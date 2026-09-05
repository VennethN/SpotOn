/**
 * Self-test: the cost-of-space layer, against the grid actually on disk. No network.
 *
 *   node scripts/selftest-property.mjs
 *
 * Two things are checked, and they are the two a rebuild cannot check for itself.
 *
 * THE ARITHMETIC OF THE PRICE LEVEL. It is a rank, and a rank has ends: the cheapest
 * catchment has to land on 0 and the dearest on 1, or the multiplier they earn is not
 * the one the panel describes. Ties have to share a level, or twenty catchments quoting
 * the same round number get spread across the scale by the order they were sorted in.
 *
 * THE SILENCES. `readCost` distinguishes five reasons a catchment can have no price
 * level, and the interface says something different for each. Four of them occur in the
 * real data, so this asserts they still do — a join that quietly stopped writing `prop`
 * would leave every cell reading "not surveyed", which is a claim about MAPID rather
 * than about the pipeline, and nothing else in the repository would notice.
 *
 * The invariant that matters most is stated last and is the reason the rest exists: the
 * multiplier is never above 1, so an unpriced catchment is never rewarded for being
 * unmeasured and a priced one can never push a score past 100.
 *
 * The modules under test are TypeScript and import each other without extensions, so
 * they are loaded through Vite — already a dependency — exactly as
 * `selftest-composition.mjs` does.
 */

import { readFileSync } from 'node:fs';
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
	const cost = await server.ssrLoadModule('/src/lib/domain/cost.ts');
	await server.close();
	return cost;
}

const cost = await load();
const { COST_FLOOR, MIN_LADDER, costFactor, priceLadder, priceLevel, readCost } = cost;

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Cost-of-space self-test (no network)\n');

/* ── the rank, on a ladder whose answers can be read by eye ───────────────── */

const ten = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
check('the cheapest price ranks 0', priceLevel(10, ten) === 0, `got ${priceLevel(10, ten)}`);
check('the dearest price ranks 1', priceLevel(100, ten) === 1, `got ${priceLevel(100, ten)}`);
check(
	'the middle of an even ladder straddles the half',
	priceLevel(50, ten) + priceLevel(60, ten) === 1,
	`got ${priceLevel(50, ten)} and ${priceLevel(60, ten)}`
);

// Ties: five catchments quoting the same round number must all get the same level, and
// it must be the middle of the run they form rather than five different levels handed
// out by sort order.
const tied = [10, 50, 50, 50, 50, 50, 60, 70, 80, 90];
const tiedLevels = [...new Set(tied.filter((v) => v === 50).map((v) => priceLevel(v, tied)))];
check('a tied run shares one level', tiedLevels.length === 1, `got ${tiedLevels.join(', ')}`);

// A ladder shorter than the minimum ranks nothing. Below it the dearest of three would
// lose a quarter of its score on the strength of two comparisons.
const short = Array.from({ length: MIN_LADDER - 1 }, (_, i) => (i + 1) * 10);
check(`a ladder shorter than ${MIN_LADDER} ranks nothing`, priceLevel(50, short) === null);
check('an absent price ranks nothing', priceLevel(null, ten) === null);

/* ── the multiplier ──────────────────────────────────────────────────────── */

check('the cheapest catchment keeps its whole score', costFactor(0) === 1);
check(`the dearest catchment is multiplied by ${COST_FLOOR}`, costFactor(1) === COST_FLOOR);
check('an unranked catchment is multiplied by 1, not by the middle', costFactor(null) === 1);
const factors = Array.from({ length: 21 }, (_, i) => costFactor(i / 20));
check('the multiplier never rises above 1', factors.every((f) => f <= 1));
check(`the multiplier never falls below ${COST_FLOOR}`, factors.every((f) => f >= COST_FLOOR));
check(
	'a dearer catchment is never multiplied by more than a cheaper one',
	factors.every((f, i) => i === 0 || f <= factors[i - 1])
);

/* ── against the grid on disk ────────────────────────────────────────────── */

const grid = JSON.parse(readFileSync(fileURLToPath(new URL('src/lib/data/hexes.json', ROOT)), 'utf8'));
const cells = grid.hexes;
const meta = grid.meta?.property;

check('the grid carries a property block', Boolean(meta), 'run `node scripts/join-property.mjs`');

if (meta) {
	for (const radius of [400, 800]) {
		const ladder = priceLadder(cells, radius);
		const readings = cells.map((c) => readCost(c, ladder, radius));
		const priced = readings.filter((r) => r.level !== null);

		check(
			`${radius} m: ${ladder.length} catchments carry a price`,
			ladder.length >= MIN_LADDER,
			`only ${ladder.length}, below the ${MIN_LADDER} needed to rank`
		);
		check(
			`${radius} m: the ladder is sorted`,
			ladder.every((v, i) => i === 0 || v >= ladder[i - 1])
		);
		check(
			`${radius} m: every priced catchment lands inside 0..1`,
			priced.every((r) => r.level >= 0 && r.level <= 1)
		);
		check(
			`${radius} m: the rank reaches both ends`,
			priced.some((r) => r.level === 0) && priced.some((r) => r.level === 1)
		);
		check(
			`${radius} m: no catchment is multiplied above 1`,
			readings.every((r) => r.factor <= 1)
		);
		// The one that would be invisible: a cell with no price must come through at
		// exactly 1, not at something merely close to it.
		check(
			`${radius} m: every unpriced catchment is multiplied by exactly 1`,
			readings.filter((r) => r.level === null).every((r) => r.factor === 1)
		);
	}

	const ladder = priceLadder(cells, 800);
	const tally = {};
	for (const c of cells) {
		const r = readCost(c, ladder, 800);
		const key = r.absence ?? 'priced';
		tally[key] = (tally[key] ?? 0) + 1;
	}
	console.log(`\n  reasons a catchment has no price level, at 800 m:`);
	for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
		console.log(`    ${String(v).padStart(4)}  ${k}`);
	}

	// Each of these has copy of its own in both locales. If a rebuild stops producing
	// one, that copy is unreachable and the reason it exists has gone with it.
	for (const key of ['priced', 'uncovered', 'empty', 'unpriced']) {
		check(`the "${key}" case still occurs in the real grid (${tally[key] ?? 0})`, (tally[key] ?? 0) > 0);
	}
	// Never both: a cell whose city was not read cannot also be reporting a price.
	check(
		'no catchment is both uncovered and priced',
		cells.every((c) => !(c.propCovered === false && c.prop))
	);
	check(
		`the join wrote its own threshold (${meta.minPriced}) into the grid`,
		typeof meta.minPriced === 'number' && meta.minPriced > 0
	);
	// The claim the whole panel rests on, checked against the tally the fetch measured
	// rather than against anybody's memory of it.
	const rentRows = Object.entries(meta.tipe3 ?? {}).filter(([k]) => /SEWA|RENT/i.test(k));
	check(
		`the catalogue still publishes no rent (${Object.keys(meta.tipe3 ?? {}).join(', ')})`,
		rentRows.length === 0,
		`found ${rentRows.map(([k, v]) => `${k}=${v}`).join(', ')} — the interface says there is none, and would now be wrong`
	);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
