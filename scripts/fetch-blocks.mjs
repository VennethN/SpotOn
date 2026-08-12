/**
 * Mengunduh geometri nyata OSM di sekitar tiap stasiun, lalu menyimpannya sebagai
 * koordinat meter lokal siap-pakai untuk maket 3D.
 *
 * Dijalankan manual saat data perlu disegarkan:
 *   node scripts/fetch-blocks.mjs
 *
 * Keluarannya `src/lib/data/blocks.json`. Sengaja disimpan sebagai berkas, bukan
 * diambil saat runtime: Overpass punya batas laju dan tidak boleh berada di jalur
 * muat halaman pengguna.
 *
 * Soal tinggi bangunan: hanya sebagian kecil bangunan di Jakarta yang punya tag
 * `height` atau `building:levels`. Yang tidak punya DIPERKIRAKAN dari jenis dan
 * luas tapaknya, dan ditandai `est: 1`. Penanda itu wajib ikut sampai ke antarmuka —
 * massa yang ditebak tidak boleh tampil seolah-olah terukur.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RADIUS = 340;
const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];

const ROAD_CLASSES =
	'motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|footway|service';

/** Lebar jalur per kelas, meter. Dipakai untuk menggambar pita jalan. */
const ROAD_WIDTH = {
	motorway: 16,
	trunk: 15,
	primary: 13,
	secondary: 11,
	tertiary: 9,
	residential: 7,
	unclassified: 6,
	living_street: 5,
	service: 4,
	pedestrian: 4,
	footway: 2.4
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
	let lastErr;
	for (let attempt = 0; attempt < 4; attempt++) {
		const url = ENDPOINTS[attempt % ENDPOINTS.length];
		try {
			// Overpass membalas 406 untuk permintaan tanpa User-Agent yang jelas —
			// bukan soal isi kuerinya. Header ini yang membuatnya dilayani.
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)',
					accept: 'application/json'
				},
				body: new URLSearchParams({ data: query })
			});
			if (res.status === 429 || res.status === 504) {
				await sleep(6000 * (attempt + 1));
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			await sleep(4000 * (attempt + 1));
		}
	}
	throw lastErr ?? new Error('Overpass gagal');
}

/** Meter per derajat pada lintang tertentu — cukup akurat untuk radius ratusan meter. */
function projector(lat0, lon0) {
	const mPerLat = 111132.92 - 559.82 * Math.cos((2 * lat0 * Math.PI) / 180);
	const mPerLon = 111412.84 * Math.cos((lat0 * Math.PI) / 180);
	// x ke timur, z ke selatan → utara berada di -Z, sesuai adegan Y-up dilihat dari atas
	return (lat, lon) => [(lon - lon0) * mPerLon, -(lat - lat0) * mPerLat];
}

/** Luas poligon (meter persegi) lewat rumus shoelace. */
function area(ring) {
	let a = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
	}
	return Math.abs(a) / 2;
}

/**
 * Tinggi bangunan. Mengembalikan [meter, ditebak?].
 * Urutannya: tag height → tag levels → perkiraan dari jenis & luas tapak.
 */
function heightOf(tags = {}, footprint) {
	const h = parseFloat(tags.height);
	if (Number.isFinite(h) && h > 1 && h < 400) return [h, 0];

	const lv = parseInt(tags['building:levels'], 10);
	if (Number.isFinite(lv) && lv > 0 && lv < 120) return [lv * 3.2 + 1.2, 0];

	// Tidak ada tag tinggi: diperkirakan. Ini yang ditandai est = 1.
	const t = tags.building ?? 'yes';
	const tall = ['apartments', 'residential', 'hotel', 'office', 'commercial', 'retail', 'mall'];
	let levels;
	if (t === 'house' || t === 'hut' || t === 'bungalow' || t === 'garage') levels = 1;
	else if (t === 'kiosk' || t === 'shed' || t === 'roof') levels = 1;
	else if (tall.includes(t)) levels = footprint > 2500 ? 8 : footprint > 900 ? 5 : 3;
	else levels = footprint > 2000 ? 4 : footprint > 600 ? 3 : footprint > 140 ? 2 : 1;
	return [levels * 3.2 + 1.2, 1];
}

const r1 = (n) => Math.round(n * 10) / 10;

async function main() {
	const stations = JSON.parse(
		readFileSync(resolve(ROOT, 'src/lib/data/stations.json'), 'utf8')
	);

	const out = [];
	let totalB = 0;
	let totalEst = 0;

	for (const [i, st] of stations.entries()) {
		const q = `[out:json][timeout:90];(way["building"](around:${RADIUS},${st.lat},${st.lon});way["highway"~"^(${ROAD_CLASSES})$"](around:${RADIUS},${st.lat},${st.lon}););out geom;`;
		process.stdout.write(`[${i + 1}/${stations.length}] ${st.name} … `);

		const data = await overpass(q);
		const project = projector(st.lat, st.lon);

		const buildings = [];
		const roads = [];

		for (const el of data.elements) {
			if (el.type !== 'way' || !el.geometry) continue;
			const pts = el.geometry.map((g) => project(g.lat, g.lon));

			if (el.tags?.building) {
				if (pts.length < 4) continue;
				// buang simpul penutup; ring disimpan terbuka
				const ring = pts.slice(0, -1);
				const a = area(ring);
				if (a < 12) continue; // gubuk kecil: hanya jadi derau di maket
				const [h, est] = heightOf(el.tags, a);
				buildings.push({
					r: ring.flatMap(([x, z]) => [r1(x), r1(z)]),
					h: r1(h),
					est
				});
				totalB++;
				totalEst += est;
			} else if (el.tags?.highway) {
				if (pts.length < 2) continue;
				roads.push({
					p: pts.flatMap(([x, z]) => [r1(x), r1(z)]),
					w: ROAD_WIDTH[el.tags.highway] ?? 5
				});
			}
		}

		out.push({ id: `S${i}`, name: st.name, buildings, roads });
		console.log(`${buildings.length} bangunan, ${roads.length} ruas jalan`);

		// Overpass dipakai bersama-sama; jangan dihajar tanpa jeda.
		if (i < stations.length - 1) await sleep(2500);
	}

	const meta = {
		radius: RADIUS,
		source: 'OpenStreetMap contributors (ODbL) via Overpass API',
		generated: 'jalankan ulang scripts/fetch-blocks.mjs untuk menyegarkan',
		heightNote:
			'Tinggi memakai tag height/building:levels bila ada. Sisanya diperkirakan dari jenis dan luas tapak, ditandai est = 1.',
		buildings: totalB,
		estimated: totalEst
	};

	const dest = resolve(ROOT, 'src/lib/data/blocks.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, blocks: out }));

	const pctEst = Math.round((totalEst / totalB) * 100);
	console.log(
		`\n${totalB} bangunan tersimpan · ${pctEst}% tingginya diperkirakan (bukan dari tag OSM)`
	);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
