import { json } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/domain/categories';
import { activeModel, activeModels, llmEnabled } from '$lib/server/llm';
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
		// The model names are stated plainly — they are not a secret, and without them
		// there is no way to check that the OPENROUTER_MODEL configured is the one
		// actually used. `model` is the one tried first, `models` the whole chain behind
		// it, because a comma-separated OPENROUTER_MODEL names fallbacks too and a single
		// name here would hide them. The key itself is never included, only whether one
		// exists.
		llm: {
			model: activeModel(),
			models: activeModels(),
			enabled: llmEnabled(),
			note: llmEnabled()
				? 'Model cuma memilih operasi dan mengisi argumen, dan seluruh angka dihitung mesin skor.'
				: 'OPENROUTER_API_KEY belum dipasang, jadi pertanyaan diurai pengurai aturan cadangan.'
		},
		provenance
	});
};
