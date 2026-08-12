/**
 * Klien Overpass untuk skrip pembangun data.
 *
 * Dulu blok yang sama persis — daftar endpoint, User-Agent, jeda, dan seluruh
 * logika coba-ulangnya — disalin di build-hexes.mjs dan build-routes.mjs. Dua
 * salinan berarti perbaikan pada satu skrip (mis. menambah cermin baru saat
 * yang lama sedang penuh) tidak pernah sampai ke skrip lainnya.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
/**
 * Kueri di sini memasang `[timeout:180]`, jadi menunggu tiga menit itu wajar.
 * Yang tidak wajar adalah menunggu selamanya: `fetch` tanpa sinyal tidak pernah
 * menyerah sendiri, dan cermin yang mati menggantung tanpa membalas apa pun.
 * Satu cermin yang tidak menjawab pernah menghabiskan seluruh jatah percobaan
 * dengan cara yang paling membingungkan — tidak ada galat, tidak ada kemajuan,
 * hanya diam.
 */
const REQUEST_TIMEOUT_MS = 200_000;

/**
 * Singgahan jawaban Overpass, supaya kueri yang SUDAH berhasil tidak perlu
 * diulang ketika kueri lain di skrip yang sama gagal.
 *
 * `build-hexes.mjs` menembakkan lima kueri berturut-turut. Sepanjang sesi ini
 * Overpass sedang penuh berkepanjangan, dan tiga kali pembangunan ulang hangus
 * karena satu kelompok terakhir menyerah — membuang empat kueri sebelumnya yang
 * sudah lolos, masing-masing setelah menunggu menit-menitan. Dengan singgahan
 * ini percobaan berikutnya melanjutkan dari tempat yang gagal.
 *
 * Umurnya sengaja pendek. Ini alat supaya percobaan ulang tidak menyakitkan,
 * BUKAN cara mempercepat pembangunan data: kalau isinya boleh tua, `hexes.json`
 * bisa diam-diam dibangun dari OSM minggu lalu tanpa ada yang sadar. Hapus
 * kapan saja — `rm -rf scripts/.overpass-cache`.
 */
const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.overpass-cache');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cachePath(query) {
	return resolve(CACHE_DIR, `${createHash('sha1').update(query).digest('hex')}.json`);
}

function readCache(query, label) {
	try {
		const p = cachePath(query);
		const age = Date.now() - statSync(p).mtimeMs;
		if (age > CACHE_TTL_MS) return null;
		const hit = JSON.parse(readFileSync(p, 'utf8'));
		console.log(`  (${label}) pakai singgahan, umur ${Math.round(age / 60000)} menit`);
		return hit;
	} catch {
		return null;
	}
}

function writeCache(query, data) {
	try {
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(cachePath(query), JSON.stringify(data));
	} catch {
		// Singgahan gagal ditulis bukan alasan menggagalkan pengambilan data.
	}
}

export async function overpass(query, label, opts = {}) {
	// Kueri berat (mis. batas administrasi dengan `out geom`) sering perlu
	// beberapa kali giliran sebelum ada cermin yang lowong. Delapan percobaan
	// melewati tiap cermin lebih dari dua kali.
	const attempts = opts.attempts ?? 8;
	let lastErr;

	const cached = readCache(query, label);
	if (cached) return cached;

	// Cermin yang gagal di tingkat sambungan — habis waktu, sertifikat
	// kedaluwarsa, DNS — dicoret untuk sisa panggilan ini. Berbeda dari cermin
	// sibuk, yang justru layak dicoba lagi: yang ini tidak akan tiba-tiba pulih
	// dalam hitungan detik, dan tiap percobaan ke sana memakan jatah percobaan
	// yang seharusnya jatuh ke cermin yang hidup.
	const dead = new Set();

	for (let i = 0; i < attempts; i++) {
		const alive = ENDPOINTS.filter((e) => !dead.has(e));
		if (alive.length === 0) break;
		const url = alive[i % alive.length];
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
				body: new URLSearchParams({ data: query }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
			// Overpass dipakai bersama-sama; kena batas laju itu wajar, bukan galat.
			if (BUSY.has(res.status)) {
				const wait = 8000 * (i + 1);
				console.log(`  (${label}) ${res.status}, cermin sibuk — tunggu ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const data = await res.json();
			// Overpass menjawab kueri yang kehabisan waktu dengan HTTP 200 dan
			// badan `{"elements":[], "remark":"runtime error: Query timed out"}`.
			// `res.ok` bernilai benar, jadi tanpa pemeriksaan ini jawaban kosong
			// itu diterima sebagai hasil sah — dan `build-hexes.mjs` menuliskan
			// nol EKSPLISIT untuk tiap kategori dalam kelompoknya. Nol eksplisit
			// dibaca mesin skor sebagai "sudah disurvei, memang tidak ada", yang
			// berarti seluruh Jakarta mendapat skor peluang tertinggi untuk
			// kategori itu. Disinggahkan pula, jadi menjalankan ulang untuk
			// memperbaikinya justru mengembalikan hasil yang sama tanpa menyentuh
			// jaringan. Diperlakukan sebagai kegagalan yang layak diulang.
			if (data?.remark) throw new Error(`Overpass remark: ${String(data.remark).slice(0, 120)}`);
			writeCache(query, data);
			return data;
		} catch (err) {
			lastErr = err;
			const host = new URL(url).host;
			// Hanya kegagalan yang tidak akan pulih sendiri yang mencoret cermin.
			//
			// Versi pertama mencoret cermin pada SETIAP lemparan, dan itu terlalu
			// keras: satu ECONNRESET, satu sertifikat yang sedang diperbarui, atau
			// satu halaman galat HTML yang gagal di-`json()` sudah cukup untuk
			// membunuh cermin yang sebenarnya sehat. Dengan tiga cermin, tiga
			// gangguan sekejap yang tidak berhubungan menghabiskan seluruh daftar
			// dalam hitungan detik — padahal versi sebelumnya memutari cermin yang
			// sama sampai lima kali dan pulih.
			const fatal = /certificate|ENOTFOUND|EAI_AGAIN|ERR_TLS|self-signed/i.test(err.message);
			if (fatal) {
				dead.add(url);
				console.log(`  (${label}) ${host}: ${err.message} — dicoret, ganti cermin…`);
			} else {
				console.log(`  (${label}) ${host}: ${err.message} — coba lagi…`);
			}
			await sleep(5000 * (i + 1));
		}
	}

	throw new Error(`Overpass gagal untuk ${label}: ${lastErr?.message ?? 'semua cermin sibuk'}`);
}
