import { json } from '@sveltejs/kit';
import { loadBase, provenance } from '$lib/server/source';
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
			counts: {
				total: catchments.length,
				withData: catchments.filter((c) => !c.nodata).length,
				titikMisi: catchments.reduce((a, c) => a + c.nStruk + c.nMenu + c.nProp, 0)
			}
		},
		{ headers: { 'cache-control': 'public, max-age=60, s-maxage=3600' } }
	);
};
