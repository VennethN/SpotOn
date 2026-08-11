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
 * Menjalankan satu kueri Overpass, berpindah cermin dan menunggu bila perlu.
 *
 * @param {string} query  kueri Overpass QL
 * @param {string} label  disebut pada pesan galat supaya ketahuan kueri mana
 * @param {{ attempts?: number }} [opts]
 */
export async function overpass(query, label, opts = {}) {
	const attempts = opts.attempts ?? 5;
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
			if (res.status === 429 || res.status === 504) {
				const wait = 8000 * (i + 1);
				console.log(`  (${label}) dibatasi laju, tunggu ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			await sleep(5000 * (i + 1));
		}
	}

	throw new Error(`Overpass gagal untuk ${label}: ${lastErr?.message ?? 'tidak diketahui'}`);
}
