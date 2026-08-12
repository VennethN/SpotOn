import type { Weights } from '$lib/types';

/**
 * Bobot & gerbang: nilai bawaan dan satu-satunya tempat nilainya dibersihkan.
 *
 * Dulu ada dua penjaga yang berdiri sendiri — satu membaca query string, satu
 * membaca body JSON — dengan `clamp01` masing-masing. Dua salinan aturan yang
 * sama berarti cepat atau lambat keduanya berbeda, dan endpoint yang satu akan
 * menerima bobot yang ditolak endpoint lainnya.
 */
/**
 * `source` bawaan MAPID, bukan OSM.
 *
 * Dulu OSM, dan alasannya masuk akal waktu itu: MAPID baru mencakup satu kota
 * untuk satu kategori, jadi memakainya sebagai bawaan berarti menyambut
 * pengguna dengan peta yang sebagian besar kosong. Alasan itu sudah habis.
 * MAPID kini menutup ketiga belas kategori di kelima kota administrasi dan
 * lebih rapat daripada OSM di semuanya — pada laundry 16×, pada kedai minuman
 * 13×.
 *
 * Yang menentukan justru arah sebaliknya. Empat kategori makanan (warteg, mie,
 * seafood, resto asing) tidak punya sumber OSM sama sekali, karena penandaan
 * `cuisine` di Jakarta terlalu jarang dan tidak mengenal warteg maupun rumah
 * makan Padang. Dengan bawaan OSM, pengguna yang memilih Warteg — jenis usaha
 * yang paling mungkin ditanyakan orang di Jakarta — akan melihat seluruh peta
 * bertanda "belum tercakup" sebelum sempat menyentuh apa pun.
 *
 * OSM tetap ada di saklar, dan tetap tidak pernah dicampur ke dalam satu skor.
 */
export const DEFAULT_WEIGHTS: Weights = {
	wd: 0.5,
	ws: 0.5,
	gate: true,
	radius: 800,
	source: 'mapid'
};

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
		// Nilai yang tidak dikenal jatuh ke bawaan, bukan ke 'osm' yang ditulis
		// tangan. Dulu tertulis `? 'mapid' : 'osm'`, yang berarti bawaan sumber
		// sebenarnya hidup di dua tempat — dan memindahkannya di DEFAULT_WEIGHTS
		// tidak akan berpengaruh apa-apa di sini.
		source: p.source === 'mapid' || p.source === 'osm' ? p.source : DEFAULT_WEIGHTS.source
	};
}
