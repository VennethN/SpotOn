/**
 * Builds Jakarta's hexagon grid along with its attributes.
 *
 *   node scripts/build-hexes.mjs
 *
 * Output: `src/lib/data/hexes.json`.
 *
 * WHY HEXAGONS, NOT A CATCHMENT PER STOP
 *
 * TransJakarta stops sit 400–500 m apart, while the walking radius in use is
 * 800 m. Give every stop its own catchment and neighbouring catchments overlap
 * almost entirely: the same customer is counted three or four times, and "top 5
 * areas" just returns five adjacent stops along the same corridor. Adding 995
 * stops to the old model made the scores less trustworthy, not more.
 *
 * A hexagon grid settles it: each cell is counted once, no areas overlap, and
 * transit access becomes a *property* of a cell — so a location served by both the
 * MRT and TransJakarta genuinely scores higher than one served by only one of them.
 *
 * Resolution 8 (edge ±531 m, width ±1 km) was chosen so that one cell is
 * comparable to the 800 m catchment used before, while staying legible on a
 * city-wide map.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, sleep } from './lib/overpass.mjs';
import * as h3 from 'h3-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = 8;
/** The walking range used to compute access & competitors. */
const WALK_M = 800;
const BBOX = '-6.42,106.65,-6.05,107.05';


/* ── distance ─────────────────────────────────────────────────────────────── */

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

/** Coarse spatial index: 0.01° buckets (±1.1 km) — plenty for an 800 m radius. */
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

/* ── deterministic ────────────────────────────────────────────────────────── */

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

/* ── classification ───────────────────────────────────────────────────────── */

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

/** Mode weights: carrying capacity differs, so their contribution to access differs. */
const MODE_WEIGHT = { mrt: 1.0, krl: 0.9, lrt: 0.6, brt: 0.45 };

const CATEGORIES = ['kopi', 'warung', 'minimarket', 'laundry', 'apotek'];

/* ── program ──────────────────────────────────────────────────────────────── */

async function main() {
	console.log(`H3 hexagon grid at resolution ${RES} · walking radius ${WALK_M} m\n`);

	// 1) transit nodes — one query for every mode
	console.log('[1/4] Fetching transit nodes…');
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
		// Opposite-direction stops are often two separate nodes ±30 m apart; a coarse
		// dedup keeps one stopping place from being counted twice.
		const key = `${mode}|${el.lat.toFixed(4)}|${el.lon.toFixed(4)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		stops.push({ lat: el.lat, lon: el.lon, mode, name: el.tags?.name ?? null });
	}
	const byMode = stops.reduce((a, s) => ((a[s.mode] = (a[s.mode] ?? 0) + 1), a), {});
	console.log(`      ${stops.length} nodes:`, byMode);

	await sleep(4000);

	// 2) competitor POIs — one query for all five categories
	console.log('[2/4] Fetching competitor POIs…');
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
	console.log(`      ${pois.length} POIs:`, byCat);

	// 3) the grid: every cell that intersects the walking range of a transit node
	console.log('[3/4] Building the grid…');
	const cells = new Set();
	for (const s of stops) {
		const home = h3.latLngToCell(s.lat, s.lon, RES);
		// gridDisk 1 covers the neighbouring cells; a cell is ±1 km wide, so this
		// already spans the 800 m range from any node inside it.
		for (const c of h3.gridDisk(home, 1)) cells.add(c);
	}
	console.log(`      ${cells.size} cells`);

	const stopIndex = makeIndex(stops);
	const poiIndex = makeIndex(pois);

	// 4) per-cell attributes
	console.log('[4/4] Computing attributes…');
	const hexes = [];
	let nodataCount = 0;

	for (const id of cells) {
		const [lat, lon] = h3.cellToLatLng(id);
		const nearStops = stopIndex.near(lat, lon, WALK_M);
		if (nearStops.length === 0) continue; // a cell without transit access is not this product's business

		const transit = { mrt: 0, krl: 0, lrt: 0, brt: 0 };
		for (const s of nearStops) transit[s.mode]++;

		// Access: a weighted count, damped by a square root so the 11th stop does not
		// count for as much as the first.
		const weighted =
			transit.mrt * MODE_WEIGHT.mrt +
			transit.krl * MODE_WEIGHT.krl +
			transit.lrt * MODE_WEIGHT.lrt +
			transit.brt * MODE_WEIGHT.brt;
		const access = Math.min(1, Math.sqrt(weighted) / 3.2);

		const nearPois = poiIndex.near(lat, lon, WALK_M);
		const osm = { kopi: 0, warung: 0, minimarket: 0, laundry: 0, apotek: 0 };
		for (const p of nearPois) osm[p.cat]++;

		// A human-readable name: the nearest transit node that has one.
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

		// ── MAPID mission attributes: SAMPLE DATA ───────────────────────────
		// Not public yet, so these are generated — but not blindly random: their
		// shape follows the REAL transit access and business density, so the
		// pattern makes spatial sense. They must still be flagged as samples in
		// the interface.
		const nodata = rnd() < 0.18;
		if (nodata) nodataCount++;

		const activity = access * 0.65 + Math.min(1, nearPois.length / 60) * 0.35;

		let hourly = null;
		let nStruk = 0;
		let nMenu = 0;
		let nProp = 0;
		let cashless = 0;
		let busy = null;
		let listing = null;
		let d = null;

		if (!nodata) {
			const peakHour = rnd() < 0.5 ? 12 : 19;
			const scale = 8 + activity * 46;
			hourly = Array.from({ length: 24 }, (_, h) => {
				const morning = Math.exp(-((h - 7.5) ** 2) / 5) * 0.55;
				const noon = Math.exp(-((h - 12) ** 2) / 6) * (peakHour === 12 ? 1 : 0.7);
				const evening = Math.exp(-((h - 19) ** 2) / 7) * (peakHour === 19 ? 1 : 0.72);
				const night = h >= 1 && h <= 4 ? 0 : 0.05;
				return Math.round((morning + noon + evening + night) * scale * (0.85 + rnd() * 0.3));
			});
			nStruk = hourly.reduce((a, v) => a + v, 0);
			nMenu = Math.round(nearPois.length * (0.3 + rnd() * 0.5));
			nProp = Math.round(4 + activity * 26 * (0.5 + rnd()));
			cashless = Math.round((0.28 + access * 0.5 + rnd() * 0.12) * 100) / 100;

			busy = {};
			listing = {};
			d = {};
			for (const c of CATEGORIES) {
				busy[c] = Math.round((0.2 + rnd() * 0.6) * 100) / 100;
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
			hourly: hourly ?? undefined,
			nStruk,
			nMenu,
			nProp,
			cashless: nodata ? undefined : cashless,
			busy: busy ?? undefined,
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
		real: 'Transit nodes (MRT, KRL, LRT, TransJakarta) and competitor POIs: OpenStreetMap via Overpass API (ODbL).',
		mock: 'MAPID mission attributes (hourly profile, receipts, menus, properties, cashless share) are generated to follow real transit access and business density — still SAMPLE DATA until the MAPID API is available.',
		regenerate: 'node scripts/build-hexes.mjs'
	};

	const dest = resolve(ROOT, 'src/lib/data/hexes.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, hexes }));

	console.log(`\n${hexes.length} cells written (${nodataCount} with no data)`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
