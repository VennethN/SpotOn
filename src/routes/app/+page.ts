import type { HexBase } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * The catchment indicators are fetched through the API endpoint rather than
 * imported directly, so the data path is exactly the same once the source is
 * swapped for the MAPID API.
 *
 * Only the base grid is loaded here — geometry and the per-cell figures every
 * category shares. The per-category columns come later, one category at a time,
 * through `AppState.loadCategory`. This load blocks the first paint, so what it
 * carries has to be what the first paint genuinely needs; a category the user has
 * not chosen yet is not that.
 */
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/catchments');
	if (!res.ok) throw new Error('Failed to load catchment data.');
	const data: { catchments: HexBase[] } = await res.json();
	return { catchments: data.catchments };
};
