/**
 * Joins the MAPID premium POIs onto the hexagon grid.
 *
 *   node scripts/join-mapid.mjs
 *
 * Reads `src/lib/data/hexes.json` and `src/lib/data/mapid-poi.json`, then
 * rewrites `hexes.json` with two additions per cell:
 *
 *   mapid   — MAPID competitor counts per category within walking range
 *   covered — per category: does this cell's city already have a MAPID dataset
 *
 * WHY COVERAGE IS DECIDED PER CITY, NOT PER DISTANCE
 *
 * The tempting approach is to mark a cell "covered" whenever a MAPID POI sits
 * nearby. That is wrong: 660 coffee shops spread across five administrative
 * cities is not a high density, so a cell on the edge of a city whose dataset HAS
 * been imported may well hold no POI at any radius — and would be wrongly marked
 * "not covered". Conversely, a cell in a city that has not been imported can
 * happen to sit near a neighbouring city's POIs and be wrongly marked "covered".
 *
 * Coverage is a city-level fact: datasets are imported per administrative city.
 * So the city boundaries are pulled from OSM, each cell is assigned its city via a
 * point-in-polygon test, and coverage is read off the list of cities whose
 * datasets exist.
 *
 * A cell that is not covered is NOT given zero competitors. Zero means "checked,
 * and there really is nothing there"; not covered means "not checked yet".
 * Telling those two apart is the heart of this project's promise of honest data.
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

/** Normalises a city name so that "KOTA ADM. JAKARTA PUSAT" and "Kota Administrasi
    Jakarta Pusat" count as the same place. */
function normCity(s) {
	return String(s ?? '')
		.toUpperCase()
		.replace(/KOTA ADMINISTRASI|KOTA ADM\.?|KABUPATEN|KOTA/g, '')
		.replace(/[^A-Z]/g, '');
}

async function main() {
	const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const poi = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/mapid-poi.json'), 'utf8'));

	console.log(`${grid.hexes.length} cells · ${poi.points.length} MAPID points\n`);

	// Which cities already have a dataset, per category.
	const coveredCities = {};
	for (const c of CATEGORIES) coveredCities[c] = new Set();
	for (const p of poi.points) {
		if (p.city) coveredCities[p.cat]?.add(normCity(p.city));
	}
	console.log('Covered cities per category:');
	for (const c of CATEGORIES) {
		console.log(
			`  ${c.padEnd(11)} ${coveredCities[c].size ? [...coveredCities[c]].join(', ') : '(none yet)'}`
		);
	}

	// City/regency boundaries from OSM — this is what makes coverage assessable
	// precisely instead of guessed from proximity.
	// admin_level=5 is the city/regency level in Indonesia. An earlier attempt used
	// 6, and what came back were subdistricts (Kebon Jeruk, Cilincing, Pulo Gadung)
	// — none of which matched KABKOT, so every cell was wrongly marked "not
	// covered" without a single error surfacing.
	console.log('\nFetching administrative boundaries from OSM (admin_level=5)…');
	const q = `[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="5"](-6.45,106.55,-6.02,107.15);
out geom;`;
	const raw = await overpass(q, 'boundaries');

	const cities = [];
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
	console.log(
		`  ${cities.length} areas: ${cities
			.map((k) => k.name)
			.join(', ')
			.slice(0, 140)}`
	);

	// Index the POIs per category
	const byCat = {};
	for (const c of CATEGORIES) byCat[c] = [];
	for (const p of poi.points) byCat[p.cat]?.push(p);

	console.log('\nJoining…');
	let assigned = 0;
	const tally = { covered: 0, uncovered: 0 };

	for (const h of grid.hexes) {
		// the city this cell falls in
		let city = null;
		for (const k of cities) {
			if (h.lon < k.bbox[0] || h.lon > k.bbox[2] || h.lat < k.bbox[1] || h.lat > k.bbox[3])
				continue;
			if (inRing(h.lon, h.lat, k.ring)) {
				city = k;
				break;
			}
		}
		if (city) assigned++;
		h.city = city?.name ?? null;

		const mapid = {};
		const covered = {};
		for (const c of CATEGORIES) {
			const isCovered = Boolean(city && coveredCities[c].has(city.key));
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
	}

	grid.meta.mapid = {
		source: poi.meta.source,
		project_id: poi.meta.project_id,
		points: poi.points.length,
		coveredCities: Object.fromEntries(CATEGORIES.map((c) => [c, [...coveredCities[c]]])),
		rule: 'Coverage is decided per administrative city (boundaries from OSM admin_level=5), not from POI proximity. Cells in a city whose dataset has not been imported are null — not checked yet, not zero competitors.',
		regenerate: 'node scripts/fetch-mapid.mjs && node scripts/join-mapid.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	const withCity = grid.hexes.filter((h) => h.city).length;
	console.log(`  cells with a city assigned : ${withCity}/${grid.hexes.length}`);
	console.log(
		`  cell×category pairs        : ${tally.covered} covered · ${tally.uncovered} not covered`
	);
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
