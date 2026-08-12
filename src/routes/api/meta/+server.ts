import { json } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/domain/categories';
import { activeModel, llmEnabled } from '$lib/server/llm';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/** GET /api/meta — business categories, data coverage, provenance, and the language layer. */
export const GET: RequestHandler = () => {
	const catchments = loadHexes();
	const withData = catchments.filter((c) => !c.nodata);
	return json({
		categories: CATEGORIES,
		coverage: {
			total: catchments.length,
			withData: withData.length,
			withoutData: catchments.length - withData.length,
			missionPoints: withData.reduce((a, c) => a + c.nStruk + c.nMenu + c.nProp, 0)
		},
		// The model name is stated plainly — it is not a secret, and without it there is
		// no way to check that the OPENROUTER_MODEL configured is the one actually used.
		// The key itself is never included, only whether one exists.
		llm: {
			model: activeModel(),
			enabled: llmEnabled(),
			note: llmEnabled()
				? 'Model hanya memilih operasi dan mengisi argumen; seluruh angka dihitung mesin skor.'
				: 'OPENROUTER_API_KEY belum dipasang — pertanyaan diurai pengurai aturan cadangan.'
		},
		provenance
	});
};
