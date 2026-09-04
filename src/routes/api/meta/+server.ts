import { json } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/domain/categories';
import { activeModel, llmEnabled } from '$lib/server/llm';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/** GET /api/meta — kategori usaha, cakupan data, provenans, dan lapisan bahasa. */
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
		// Nama model disebut apa adanya — bukan rahasia, dan tanpa ini tidak ada cara
		// memeriksa bahwa OPENROUTER_MODEL yang dipasang benar-benar yang dipakai.
		// Kuncinya sendiri tidak pernah ikut, hanya ada/tidaknya.
		llm: {
			model: activeModel(),
			aktif: llmEnabled(),
			catatan: llmEnabled()
				? 'Model hanya memilih operasi dan mengisi argumen; seluruh angka dihitung mesin skor.'
				: 'OPENROUTER_API_KEY belum dipasang — pertanyaan diurai pengurai aturan cadangan.'
		},
		provenance
	});
};
