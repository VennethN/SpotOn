import type { Weights } from '$lib/types';

/**
 * Bobot & gerbang: nilai bawaan dan satu-satunya tempat nilainya dibersihkan.
 *
 * Dulu ada dua penjaga yang berdiri sendiri — satu membaca query string, satu
 * membaca body JSON — dengan `clamp01` masing-masing. Dua salinan aturan yang
 * sama berarti cepat atau lambat keduanya berbeda, dan endpoint yang satu akan
 * menerima bobot yang ditolak endpoint lainnya.
 */
export const DEFAULT_WEIGHTS: Weights = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'osm' };

const clamp01 = (v: unknown, fallback: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

/**
 * Bobot apa pun asalnya → bobot yang aman dipakai mesin skor.
 *
 * Radius sengaja hanya menerima 400 atau 800: mesin skor cuma bisa menskalakan
 * hitungan yang sudah jadi ke dua nilai itu. Angka lain akan menghasilkan
 * bilangan yang tampak masuk akal padahal tidak berdasar.
 */
export function normalizeWeights(partial: Partial<Weights> | undefined): Weights {
	const p = partial ?? {};
	return {
		wd: clamp01(p.wd, DEFAULT_WEIGHTS.wd),
		ws: clamp01(p.ws, DEFAULT_WEIGHTS.ws),
		gate: typeof p.gate === 'boolean' ? p.gate : DEFAULT_WEIGHTS.gate,
		radius: p.radius === 400 ? 400 : 800,
		source: p.source === 'mapid' ? 'mapid' : 'osm'
	};
}
