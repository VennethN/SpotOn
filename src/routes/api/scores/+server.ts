import { json } from '@sveltejs/kit';
import { CATEGORY_MAP } from '$lib/domain/categories';
import { scoreAll } from '$lib/domain/scoring';
import { readCategory, readWeights } from '$lib/server/params';
import { loadHexes } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/scores?kategori=kopi&wd=0.5&ws=0.5&gate=1&radius=800
 * The computed Opportunity Score per catchment. The interface recomputes locally as
 * the sliders move so the feedback is instant; this endpoint is the same contract
 * for every other consumer (export, testing, integration).
 */
export const GET: RequestHandler = ({ url }) => {
	const kategori = readCategory(url);
	const weights = readWeights(url);
	const rows = scoreAll(loadHexes(), kategori, weights);

	return json({
		kategori,
		definisi: CATEGORY_MAP[kategori],
		weights,
		rows: [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
	});
};
