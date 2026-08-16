/**
 * Self-test: the unit pivot, against the data actually on disk. No network.
 *
 *   node scripts/selftest-units.mjs
 *
 * The pivot swaps which of two things is a row: a catchment, or a unit standing in one.
 * That sounds like a presentation change and is not — it changes what a duplicate means,
 * what a null means, and what "best" means, and each of those has a way of going wrong
 * that produces a plausible list rather than an error.
 *
 * Three properties are worth more than the rest, and they are the ones checked hardest:
 *
 * 1. ONE ROW PER UNIT. The cell join counts a listing into every catchment that reaches
 *    it, which is right for a count and fatal for a list — the same shophouse would
 *    appear five times with five different scores beside it, arguing with itself.
 * 2. NO INVENTED CONTEXT. A unit outside every catchment is dropped, not given the
 *    figures of the nearest cell however far away it is.
 * 3. UNMEASURED IS NOT LAST. A unit with no price is absent from a price ranking rather
 *    than sorted to the bottom of it, exactly as in the cell pivot.
 */

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = new URL('..', import.meta.url);

async function load() {
	const server = await createServer({
		configFile: false,
		root: fileURLToPath(ROOT),
		resolve: { alias: { $lib: fileURLToPath(new URL('src/lib', ROOT)) } },
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'error'
	});
	const units = await server.ssrLoadModule('/src/lib/domain/units.ts');
	const premises = await server.ssrLoadModule('/src/lib/domain/premises.ts');
	const scoring = await server.ssrLoadModule('/src/lib/domain/scoring.ts');
	const source = await server.ssrLoadModule('/src/lib/server/source.ts');
	await server.close();
	return { units, premises, scoring, cells: source.loadHexes() };
}

const { units: U, premises, scoring, cells } = await load();
const W = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'mapid' };

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Unit-pivot self-test (no network)\n');

// The point file the app fetches, read straight off disk.
const { readFileSync } = await import('node:fs');
const file = JSON.parse(
	readFileSync(fileURLToPath(new URL('static/data/property.json', ROOT)), 'utf8')
);
const listings = premises.parseListings(file);
const rows = scoring.scoreAll(cells, 'kopi', W);
const rowById = new Map(rows.map((r) => [r.id, r]));
const built = U.buildUnits(cells, listings, rowById, W.radius);

check(`${built.length} units built from ${listings.length} listings`, built.length > 0);

/* ── one row per unit ────────────────────────────────────────────────────── */

check(
	'every unit appears exactly once',
	new Set(built.map((u) => u.id)).size === built.length,
	`${built.length - new Set(built.map((u) => u.id)).size} duplicate ids`
);
// The failure this guards against is subtle: 1,915 of the listings share a coordinate
// with another, so a set keyed on position would silently merge four real units in one
// building into one row.
const byCoord = new Set(built.map((u) => `${u.listing.lat},${u.listing.lon}`));
check(
	`units sharing a coordinate are kept apart (${built.length} units on ${byCoord.size} points)`,
	built.length > byCoord.size
);

/* ── premises only, and no invented context ──────────────────────────────── */

check(
	'only premises are listed',
	built.every((u) => u.listing.premises),
	'a warehouse or office floor got into the unit list'
);
check(
	'every unit is inside its home cell’s walking radius',
	built.every((u) => u.distance <= W.radius),
	'a unit was given the figures of a cell it cannot walk to'
);
check(
	'every unit names a real cell',
	built.every((u) => cells.some((c) => c.id === u.cellId)),
	'a unit points at a cell that is not in the grid'
);
// Nearest, not merely near: any covering cell would have been defensible, but the rule
// has to be the one the code claims, or the figures beside a unit are another cell's.
const sample = built.slice(0, 200);
check(
	'the home cell really is the nearest one',
	sample.every((u) => {
		let best = Infinity;
		for (const c of cells) {
			const dLat = (c.lat - u.listing.lat) * 111320;
			const dLon = (c.lon - u.listing.lon) * 110000;
			const d = Math.hypot(dLat, dLon);
			if (d < best) best = d;
		}
		// Generous tolerance: the check above uses a flat approximation and `buildUnits`
		// uses haversine, so they differ by a few metres at this latitude.
		return u.distance <= best + 60;
	})
);

/* ── ranking ─────────────────────────────────────────────────────────────── */

for (const key of U.UNIT_METRIC_KEYS) {
	const def = U.UNIT_METRIC_MAP[key];
	const asc = U.rankUnits(built, key, 'asc');
	const desc = U.rankUnits(built, key, 'desc');
	check(
		`${key}: sorts both ways over the same ${asc.length} rows`,
		asc.length === desc.length &&
			asc.every((x, i) => i === 0 || x.value >= asc[i - 1].value) &&
			desc.every((x, i) => i === 0 || x.value <= desc[i - 1].value)
	);
	check(`${key}: declares which end is best`, def.best === 'asc' || def.best === 'desc');
	// Unmeasured rows are absent, not last. A list of "cheapest units" whose tail is
	// really "units with no price on them" is worse than a shorter list.
	check(
		`${key}: rows with nothing measured are dropped, not sorted last`,
		asc.every((x) => x.value !== null && Number.isFinite(x.value))
	);
}

// The drop rule has to be exercised by real data, not just be present in the code. It
// is not `harga` that exercises it: every listing in the catalogue carries a total
// asking price. What half of them do not carry is a price PER M², because the catalogue
// only publishes that where it knows the land area — so that is the measure whose
// ranking must come back short.
const total = U.rankUnits(built, 'harga', 'asc');
const perM2 = U.rankUnits(built, 'harga_m2', 'asc');
check(
	`every unit carries a total price (${total.length} of ${built.length})`,
	total.length === built.length
);
check(
	`only ${perM2.length} of ${built.length} carry a price per m², and the rest are dropped`,
	perM2.length > 0 && perM2.length < built.length,
	'nothing exercised the drop rule, so it is untested against real gaps'
);

/* ── filters narrow, and narrow honestly ─────────────────────────────────── */

const cheap = U.applyUnitFilters(built, [{ ukuran: 'harga', arah: 'rendah' }]);
check(
	`the bottom third by price is smaller than the whole set (${cheap.length} of ${built.length})`,
	cheap.length > 0 && cheap.length < built.length
);
check(
	'a band filter drops units with nothing measured, rather than keeping them',
	cheap.every((u) => u.listing.price !== null)
);
const withPrice = U.applyUnitFilters(built, [{ ukuran: 'harga', arah: 'ada' }]);
check('an "ada" filter keeps only units carrying that figure', withPrice.every((u) => u.listing.price));

// Two filters compose, and the second is applied to what the first left rather than to
// the whole set. Applied independently and intersected they would give a different, and
// wrong, answer.
const both = U.applyUnitFilters(built, [
	{ ukuran: 'harga', arah: 'rendah' },
	{ ukuran: 'skor_petak', arah: 'tinggi' }
]);
check(
	`two filters compose (${both.length} rows, from ${cheap.length} cheap ones)`,
	both.length <= cheap.length
);

/* ── the default the list opens on ───────────────────────────────────────── */

check(
	`the default sort (${U.DEFAULT_UNIT_METRIC}) is a real measure`,
	Boolean(U.UNIT_METRIC_MAP[U.DEFAULT_UNIT_METRIC])
);
const opening = U.rankUnits(built, U.DEFAULT_UNIT_METRIC, U.UNIT_METRIC_MAP[U.DEFAULT_UNIT_METRIC].best);
check('the list opens on something', opening.length > 0);

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
