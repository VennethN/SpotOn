import { json } from '@sveltejs/kit';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/catchments
 * Raw indicators per station catchment — the shape the MAPID backend will
 * eventually return after its spatial join. Scoring does not happen here, because
 * its weights are set by the user directly in the interface.
 */
export const GET: RequestHandler = () => {
	const catchments = loadHexes();
	return json(
		{
			catchments,
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
