/**
 * Membaca `MAPID_API_KEY` untuk skrip-skrip MAPID.
 *
 * Dulu blok ini disalin di fetch-mapid.mjs dan search-mapid.mjs, dan keduanya
 * hanya mau membaca dari berkas `.env`.
 *
 * KENAPA LINGKUNGAN DIDAHULUKAN
 *
 * `.env` adalah cara yang benar di mesin sendiri — berkasnya tidak ikut
 * ter-commit dan kuncinya tinggal di satu tempat. Tapi skrip ini juga dijalankan
 * di tempat yang tidak punya berkas itu sama sekali: CI, kontainer, sesi remote.
 * Di sana kunci datang sebagai variabel lingkungan, dan versi lama berhenti di
 * `readFileSync` dengan `ENOENT: no such file or directory, open '.env'` —
 * pesan yang menunjuk ke berkas yang hilang, padahal kuncinya sudah ada di
 * lingkungan dan tinggal dibaca. Yang gagal bukan kredensialnya, melainkan cara
 * mencarinya.
 *
 * Urutannya: lingkungan dulu, `.env` sebagai cadangan. Dengan begitu satu
 * perintah `MAPID_API_KEY=… node scripts/fetch-mapid.mjs` bisa menimpa isi
 * `.env` tanpa menyunting berkasnya — berguna saat menguji kunci lain.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Mengambil satu nilai dari `.env` tanpa memasang pustaka pemuat apa pun.
 * Cukup untuk berkas sederhana `KUNCI=nilai` seperti punya proyek ini.
 */
function fromDotenv(name) {
	let raw;
	try {
		raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	} catch {
		// Tidak ada `.env` bukan galat — pemanggilnya yang memutuskan itu fatal
		// atau tidak, setelah lingkungan juga ternyata kosong.
		return '';
	}
	const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'));
	return (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

/**
 * Kunci baca MAPID. Melempar dengan pesan yang menyebut kedua jalan bila tidak
 * ketemu di mana pun.
 */
export function mapidKey() {
	const key = (process.env.MAPID_API_KEY ?? '').trim() || fromDotenv('MAPID_API_KEY');
	if (!key) {
		throw new Error(
			'MAPID_API_KEY tidak ditemukan — isi di .env (lihat .env.example) ' +
				'atau ekspor sebagai variabel lingkungan'
		);
	}
	return key;
}
