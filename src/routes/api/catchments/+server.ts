import { json } from '@sveltejs/kit';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/**
 * GET /api/catchments
 * Indikator mentah per catchment stasiun — bentuk yang nantinya dikembalikan
 * backend MAPID setelah spatial join. Skoring tidak dilakukan di sini karena
 * bobotnya diatur pengguna secara langsung di antarmuka.
 */
export const GET: RequestHandler = () => {
	const catchments = loadHexes();
	return json(
		{
			catchments,
			provenance,
			counts: {
				total: catchments.length,
				terdata: catchments.filter((c) => !c.nodata).length,
				titikMisi: catchments.reduce((a, c) => a + c.nStruk + c.nMenu + c.nProp, 0)
			}
		},
		{ headers: { 'cache-control': 'public, max-age=60, s-maxage=3600' } }
	);
};
