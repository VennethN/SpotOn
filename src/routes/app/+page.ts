import type { GridMeta, HexBase } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * The catchment indicators are fetched through the API endpoint rather than
 * imported directly, so the data path is exactly the same once the source is
 * swapped for the MAPID API.
 *
 * ONE REQUEST, and only one: the base grid, which is the geometry plus the per-cell
 * figures every category shares.
 *
 * There used to be a second, for the business type the map opened on. That type has
 * gone — the map no longer opens on one, because handing a reader a map coloured for
 * coffee before they have said a word about coffee is a claim nobody asked for. What
 * the opening map paints is the trade standing around each cell, and that column
 * rides in the base payload, so the first paint now needs nothing else.
 *
 * The per-category columns are two thirds of the grid's weight and the map only ever
 * scores the types somebody asked about, so `AppState.loadCategories` picks them up
 * when a question names them. This is the whole point of splitting the payload: what
 * blocks the first paint has to be what the first paint genuinely needs.
 */
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/catchments');
	if (!res.ok) throw new Error('Failed to load catchment data.');

	const base: { catchments: HexBase[]; meta: GridMeta } = await res.json();
	return { catchments: base.catchments, meta: base.meta };
};
