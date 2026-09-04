import { normalizeCategories } from '$lib/domain/categories';
import { ruleChatTopic } from '$lib/domain/chat';
import { answer, parseQuestion, runQuery } from '$lib/domain/nlq';
import { normalizeWeights } from '$lib/domain/weights';
import { llmEnabled, parseWithLLM } from '$lib/server/llm';
import { writeReply } from '$lib/server/reply';
import { loadHexes } from '$lib/server/source';
import type { AiAnswer, AiEvent, CategoryKey, ChatTopic, ChatTurn, Weights } from '$lib/types';

/**
 * One question, answered, with the working shown as it happens.
 *
 * WHY THIS IS NOT IN THE ROUTE ANY MORE
 *
 * There are two ways to ask: one HTTP request that comes back with the whole answer,
 * and one that streams. They must not be two implementations of answering a question,
 * or the day somebody fixes a branch here the other reply keeps the bug. So there is
 * one function, it reports what it is doing through `emit`, and the two routes differ
 * only in what they do with those reports: the streaming one writes each out as a line,
 * the plain one throws them away and returns the result.
 *
 * WHAT IS ACTUALLY STREAMED, AND WHAT IS NOT
 *
 * Not the figures. Not one of them. The scoring engine runs on the grid in one go and
 * either has an answer or does not, and a number arriving a digit at a time would be a
 * dramatisation of work that already finished.
 *
 * What streams is the wait itself. Understanding the question means a call out to a
 * shared free model, and that is where the seconds go — up to ninety of them before the
 * chain gives up and the rule parser takes over. A reader watching one motionless line
 * for that long has no way to tell a slow answer from a broken one. So the stages are
 * said out loud, and the casual reply, which is the one sentence written with nothing
 * computed behind it, is passed on as it is written. The ANSWER's own sentence is not:
 * it is made of figures, and no figure is ever streamed.
 *
 * The stages are reported from where the work actually is, not on a timer. `reading` is
 * the question going out. `retrying` is one model dropping out and the next taking over,
 * which is where the longest silences live. `choosing` is the model naming its operation
 * and writing the arguments, which is the first proof it woke up at all. `computing` is
 * the scoring engine on the grid. None of them is a fraction of anything, because none
 * of them could honestly be one.
 */

/**
 * A casual turn, in the shape every other answer has.
 *
 * Deliberately carries no items and no highlight: nothing was computed, so nothing may
 * appear on the map. A chat reply that moved the map would be the map claiming to have
 * answered a question it never received.
 *
 * `query` is still filled in, because the response shape is a published contract and a
 * consumer reading `query.kategori` should not have to special-case this. It describes
 * what WOULD have been asked, and `chat` is what tells a reader it was not.
 */
function chatAnswer(
	topik: ChatTopic,
	text: string | undefined,
	question: string,
	weights: Weights,
	fallback: readonly CategoryKey[],
	parsedBy: 'model' | 'rules',
	said: readonly string[]
): AiAnswer {
	return {
		query: parseQuestion(question, weights, fallback, said),
		parsedBy,
		chat: text ? { topik, text } : { topik },
		// The headline is what an API consumer reads. Empty would make this turn look
		// like a failed query rather than a deliberate non-answer.
		headline: text ?? 'Obrolan biasa, bukan pertanyaan data. Tidak ada angka yang dihitung.',
		items: [],
		highlight: [],
		provenance: [
			'Giliran ini tidak menyentuh data: tidak ada operasi yang dijalankan dan tidak ada angka yang dihitung.',
			'Balasan obrolan tidak boleh memuat angka. Yang memuat angka dibuang mesin dan diganti kalimat baku — lihat `domain/chat`.'
		]
	};
}

export interface AskInput {
	question: string;
	/** The business types the reader has in force — one name, or a list of them. */
	kategori?: string | string[];
	weights?: Partial<Weights>;
	/** The reader's language; only affects the model's "I don't understand" sentence. */
	lang?: string;
	/**
	 * The turns before this one, oldest first.
	 *
	 * Optional, and everything works without it exactly as it did before it existed:
	 * a question with no thread behind it is a first question. What it buys is the whole
	 * difference between a form and a conversation, because a follow-up does not carry
	 * its own subject and used to be parsed as though it did.
	 */
	history?: ChatTurn[];
}

/**
 * The catchments the conversation has named, newest first and without repeats.
 *
 * This is the only thing the ENGINE is told about the thread, as opposed to the model,
 * and it is deliberately just a list of names. It settles what "that one" refers to when
 * a question points instead of naming, which is the one thing the scoring engine cannot
 * work out for itself: it knows the whole grid and has no idea which of it was on screen
 * a moment ago.
 */
function spokenPlaces(history: readonly ChatTurn[] | undefined): string[] {
	const out: string[] = [];
	for (let i = (history?.length ?? 0) - 1; i >= 0; i--) {
		for (const place of history![i].places ?? []) {
			if (typeof place === 'string' && place && !out.includes(place)) out.push(place);
		}
	}
	return out;
}

/**
 * The recommendation engine behind the interface.
 *
 * Two layers, and the split between them is what matters:
 *
 * - **Understanding** the question is done by the model (OpenRouter,
 *   function-calling). The model only picks the operation and fills its arguments.
 * - **Computing** is done by the scoring engine on the server, from the data. The
 *   model never touches a single number, so there is no value it could invent.
 *
 * If the model is unavailable — no key configured, network down, time up — the
 * rule-based parser takes over and an answer still comes out. What changes is only
 * how cleverly the question was understood, not whether the figures are right.
 * Which path was taken is sent along as `parsedBy`, so the interface can be honest
 * about it instead of glossing over it.
 *
 * `emit` is told which stage is running and, for a casual turn, what the model is
 * writing. It is never told a figure, because by the time any figure exists the answer
 * is finished and the whole object goes at once. Left off entirely when nobody is
 * listening, which is also what keeps the one-piece reply making the upstream request it
 * has always made.
 */
export async function resolveQuestion(
	input: AskInput,
	emit?: (event: AiEvent) => void
): Promise<AiAnswer> {
	const question = input.question;

	/* What the question is answered ABOUT when it does not name a business type itself:
	   whatever the reader already had in force, and NOTHING if they had nothing.

	   This used to fall back to coffee, and that was the last place the old default was
	   hiding. A reader who has named no business and asks "where is busiest" is asking
	   about the city, not about coffee — and one who asks "where should I open" is
	   asking a question that is one word short, which `runQuery` answers by asking for
	   the word rather than by choosing a business on their behalf. */
	const fallback: CategoryKey[] = normalizeCategories(input.kategori, []);
	const weights: Weights = normalizeWeights(input.weights);

	const catchments = loadHexes();
	/* What the conversation has already named. The model gets the whole thread; the
	   engine gets only this, because the only thing it cannot work out for itself is
	   which of the 562 catchments were on screen a moment ago. */
	const said = spokenPlaces(input.history);

	emit?.({ kind: 'stage', stage: 'reading' });
	/* No sink when nobody is listening, and that is not just tidiness. A sink is what
	   makes the model layer ask OpenRouter for a STREAMED completion, and models do not
	   all behave identically with `stream: true` alongside tools. The one-piece JSON
	   reply has no use for fragments, so it keeps making the request it always made. */
	const parsed = await parseWithLLM(
		question,
		weights,
		fallback,
		input.lang === 'en' ? 'en' : 'id',
		emit && {
			delta: (text) => emit({ kind: 'delta', text }),
			reset: () => emit({ kind: 'reset' }),
			/* Only for `jalankan_query`, and that is the point rather than an oversight.
			   `ngobrol` is already answering in the reader's own bubble, a word at a
			   time, so a line saying it is working would be talking over it. And
			   `tidak_dimengerti` writes one short sentence, which lands before a stage
			   line would have finished appearing. */
			chose: (tool) => {
				if (tool === 'jalankan_query') emit({ kind: 'stage', stage: 'choosing' });
			},
			retrying: () => emit({ kind: 'stage', stage: 'retrying' })
		},
		input.history ?? []
	);

	// A greeting, a question about SpotOn itself, or general talk about running a small
	// business. No operation runs and nothing is computed, which is exactly right: there
	// was no question about the data to compute an answer to.
	if (parsed && !parsed.ok && 'chat' in parsed) {
		return chatAnswer(
			parsed.chat,
			parsed.text ?? undefined,
			question,
			weights,
			fallback,
			'model',
			said
		);
	}

	// The model admits it did not understand. That is a legitimate result, not a
	// failure — and far better than answering a misinterpreted question.
	if (parsed && !parsed.ok) {
		return {
			query: parseQuestion(question, weights, fallback, said),
			parsedBy: 'model',
			notUnderstood: parsed.reason,
			headline: parsed.reason,
			items: [],
			highlight: [],
			provenance: [
				'Pertanyaan tidak dipetakan ke operasi mana pun, jadi tidak ada angka yang dihitung.'
			]
		};
	}

	// No model, and the question is plainly a greeting. Recognised by rule, answered
	// with the interface's own canned line rather than a refusal — see `domain/chat`
	// for why only the narrow half of chat is reachable without a model.
	if (!parsed) {
		const topic = ruleChatTopic(question);
		if (topic) return chatAnswer(topic, undefined, question, weights, fallback, 'rules', said);
	}

	// Said before the engine runs rather than after, which is the only way round that
	// means anything: a stage announced once its work is done is a caption, not a state.
	emit?.({ kind: 'stage', stage: 'computing' });

	/* A shape that is ABOUT a named place, asked without naming one. "Kenapa yang itu"
	   and "bandingkan dua teratas" are ordinary things to say and neither carries a name,
	   so a model that reads the intent correctly and leaves `target` empty is not wrong,
	   it is pointing. The conversation is what it points at, and this is the one place
	   that knows what the conversation said.

	   Filled in only when the model left it empty. A name the model DID write is the one
	   it meant, even when it is not the newest thing on screen. */
	if (parsed?.ok && !parsed.query.target?.length && said.length) {
		if (parsed.query.intent === 'EXPLAIN') parsed.query.target = said.slice(0, 1);
		if (parsed.query.intent === 'COMPARE') parsed.query.target = said.slice(0, 2);
	}

	const computed: AiAnswer = parsed
		? { ...runQuery(parsed.query, question, catchments, weights), parsedBy: 'model' }
		: { ...answer(question, catchments, weights, fallback, said), parsedBy: 'rules' };

	/* THE ANSWER IS COMPUTED. NOW IT GETS SAID.
	   
	   Every figure above is already fixed, and this pass cannot change one: it is handed
	   them and may write those and no others, which `domain/grounded` checks rather than
	   requests. What it buys is that the reply answers the question that was asked. Before
	   it, an operation ran and a template read the result out, so "kenapa yang itu" and
	   "menurutmu sewa di sana bagus" resolved to the same operation on the same place and
	   came back as the same paragraph, twice, word for word.

	   Best effort throughout. No model, no time, or a reply that broke the fence, and the
	   answer travels without one, exactly as it always did. The interface composes its own
	   sentence from these same figures, so the fallback is a plainer answer and never a
	   missing one. */
	/* Nothing to announce and nothing to wait for when there is no model. Said before the
	   call rather than inside it, so a reader running this from a bare clone does not
	   watch a stage appear for the length of one tick and vanish. */
	if (!llmEnabled()) return computed;

	emit?.({ kind: 'stage', stage: 'writing' });
	const written = await writeReply(
		computed,
		question,
		input.history ?? [],
		// Every name on the grid, so a reply can be checked for naming a place this answer
		// never named. A right figure against a wrong place is the one error a reader
		// cannot catch, because the number checks out.
		catchments.map((c) => c.name).filter((n): n is string => Boolean(n)),
		input.lang === 'en' ? 'en' : 'id'
	);
	if (!written) return computed;

	/* Written, and refused. The composed sentence stands in exactly as it does when nothing
	   came back, and the difference is said in the provenance, because from the reader's
	   side a model that is away and a model whose every reply is being thrown away look the
	   same, and only one of them is a bug. */
	if (!written.text) {
		return {
			...computed,
			provenance: [
				...computed.provenance,
				`Model sempat menulis kalimat jawabannya, tapi kalimat itu dibuang mesin dan diganti kalimat baku karena ${written.fault}. Lihat \`domain/grounded\`.`
			]
		};
	}

	return {
		...computed,
		reply: written.text,
		provenance: [
			...computed.provenance,
			'Kalimat jawabannya ditulis model dari angka yang sudah dihitung di atas. Tiap angka di dalamnya dicocokkan kembali ke angka-angka itu, dan yang memuat angka di luarnya dibuang mesin, bukan diperbaiki — lihat `domain/grounded`.'
		]
	};
}
