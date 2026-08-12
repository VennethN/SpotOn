import { error, json } from '@sveltejs/kit';
import { isCategory } from '$lib/domain/categories';
import { loadCategorySlice } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/catchments/[kategori]
 * One category's competitor, demand and space columns for the whole grid — the half
 * of the catchment data that only matters once a category has been chosen.
 *
 * The arrays line up BY INDEX with `/api/catchments`, which is why `n` is sent: the
 * client checks it against the base length and refuses the slice if they disagree.
 * A mismatched slice would attach every figure to the wrong cell and produce a map
 * that looks entirely normal while being wrong in every cell.
 *
 * Cached hard: a slice only changes when the grid is rebuilt, and by then the whole
 * deployment has changed with it.
 */
export const GET: RequestHandler = ({ params }) => {
	const cat = params.kategori;
	// Named explicitly rather than 404'ing on a bad key: a typo'd category is a
	// programming mistake worth reading, not a missing page.
	if (!isCategory(cat)) throw error(400, `Kategori tidak dikenal: ${cat}`);

	return json(loadCategorySlice(cat), {
		headers: { 'cache-control': 'public, max-age=300, s-maxage=86400' }
	});
};
