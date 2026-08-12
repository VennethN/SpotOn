import { error, json } from '@sveltejs/kit';
import { isCategory } from '$lib/domain/categories';
import { answer, parseQuestion, runQuery } from '$lib/domain/nlq';
import { normalizeWeights } from '$lib/domain/weights';
import { parseWithLLM } from '$lib/server/llm';
import { loadHexes } from '$lib/server/source';
import type { AiAnswer, CategoryKey, Weights } from '$lib/types';
import type { RequestHandler } from './$types';

interface Body {
	question?: string;
	kategori?: string;
	weights?: Partial<Weights>;
	/** The reader's language; only affects the model's "I don't understand" sentence. */
	lang?: string;
}

/**
 * POST /api/ai/query — the recommendation engine behind the interface.
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
 */
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

	const fallback: CategoryKey = isCategory(body.kategori) ? body.kategori : 'kopi';
	const weights: Weights = normalizeWeights(body.weights);

	const catchments = loadHexes();
	const parsed = await parseWithLLM(question, weights, fallback, body.lang === 'en' ? 'en' : 'id');

	// The model admits it did not understand. That is a legitimate result, not a
	// failure — and far better than answering a misinterpreted question.
	if (parsed && !parsed.ok) {
		const empty: AiAnswer = {
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
		return json(empty);
	}

	const result: AiAnswer = parsed
		? { ...runQuery(parsed.query, question, catchments, weights), parsedBy: 'model' }
		: { ...answer(question, catchments, weights, fallback), parsedBy: 'rules' };

	return json(result);
};
