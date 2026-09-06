import { json } from '@sveltejs/kit';
import { grid, loadBase, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/catchments
 * Raw indicators per station catchment — the shape the MAPID backend will
 * eventually return after its spatial join. Scoring does not happen here, because
 * its weights are set by the user directly in the interface.
 *
 * WHAT THIS RESPONSE DELIBERATELY LEAVES OUT
 *
 * The six per-category columns (`osm`, `mapid`, `covered`, `busy`, `listing`, `d`)
 * are served by `/api/catchments/[kategori]` instead, one category at a time. They
 * were two thirds of this payload and they grow with every category added — going
 * from nine to thirteen put on 63 KB that nobody had asked to see, because the map
 * only ever draws ONE category. So the page starts with the geometry and the
 * per-cell figures every category shares, and picks up a category's columns when
 * that category is actually asked for.
 *
 * `city` is dropped as well: it is how `join-mapid.mjs` decides coverage, and the
 * interface never reads it.
 */
export const GET: RequestHandler = () => {
	const catchments = loadBase();
	return json(
		{
			catchments: catchments.map(({ city: _city, ...rest }) => rest),
			provenance,
			/* What the grid knows about itself: how many transit nodes it captured, how
			   many competitor POIs were counted, and from which sources. A few hundred
			   bytes, and it is what lets the interface state the size of the evidence
			   from the data rather than from a sentence somebody typed once. */
			meta: grid,
			counts: {
				total: catchments.length,
				/* Cells whose city the MAPID catalogue has actually been read for. The
				   density column is null exactly there, which is why it is what gets
				   counted rather than a flag stored beside it. */
				disurvei: catchments.filter((c) => c.dens.mapid !== null).length
			}
		},
		{ headers: { 'cache-control': 'public, max-age=60, s-maxage=3600' } }
	);
};
