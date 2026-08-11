/**
 * Membangun kisi heksagon Jakarta beserta atributnya.
 *
 *   node scripts/build-hexes.mjs
 *
 * Keluaran: `src/lib/data/hexes.json`.
 *
 * KENAPA HEKSAGON, BUKAN CATCHMENT PER HALTE
 *
 * Halte TransJakarta berjarak 400–500 m satu sama lain, sedangkan radius jalan
 * kaki yang dipakai 800 m. Kalau tiap halte diberi catchment sendiri, catchment
 * yang bersebelahan nyaris bertumpuk seluruhnya: pembeli yang sama dihitung tiga
 * empat kali, dan "5 kawasan teratas" hanya akan mengembalikan lima halte
 * berdampingan di koridor yang sama. Menambah 995 halte ke model lama justru
 * membuat skornya kurang bisa dipercaya, bukan lebih.
 *
 * Kisi heksagon menyelesaikannya: tiap petak dihitung sekali, tidak ada wilayah
 * yang tumpang tindih, dan akses transit menjadi *sifat* sebuah petak — sehingga
 * lokasi yang dilayani MRT sekaligus TransJakarta memang bernilai lebih tinggi
 * daripada yang hanya dilayani salah satunya.
 *
 * Resolusi 8 (sisi ±531 m, lebar ±1 km) dipilih supaya satu petak sebanding
 * dengan catchment 800 m yang dipakai sebelumnya, dan tetap terbaca pada peta
 * seluruh kota.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as h3 from 'h3-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = 8;
/** Jangkauan jalan kaki yang dipakai untuk menghitung akses & pesaing. */
const WALK_M = 800;
const BBOX = '-6.42,106.65,-6.05,107.05';

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];
const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, label) {
	let lastErr;
	for (let attempt = 0; attempt < 5; attempt++) {
		const url = ENDPOINTS[attempt % ENDPOINTS.length];
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': UA,
					accept: 'application/json'
				},
				body: new URLSearchParams({ data: query })
			});
			if (res.status === 429 || res.status === 504) {
				// Overpass dipakai bersama-sama; kena batas laju itu wajar, bukan galat.
				const wait = 8000 * (attempt + 1);
				console.log(`  (${label}) dibatasi laju, tunggu ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			await sleep(5000 * (attempt + 1));
		}
	}
	throw lastErr ?? new Error(`Overpass gagal: ${label}`);
}

/* ── jarak ────────────────────────────────────────────────────────────────── */

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function haversine(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const la1 = rad(aLat);
	const la2 = rad(bLat);
	const x =
		Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

/** Indeks spasial kasar: ember 0.01° (±1.1 km) — cukup untuk radius 800 m. */
function makeIndex(points) {
	const cell = 0.01;
	const map = new Map();
	for (const p of points) {
		const k = `${Math.floor(p.lat / cell)}|${Math.floor(p.lon / cell)}`;
		let arr = map.get(k);
		if (!arr) map.set(k, (arr = []));
		arr.push(p);
	}
	return {
		near(lat, lon, radius) {
			const out = [];
			const gy = Math.floor(lat / cell);
			const gx = Math.floor(lon / cell);
			const span = Math.ceil(radius / 1100) + 1;
			for (let dy = -span; dy <= span; dy++) {
				for (let dx = -span; dx <= span; dx++) {
					const arr = map.get(`${gy + dy}|${gx + dx}`);
					if (!arr) continue;
					for (const p of arr) {
						if (haversine(lat, lon, p.lat, p.lon) <= radius) out.push(p);
					}
				}
			}
			return out;
		}
	};
}

/* ── deterministik ────────────────────────────────────────────────────────── */

function hashSeed(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function mulberry32(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/* ── klasifikasi ──────────────────────────────────────────────────────────── */

function transitMode(tags = {}) {
	const op = (tags.operator ?? '') + ' ' + (tags.network ?? '');
	if (tags.station === 'subway' || tags.subway === 'yes') return 'mrt';
	if (tags.station === 'light_rail' || tags.light_rail === 'yes') return 'lrt';
	if (tags.railway === 'station' || tags.railway === 'halt') return 'krl';
	if (/transjakarta/i.test(op)) return 'brt';
	return null;
}

function poiCategory(tags = {}) {
	if (tags.amenity === 'cafe') return 'kopi';
	if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'warung';
	if (tags.shop === 'convenience' || tags.shop === 'supermarket') return 'minimarket';
	if (tags.shop === 'laundry') return 'laundry';
	if (tags.amenity === 'pharmacy') return 'apotek';
	return null;
}

/** Bobot moda: kapasitas angkut berbeda, jadi kontribusi aksesnya berbeda. */
const MODE_WEIGHT = { mrt: 1.0, krl: 0.9, lrt: 0.6, brt: 0.45 };

const CATEGORIES = ['kopi', 'warung', 'minimarket', 'laundry', 'apotek'];

/* ── program ──────────────────────────────────────────────────────────────── */

async function main() {
	console.log(`Kisi heksagon H3 resolusi ${RES} · radius jalan kaki ${WALK_M} m\n`);

	// 1) simpul transit — satu kueri untuk semua moda
	console.log('[1/4] Mengambil simpul transit…');
	const transitQuery = `[out:json][timeout:180];(
node["station"="subway"](${BBOX});
node["railway"="station"](${BBOX});
node["railway"="halt"](${BBOX});
node["station"="light_rail"](${BBOX});
node["highway"="bus_stop"]["operator"~"TransJakarta",i](${BBOX});
node["public_transport"="platform"]["operator"~"TransJakarta",i](${BBOX});
);out body;`;
	const transitRaw = await overpass(transitQuery, 'transit');

	const stops = [];
	const seen = new Set();
	for (const el of transitRaw.elements) {
		if (el.type !== 'node' || el.lat == null) continue;
		const mode = transitMode(el.tags);
		if (!mode) continue;
		// Halte arah berlawanan sering dua simpul terpisah ±30 m; dedup kasar
		// supaya satu tempat henti tidak dihitung dua kali.
		const key = `${mode}|${el.lat.toFixed(4)}|${el.lon.toFixed(4)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		stops.push({ lat: el.lat, lon: el.lon, mode, name: el.tags?.name ?? null });
	}
	const byMode = stops.reduce((a, s) => ((a[s.mode] = (a[s.mode] ?? 0) + 1), a), {});
	console.log(`      ${stops.length} simpul:`, byMode);

	await sleep(4000);

	// 2) POI pesaing — satu kueri untuk lima kategori
	console.log('[2/4] Mengambil POI pesaing…');
	const poiQuery = `[out:json][timeout:180];(
node["amenity"~"^(cafe|restaurant|fast_food|pharmacy)$"](${BBOX});
node["shop"~"^(convenience|supermarket|laundry)$"](${BBOX});
way["amenity"~"^(cafe|restaurant|fast_food|pharmacy)$"](${BBOX});
way["shop"~"^(convenience|supermarket|laundry)$"](${BBOX});
);out center;`;
	const poiRaw = await overpass(poiQuery, 'poi');

	const pois = [];
	for (const el of poiRaw.elements) {
		const lat = el.lat ?? el.center?.lat;
		const lon = el.lon ?? el.center?.lon;
		if (lat == null || lon == null) continue;
		const cat = poiCategory(el.tags);
		if (!cat) continue;
		pois.push({ lat, lon, cat });
	}
	const byCat = pois.reduce((a, p) => ((a[p.cat] = (a[p.cat] ?? 0) + 1), a), {});
	console.log(`      ${pois.length} POI:`, byCat);

	// 3) kisi: semua petak yang bersinggungan dengan jangkauan jalan kaki simpul transit
	console.log('[3/4] Membangun kisi…');
	const cells = new Set();
	for (const s of stops) {
		const home = h3.latLngToCell(s.lat, s.lon, RES);
		// gridDisk 1 menutup petak tetangga; lebar petak ±1 km, jadi ini sudah
		// mencakup jangkauan 800 m dari simpul mana pun di dalamnya.
		for (const c of h3.gridDisk(home, 1)) cells.add(c);
	}
	console.log(`      ${cells.size} petak`);

	const stopIndex = makeIndex(stops);
	const poiIndex = makeIndex(pois);

	// 4) atribut per petak
	console.log('[4/4] Menghitung atribut…');
	const hexes = [];
	let nodataCount = 0;

	for (const id of cells) {
		const [lat, lon] = h3.cellToLatLng(id);
		const nearStops = stopIndex.near(lat, lon, WALK_M);
		if (nearStops.length === 0) continue; // petak tanpa akses transit bukan urusan produk ini

		const transit = { mrt: 0, krl: 0, lrt: 0, brt: 0 };
		for (const s of nearStops) transit[s.mode]++;

		// Akses: jumlah berbobot, diredam akar supaya halte ke-11 tidak dihitung
		// sepenting halte pertama.
		const weighted =
			transit.mrt * MODE_WEIGHT.mrt +
			transit.krl * MODE_WEIGHT.krl +
			transit.lrt * MODE_WEIGHT.lrt +
			transit.brt * MODE_WEIGHT.brt;
		const access = Math.min(1, Math.sqrt(weighted) / 3.2);

		const nearPois = poiIndex.near(lat, lon, WALK_M);
		const osm = { kopi: 0, warung: 0, minimarket: 0, laundry: 0, apotek: 0 };
		for (const p of nearPois) osm[p.cat]++;

		// Nama manusiawi: simpul transit terdekat yang punya nama.
		let label = null;
		let best = Infinity;
		for (const s of nearStops) {
			if (!s.name) continue;
			const d = haversine(lat, lon, s.lat, s.lon);
			if (d < best) {
				best = d;
				label = s.name;
			}
		}

		const rnd = mulberry32(hashSeed(id));

		// ── atribut misi MAPID: CONTOH ──────────────────────────────────────
		// Belum publik, jadi dibangkitkan — tapi tidak acak buta: bentuknya
		// mengikuti akses transit dan kepadatan usaha yang NYATA, supaya polanya
		// masuk akal secara spasial. Tetap wajib ditandai contoh di antarmuka.
		const nodata = rnd() < 0.18;
		if (nodata) nodataCount++;

		const activity = access * 0.65 + Math.min(1, nearPois.length / 60) * 0.35;

		let jam = null;
		let nStruk = 0;
		let nMenu = 0;
		let nProp = 0;
		let nontunai = 0;
		let ramai = null;
		let listing = null;
		let d = null;

		if (!nodata) {
			const peakHour = rnd() < 0.5 ? 12 : 19;
			const scale = 8 + activity * 46;
			jam = Array.from({ length: 24 }, (_, h) => {
				const morning = Math.exp(-((h - 7.5) ** 2) / 5) * 0.55;
				const noon = Math.exp(-((h - 12) ** 2) / 6) * (peakHour === 12 ? 1 : 0.7);
				const evening = Math.exp(-((h - 19) ** 2) / 7) * (peakHour === 19 ? 1 : 0.72);
				const night = h >= 1 && h <= 4 ? 0 : 0.05;
				return Math.round((morning + noon + evening + night) * scale * (0.85 + rnd() * 0.3));
			});
			nStruk = jam.reduce((a, v) => a + v, 0);
			nMenu = Math.round(nearPois.length * (0.3 + rnd() * 0.5));
			nProp = Math.round(4 + activity * 26 * (0.5 + rnd()));
			nontunai = Math.round((0.28 + access * 0.5 + rnd() * 0.12) * 100) / 100;

			ramai = {};
			listing = {};
			d = {};
			for (const c of CATEGORIES) {
				ramai[c] = Math.round((0.2 + rnd() * 0.6) * 100) / 100;
				listing[c] = Math.round(rnd() * (nProp / 4));
				d[c] = Math.round(Math.min(1, activity * (0.55 + rnd() * 0.7)) * 100) / 100;
			}
		}

		hexes.push({
			id,
			lat: Math.round(lat * 1e5) / 1e5,
			lon: Math.round(lon * 1e5) / 1e5,
			boundary: h3
				.cellToBoundary(id)
				.map(([blat, blon]) => [Math.round(blon * 1e5) / 1e5, Math.round(blat * 1e5) / 1e5]),
			name: label,
			transit,
			access: Math.round(access * 1000) / 1000,
			osm,
			nodata: nodata || undefined,
			jam: jam ?? undefined,
			nStruk,
			nMenu,
			nProp,
			nontunai: nodata ? undefined : nontunai,
			ramai: ramai ?? undefined,
			listing: listing ?? undefined,
			d: d ?? undefined
		});
	}

	hexes.sort((a, b) => b.access - a.access);

	const meta = {
		resolution: RES,
		walkRadius: WALK_M,
		hexes: hexes.length,
		nodata: nodataCount,
		stops: stops.length,
		stopsByMode: byMode,
		pois: pois.length,
		poisByCategory: byCat,
		real: 'Simpul transit (MRT, KRL, LRT, TransJakarta) dan POI pesaing: OpenStreetMap via Overpass API (ODbL).',
		mock: 'Atribut misi MAPID (jam, struk, menu, properti, non-tunai) dibangkitkan mengikuti akses transit dan kepadatan usaha nyata — tetap CONTOH sampai API MAPID tersedia.',
		regenerate: 'node scripts/build-hexes.mjs'
	};

	const dest = resolve(ROOT, 'src/lib/data/hexes.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, hexes }));

	console.log(`\n${hexes.length} petak tersimpan (${nodataCount} belum terdata)`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
