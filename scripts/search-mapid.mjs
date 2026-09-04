/**
 * Menelusuri katalog data premium MAPID.
 *
 *   node scripts/search-mapid.mjs                 # tiga belas kategori SpotOn
 *   node scripts/search-mapid.mjs APOTEK ATM      # istilah bebas
 *   node scripts/search-mapid.mjs --kota "BANDUNG,SURABAYA" PASAR
 *
 * Ini perkakas penjelajah: dipakai untuk memutuskan dataset apa yang layak
 * masuk MANIFEST di `scripts/fetch-mapid.mjs`. Pengambilan datanya sendiri
 * bukan urusan skrip ini — begitu sebuah dataset masuk manifest, fetch-mapid
 * menemukan dan membacanya sendiri.
 *
 * KENAPA ENDPOINTNYA BERGANTI
 *
 * Versi sebelumnya memakai `layers_new/search_layers_public`, yang hanya
 * mengindeks layer PUBLIK. Katalog premium tidak ada di dalamnya, jadi
 * jawabannya menyesatkan dengan cara yang paling mahal: kategori yang
 * sebenarnya tersedia lengkap dilaporkan sebagai "tidak terlihat lewat jalur
 * ini, perlu dicek manual". APOTEK dinyatakan begitu selama berminggu-minggu,
 * padahal ada untuk kelima kota. RESTORAN dan MINIMARKET ketemu semata-mata
 * karena MAPID Database kebetulan menerbitkan keduanya secara publik juga.
 *
 * Yang benar adalah `moneys_bun/search_data_premium_v2` — endpoint yang dipakai
 * kotak pencarian GEO MAPID sendiri, dan ia menelusuri katalog premium. Tidak
 * perlu autentikasi apa pun.
 *
 * Peringatan lama "kosong berarti tidak terlihat, bukan tidak ada" karena itu
 * tidak berlaku lagi di sini: kosong dari endpoint ini berarti benar-benar
 * tidak ada di katalog. LAUNDRY adalah kasus nyatanya.
 */

import { matchesDataset, searchPremium } from './lib/mapid.mjs';

/** Lima kota administrasi DKI. Katalog memberi satu dataset per kota. */
const KOTA_DEFAULT = ['JAKARTA PUSAT', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR', 'JAKARTA UTARA'];

/** Istilah yang dipakai MANIFEST fetch-mapid.mjs, supaya keduanya bisa diadu. */
const TERMS_DEFAULT = [
	'COFFEE SHOP',
	'BRAND COFFEE SHOP',
	'MINUMAN',
	'ROTI DAN KUE',
	'RESTORAN',
	'MAKANAN DAN MINUMAN',
	'MINIMARKET',
	'TOKO KELONTONG',
	'LAYANAN ATAU JASA',
	'PERAWATAN DAN PERBAIKAN OTOMOTIF',
	'APOTEK'
];

function parseArgv(argv) {
	const kota = [...KOTA_DEFAULT];
	const terms = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--kota') {
			kota.length = 0;
			kota.push(...(argv[++i] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
			continue;
		}
		terms.push(argv[i].toUpperCase());
	}
	return { kota, terms: terms.length ? terms : TERMS_DEFAULT };
}

async function main() {
	const { kota, terms } = parseArgv(process.argv.slice(2));
	console.log(`Katalog premium MAPID · ${terms.length} istilah × ${kota.length} kota\n`);

	let found = 0;
	for (const term of terms) {
		console.log(`## ${term}`);
		for (const k of kota) {
			const hits = await searchPremium(`${term} ${k}`);
			// Pencocokan AND per kata sudah menyempitkan hasil, tapi tetap
			// diverifikasi dengan aturan yang sama persis dengan yang dipakai
			// fetch-mapid.mjs — kalau keduanya menilai berbeda, penjelajah ini
			// bisa melaporkan dataset yang ternyata dilewati pengambilnya.
			const exact = hits.filter((l) => matchesDataset(l.name, term, k));
			if (!exact.length) {
				console.log(`  ${k.padEnd(18)} —  tidak ada di katalog`);
				continue;
			}
			for (const l of exact) {
				found++;
				console.log(`  ${k.padEnd(18)} ✓  ${l.name}`);
				console.log(`  ${''.padEnd(18)}    https://geo.mapid.io/layer/${l._id}`);
			}
		}
		console.log('');
	}

	console.log(`${found} dataset ketemu.`);
	console.log('Yang belum ada di MANIFEST scripts/fetch-mapid.mjs tinggal ditambahkan di sana —');
	console.log('tidak ada langkah impor, fetch-mapid membacanya langsung dari katalog.');
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
