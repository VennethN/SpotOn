/**
 * Downloads real OSM geometry around each station and stores it as ready-to-use
 * local metre coordinates for the 3D diorama.
 *
 * Run by hand whenever the data needs refreshing:
 *   node scripts/fetch-blocks.mjs
 *
 * Output is `src/lib/data/blocks.json`. Deliberately kept as a file rather than
 * fetched at runtime: Overpass is rate-limited and has no business sitting in the
 * user's page-load path.
 *
 * On building heights: only a small share of Jakarta's buildings carry a `height`
 * or `building:levels` tag. Those that don't are ESTIMATED from their type and
 * footprint area, and flagged with `est: 1`. That flag has to survive all the way
 * to the interface — a guessed mass must never be presented as a measured one.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RADIUS = 340;
/** How many cells to pull geometry for. The diorama only ever stands in one at a time. */
const STATION_COUNT = 13;
const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];

const ROAD_CLASSES =
	'motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|footway|service';

/** Lane width per class, in metres. Used to draw the road ribbons. */
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
			// Overpass answers 406 for requests without an explicit User-Agent —
			// nothing to do with the query itself. This header is what gets it served.
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
	throw lastErr ?? new Error('Overpass failed');
}

/** Metres per degree at a given latitude — accurate enough for radii of a few hundred metres. */
function projector(lat0, lon0) {
	const mPerLat = 111132.92 - 559.82 * Math.cos((2 * lat0 * Math.PI) / 180);
	const mPerLon = 111412.84 * Math.cos((lat0 * Math.PI) / 180);
	// x east, z south → north lands on -Z, matching a Y-up scene seen from above
	return (lat, lon) => [(lon - lon0) * mPerLon, -(lat - lat0) * mPerLat];
}

/** Polygon area (square metres) via the shoelace formula. */
function area(ring) {
	let a = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
	}
	return Math.abs(a) / 2;
}

/**
 * Building height. Returns [metres, estimated?].
 * Order: height tag → levels tag → estimate from type & footprint area.
 */
function heightOf(tags = {}, footprint) {
	const h = parseFloat(tags.height);
	if (Number.isFinite(h) && h > 1 && h < 400) return [h, 0];

	const lv = parseInt(tags['building:levels'], 10);
	if (Number.isFinite(lv) && lv > 0 && lv < 120) return [lv * 3.2 + 1.2, 0];

	// No height tag: estimate it. This is what gets flagged est = 1.
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
	/* The cells the grid itself holds, best-served first. This used to read a
	   `stations.json` that carried a hand-made set of thirteen stations along with
	   generated receipt, menu and property figures for each. The figures are gone and so
	   is the file, and the coordinates it was actually used for are in the grid. */
	const grid = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/hexes.json'), 'utf8'));
	const stations = grid.hexes
		.filter((h) => h.name)
		.slice(0, STATION_COUNT)
		.map((h) => ({ name: h.name, lat: h.lat, lon: h.lon }));

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
				// drop the closing node; the ring is stored open
				const ring = pts.slice(0, -1);
				const a = area(ring);
				if (a < 12) continue; // tiny shacks: nothing but noise in the diorama
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
		console.log(`${buildings.length} buildings, ${roads.length} road segments`);

		// Overpass is a shared service; don't hammer it without a pause.
		if (i < stations.length - 1) await sleep(2500);
	}

	const meta = {
		radius: RADIUS,
		source: 'OpenStreetMap contributors (ODbL) via Overpass API',
		generated: 're-run scripts/fetch-blocks.mjs to refresh',
		heightNote:
			'Heights use the height/building:levels tags where present. The rest are estimated from type and footprint area, flagged est = 1.',
		buildings: totalB,
		estimated: totalEst
	};

	const dest = resolve(ROOT, 'src/lib/data/blocks.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, blocks: out }));

	const pctEst = Math.round((totalEst / totalB) * 100);
	console.log(
		`\n${totalB} buildings written · ${pctEst}% of heights estimated (not from OSM tags)`
	);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
