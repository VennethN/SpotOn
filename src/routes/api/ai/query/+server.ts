import { error, json } from '@sveltejs/kit';
import { resolveQuestion, type AskInput } from '$lib/server/answer';
import type { AiEvent } from '$lib/types';
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
 */
interface Body extends Partial<AskInput> {
	/** Reply as a stream of events instead of as one object. */
	stream?: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: Body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body harus berupa JSON.');
	}

	const question = (body.question ?? '').trim();
	if (!question) throw error(400, 'Pertanyaan kosong.');
	if (question.length > 500) throw error(413, 'Pertanyaan terlalu panjang.');

	const input: AskInput = {
		question,
		kategori: body.kategori,
		weights: body.weights,
		lang: body.lang
	};

	if (body.stream !== true && !(request.headers.get('accept') ?? '').includes(NDJSON)) {
		return json(await resolveQuestion(input, () => {}));
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
