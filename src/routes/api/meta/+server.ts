import { json } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/domain/categories';
import { activeModel, llmEnabled } from '$lib/server/llm';
import { loadHexes, provenance } from '$lib/server/source';
import type { RequestHandler } from './$types';

/** GET /api/meta — business categories, data coverage, provenance, and the language layer. */
export const GET: RequestHandler = () => {
	const catchments = loadHexes();
	const surveyed = catchments.filter((c) => c.dens.mapid !== null);
	return json({
		categories: CATEGORIES,
		coverage: {
			total: catchments.length,
			/* Coverage is read off the data itself: the MAPID density is null exactly for
			   the cells whose city was never surveyed. What stood here before counted a
			   flag that a random number generator had set at build time. */
			disurvei: surveyed.length,
			belumDisurvei: catchments.length - surveyed.length
		},
		// The model name is stated plainly — it is not a secret, and without it there is
		// no way to check that the OPENROUTER_MODEL configured is the one actually used.
		// The key itself is never included, only whether one exists.
		llm: {
			model: activeModel(),
			enabled: llmEnabled(),
			note: llmEnabled()
				? 'Model cuma memilih operasi dan mengisi argumen, dan seluruh angka dihitung mesin skor.'
				: 'OPENROUTER_API_KEY belum dipasang, jadi pertanyaan diurai pengurai aturan cadangan.'
		},
		provenance
	});
};
