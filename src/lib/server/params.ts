import { isCategory } from '$lib/domain/categories';
import { DEFAULT_WEIGHTS, normalizeWeights } from '$lib/domain/weights';
import type { CategoryKey, Weights } from '$lib/types';

/**
 * Query string → argumen mesin skor.
 *
 * Hanya membaca dan mengubah bentuk; pembersihan nilainya satu pintu di
 * `domain/weights`, sama dengan yang dipakai endpoint yang menerima body JSON.
 */
/** `?source=` bila dikenali; `undefined` supaya `normalizeWeights` yang memutus
    bawaannya — berkas ini membaca, bukan menentukan. */
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
		// Tanpa baris ini endpoint mengabaikan `?source=` sepenuhnya — dan
		// hasilnya tetap terlihat wajar, jadi tidak ada yang menandakan bahwa
		// saklarnya tidak berfungsi.
		//
		// Bawaannya dibaca dari DEFAULT_WEIGHTS, bukan ditulis ulang di sini.
		// Sempat tertulis `: 'osm'` langsung, dan itu menjadikan berkas ini
		// penjaga kedua yang memutuskan hal yang sama dengan cara sendiri —
		// persis pola yang sudah pernah menggigit modul bobot ini. Waktu bawaan
		// dipindah ke MAPID, satu baris ini akan diam-diam mempertahankan OSM
		// untuk seluruh endpoint sementara antarmuka sudah berpindah.
		source: readSource(url)
	});
}

export function readCategory(url: URL, fallback: CategoryKey = 'kopi'): CategoryKey {
	const raw = url.searchParams.get('kategori') ?? url.searchParams.get('cat');
	return isCategory(raw) ? raw : fallback;
}
