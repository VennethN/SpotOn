/**
 * Menggabungkan POI premium MAPID ke kisi heksagon.
 *
 *   node scripts/join-mapid.mjs
 *
 * Membaca `src/lib/data/hexes.json` dan `src/lib/data/mapid-poi.json`, lalu
 * menulis ulang `hexes.json` dengan dua tambahan per petak:
 *
 *   mapid   — cacah pesaing MAPID per kategori dalam jangkauan jalan kaki
 *   covered — per kategori: apakah kota petak ini sudah punya dataset MAPID
 *
 * KENAPA CAKUPAN DITENTUKAN PER KOTA, BUKAN PER JARAK
 *
 * Godaannya adalah menandai petak "tercakup" bila ada POI MAPID di dekatnya.
 * Itu keliru: 895 kedai kopi tersebar di lima kota administrasi bukan kepadatan
 * yang tinggi, jadi petak di pinggiran kota yang datasetnya SUDAH dibaca bisa
 * saja tidak punya satu pun POI dalam radius berapa pun — dan akan salah
 * ditandai "belum tercakup". Sebaliknya petak di kota yang datasetnya tidak ada
 * bisa kebetulan dekat dengan POI kota tetangga dan salah ditandai "tercakup".
 *
 * Cakupan itu fakta tingkat kota: katalog MAPID memberi satu dataset per kota
 * administrasi. Maka batas kota diambil dari OSM, tiap petak ditentukan kotanya
 * lewat uji titik dalam poligon, dan cakupan dibaca dari daftar kota yang
 * datasetnya berhasil dibaca — daftar itu dideklarasikan `fetch-mapid.mjs`,
 * bukan disimpulkan ulang di sini.
 *
 * Petak yang belum tercakup TIDAK diberi nol pesaing. Nol berarti "sudah
 * dicek, memang tidak ada"; belum tercakup berarti "belum dicek". Membedakan
 * keduanya adalah inti dari janji kejujuran data proyek ini.
 *
 * Sejak katalog premium bisa dibaca langsung, empat dari lima kategori tercakup
 * penuh di kelima kota. Yang tersisa `laundry` — memang tidak ada di katalog,
 * jadi ia tetap null di seluruh petak, dan itu jawaban yang benar.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass } from './lib/overpass.mjs';
import { normKota } from './lib/mapid.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALK_M = 800;
const CATEGORIES = [
	'kopi',
	'minuman',
	'roti',
	'warteg',
	'cepatsaji',
	'mie',
	'seafood',
	'restoasing',
	'minimarket',
	'kelontong',
	'laundry',
	'bengkel',
	'apotek'
];

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversine(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const x =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

/** Ray casting; ring berupa [lon, lat][]. */
function inRing(lon, lat, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

async function main() {
	const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const poi = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/mapid-poi.json'), 'utf8'));

	console.log(`${grid.hexes.length} petak · ${poi.points.length} titik MAPID\n`);

	// Kota mana yang datasetnya sudah dibaca, per kategori.
	//
	// Yang dipakai adalah deklarasi dari `fetch-mapid.mjs`, bukan penyimpulan
	// dari KABKOT titik yang lolos klasifikasi. Menyimpulkan dari titik
	// mencampur "dataset tidak ada" dengan "dataset ada tapi nol baris setelah
	// disaring" — keduanya menghasilkan nol titik, padahal yang pertama berarti
	// belum dicek dan yang kedua sudah. Perbedaan itu justru yang dijanjikan
	// peta ini.
	//
	// Penyimpulan lama tetap disimpan sebagai cadangan untuk `mapid-poi.json`
	// lama yang belum punya blok `coverage`.
	const coveredKota = {};
	for (const c of CATEGORIES) coveredKota[c] = new Set();
	const declared = poi.meta?.coverage;
	if (declared) {
		for (const c of CATEGORIES) for (const k of declared[c] ?? []) coveredKota[c].add(k);
		console.log('Cakupan: dideklarasikan fetch-mapid.mjs\n');
	} else {
		for (const p of poi.points) if (p.kabkot) coveredKota[p.cat]?.add(normKota(p.kabkot));
		console.log('Cakupan: disimpulkan dari titik (mapid-poi.json lama, jalankan ulang fetch-mapid.mjs)\n');
	}
	console.log('Kota tercakup per kategori:');
	for (const c of CATEGORIES) {
		console.log(`  ${c.padEnd(11)} ${coveredKota[c].size ? [...coveredKota[c]].join(', ') : '(belum ada)'}`);
	}

	// Batas kota/kabupaten dari OSM — inilah yang membuat cakupan bisa dinilai
	// tepat, bukan ditebak dari kedekatan.
	//
	// KENAPA HASILNYA DIPAKAI ULANG
	//
	// Petak mana ada di kota mana hanya berubah kalau kisinya sendiri berubah,
	// sedangkan skrip ini dijalankan ulang tiap kali data MAPID diperbarui.
	// Menarik ulang batas administrasi tiap kali berarti menggantungkan seluruh
	// penggabungan pada layanan paling rapuh di jalur ini: satu putaran pernah
	// habis tujuh menit dan gagal dengan 503 karena semua cermin Overpass
	// sedang penuh — padahal jawabannya sudah tersimpan di `hexes.json` dari
	// putaran sebelumnya, tidak berubah sedikit pun.
	//
	// Jadi batas hanya ditarik bila memang belum ada. Paksa dengan
	// `--refresh-kota` setelah kisinya dibangun ulang atau batas OSM berubah.
	const refresh = process.argv.includes('--refresh-kota');
	// Ujinya "ada petak yang BENAR-BENAR dapat kota", bukan "kolomnya ada".
	//
	// Sempat diuji dengan `every((h) => 'kota' in h)`, dan itu keliru dengan cara
	// yang tidak berbunyi: `h.kota = kotaName` menulis kuncinya untuk tiap petak
	// termasuk yang null, dan JSON menyimpan null apa adanya. Jadi satu putaran
	// yang batas administrasinya kembali kosong — cermin membalas
	// `{"elements":[]}`, atau salah `admin_level` seperti yang pernah terjadi —
	// menghasilkan `"kota": null` di semua petak, lolos uji itu selamanya, dan
	// menandai seluruh pasangan petak×kategori "belum tercakup" tanpa ada yang
	// bisa memperbaikinya kecuali ingat memakai `--refresh-kota`.
	const cached = grid.hexes.some((h) => h.kota);

	let kotas = null;
	if (cached && !refresh) {
		const n = grid.hexes.filter((h) => h.kota).length;
		console.log(`\nBatas administrasi: pakai penetapan tersimpan (${n}/${grid.hexes.length} petak)`);
		console.log('  jalankan dengan --refresh-kota untuk menariknya ulang dari OSM');
	} else {
		// admin_level=5 adalah kota/kabupaten di Indonesia. Sempat memakai 6, dan
		// yang kembali justru kecamatan (Kebon Jeruk, Cilincing, Pulo Gadung) —
		// tidak ada yang cocok dengan KABKOT, jadi seluruh petak salah ditandai
		// "belum tercakup" tanpa satu pun galat muncul.
		console.log('\nMengambil batas administrasi dari OSM (admin_level=5)…');
		const q = `[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="5"](-6.45,106.55,-6.02,107.15);
out geom;`;
		const raw = await overpass(q, 'batas');

		kotas = [];
		for (const rel of raw.elements) {
			if (rel.type !== 'relation' || !rel.members) continue;
			const name = rel.tags?.name;
			if (!name) continue;
			// Gabung seluruh way anggota jadi satu himpunan ring kasar; untuk uji
			// "di kota mana" ini sudah cukup — kita tidak menggambar batasnya.
			const ring = [];
			for (const m of rel.members) {
				if (m.type !== 'way' || !m.geometry) continue;
				for (const g of m.geometry) ring.push([g.lon, g.lat]);
			}
			if (ring.length < 4) continue;
			const lons = ring.map((r) => r[0]);
			const lats = ring.map((r) => r[1]);
			kotas.push({
				name,
				key: normKota(name),
				ring,
				bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
			});
		}
		console.log(`  ${kotas.length} wilayah: ${kotas.map((k) => k.name).join(', ').slice(0, 140)}`);
	}

	// Indeks POI per kategori
	const byCat = {};
	for (const c of CATEGORIES) byCat[c] = [];
	for (const p of poi.points) byCat[p.cat]?.push(p);

	console.log('\nMenggabungkan…');
	const tally = { covered: 0, uncovered: 0 };

	for (const h of grid.hexes) {
		// kota petak ini — dari uji titik-dalam-poligon bila batasnya baru
		// ditarik, atau dari nama yang sudah tersimpan pada petak.
		let kotaName = null;
		if (kotas) {
			for (const k of kotas) {
				if (h.lon < k.bbox[0] || h.lon > k.bbox[2] || h.lat < k.bbox[1] || h.lat > k.bbox[3]) continue;
				if (inRing(h.lon, h.lat, k.ring)) {
					kotaName = k.name;
					break;
				}
			}
		} else {
			kotaName = h.kota ?? null;
		}
		h.kota = kotaName;
		// Kuncinya dihitung ulang dari nama lewat normKota yang sama dengan yang
		// dipakai fetch-mapid.mjs, jadi jalur tersimpan dan jalur tarik-ulang
		// tidak bisa menilai cakupan dengan cara yang berbeda.
		const kotaKey = kotaName ? normKota(kotaName) : null;

		const mapid = {};
		const covered = {};
		for (const c of CATEGORIES) {
			const isCovered = Boolean(kotaKey && coveredKota[c].has(kotaKey));
			covered[c] = isCovered;
			if (!isCovered) {
				// Sengaja TIDAK ditulis nol — pembaca harus dipaksa membedakan
				// "tidak ada pesaing" dari "belum dicek".
				mapid[c] = null;
				tally.uncovered++;
				continue;
			}
			let n = 0;
			for (const p of byCat[c]) {
				if (Math.abs(p.lat - h.lat) > 0.012 || Math.abs(p.lon - h.lon) > 0.012) continue;
				if (haversine(h.lat, h.lon, p.lat, p.lon) <= WALK_M) n++;
			}
			mapid[c] = n;
			tally.covered++;
		}
		h.mapid = mapid;
		h.covered = covered;
	}

	grid.meta.mapid = {
		source: poi.meta.source,
		project_id: poi.meta.project_id,
		points: poi.points.length,
		coveredKota: Object.fromEntries(
			CATEGORIES.map((c) => [c, [...coveredKota[c]]])
		),
		coverageSource: poi.meta?.coverage ? 'dideklarasikan fetch-mapid.mjs' : 'disimpulkan dari titik',
		rule: 'Cakupan ditentukan per kota administrasi (batas dari OSM admin_level=5), bukan dari kedekatan POI. Petak di kota yang datasetnya tidak ada di katalog bernilai null — belum dicek, bukan nol pesaing.',
		regenerate: 'node scripts/fetch-mapid.mjs && node scripts/join-mapid.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	const withKota = grid.hexes.filter((h) => h.kota).length;
	console.log(`  petak dengan kota terisi : ${withKota}/${grid.hexes.length}`);
	console.log(`  pasangan petak×kategori  : ${tally.covered} tercakup · ${tally.uncovered} belum tercakup`);
	const tot = {};
	for (const c of CATEGORIES) {
		tot[c] = grid.hexes.reduce((a, h) => a + (h.mapid?.[c] ?? 0), 0);
	}
	console.log('  total pesaing MAPID terhitung:', tot);
	console.log(`\n→ ${hexPath}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
