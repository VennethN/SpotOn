/**
 * Joins the MAPID commercial property listings onto the hexagon grid.
 *
 *   node scripts/join-property.mjs
 *
 * Reads `src/lib/data/hexes.json` and `src/lib/data/mapid-property.json`, then
 * rewrites `hexes.json` with two additions per cell:
 *
 *   prop        — listings and the median asking price per m² within walking range
 *   propCovered — has this cell's city been read from the property catalogue
 *
 * WHY THIS DOES NOT TOUCH THE NETWORK
 *
 * Which city a cell sits in was already decided by `join-mapid.mjs`, by a
 * point-in-polygon test against OSM administrative boundaries, and stored on the cell.
 * This step reads that assignment rather than pulling the boundaries again. Coverage is
 * a city-level fact for the same reason it is over there: the catalogue ships one
 * dataset per administrative city, so proximity to a listing says nothing about whether
 * a city was surveyed.
 *
 * Run `join-mapid.mjs` first on a freshly built grid. Without a city on the cells this
 * script covers nothing, and it says so loudly rather than writing zeroes.
 *
 * BOTH RADII ARE STORED, AND THE PRICE IS NOT SCALED BETWEEN THEM
 *
 * Counts elsewhere in this project are precomputed at 800 m and multiplied by ¼ when
 * the reader switches to 400 m, because a quarter of the area holds roughly a quarter
 * of the outlets. A median price cannot be rescaled that way: it is an intensive
 * figure, and a quarter of it is not the price of anything. So both radii are computed
 * here from the listings genuinely inside each one, and the engine picks the one it
 * needs instead of arithmetic on the other.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normCity } from './lib/mapid.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * The walking radii a reader may choose between.
 *
 * Not two any more. The interface offers this as a slider, and a slider with two stops
 * is a segmented control wearing a costume — so the join computes every stop the slider
 * can land on, from the listings genuinely inside each one.
 *
 * They have to be computed rather than interpolated. A COUNT can be scaled by area, and
 * the scoring engine does exactly that for competitors. A MEDIAN cannot: half of a
 * median is not the price of anything, and a price interpolated between two radii would
 * be the one figure on the screen that came from nobody's data.
 */
const RADII = [400, 500, 600, 700, 800];

/** The families a small business could actually occupy. Mirrors `PREMISES_TYPES` in
    `src/lib/domain/cost.ts`, which is where the interface reads the same rule. */
const PREMISES = new Set(['ruko', 'toko', 'ruang', 'rukan', 'komersial']);

/**
 * How many priced units have to be in range before a cell is given a price at all.
 *
 * A median of one is that one listing, and the listings carry real errors: the ruko
 * set runs from Rp 654 thousand per m² to Rp 9.6 billion, which is a decimal point in
 * the wrong place rather than a neighbourhood. One such row alone in a cell would put
 * that cell at the dear end of the grid and cost it a quarter of its score, on the
 * strength of a typo.
 *
 * Three is where a median starts absorbing a single bad row instead of being it. Below
 * that the cell carries no price and the panel says the range is too thin to read,
 * which is the true statement. It costs 105 of the 462 covered cells their price and
 * leaves 284 with one.
 */
const MIN_PRICED = 3;

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversine(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const x =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

/** The middle value, or the mean of the two middle ones. Whole rupiah: the inputs are
    whole rupiah and half of one is not a price. */
function median(values, min = 1) {
	if (values.length < min) return null;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function main() {
	const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const file = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/mapid-property.json'), 'utf8'));

	console.log(`${grid.hexes.length} cells · ${file.points.length} property listings\n`);

	// Declared by fetch-property.mjs: the cities whose datasets were read successfully.
	// Not inferred from where the listings happen to fall — a city with a dataset that
	// holds nothing has still been checked, and a cell near a neighbouring city's
	// listings has not.
	const covered = new Set(file.meta?.coverage ?? []);
	console.log(`Coverage declared for: ${[...covered].sort().join(', ') || '(none)'}`);

	const withCity = grid.hexes.filter((h) => h.city).length;
	if (withCity === 0) {
		console.error('\nNot one cell carries a city. Run `node scripts/join-mapid.mjs` first —');
		console.error('that is what assigns cells to administrative cities. Nothing was written.');
		process.exit(1);
	}
	console.log(`Cells with a city assigned: ${withCity}/${grid.hexes.length}\n`);

	console.log('Joining…');
	const tally = { covered: 0, uncovered: 0, priced: 0 };

	for (const h of grid.hexes) {
		const cityKey = h.city ? normCity(h.city) : null;
		const isCovered = Boolean(cityKey && covered.has(cityKey));
		h.propCovered = isCovered;

		if (!isCovered) {
			// Deliberately no `prop` at all rather than a block of zeroes. Zero listings is
			// a finding about a place that was surveyed; this city was not.
			delete h.prop;
			tally.uncovered++;
			continue;
		}
		tally.covered++;

		const near = [];
		for (const p of file.points) {
			if (Math.abs(p.lat - h.lat) > 0.012 || Math.abs(p.lon - h.lon) > 0.012) continue;
			const d = haversine(h.lat, h.lon, p.lat, p.lon);
			if (d <= RADII[RADII.length - 1]) near.push({ p, d });
		}

		// One entry per radius, keyed by it, rather than eight flat keys named after two.
		// Adding a stop to RADII used to mean adding four more `n700`-shaped fields to the
		// type, the join, the reader and the interface; now it means adding a number.
		const prop = { r: {} };
		for (const r of RADII) {
			const inside = near.filter((n) => n.d <= r).map((n) => n.p);
			const premises = inside.filter((p) => PREMISES.has(p.type));
			const prices = premises.map((p) => p.ppm).filter((v) => typeof v === 'number' && v > 0);
			prop.r[r] = {
				n: inside.length,
				u: premises.length,
				// Null, not zero. "No unit in range carried a published price" and "space
				// here costs nothing" are not the same statement, and only one is true.
				p: median(prices, MIN_PRICED),
				// How many units that median was read from, so the panel can put the figure
				// and the weight of evidence behind it in one sentence. Kept even where the
				// median came back null, because "two units, not enough to read" is more
				// useful than "nothing".
				q: prices.length
			};
		}
		if (prop.r[800].p !== null) tally.priced++;

		// The mix of what is on the market, at the walking radius the grid was built for.
		// Counted for every type, premises or not: "three shophouses and a warehouse" is a
		// different street from "four shophouses", and the panel says which.
		const by = {};
		for (const { p } of near) by[p.type] = (by[p.type] ?? 0) + 1;
		prop.by = by;

		h.prop = prop;
	}

	const prices800 = grid.hexes.map((h) => h.prop?.r?.[800]?.p).filter((v) => typeof v === 'number');
	grid.meta.property = {
		source: file.meta.source,
		project_id: file.meta.project_id,
		listings: file.points.length,
		listingType: file.meta.listingType,
		tipe3: file.meta.tipe3,
		priceColumn: file.meta.priceColumn,
		radii: RADII,
		coveredCities: [...covered].sort(),
		cellsCovered: tally.covered,
		cellsPriced: tally.priced,
		minPriced: MIN_PRICED,
		medianPrice: median(prices800),
		rule: 'Coverage is decided per administrative city, reusing the assignment join-mapid.mjs stored on each cell. A cell in a city absent from the catalogue carries no `prop` at all — not checked, which is not the same as nothing on the market.',
		regenerate: 'node scripts/fetch-property.mjs && node scripts/join-property.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	console.log(`  cells covered      : ${tally.covered} · not covered ${tally.uncovered}`);
	console.log(`  cells with a price : ${tally.priced}`);
	const med = grid.meta.property.medianPrice;
	console.log(`  grid median        : ${med === null ? '(none)' : `Rp ${med.toLocaleString('id-ID')}/m²`}`);
	const totals = {};
	for (const h of grid.hexes) for (const [k, v] of Object.entries(h.prop?.by ?? {})) totals[k] = (totals[k] ?? 0) + v;
	console.log('  listings counted by type (cells overlap, so this exceeds the file):', totals);
	console.log(`\n→ ${hexPath}`);
}

try {
	main();
} catch (err) {
	console.error('Failed:', err.message);
	process.exit(1);
}
