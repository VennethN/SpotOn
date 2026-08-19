/**
 * Joins the MAPID premium POIs onto the hexagon grid.
 *
 *   node scripts/join-mapid.mjs
 *
 * Reads `src/lib/data/hexes.json` and `src/lib/data/mapid-poi.json`, then rewrites
 * `hexes.json` with two additions per cell:
 *
 *   mapid   — MAPID competitor counts per category within walking range
 *   covered — per category: does this cell's city already have a MAPID dataset
 *
 * WHY COVERAGE IS DECIDED PER CITY, NOT PER DISTANCE
 *
 * The tempting approach is to mark a cell "covered" whenever a MAPID POI sits
 * nearby. That is wrong: 895 coffee shops spread across five administrative cities
 * is not a high density, so a cell on the edge of a city whose dataset HAS been read
 * may well hold no POI at any radius — and would be wrongly marked "not covered".
 * Conversely, a cell in a city with no dataset can happen to sit near a neighbouring
 * city's POIs and be wrongly marked "covered".
 *
 * Coverage is a city-level fact: the MAPID catalogue ships one dataset per
 * administrative city. So the city boundaries are pulled from OSM, each cell is
 * assigned its city via a point-in-polygon test, and coverage is read off the list
 * of cities whose datasets were read successfully — a list declared by
 * `fetch-mapid.mjs`, not re-derived here.
 *
 * A cell that is not covered is NOT given zero competitors. Zero means "checked, and
 * there really is nothing there"; not covered means "not checked yet". Telling those
 * two apart is the heart of this project's promise of honest data.
 *
 * Since the premium catalogue became directly readable, four of the five categories
 * are fully covered across all five cities. What remains is `laundry` — genuinely
 * absent from the catalogue, so it stays null on every cell, and that is the correct
 * answer.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass } from './lib/overpass.mjs';
import { normCity } from './lib/mapid.mjs';

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

/** Ray casting; the ring is a [lon, lat][]. */
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

	console.log(`${grid.hexes.length} cells · ${poi.points.length} MAPID points\n`);

	// Which cities have had their datasets read, per category.
	//
	// What is used is the declaration from `fetch-mapid.mjs`, not an inference from
	// the KABKOT of whichever points survived classification. Inferring from points
	// conflates "the dataset does not exist" with "the dataset exists but yielded
	// zero rows after filtering" — both produce zero points, yet the first means not
	// checked and the second means checked. That distinction is precisely what this
	// map promises.
	//
	// The old inference is kept as a fallback for older `mapid-poi.json` files that
	// do not yet carry a `coverage` block.
	const coveredCities = {};
	for (const c of CATEGORIES) coveredCities[c] = new Set();
	const declared = poi.meta?.coverage;
	if (declared) {
		for (const c of CATEGORIES) for (const k of declared[c] ?? []) coveredCities[c].add(k);
		console.log('Coverage: declared by fetch-mapid.mjs\n');
	} else {
		for (const p of poi.points) if (p.city) coveredCities[p.cat]?.add(normCity(p.city));
		console.log('Coverage: inferred from points (old mapid-poi.json, re-run fetch-mapid.mjs)\n');
	}
	console.log('Covered cities per category:');
	for (const c of CATEGORIES) {
		console.log(`  ${c.padEnd(11)} ${coveredCities[c].size ? [...coveredCities[c]].join(', ') : '(none yet)'}`);
	}

	// City/regency boundaries from OSM — this is what makes coverage assessable
	// precisely instead of guessed from proximity.
	//
	// WHY THE RESULT IS REUSED
	//
	// Which cell sits in which city only changes when the grid itself changes, while
	// this script is re-run every time the MAPID data is refreshed. Re-pulling the
	// administrative boundaries each time would hang the whole join on the most
	// fragile service in the chain: one run once burned seven minutes and failed with
	// a 503 because every Overpass mirror was saturated — when the answer was already
	// stored in `hexes.json` from the previous run, unchanged in every respect.
	//
	// So boundaries are only pulled when they are genuinely absent. Force it with
	// `--refresh-kota` after the grid has been rebuilt or the OSM boundaries change.
	// (The flag keeps its Indonesian name: it is documented in docs/04-data-mapid.md.)
	const refresh = process.argv.includes('--refresh-kota');
	// The test is "some cell GENUINELY got a city", not "the key is present".
	//
	// It was once tested with `every((h) => 'city' in h)`, and that was wrong in a way
	// that made no sound: `h.city = cityName` writes the key for every cell including
	// the null ones, and JSON stores null as-is. So a single run whose administrative
	// boundaries came back empty — a mirror answering `{"elements":[]}`, or the wrong
	// `admin_level` as has happened before — produces `"city": null` on every cell,
	// passes that test forever, and marks every cell×category pair "not covered" with
	// nothing able to fix it short of remembering to use `--refresh-kota`.
	const cached = grid.hexes.some((h) => h.city);

	let cities = null;
	if (cached && !refresh) {
		const n = grid.hexes.filter((h) => h.city).length;
		console.log(`\nAdministrative boundaries: using the stored assignment (${n}/${grid.hexes.length} cells)`);
		console.log('  run with --refresh-kota to pull them again from OSM');
	} else {
		// admin_level=5 is the city/regency level in Indonesia. An earlier attempt used
		// 6, and what came back were subdistricts (Kebon Jeruk, Cilincing, Pulo Gadung)
		// — none of which matched KABKOT, so every cell was wrongly marked "not
		// covered" without a single error surfacing.
		console.log('\nFetching administrative boundaries from OSM (admin_level=5)…');
		const q = `[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="5"](-6.45,106.55,-6.02,107.15);
out geom;`;
		const raw = await overpass(q, 'boundaries');

		cities = [];
		for (const rel of raw.elements) {
			if (rel.type !== 'relation' || !rel.members) continue;
			const name = rel.tags?.name;
			if (!name) continue;
			// Merge every member way into one rough set of rings; for a "which city is
			// this in" test that is plenty — we are not drawing the boundary.
			const ring = [];
			for (const m of rel.members) {
				if (m.type !== 'way' || !m.geometry) continue;
				for (const g of m.geometry) ring.push([g.lon, g.lat]);
			}
			if (ring.length < 4) continue;
			const lons = ring.map((r) => r[0]);
			const lats = ring.map((r) => r[1]);
			cities.push({
				name,
				key: normCity(name),
				ring,
				bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
			});
		}
		console.log(`  ${cities.length} areas: ${cities.map((k) => k.name).join(', ').slice(0, 140)}`);
	}

	// Index the POIs per category
	const byCat = {};
	for (const c of CATEGORIES) byCat[c] = [];
	for (const p of poi.points) byCat[p.cat]?.push(p);

	console.log('\nJoining…');
	const tally = { covered: 0, uncovered: 0 };

	for (const h of grid.hexes) {
		// this cell's city — from the point-in-polygon test if the boundaries were just
		// pulled, or from the name already stored on the cell.
		let cityName = null;
		if (cities) {
			for (const k of cities) {
				if (h.lon < k.bbox[0] || h.lon > k.bbox[2] || h.lat < k.bbox[1] || h.lat > k.bbox[3]) continue;
				if (inRing(h.lon, h.lat, k.ring)) {
					cityName = k.name;
					break;
				}
			}
		} else {
			cityName = h.city ?? null;
		}
		h.city = cityName;
		// The key is recomputed from the name through the same normCity that
		// fetch-mapid.mjs uses, so the stored path and the re-pull path cannot judge
		// coverage in different ways.
		const cityKey = cityName ? normCity(cityName) : null;

		const mapid = {};
		const covered = {};
		for (const c of CATEGORIES) {
			const isCovered = Boolean(cityKey && coveredCities[c].has(cityKey));
			covered[c] = isCovered;
			if (!isCovered) {
				// Deliberately NOT written as zero — the reader must be forced to tell
				// "no competitors" apart from "not checked yet".
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
		// The MAPID half of the density the score reads its demand from. Null where the
		// city was never surveyed, for the same reason the counts above are: a zero here
		// would call an unread city empty of trade.
		const anyCovered = Object.values(covered).some(Boolean);
		h.dens = {
			...(h.dens ?? { osm: 0 }),
			mapid: anyCovered ? Object.values(mapid).reduce((a, n) => a + (n ?? 0), 0) : null
		};
	}

	grid.meta.mapid = {
		source: poi.meta.source,
		project_id: poi.meta.project_id,
		points: poi.points.length,
		coveredCities: Object.fromEntries(
			CATEGORIES.map((c) => [c, [...coveredCities[c]]])
		),
		coverageSource: poi.meta?.coverage ? 'declared by fetch-mapid.mjs' : 'inferred from points',
		rule: 'Coverage is decided per administrative city (boundaries from OSM admin_level=5), not from POI proximity. Cells in a city whose dataset is absent from the catalogue are null — not checked yet, not zero competitors.',
		regenerate: 'node scripts/fetch-mapid.mjs && node scripts/join-mapid.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	const withCity = grid.hexes.filter((h) => h.city).length;
	console.log(`  cells with a city assigned : ${withCity}/${grid.hexes.length}`);
	console.log(`  cell×category pairs        : ${tally.covered} covered · ${tally.uncovered} not covered`);
	const tot = {};
	for (const c of CATEGORIES) {
		tot[c] = grid.hexes.reduce((a, h) => a + (h.mapid?.[c] ?? 0), 0);
	}
	console.log('  total MAPID competitors counted:', tot);
	console.log(`\n→ ${hexPath}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
