import { DEFAULT_CATEGORY } from '$lib/domain/weights';
import type { CategorySlice, GridMeta, HexBase } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * The catchment indicators are fetched through the API endpoint rather than
 * imported directly, so the data path is exactly the same once the source is
 * swapped for the MAPID API.
 *
 * Two requests, in parallel, and only two:
 *
 *   the base grid          — geometry and the per-cell figures every category shares
 *   the opening category   — the six columns the heatmap needs to colour anything
 *
 * The other twelve categories are NOT fetched here. They are two thirds of the
 * grid's weight, the map only ever draws one at a time, and `AppState.loadCategory`
 * picks each one up when it is actually asked for. This is the whole point of
 * splitting the payload: what blocks the first paint has to be what the first paint
 * genuinely needs.
 *
 * The opening category is in that set because the heatmap is on from the start.
 * Fetched after mount instead, it would cost a second round trip and show a grey
 * grid until it landed.
 */
export const load: PageLoad = async ({ fetch }) => {
	const [baseRes, sliceRes] = await Promise.all([
		fetch('/api/catchments'),
		fetch(`/api/catchments/${DEFAULT_CATEGORY}`)
	]);
	if (!baseRes.ok) throw new Error('Failed to load catchment data.');

	const base: { catchments: HexBase[]; meta: GridMeta } = await baseRes.json();
	// A category that fails to load is not fatal: the grid still draws, and the
	// legend offers the heatmap again rather than the page refusing to open.
	const slice: CategorySlice | undefined = sliceRes.ok ? await sliceRes.json() : undefined;

	return { catchments: base.catchments, slice, meta: base.meta };
};
