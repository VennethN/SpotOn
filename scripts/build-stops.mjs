/**
 * Writes the transit stops the app draws.
 *
 *   node scripts/build-stops.mjs
 *
 * Output: `static/data/stops.json`.
 *
 * The grid already knows HOW MANY nodes of each mode a cell captures — that is what
 * transit access is computed from. What it does not keep is WHICH ones, because the
 * count is all the score needs. But "MRT ×2" tells someone choosing a location much
 * less than "Blok M and ASEAN", so the app names the stations a cell captures and
 * draws them on the map, and for that it needs the stops themselves.
 *
 * Served from `static/` rather than imported: MapLibre fetches it by URL like any
 * other asset, so it stays out of the JS bundle and is only pulled when a cell is
 * actually selected.
 *
 * The query, the mode classifier and the dedup all come from `lib/transit.mjs`, the
 * same module `build-hexes.mjs` uses — see the note there for why that matters.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass } from './lib/overpass.mjs';
import { TRANSIT_QUERY, readStops } from './lib/transit.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
	console.log('Fetching transit nodes…');
	const raw = await overpass(TRANSIT_QUERY, 'transit');
	const stops = readStops(raw);

	const byMode = stops.reduce((a, s) => ((a[s.mode] = (a[s.mode] ?? 0) + 1), a), {});
	console.log(`  ${stops.length} nodes:`, byMode);

	// Coordinates to five decimals (±1 m). Full float precision would roughly double
	// the file for a difference nobody can see at any zoom this map offers.
	//
	// Written as short keys and a flat array rather than GeoJSON: at ~1,100 stops the
	// repeated "type"/"geometry"/"properties" scaffolding costs more than the data.
	// The app builds the GeoJSON it needs for the handful of stops a cell captures.
	const out = {
		meta: {
			source: 'OpenStreetMap contributors (ODbL) via Overpass API',
			note: 'Simpul transit empat moda. Sama persis dengan yang dihitung build-hexes.mjs untuk akses transit tiap petak — keduanya memakai scripts/lib/transit.mjs.',
			count: stops.length,
			byMode,
			regenerate: 'node scripts/build-stops.mjs'
		},
		stops: stops.map((s) => ({
			n: s.name,
			m: s.mode,
			y: Math.round(s.lat * 1e5) / 1e5,
			x: Math.round(s.lon * 1e5) / 1e5
		}))
	};

	const dir = resolve(ROOT, 'static/data');
	mkdirSync(dir, { recursive: true });
	const path = resolve(dir, 'stops.json');
	writeFileSync(path, JSON.stringify(out));

	const named = stops.filter((s) => s.name).length;
	console.log(`  ${named} of ${stops.length} carry a name`);
	console.log(`\n→ ${path}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
