import type { CategoryKey } from '$lib/types';

export interface CategoryDef {
	key: CategoryKey;
	/** Nama pendek untuk segmented control. */
	short: string;
	/** Nama lengkap untuk kalimat. */
	name: string;
	/**
	 * Tag OSM sumber hitungan pesaing — ditampilkan agar angka dapat ditelusuri.
	 *
	 * `null` berarti OSM TIDAK BISA menghitung kategori ini, dan mesin skor
	 * memperlakukan seluruh petak sebagai "belum tercakup" pada sumber OSM.
	 * Bukan nol. Bedanya menentukan: nol pesaing adalah peluang terbaik yang
	 * bisa dilaporkan peta ini, jadi kategori yang tidak punya sumber tetapi
	 * dihitung nol akan menobatkan seluruh Jakarta sebagai lokasi ideal.
	 */
	osmTag: string | null;
	/** Dataset MAPID sumber hitungan pesaing — ditampilkan agar angka dapat ditelusuri. */
	mapidSet: string;
	/** Kategori Properti Go yang dianggap cocok untuk usaha ini. */
	propKat: string;
}

/**
 * Sembilan jenis usaha yang dinilai.
 *
 * Urutannya urutan tampil: makanan & minuman dulu, lalu ritel, lalu jasa.
 * Berbeda dari urutan di `scripts/build-hexes.mjs`, yang harus mempertahankan
 * lima kategori lama di depan — alasannya ada di sana.
 *
 * Tiap kategori wajib punya SUMBER DI KEDUA SISI, tag OSM dan dataset MAPID.
 * Saklar sumber di bilah atas memilih salah satunya, dan kategori yang hanya
 * punya satu sisi akan diam-diam bernilai nol di sisi yang lain — persis
 * kekeliruan yang paling dihindari proyek ini, karena nol pesaing membaca
 * sebagai peluang terbaik. Kalau sebuah jenis usaha tidak punya keduanya, ia
 * belum layak jadi kategori.
 */
export const CATEGORIES: CategoryDef[] = [
	{
		key: 'kopi',
		short: 'Kopi',
		name: 'Kedai Kopi',
		osmTag: 'amenity=cafe',
		mapidSet: 'COFFEE SHOP + BRAND COFFEE SHOP',
		propKat: 'Coffee Shop'
	},
	{
		key: 'minuman',
		short: 'Minuman',
		name: 'Kedai Minuman',
		osmTag: 'shop=beverages|bubble_tea, amenity=ice_cream',
		mapidSet: 'MINUMAN',
		propKat: 'Retail F&B'
	},
	{
		key: 'roti',
		short: 'Roti',
		name: 'Toko Roti & Kue',
		osmTag: 'shop=bakery|pastry',
		mapidSet: 'ROTI DAN KUE',
		propKat: 'Retail F&B'
	},
	/**
	 * `warung` dulu satu kategori berisi 6.094 titik: warteg, sushi, KFC, dan
	 * rumah makan Padang dihitung sebagai pesaing yang sama. Untuk orang yang
	 * sedang memilih lokasi itu angka yang menyesatkan — warteg tidak bersaing
	 * dengan restoran Jepang, dan kepadatan gerai cepat saji tidak mengatakan
	 * apa pun tentang peluang membuka warung nasi.
	 *
	 * Empat dari lima pecahannya ber-`osmTag: null`. OSM tidak punya penandaan
	 * yang bisa dipakai: hanya 48,9% gerai makan di Jakarta Pusat punya tag
	 * `cuisine` sama sekali, kosakata yang ada tidak mengenal warteg maupun
	 * rumah makan Padang, dan `seafood` tidak muncul satu kali pun pada sampel.
	 * Memaksakan pemetaan akan menghasilkan cacah yang terlalu rendah dan
	 * berat sebelah — paling parah justru untuk warteg, yang paling jarang
	 * ditandai. `cepat saji` selamat karena `amenity=fast_food` adalah tag
	 * tersendiri yang tidak bergantung pada `cuisine`.
	 */
	{
		key: 'warteg',
		short: 'Warteg',
		name: 'Warung & Rumah Makan',
		osmTag: null,
		mapidSet: 'RESTORAN → warteg, nasi goreng, padang, melayu, nusantara, ayam, jajanan',
		propKat: 'Retail F&B'
	},
	{
		key: 'cepatsaji',
		short: 'Cepat Saji',
		name: 'Gerai Cepat Saji',
		osmTag: 'amenity=fast_food',
		mapidSet: 'RESTORAN → cepat saji',
		propKat: 'Retail F&B'
	},
	{
		key: 'mie',
		short: 'Mie',
		name: 'Mie & Bakso',
		osmTag: null,
		mapidSet: 'RESTORAN → mie dan bakso, ramen',
		propKat: 'Retail F&B'
	},
	{
		key: 'seafood',
		short: 'Seafood',
		name: 'Rumah Makan Seafood',
		osmTag: null,
		mapidSet: 'RESTORAN → seafood',
		propKat: 'Retail F&B'
	},
	{
		key: 'restoasing',
		short: 'Resto Asing',
		name: 'Restoran Masakan Asing',
		osmTag: null,
		mapidSet: 'RESTORAN → korea, jepang, thailand, sushi, timur tengah, eropa, dll.',
		propKat: 'Retail F&B'
	},
	{
		key: 'minimarket',
		short: 'Minimarket',
		name: 'Minimarket',
		osmTag: 'shop=convenience|supermarket',
		mapidSet: 'MINIMARKET',
		propKat: 'Minimarket'
	},
	{
		key: 'kelontong',
		short: 'Kelontong',
		name: 'Toko Kelontong',
		osmTag: 'shop=grocery|general|kiosk',
		mapidSet: 'TOKO KELONTONG',
		propKat: 'Ruko'
	},
	{
		key: 'laundry',
		short: 'Laundry',
		name: 'Laundry',
		osmTag: 'shop=laundry|dry_cleaning',
		mapidSet: 'LAYANAN ATAU JASA → BINATU (LAUNDRY)',
		propKat: 'Laundry'
	},
	{
		key: 'bengkel',
		short: 'Bengkel',
		name: 'Bengkel Kendaraan',
		osmTag: 'shop=car_repair|motorcycle_repair',
		mapidSet: 'PERAWATAN DAN PERBAIKAN OTOMOTIF',
		propKat: 'Ruko'
	},
	{
		key: 'apotek',
		short: 'Apotek',
		name: 'Apotek',
		osmTag: 'amenity=pharmacy',
		mapidSet: 'APOTEK',
		propKat: 'Ruko'
	}
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
	CategoryKey,
	CategoryDef
>;

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function isCategory(v: unknown): v is CategoryKey {
	return typeof v === 'string' && CATEGORY_KEYS.includes(v as CategoryKey);
}
