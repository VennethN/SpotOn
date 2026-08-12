import { isCategory } from '$lib/domain/categories';
import { DEFAULT_WEIGHTS, normalizeWeights } from '$lib/domain/weights';
import type { CategoryKey, Weights } from '$lib/types';

/**
 * Query string → scoring-engine arguments.
 *
 * Only reads and reshapes; value sanitising has a single entry point in
 * `domain/weights`, the same one used by endpoints that take a JSON body.
 */
export function readWeights(url: URL): Weights {
	const num = (key: string, fallback: number) => {
		const raw = url.searchParams.get(key);
		const v = raw === null ? NaN : Number(raw);
		return Number.isFinite(v) ? v : fallback;
	};
	return normalizeWeights({
		wd: num('wd', DEFAULT_WEIGHTS.wd),
		ws: num('ws', DEFAULT_WEIGHTS.ws),
		gate: (url.searchParams.get('gate') ?? '1') !== '0',
		radius: num('radius', DEFAULT_WEIGHTS.radius),
		// Without this line the endpoint always scores with OSM whatever ?source=
		// is sent — and the result still looks plausible, so nothing signals that
		// the switch is doing nothing.
		source: url.searchParams.get('source') === 'mapid' ? 'mapid' : 'osm'
	});
}

export function readCategory(url: URL, fallback: CategoryKey = 'kopi'): CategoryKey {
	const raw = url.searchParams.get('kategori') ?? url.searchParams.get('cat');
	return isCategory(raw) ? raw : fallback;
}
