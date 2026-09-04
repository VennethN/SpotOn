import { error, json } from '@sveltejs/kit';
import { resolveQuestion, type AskInput } from '$lib/server/answer';
import { spendMeter } from '$lib/server/accounts';
import type { AiEvent, ChatTurn } from '$lib/types';
import type { RequestHandler } from './$types';

/** The media type one answer-per-line is served as. */
const NDJSON = 'application/x-ndjson';

/**
 * POST /api/ai/query — ask the recommendation engine.
 *
 * Answers in one of two ways, and the difference is transport only. Both run the same
 * `resolveQuestion`, so there is no branch in which the two could come to disagree
 * about what the answer is:
 *
 * - **One JSON object**, the way this endpoint has always replied. Anything reading it
 *   as an API gets exactly what it got before.
 * - **A stream of NDJSON lines**, one `AiEvent` each, ending in the `answer` event that
 *   carries the very same object. Asked for with `stream: true` in the body, or by an
 *   `Accept` header naming `application/x-ndjson`.
 *
 * NDJSON rather than server-sent events: this is a POST, so `EventSource` was never on
 * the table, and a line of JSON per line of output needs no framing rules to explain.
 *
 * IT NOW COSTS ONE CREDIT, and needs an account. That is the one thing about this
 * endpoint that did change: understanding a question means a call out to a shared
 * model, which is the expensive half of the product, so it is the half that is metered.
 * The credit is spent here rather than trusted to the caller, and the reply says so with
 * a status rather than in the answer object: a 401 with no session, a 402 with nothing
 * left. The shape of an ANSWER is untouched, so anything already reading this as an API
 * needs a cookie and nothing else.
 */
interface Body extends Partial<AskInput> {
	/** Reply as a stream of events instead of as one object. */
	stream?: boolean;
}

/**
 * How much of the conversation is carried, and how much of each turn.
 *
 * A thread has no natural end, and the whole of one goes out to a shared free model on
 * every question: left uncapped, a long afternoon of asking becomes a request that is
 * slower and more likely to be refused with every turn, for context nobody is still
 * pointing at. Twelve turns is roughly the last six exchanges, which is further back
 * than "that one" ever reaches.
 */
const HISTORY_TURNS = 12;
const HISTORY_CHARS = 500;
const HISTORY_PLACES = 8;

/**
 * The thread, read the way any other body field is read: as something a caller sent,
 * not as something this server said.
 *
 * It LOOKS like our own output coming back, which is exactly why it is checked. Anything
 * can post to this endpoint, so every turn is trimmed to the same length one question is
 * allowed, the roles are read as a closed pair, and anything that is not a string is
 * dropped. Nothing here is trusted for being familiar.
 */
function readHistory(raw: unknown): ChatTurn[] {
	if (!Array.isArray(raw)) return [];
	const out: ChatTurn[] = [];
	for (const item of raw.slice(-HISTORY_TURNS)) {
		const turn = item as Partial<ChatTurn>;
		const who = turn?.who === 'user' ? 'user' : turn?.who === 'tapak' ? 'tapak' : null;
		if (!who) continue;
		const text = typeof turn.text === 'string' ? turn.text.trim().slice(0, HISTORY_CHARS) : '';
		const places = Array.isArray(turn.places)
			? turn.places
					.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
					.map((p) => p.trim().slice(0, 80))
					.slice(0, HISTORY_PLACES)
			: [];
		if (!text && !places.length) continue;
		out.push(places.length ? { who, text, places } : { who, text });
	}
	return out;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	let body: Body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body harus berupa JSON.');
	}

	const question = (body.question ?? '').trim();
	if (!question) throw error(400, 'Pertanyaan kosong.');
	if (question.length > 500) throw error(413, 'Pertanyaan terlalu panjang.');

	/* One question, one credit, and it is spent HERE rather than in the browser.
	   A balance the browser is trusted to keep is a balance anybody can top up with a
	   developer console, so the reading in the interface is a copy of this figure and
	   never the figure itself.

	   Spent BEFORE the model is called, not after it answers. The cost this meter is
	   about is the call itself: a question that goes out to a shared model and comes
	   back empty was still asked, and charging only for the answers would let a
	   question be re-asked for nothing until one came back.

	   The two checks are one line apart on purpose. Refusing a question this account
	   cannot pay for has to happen before anything is understood, or the wait streams
	   for ninety seconds and ends in a refusal that was knowable at the start. */
	if (!locals.account) throw error(401, 'Masuk dulu untuk bertanya.');
	const paid = await spendMeter(locals.account.id, 'ai');
	if (!paid.ok) {
		if (paid.reason === 'empty') throw error(402, 'Kuota pertanyaan minggu ini sudah habis.');
		throw error(503, 'Kuota tidak bisa dibaca. Coba lagi sebentar lagi.');
	}

	const input: AskInput = {
		question,
		kategori: body.kategori,
		weights: body.weights,
		lang: body.lang,
		history: readHistory(body.history)
	};

	if (body.stream !== true && !(request.headers.get('accept') ?? '').includes(NDJSON)) {
		return json(await resolveQuestion(input));
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			/* Closed the moment the reader goes away, and every write after that is
			   dropped rather than thrown. A reader who asks a question and then closes
			   the tab is not an error to report, and an unhandled throw inside this
			   callback takes the whole response down with it. */
			let open = true;
			const send = (event: AiEvent) => {
				if (!open) return;
				try {
					controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				} catch {
					open = false;
				}
			};

			try {
				send({ kind: 'answer', answer: await resolveQuestion(input, send) });
			} catch (err) {
				/* The status line went out with the first byte, so a failure here cannot
				   become a 500 any more. Saying so in the stream is the honest remaining
				   option: the interface reads this and says the question could not be
				   answered, rather than waiting on a reply that is never coming. */
				console.error('[SpotOn] Streamed answer failed:', (err as Error).message);
				send({ kind: 'error', message: 'Pertanyaan tidak bisa diproses.' });
			} finally {
				open = false;
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': `${NDJSON}; charset=utf-8`,
			'cache-control': 'no-store',
			// Tells nginx and friends not to sit on the body until it is complete, which
			// would turn every one of these events into one delivery at the very end and
			// leave the streaming doing nothing at all.
			'x-accel-buffering': 'no'
		}
	});
};
