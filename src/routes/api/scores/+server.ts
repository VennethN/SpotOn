import { json } from '@sveltejs/kit';
import { CATEGORY_MAP } from '$lib/domain/categories';
import { scoreAll } from '$lib/domain/scoring';
import { readCategories, readWeights } from '$lib/server/params';
import { loadHexes } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/scores?kategori=kopi&wd=0.5&ws=0.5&gate=1&radius=800
 *
 * The computed Opportunity Score per catchment. The interface recomputes locally as
 * the sliders move so the feedback is instant; this endpoint is the same contract
 * for every other consumer (export, testing, integration).
 *
 * `kategori` takes more than one business type, comma-separated — `kategori=kopi,roti`
 * scores the two as one set: their outlets counted together as rivals, and both taken
 * out of the trade around each cell. One name behaves exactly as it always did.
 */
export const GET: RequestHandler = ({ url }) => {
	const categories = readCategories(url);
	const weights = readWeights(url);
	const rows = scoreAll(loadHexes(), categories, weights);

	return json({
		kategori: categories,
		definition: categories.map((k) => CATEGORY_MAP[k]),
		weights,
		rows: [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
	});
};
