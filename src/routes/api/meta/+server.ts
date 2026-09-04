import { json } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/categories';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/** GET /api/meta — kategori usaha, cakupan data, dan provenans. */
export const GET: RequestHandler = () => {
	const catchments = loadHexes();
	const terdata = catchments.filter((c) => !c.nodata);
	return json({
		categories: CATEGORIES,
		coverage: {
			total: catchments.length,
			terdata: terdata.length,
			belumTerdata: catchments.length - terdata.length,
			titikMisi: terdata.reduce((a, c) => a + c.nStruk + c.nMenu + c.nProp, 0)
		},
		provenance
	});
};
