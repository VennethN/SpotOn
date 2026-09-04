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
 * Itu keliru: 660 kedai kopi tersebar di lima kota administrasi bukan kepadatan
 * yang tinggi, jadi petak di pinggiran kota yang datasetnya SUDAH diimpor bisa
 * saja tidak punya satu pun POI dalam radius berapa pun — dan akan salah
 * ditandai "belum tercakup". Sebaliknya petak di kota yang belum diimpor bisa
 * kebetulan dekat dengan POI kota tetangga dan salah ditandai "tercakup".
 *
 * Cakupan itu fakta tingkat kota: dataset diimpor per kota administrasi. Maka
 * batas kota diambil dari OSM, tiap petak ditentukan kotanya lewat uji titik
 * dalam poligon, dan cakupan dibaca dari daftar kota yang datasetnya ada.
 *
 * Petak yang belum tercakup TIDAK diberi nol pesaing. Nol berarti "sudah
 * dicek, memang tidak ada"; belum tercakup berarti "belum dicek". Membedakan
 * keduanya adalah inti dari janji kejujuran data proyek ini.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass } from './lib/overpass.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALK_M = 800;
const CATEGORIES = ['kopi', 'warung', 'minimarket', 'laundry', 'apotek'];

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

/** Normalisasi nama kota supaya "KOTA ADM. JAKARTA PUSAT" dan "Kota Administrasi
    Jakarta Pusat" dianggap sama. */
function normKota(s) {
	return String(s ?? '')
		.toUpperCase()
		.replace(/KOTA ADMINISTRASI|KOTA ADM\.?|KABUPATEN|KOTA/g, '')
		.replace(/[^A-Z]/g, '');
}

async function main() {
	const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const poi = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/mapid-poi.json'), 'utf8'));

	console.log(`${grid.hexes.length} petak · ${poi.points.length} titik MAPID\n`);

	// Kota mana yang datasetnya sudah ada, per kategori.
	const coveredKota = {};
	for (const c of CATEGORIES) coveredKota[c] = new Set();
	for (const p of poi.points) {
		if (p.kabkot) coveredKota[p.cat]?.add(normKota(p.kabkot));
	}
	console.log('Kota tercakup per kategori:');
	for (const c of CATEGORIES) {
		console.log(`  ${c.padEnd(11)} ${coveredKota[c].size ? [...coveredKota[c]].join(', ') : '(belum ada)'}`);
	}

	// Batas kota/kabupaten dari OSM — inilah yang membuat cakupan bisa dinilai
	// tepat, bukan ditebak dari kedekatan.
	// admin_level=5 adalah kota/kabupaten di Indonesia. Sempat memakai 6, dan
	// yang kembali justru kecamatan (Kebon Jeruk, Cilincing, Pulo Gadung) —
	// tidak ada yang cocok dengan KABKOT, jadi seluruh petak salah ditandai
	// "belum tercakup" tanpa satu pun galat muncul.
	console.log('\nMengambil batas administrasi dari OSM (admin_level=5)…');
	const q = `[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="5"](-6.45,106.55,-6.02,107.15);
out geom;`;
	const raw = await overpass(q, 'batas');

	const kotas = [];
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

	// Indeks POI per kategori
	const byCat = {};
	for (const c of CATEGORIES) byCat[c] = [];
	for (const p of poi.points) byCat[p.cat]?.push(p);

	console.log('\nMenggabungkan…');
	let assigned = 0;
	const tally = { covered: 0, uncovered: 0 };

	for (const h of grid.hexes) {
		// kota petak ini
		let kota = null;
		for (const k of kotas) {
			if (h.lon < k.bbox[0] || h.lon > k.bbox[2] || h.lat < k.bbox[1] || h.lat > k.bbox[3]) continue;
			if (inRing(h.lon, h.lat, k.ring)) {
				kota = k;
				break;
			}
		}
		if (kota) assigned++;
		h.kota = kota?.name ?? null;

		const mapid = {};
		const covered = {};
		for (const c of CATEGORIES) {
			const isCovered = Boolean(kota && coveredKota[c].has(kota.key));
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
		rule: 'Cakupan ditentukan per kota administrasi (batas dari OSM admin_level=5), bukan dari kedekatan POI. Petak di kota yang datasetnya belum diimpor bernilai null — belum dicek, bukan nol pesaing.',
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
