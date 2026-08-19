import { normalizeCategories } from '$lib/domain/categories';
import { DEFAULT_WEIGHTS, normalizeWeights } from '$lib/domain/weights';
import type { CategoryKey, Weights } from '$lib/types';

/**
 * Query string → scoring-engine arguments.
 *
 * Only reads and reshapes; value sanitising has a single entry point in
 * `domain/weights`, the same one used by endpoints that take a JSON body.
 */
/** `?source=` when recognised; `undefined` so `normalizeWeights` decides the
    default — this file reads, it does not decide. */
function readSource(url: URL): Weights['source'] | undefined {
	const raw = url.searchParams.get('source');
	return raw === 'mapid' || raw === 'osm' ? raw : undefined;
}

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
		// Without this line the endpoint ignores `?source=` entirely — and the result
		// still looks plausible, so nothing signals that the switch is doing nothing.
		//
		// The default is read from DEFAULT_WEIGHTS rather than restated here. It once
		// read `: 'osm'` directly, which made this file a second guard deciding the
		// same thing its own way — exactly the pattern that has already bitten this
		// weights module. When the default moved to MAPID, this one line would have
		// quietly kept OSM for every endpoint while the interface had already moved.
		source: readSource(url)
	});
}

/**
 * `?kategori=kopi,roti` → the business types to score together.
 *
 * Comma-separated rather than a repeated parameter, so a single type is still written
 * exactly the way it always was and nothing that already calls this endpoint has to
 * change. Unknown names are dropped rather than failing the request: the honest answer
 * to `?kategori=kopi,gudeg` is the coffee half, not a 400 for a word this product does
 * not know.
 */
export function readCategories(url: URL, fallback: CategoryKey = 'kopi'): CategoryKey[] {
	const raw = url.searchParams.get('kategori') ?? url.searchParams.get('cat');
	return normalizeCategories(raw, [fallback]);
}
