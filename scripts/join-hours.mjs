/**
 * Joins the OpenStreetMap opening hours onto the hexagon grid.
 *
 *   node scripts/join-hours.mjs
 *
 * Reads `src/lib/data/hexes.json` and `src/lib/data/osm-hours.json`, then rewrites
 * `hexes.json` with one addition per cell:
 *
 *   hours — how many businesses stand in walking range, how many of them publish
 *           opening hours, and how many of those could be read, at every radius
 *
 * WHAT IS AND IS NOT WRITTEN HERE
 *
 * Three counts per radius, and not the curve. A week is 168 hours, and 168 numbers per
 * cell per radius across 562 cells is 470,000 figures in a grid file that carries the
 * counts alone in 674 KB.
 * The curve is drawn in the browser instead, from the points in
 * `static/data/hours.json`, matched to the cell with the same distance test this
 * script uses — see `domain/activity`. What has to be here is the DENOMINATOR, because
 * a business that publishes no hours leaves no point behind and the panel would have
 * nothing to weigh the curve against.
 *
 * COVERAGE IS NOT A QUESTION HERE, AND THAT IS WORTH SAYING
 *
 * The property join has to decide coverage per administrative city, because MAPID
 * publishes one dataset per city and a city nobody imported has not been checked. This
 * one queries a bounding box that covers the whole grid in a single pass, so every
 * cell has been looked at. A cell with `p: 0` is a place where nobody published hours,
 * which is a finding, and there is no fourth state hiding behind it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversine } from './lib/geo.mjs';
import { openHours } from './lib/hours.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The walking radii a reader may choose between. Mirrors `RADII` in
    `src/lib/domain/weights.ts`, exactly as `join-property.mjs` does, and
    `selftest-hours.mjs` checks the two lists against each other. */
export const RADII = [400, 500, 600, 700, 800];

/**
 * How many readable businesses a cell needs in range before a curve is drawn for it.
 *
 * A curve is 24 columns, and drawn from three shops it is not a rhythm, it is three
 * shops. One 24-hour minimart among them and the street reads as never sleeping.
 *
 * Eight is where the shape starts belonging to the street rather than to whichever
 * business happened to be tagged. Below it the panel says how many it found and draws
 * nothing, which is the true statement — the same rule, for the same reason, as the
 * three priced units a median needs in `join-property.mjs`.
 */
export const MIN_READABLE = 8;

function main() {
	const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const file = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/osm-hours.json'), 'utf8'));

	const points = file.points ?? [];
	console.log(`${grid.hexes.length} cells · ${points.length} businesses\n`);

	const widest = RADII[RADII.length - 1];
	const tally = { readable: 0, thin: 0, none: 0 };
	/** How many readable businesses each cell captured at the widest radius, so the
	    threshold above can be argued with from the distribution rather than defended
	    from memory. */
	const spread = [];

	for (const h of grid.hexes) {
		const near = [];
		for (const p of points) {
			if (Math.abs(p.lat - h.lat) > 0.012 || Math.abs(p.lon - h.lon) > 0.012) continue;
			const d = haversine(h.lat, h.lon, p.lat, p.lon);
			if (d <= widest) near.push({ p, d });
		}

		const hours = { r: {} };
		for (const r of RADII) {
			const inside = near.filter((n) => n.d <= r).map((n) => n.p);
			// `p` counts every business that published an `opening_hours` tag and `h`
			// only the ones this project's reader would not have to guess at. The fetch
			// keeps a week on the second kind alone, which is what makes the difference
			// countable here rather than a number somebody remembered.
			hours.r[r] = {
				n: inside.length,
				p: inside.filter((x) => x.published).length,
				h: inside.filter((x) => x.week).length
			};
		}
		h.hours = hours;

		const readable = hours.r[widest].h;
		spread.push(readable);
		if (readable >= MIN_READABLE) tally.readable++;
		else if (readable > 0) tally.thin++;
		else tally.none++;
	}

	const sorted = [...spread].sort((a, b) => a - b);
	const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
	const weeks = points.filter((p) => p.week);

	grid.meta.hours = {
		source: file.meta.source,
		counted: file.meta.counted,
		note: file.meta.note,
		bbox: file.meta.bbox,
		radii: RADII,
		businesses: file.meta.businesses,
		published: file.meta.published,
		readable: file.meta.readable,
		unreadable: file.meta.unreadable,
		minReadable: MIN_READABLE,
		/* The distribution the threshold was chosen against, so the choice can be argued
		   with from the data rather than defended from memory. Readable businesses within
		   the widest radius, per cell. */
		perCell: {
			min: sorted[0] ?? 0,
			q1: at(0.25),
			median: at(0.5),
			q3: at(0.75),
			max: sorted[sorted.length - 1] ?? 0
		},
		cellsReadable: tally.readable,
		cellsThin: tally.thin,
		cellsEmpty: tally.none,
		openHoursPerWeek: file.meta.openHoursPerWeek,
		rule: 'Kurvanya dihitung di peramban dari static/data/hours.json dengan uji jarak yang sama. Yang disimpan di sini penyebutnya, karena usaha yang tidak memasang jam tidak meninggalkan titik.',
		regenerate: 'node scripts/fetch-hours.mjs && node scripts/join-hours.mjs && node scripts/build-hours.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	console.log(`  readable businesses within ${widest} m, per cell:`);
	console.log(`    lowest ${sorted[0] ?? 0} · quartile ${at(0.25)} · median ${at(0.5)} · quartile ${at(0.75)} · highest ${sorted[sorted.length - 1] ?? 0}`);
	console.log(`  cells with a curve  : ${tally.readable} (${MIN_READABLE} readable or more)`);
	console.log(`  cells too thin      : ${tally.thin}`);
	console.log(`  cells with none     : ${tally.none}`);
	console.log(`  average business is open ${(weeks.reduce((a, p) => a + openHours(p.week), 0) / Math.max(weeks.length, 1)).toFixed(1)} hours a week`);
	console.log(`\n→ ${hexPath}`);
}

// Only when run as a script. Imported — which is how `selftest-hours.mjs` reaches the
// radii and the threshold — this must not touch the filesystem or write anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (err) {
		console.error('Failed:', err.message);
		process.exit(1);
	}
}
