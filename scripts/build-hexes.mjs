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
 * areas" just returns five adjacent stops along the same corridor. Adding 995 stops
 * to the old model made the scores less trustworthy, not more.
 *
 * A hexagon grid settles it: each cell is counted once, no areas overlap, and
 * transit access becomes a *property* of a cell — so a location served by both the
 * MRT and TransJakarta genuinely scores higher than one served by only one of them.
 *
 * Resolution 8 (edge ±531 m, width ±1 km) was chosen so that one cell is comparable
 * to the 800 m catchment used before, while staying legible on a city-wide map.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, sleep } from './lib/overpass.mjs';
import { BBOX, TRANSIT_QUERY, readStops } from './lib/transit.mjs';
import * as h3 from 'h3-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = 8;
/** The walking range used to compute access & competitors. */
const WALK_M = 800;


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

/* ── classification ───────────────────────────────────────────────────────── */

/* `transitMode` and the transit query now live in `lib/transit.mjs`: the app draws
   the stops a cell captures, and it has to draw the very same ones this script
   counted. See the note over there. */

function poiCategory(tags = {}) {
	if (tags.amenity === 'cafe') return 'kopi';
	if (tags.amenity === 'ice_cream') return 'minuman';
	if (tags.shop === 'beverages' || tags.shop === 'bubble_tea') return 'minuman';
	if (tags.shop === 'bakery' || tags.shop === 'pastry') return 'roti';
	if (tags.amenity === 'fast_food') return 'cepatsaji';
	// `amenity=restaurant` is deliberately NOT mapped. Since warung was split into
	// warteg/mie/seafood/foreign restaurants, no single category is a fair home for
	// it, and OSM cannot separate them: only 48.9% of eating places in Jakarta Pusat
	// carry a `cuisine` tag, its vocabulary knows neither warteg nor Padang
	// restaurants, and `seafood` does not appear in the sample at all. Guessing from
	// `cuisine` would produce skewed counts, worst of all for warteg, the least
	// tagged. So those four categories are declared uncovered by OSM via
	// `osmTag: null`, and plain restaurants are not counted towards anything.
	if (tags.shop === 'convenience' || tags.shop === 'supermarket') return 'minimarket';
	// Deliberately kept apart from minimarket: OSM uses `convenience` for chain
	// outlets, while `grocery`/`general`/`kiosk` are for neighbourhood corner shops.
	// To someone about to open a business those are different competitors, so merging
	// them hides exactly what they are looking for.
	if (tags.shop === 'grocery' || tags.shop === 'general' || tags.shop === 'kiosk')
		return 'kelontong';
	if (tags.shop === 'laundry' || tags.shop === 'dry_cleaning') return 'laundry';
	if (tags.shop === 'car_repair' || tags.shop === 'motorcycle_repair') return 'bengkel';
	if (tags.amenity === 'pharmacy') return 'apotek';
	return null;
}

/**
 * POIs are fetched over several queries rather than one.
 *
 * Back at five categories, eight tag values fitted in a single query and Overpass
 * served it without complaint. Nine categories need eighteen values, and that query
 * started coming back `504 Gateway Timeout` over and over — not busy, but not
 * finishing within its time budget. Split like this each query is far lighter, and
 * one group failing does not drag down the whole fetch.
 *
 * There is a pause between groups because Overpass is a shared service; firing four
 * queries at once is a quick way to stop being an invited guest.
 */
const POI_GROUPS = [
	// `restaurant` is deliberately NOT requested. `poiCategory` maps it nowhere since
	// warung was split, so asking for it means hauling in and discarding some 2,400
	// elements on every run — weighing down the very queries this grouping exists to
	// lighten.
	{ key: 'amenity', values: 'cafe|fast_food|pharmacy|ice_cream' },
	{ key: 'shop', values: 'convenience|supermarket|grocery|general|kiosk' },
	{ key: 'shop', values: 'bakery|pastry|beverages|bubble_tea' },
	{ key: 'shop', values: 'laundry|dry_cleaning|car_repair|motorcycle_repair' }
];

/** Mode weights: carrying capacity differs, so their contribution to access differs. */
const MODE_WEIGHT = { mrt: 1.0, krl: 0.9, lrt: 0.6, brt: 0.45 };

/**
 * The categories that genuinely have a source in OSM. ONLY these may appear as keys
 * on `hexes.json.osm`.
 *
 * Whether a key exists is what the scoring engine reads as "fetched and genuinely
 * zero" versus "not covered". Writing a zero for a category with no OSM tag would
 * declare the whole of Jakarta free of warteg competitors — and since zero
 * competitors is the best score this map can give, its entire ranking becomes a lie.
 * This list has to match the non-null `osmTag` entries in
 * `src/lib/domain/categories.ts`.
 */
const OSM_CATEGORIES = new Set([
	'kopi',
	'minuman',
	'roti',
	'cepatsaji',
	'minimarket',
	'kelontong',
	'laundry',
	'bengkel',
	'apotek'
]);

/* ── program ──────────────────────────────────────────────────────────────── */

async function main() {
	console.log(`H3 hexagon grid at resolution ${RES} · walking radius ${WALK_M} m\n`);

	// 1) transit nodes — one query for every mode
	console.log('[1/4] Fetching transit nodes…');
	const transitRaw = await overpass(TRANSIT_QUERY, 'transit');
	const stops = readStops(transitRaw);
	const byMode = stops.reduce((a, s) => ((a[s.mode] = (a[s.mode] ?? 0) + 1), a), {});
	console.log(`      ${stops.length} nodes:`, byMode);

	await sleep(4000);

	// 2) competitor POIs — split over several queries, see the note on POI_GROUPS
	console.log('[2/4] Fetching competitor POIs…');
	const pois = [];
	for (const [gi, g] of POI_GROUPS.entries()) {
		const q = `[out:json][timeout:180];(
node["${g.key}"~"^(${g.values})$"](${BBOX});
way["${g.key}"~"^(${g.values})$"](${BBOX});
);out center;`;
		const raw = await overpass(q, `poi ${gi + 1}/${POI_GROUPS.length}`);
		let n = 0;
		for (const el of raw.elements) {
			const lat = el.lat ?? el.center?.lat;
			const lon = el.lon ?? el.center?.lon;
			if (lat == null || lon == null) continue;
			const cat = poiCategory(el.tags);
			if (!cat) continue;
			pois.push({ lat, lon, cat });
			n++;
		}
		console.log(`      [${gi + 1}/${POI_GROUPS.length}] ${String(n).padStart(5)} POI · ${g.key}=${g.values.slice(0, 46)}`);
		if (gi < POI_GROUPS.length - 1) await sleep(4000);
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
		const osm = Object.fromEntries([...OSM_CATEGORIES].map((c) => [c, 0]));
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
			// Business density: every counted POI in range, whatever its category. The
			// demand side of the score is read from this minus the category being asked
			// about, so it says how much OTHER trade a place already carries. Written per
			// cell rather than per category because it is one figure for all thirteen, and
			// the MAPID half is filled in later by `join-mapid.mjs` from its own points.
			dens: { osm: nearPois.length, mapid: null }
		});
	}

	hexes.sort((a, b) => b.access - a.access);

	const meta = {
		resolution: RES,
		walkRadius: WALK_M,
		hexes: hexes.length,
		stops: stops.length,
		stopsByMode: byMode,
		pois: pois.length,
		poisByCategory: byCat,
		real: 'Transit nodes (MRT, KRL, LRT, TransJakarta) and competitor POIs: OpenStreetMap via Overpass API (ODbL).',
		density:
			'Business density per cell: the same counted POIs, totalled across every category, per source. Demand is read from it minus the category being asked about.',
		regenerate: 'node scripts/build-hexes.mjs'
	};

	const dest = resolve(ROOT, 'src/lib/data/hexes.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, hexes }));

	console.log(`\n${hexes.length} cells written`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
