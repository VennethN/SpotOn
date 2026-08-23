/**
 * Writes the opening hours the app draws its activity curve from.
 *
 *   node scripts/build-hours.mjs
 *
 * Output: `static/data/hours.json`.
 *
 * The grid already knows HOW MANY businesses around a cell publish readable hours —
 * `join-hours.mjs` counted them, at every radius. What it does not keep is WHEN each
 * of them is open, because a week is 168 numbers and a cell is not the thing they
 * belong to. A business sits in five overlapping catchments and its week is the same
 * week in all five, so the week travels with the business and the browser adds them up
 * for whichever cell is on screen.
 *
 * Served from `static/` rather than imported, like the stops and the property
 * listings: fetched by URL when a cell is actually selected, so none of it is in the
 * JS bundle and the browser caches it as an ordinary asset.
 *
 * THE WEEKS ARE A DICTIONARY, AND THAT IS THE WHOLE FILE FORMAT
 *
 * Jakarta's shops keep a few hundred distinct timetables between them: `Mo-Su
 * 10:00-22:00` is one entry, written once, and the two thousand shops keeping it point
 * at it. Written out per business the same seven numbers would repeat two thousand
 * times and cost more than every coordinate in the file put together.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWeek, openHours } from './lib/hours.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The point file → the payload the app fetches.
 *
 * Exported and kept away from the filesystem so `selftest-hours.mjs` can run it on a
 * fixture. It matters here for the same reason it matters in `build-pois.mjs`: the
 * branch that drops a business with no readable week is never taken by the real data
 * once the fetch has done its job, and it would go on compiling long after it stopped
 * working.
 */
export function buildHours(file) {
	const points = file.points ?? [];

	/** Distinct weeks, in the order they are first met, and where each one landed. */
	const weeks = [];
	const index = new Map();
	const rows = [];
	let open = 0;

	for (const p of points) {
		// A business with no readable week is counted by the grid and drawn by nothing.
		// Leaving it out here is not the same as forgetting it: `join-hours.mjs` wrote
		// `n`, `p` and `h` per cell precisely so the panel can say how many businesses
		// this file does NOT speak for.
		if (!p.week) continue;
		const key = encodeWeek(p.week);
		let at = index.get(key);
		if (at === undefined) {
			at = weeks.length;
			index.set(key, at);
			weeks.push(key);
		}
		open += openHours(p.week);
		rows.push([p.lat, p.lon, at]);
	}

	return {
		meta: {
			source: file.meta?.source ?? 'OpenStreetMap via Overpass API',
			counted: file.meta?.counted ?? '',
			note: file.meta?.note ?? '',
			/* Every business counted in the bounding box, and the two subsets of it. The
			   panel puts the curve against the first of these rather than against itself,
			   so a reader can see that fewer than one business in ten is speaking. */
			businesses: file.meta?.businesses ?? 0,
			published: file.meta?.published ?? 0,
			readable: rows.length,
			unreadable: file.meta?.unreadable ?? {},
			timetables: weeks.length,
			openHoursPerWeek: Number((open / Math.max(rows.length, 1)).toFixed(1)),
			regenerate: 'node scripts/fetch-hours.mjs && node scripts/build-hours.mjs'
		},
		/* Seven base-36 chunks, Monday first, joined by a dot. Bit `h` of a chunk is set
		   when a door is open at some point during hour `h`. `lib/hours.mjs` writes this
		   and `domain/activity` reads it, and the two are one contract. */
		weeks,
		/* [lat, lon, which week] — the same flat-tuple economy `build-pois.mjs` applies,
		   for the same reason: at thousands of points the key names cost more than the
		   numbers do. */
		points: rows
	};
}

function main() {
	const src = resolve(ROOT, 'src/lib/data/osm-hours.json');
	const file = JSON.parse(readFileSync(src, 'utf8'));
	console.log(`Reading ${(file.points ?? []).length} businesses…`);

	const payload = buildHours(file);
	const dir = resolve(ROOT, 'static/data');
	mkdirSync(dir, { recursive: true });
	const dest = resolve(dir, 'hours.json');
	writeFileSync(dest, JSON.stringify(payload));

	const m = payload.meta;
	console.log(`  ${m.businesses} businesses counted`);
	console.log(`  ${m.published} publish opening hours`);
	console.log(`  ${m.readable} of those could be read, keeping ${m.timetables} distinct timetables`);
	console.log(`  the average one is open ${m.openHoursPerWeek} hours a week`);
	console.log(`\n→ ${dest} (${Math.round(JSON.stringify(payload).length / 1024)} KB)`);

	if (payload.points.length === 0) {
		console.log(
			'\nNOTE: not one business carries a readable week, so the app will draw no\n' +
				'activity curve anywhere. Re-run `node scripts/fetch-hours.mjs` and check the\n' +
				'refusal tally it prints before assuming this is what Jakarta looks like.'
		);
	}
}

// Only when run as a script. Imported — which is how the self-test reaches
// `buildHours` — this must not touch the filesystem or write anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (err) {
		console.error('Failed:', err.message);
		process.exit(1);
	}
}
