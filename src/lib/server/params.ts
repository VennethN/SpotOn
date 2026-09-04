import { isCategory } from '$lib/categories';
import { DEFAULT_WEIGHTS } from '$lib/scoring';
import type { CategoryKey, Weights } from '$lib/types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Membaca bobot & gerbang dari query string, dengan nilai bawaan yang aman. */
export function readWeights(url: URL): Weights {
	const num = (key: string, fallback: number) => {
		const raw = url.searchParams.get(key);
		const v = raw === null ? NaN : Number(raw);
		return Number.isFinite(v) ? v : fallback;
	};
	const radius = num('radius', DEFAULT_WEIGHTS.radius);
	return {
		wd: clamp01(num('wd', DEFAULT_WEIGHTS.wd)),
		ws: clamp01(num('ws', DEFAULT_WEIGHTS.ws)),
		gate: (url.searchParams.get('gate') ?? '1') !== '0',
		// Hanya dua radius berjalan kaki yang didukung mesin skor.
		radius: radius === 400 ? 400 : 800
	};
}

export function readCategory(url: URL, fallback: CategoryKey = 'kopi'): CategoryKey {
	const raw = url.searchParams.get('kategori') ?? url.searchParams.get('cat');
	return isCategory(raw) ? raw : fallback;
}
