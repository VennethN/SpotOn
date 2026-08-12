/**
 * Klien Overpass untuk skrip pembangun data.
 *
 * Dulu blok yang sama persis — daftar endpoint, User-Agent, jeda, dan seluruh
 * logika coba-ulangnya — disalin di build-hexes.mjs dan build-routes.mjs. Dua
 * salinan berarti perbaikan pada satu skrip (mis. menambah cermin baru saat
 * yang lama sedang penuh) tidak pernah sampai ke skrip lainnya.
 */

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.osm.jp/api/interpreter'
];

const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Status yang berarti "server sedang sibuk, coba lagi" — bukan "kueri ini
 * salah". Menganggapnya galat adalah cara paling mudah membuang pekerjaan yang
 * sebenarnya tinggal diulang.
 *
 * 503 sempat tidak masuk daftar ini, dan itu memakan satu putaran penuh
 * `join-mapid.mjs`: dua cermin membalas 429, cermin ketiga membalas 503, dan
 * karena 503 jatuh ke cabang galat umum, jedanya cuma 5 detik — kelewat pendek
 * untuk antrean Overpass, sehingga sisa percobaan habis terbakar dalam
 * hitungan detik dan skrip menyerah setelah tujuh menit menunggu sia-sia.
 * Overpass memakai 503 persis untuk "semua slot kueri sedang terpakai".
 */
const BUSY = new Set([429, 502, 503, 504]);

/**
 * Menjalankan satu kueri Overpass, berpindah cermin dan menunggu bila perlu.
 *
 * @param {string} query  kueri Overpass QL
 * @param {string} label  disebut pada pesan galat supaya ketahuan kueri mana
 * @param {{ attempts?: number }} [opts]
 */
export async function overpass(query, label, opts = {}) {
	// Kueri berat (mis. batas administrasi dengan `out geom`) sering perlu
	// beberapa kali giliran sebelum ada cermin yang lowong. Delapan percobaan
	// melewati tiap cermin lebih dari dua kali.
	const attempts = opts.attempts ?? 8;
	let lastErr;

	for (let i = 0; i < attempts; i++) {
		const url = ENDPOINTS[i % ENDPOINTS.length];
		try {
			// Overpass membalas 406 untuk permintaan tanpa User-Agent yang jelas —
			// bukan soal isi kuerinya. Header ini yang membuatnya dilayani.
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': UA,
					accept: 'application/json'
				},
				body: new URLSearchParams({ data: query })
			});
			// Overpass dipakai bersama-sama; kena batas laju itu wajar, bukan galat.
			if (BUSY.has(res.status)) {
				const wait = 8000 * (i + 1);
				console.log(`  (${label}) ${res.status}, cermin sibuk — tunggu ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			console.log(`  (${label}) ${err.message} — ganti cermin…`);
			await sleep(5000 * (i + 1));
		}
	}

	throw new Error(`Overpass gagal untuk ${label}: ${lastErr?.message ?? 'semua cermin sibuk'}`);
}
