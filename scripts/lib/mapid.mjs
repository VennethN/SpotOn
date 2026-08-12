/**
 * Klien MAPID bersama untuk skrip data.
 *
 * KENAPA IMPOR MANUAL TERNYATA TIDAK WAJIB
 *
 * Dokumen ini sempat menyimpulkan sebaliknya: bahwa isi layer premium hanya
 * bisa dibaca setelah dataset-nya diimpor ke proyek sendiri lewat antarmuka
 * GEO MAPID, karena `get_layer` menolak layer milik orang lain dengan
 * `{"is_owner_project": false, "is_owner_layer": false}`.
 *
 * Yang terlewat: penolakan itu datang dari `project_id` yang dikirim, bukan
 * dari `layer_id`. Waktu itu yang dicoba adalah `project_id` milik MAPID
 * Database — proyek yang memang bukan milik kita, jadi wajar ditolak. Server
 * memeriksa "apakah pemanggil memiliki proyek ini", lalu menyajikan layer yang
 * diminta; ia tidak pernah memeriksa apakah layer itu benar-benar anggota
 * proyek tersebut.
 *
 * Maka `layer_id` katalog + `project_id` KITA SENDIRI = 200 dengan isi lengkap,
 * tanpa impor sama sekali. Kekeliruan lamanya bukan pada endpoint, melainkan
 * pada menyimpulkan "tidak boleh" dari satu percobaan yang salah parameter.
 *
 * DUA JEBAKAN YANG SUDAH KENA SEKALI, JANGAN DIULANG
 *
 * 1. `get_layer` memotong di 200 fitur tanpa penanda apa pun — respons yang
 *    terpotong terlihat sukses sempurna. RESTORAN Jakarta Barat sebenarnya
 *    1.246 titik; tanpa `limit` eksplisit 84% hilang diam-diam. Karena itu
 *    `readLayer` selalu memasang `limit` dan tidak menerima nilai bawaan.
 *
 * 2. Pencarian katalog premium memakai nama parameter `search_params` —
 *    bukan `search`, `q`, atau `keyword`. Parameter yang tidak dikenal
 *    diabaikan diam-diam, jadi tiap tebakan mengembalikan halaman pertama
 *    tanpa filter dan tampak seperti "pencarian tidak didukung".
 */

import { mapidKey } from './mapid-key.mjs';

export { mapidKey };

export const GEOSERVER = 'https://geoserver.mapid.io';
export const BUN_SERVER = 'https://server.mapid.io';

const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; kontak lewat repo)';

/** Pemilik resmi katalog data premium. */
const PUBLISHER = /mapid\.database|MAPID Database/i;

/**
 * Jauh di atas layer terbesar yang pernah ditemui (MAKANAN DAN MINUMAN Jakarta
 * Pusat, 1.714 fitur). Naikkan bila suatu saat ada yang menyentuhnya — dan
 * perhatikan bahwa yang menyentuh batas TIDAK akan memberi tahu.
 */
export const FEATURE_LIMIT = 100000;

/** Proyek GEO MAPID milik kita. Dipakai sebagai "tiket baca", lihat catatan di atas. */
export function projectId() {
	return process.env.MAPID_PROJECT_ID || '6a7c1672fb8d434002151fa7';
}

/**
 * Normalisasi nama kota supaya "KOTA ADM. JAKARTA PUSAT", "Kota Administrasi
 * Jakarta Pusat", dan "JAKARTA PUSAT" jadi kunci yang sama.
 *
 * Tinggal di sini, bukan disalin ke tiap skrip, karena dipakai di dua sisi
 * timbangan yang harus cocok persis: `fetch-mapid.mjs` menulis daftar kota
 * tercakup, `join-mapid.mjs` mencocokkan nama kota dari OSM ke daftar itu.
 * Kalau keduanya menormalkan sedikit berbeda, tidak ada galat yang muncul —
 * yang terjadi cuma seluruh petak sunyi ditandai "belum tercakup".
 */
export function normKota(s) {
	return String(s ?? '')
		.toUpperCase()
		.replace(/KOTA ADMINISTRASI|KOTA ADM\.?|KABUPATEN|KOTA/g, '')
		.replace(/[^A-Z]/g, '');
}

/**
 * Mencocokkan nama dataset ke istilah pencarian dan kota.
 *
 * Dipakai `fetch-mapid.mjs` dan `search-mapid.mjs` supaya keduanya menilai
 * "ini dataset yang dicari" dengan cara yang sama persis — kalau berbeda,
 * penjelajah bisa melaporkan sebuah dataset ada padahal pengambilnya
 * melewatinya, dan sebaliknya.
 *
 * Istilahnya di-escape sebelum jadi RegExp. `search-mapid.mjs` menerima istilah
 * bebas dari argumen baris perintah, jadi tanpa ini satu tanda kurung sudah
 * cukup untuk menjatuhkan skrip dengan pesan galat tentang sintaks regex —
 * galat yang tidak ada hubungannya dengan apa pun yang sedang dikerjakan
 * penggunanya.
 */
export function matchesDataset(name, term, kota) {
	const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const n = String(name ?? '');
	// `\b` hanya berlaku bila istilahnya berakhir dengan karakter kata. Setelah
	// tanda kurung atau tanda baca, tidak pernah ada batas kata di depan spasi,
	// sehingga `\b` yang dipasang tanpa syarat justru membuang kecocokan yang
	// benar. Batasnya memang dibutuhkan — tanpa itu "APOTEK" ikut mencomot
	// "APOTEKER SEJAHTERA".
	const boundary = /\w$/.test(term) ? '\\b' : '';
	return (
		new RegExp(`^${esc(term)}${boundary}`, 'i').test(n) &&
		new RegExp(esc(kota).replace(/\s+/g, '\\s+'), 'i').test(n)
	);
}

/** GET JSON dengan percobaan ulang berjenjang. */
export async function getJSON(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': UA } });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
}

/**
 * Menelusuri KATALOG PREMIUM.
 *
 *   GET server.mapid.io/moneys_bun/search_data_premium_v2?search_params=<istilah>
 *
 * Berbeda dari `layers_new/search_layers_public`, yang hanya mengindeks layer
 * publik dan karena itu memberi jawaban menyesatkan: APOTEK dan LAUNDRY pernah
 * disimpulkan "tidak terlihat, perlu cek manual" padahal APOTEK ada lengkap
 * untuk kelima kota di katalog premium. Endpoint ini yang benar untuk
 * pertanyaan "apakah dataset X ada".
 *
 * Pencocokannya AND per kata, jadi kueri sempit seperti "APOTEK JAKARTA PUSAT"
 * mengembalikan tepat satu dataset. `skip` diterima tapi diabaikan server —
 * jangan andalkan paginasi; persempit kuerinya.
 *
 * Hasil disaring ke terbitan MAPID Database supaya salinan "IMPORT" milik
 * pengguna lain yang namanya mirip tidak ikut terbawa.
 */
export async function searchPremium(term) {
	const q = new URLSearchParams({ search_params: term });
	const j = await getJSON(`${BUN_SERVER}/moneys_bun/search_data_premium_v2?${q}`, `cari "${term}"`);
	return (j?.layers ?? []).filter((l) => PUBLISHER.test(`${l.user?.name ?? ''} ${l.user?.full_name ?? ''}`));
}

/**
 * Membaca isi satu layer. `layerId` boleh milik siapa pun selama layer-nya
 * publik; `project_id` yang dikirim adalah proyek kita sendiri.
 */
export async function readLayer(layerId, key, label = layerId) {
	const q = new URLSearchParams({
		api_key: key,
		layer_id: layerId,
		project_id: projectId(),
		limit: String(FEATURE_LIMIT)
	});
	const j = await getJSON(`${GEOSERVER}/layers_new/get_layer?${q}`, label);
	const features = j?.features ?? [];
	if (features.length >= FEATURE_LIMIT) {
		throw new Error(`${label}: menyentuh FEATURE_LIMIT (${FEATURE_LIMIT}) — data mungkin terpotong, naikkan batasnya`);
	}
	return { name: j?.layer_name ?? label, features };
}

/** Daftar layer di dalam sebuah proyek milik kita. */
export async function listProjectLayers(key) {
	const q = new URLSearchParams({ api_key: key, project_id: projectId() });
	const listed = await getJSON(`${GEOSERVER}/layers_new/get_layer_list?${q}`, 'get_layer_list');
	return Object.values(listed).filter((l) => l && typeof l === 'object' && l._id);
}
