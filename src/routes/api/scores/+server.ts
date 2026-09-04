import { json } from '@sveltejs/kit';
import { CATEGORY_MAP } from '$lib/categories';
import { scoreAll } from '$lib/scoring';
import { readCategory, readWeights } from '$lib/server/params';
import { loadHexes } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/scores?kategori=kopi&wd=0.5&ws=0.5&gate=1&radius=800
 * Opportunity Score terhitung per catchment. Antarmuka menghitung ulang secara
 * lokal saat slider digeser agar umpan baliknya seketika; endpoint ini adalah
 * kontrak yang sama untuk konsumen lain (ekspor, pengujian, integrasi).
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
