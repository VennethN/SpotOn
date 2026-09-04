import { normalizeCategories } from '$lib/domain/categories';
import { ruleChatTopic } from '$lib/domain/chat';
import { answer, parseQuestion, runQuery } from '$lib/domain/nlq';
import { normalizeWeights } from '$lib/domain/weights';
import { parseWithLLM } from '$lib/server/llm';
import { loadHexes } from '$lib/server/source';
import type { AiAnswer, AiEvent, CategoryKey, ChatTopic, Weights } from '$lib/types';

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
 * said out loud, and the one sentence the model does write is passed on as it is
 * written.
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
	parsedBy: 'model' | 'rules'
): AiAnswer {
	return {
		query: parseQuestion(question, weights, fallback),
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
 * is finished and the whole object goes at once.
 */
export async function resolveQuestion(
	input: AskInput,
	emit: (event: AiEvent) => void
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

	emit({ kind: 'stage', stage: 'reading' });
	const parsed = await parseWithLLM(
		question,
		weights,
		fallback,
		input.lang === 'en' ? 'en' : 'id',
		{
			delta: (text) => emit({ kind: 'delta', text }),
			reset: () => emit({ kind: 'reset' })
		}
	);

	// A greeting, a question about SpotOn itself, or general talk about running a small
	// business. No operation runs and nothing is computed, which is exactly right: there
	// was no question about the data to compute an answer to.
	if (parsed && !parsed.ok && 'chat' in parsed) {
		return chatAnswer(parsed.chat, parsed.text ?? undefined, question, weights, fallback, 'model');
	}

	// The model admits it did not understand. That is a legitimate result, not a
	// failure — and far better than answering a misinterpreted question.
	if (parsed && !parsed.ok) {
		return {
			query: parseQuestion(question, weights, fallback),
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
		if (topic) return chatAnswer(topic, undefined, question, weights, fallback, 'rules');
	}

	// Said before the engine runs rather than after, which is the only way round that
	// means anything: a stage announced once its work is done is a caption, not a state.
	emit({ kind: 'stage', stage: 'computing' });

	return parsed
		? { ...runQuery(parsed.query, question, catchments, weights), parsedBy: 'model' }
		: { ...answer(question, catchments, weights, fallback), parsedBy: 'rules' };
}
