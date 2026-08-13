/**
 * Writes the competitor points the app draws.
 *
 *   node scripts/build-pois.mjs
 *
 * Output: `static/data/pois/<category>.json`, one file per business type.
 *
 * The grid already knows HOW MANY competitors a cell captures — that is one of the
 * two numbers the opportunity score is a difference between. What it does not keep
 * is WHERE they are, because the count is all the score needs. But "9 competitors"
 * tells someone choosing a location much less than nine dots showing that eight of
 * them sit on one street and the far side of the cell is empty, so the app draws the
 * competitors a cell captures the same way it draws the transit nodes it captures.
 *
 * SOURCE, AND WHY ONLY ONE OF THE TWO
 *
 * Read from `src/lib/data/mapid-poi.json`, the MAPID premium points, which is the
 * same file `join-mapid.mjs` counts to fill each cell's `mapid` column. Same points,
 * same walking radius, same distance test — so the dots on screen ARE the count the
 * score was computed from, not a second dataset that happens to resemble it.
 *
 * There is no OSM equivalent. `build-hexes.mjs` fetches OSM POIs with coordinates
 * but keeps only the per-cell counts, so nothing on disk knows where an OSM
 * competitor stands. The app says so rather than drawing MAPID points under an OSM
 * count, which would put one source's competitors next to another source's number.
 *
 * Served from `static/` rather than imported, like the stops: fetched by URL when a
 * cell is actually selected, one category at a time, so none of it is in the JS
 * bundle and the browser caches it as an ordinary asset.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
	const src = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	const file = JSON.parse(readFileSync(src, 'utf8'));
	const points = file.points ?? [];
	console.log(`Reading ${points.length} MAPID points…`);

	/** Points per category. A category with no points still gets a file: an empty
	    list is the honest answer to "where are they", and a missing file would make
	    the app report a failed fetch instead. */
	const byCat = new Map();
	for (const cat of Object.keys(file.meta?.byCategory ?? {})) byCat.set(cat, []);
	for (const p of points) {
		if (!byCat.has(p.cat)) byCat.set(p.cat, []);
		byCat.get(p.cat).push(p);
	}

	const dir = resolve(ROOT, 'static/data/pois');
	mkdirSync(dir, { recursive: true });

	let namedTotal = 0;
	for (const [cat, list] of [...byCat].sort(([a], [b]) => a.localeCompare(b))) {
		const named = list.filter((p) => p.name).length;
		namedTotal += named;
		// Coordinates to five decimals (±1 m) as a flat [y, x] pair, the same economy
		// `build-stops.mjs` applies: at up to 3,700 points per category the GeoJSON
		// scaffolding, or even named keys, would cost more than the data itself. The
		// app builds the GeoJSON it needs for the handful a cell actually captures.
		//
		// A named outlet gets a third slot. Left OFF entirely when there is no name,
		// rather than written as null: at 24,630 points the nulls alone would be
		// 120 KB of file saying nothing, and the reader has to tell "no name" from
		// "no label drawn" either way.
		const out = {
			meta: {
				cat,
				source: file.meta?.source ?? 'MAPID premium data (Data Premium)',
				note: 'Titik pesaing MAPID. Persis titik yang dihitung join-mapid.mjs untuk kolom `mapid` tiap petak, jadi cacah yang tergambar sama dengan cacah yang dipakai mesin skor.',
				count: list.length,
				/* How many carry a name of their own. Stated so a map with marks and no
				   labels can be read as what it is, rather than as a broken label
				   layer. Zero here means `mapid-poi.json` predates names being kept
				   (see the NAMA note in fetch-mapid.mjs) and needs a re-fetch. */
				named,
				/* Which cities were READ, carried over from the point file. A city that is
				   not here was never checked, and that is not the same fact as a city that
				   was checked and held no competitor. The app needs to be able to tell the
				   two apart before it draws an empty cell. */
				coverage: file.meta?.coverage?.[cat] ?? [],
				regenerate: 'node scripts/build-pois.mjs'
			},
			points: list.map((p) => {
				const y = Math.round(p.lat * 1e5) / 1e5;
				const x = Math.round(p.lon * 1e5) / 1e5;
				return p.name ? [y, x, p.name] : [y, x];
			})
		};

		const path = resolve(dir, `${cat}.json`);
		writeFileSync(path, JSON.stringify(out));
		console.log(
			`  ${String(list.length).padStart(5)} · ${String(named).padStart(5)} named · ${cat}.json`
		);
	}

	console.log(`\n→ ${dir}`);
	if (namedTotal === 0) {
		console.log(
			'\nNOTE: not one point carries a name, so the map will draw competitor marks\n' +
				'without labels. The MAPID features do have a NAMA column — it was simply not\n' +
				'kept when this point file was written. Re-run `node scripts/fetch-mapid.mjs`\n' +
				'with MAPID_API_KEY set, then this script again, and the labels appear.'
		);
	}
}

try {
	main();
} catch (err) {
	console.error('Failed:', err.message);
	process.exit(1);
}
