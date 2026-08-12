/**
 * Self-test: the score breakdown against the scoring engine. No network.
 *
 *   node scripts/selftest-composition.mjs
 *
 * `domain/composition` exists to take a number apart and hand back the steps that
 * made it. Its whole worth is that those steps land on the number — a breakdown that
 * disagrees with the score printed above it discredits the score, not just itself.
 * That is a property, not an example, so it is checked as one: every combination of
 * weights, demand, competition, access and listings below is scored by the engine and
 * then taken apart, and the two are held against each other.
 *
 * Rounding is the reason this is worth running. Each step is rounded against the
 * RUNNING TOTAL rather than on its own, so that the column adds up on screen; that is
 * easy to "simplify" into per-delta rounding, which still looks right in a screenshot
 * and is off by a point often enough for a reader to notice.
 *
 * The modules under test are TypeScript and import each other without extensions, so
 * they are loaded through Vite — already a dependency — rather than by hand.
 */

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = new URL('..', import.meta.url);

/** Load the domain modules the way the app does: Vite resolves TS and `$lib`. */
async function load() {
	const server = await createServer({
		configFile: false,
		root: fileURLToPath(ROOT),
		resolve: { alias: { $lib: fileURLToPath(new URL('src/lib', ROOT)) } },
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'error'
	});
	const composition = await server.ssrLoadModule('/src/lib/domain/composition.ts');
	const scoring = await server.ssrLoadModule('/src/lib/domain/scoring.ts');
	await server.close();
	return { composeScore: composition.composeScore, scoreOne: scoring.scoreOne };
}

/**
 * A cell the engine can score, carrying exactly the figures asked for.
 *
 * `busy` is fixed at 0.5 because that is the value at which the engine's busyness
 * factor `0.55 + 0.9 × busy` is exactly 1 — so with `scale` at 100 the competitor
 * count passes through as the supply, and a case can be read as what it says it is.
 */
const cell = (demand, supply, access, listings) => ({
	id: 'selftest',
	name: null,
	lat: -6.2,
	lon: 106.8,
	boundary: [],
	transit: { mrt: 0, krl: 0, lrt: 0, brt: 3 },
	access,
	nStruk: 1,
	nMenu: 1,
	nProp: 1,
	osm: { kopi: Math.round(supply * 100) },
	mapid: { kopi: Math.round(supply * 100) },
	covered: { kopi: true },
	busy: { kopi: 0.5 },
	listing: { kopi: listings },
	d: { kopi: demand }
});

const SCALE = 100;
const CAT = 'kopi';

function selftest({ composeScore, scoreOne }) {
	let failures = 0;
	const check = (label, ok, detail = '') => {
		if (!ok) failures++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
	};

	/* ── the property sweep ──────────────────────────────────────────────── */

	const demands = [0, 0.22, 0.5, 0.89, 1];
	const supplies = [0, 0.3, 0.55, 1];
	const accesses = [0, 0.35, 0.81, 1];
	const listingCounts = [0, 5];
	const weightSets = [
		{ wd: 0.5, ws: 0.5, gate: true },
		{ wd: 0, ws: 1, gate: true },
		{ wd: 1, ws: 0, gate: true },
		{ wd: 0.5, ws: 0.5, gate: false }
	];

	let cases = 0;
	let lowest = 100;
	let highest = 0;
	let clamped = 0;
	let gateBit = 0;
	const broken = { total: 0, deltas: 0, split: 0, ceiling: 0, missing: 0 };

	for (const demand of demands)
		for (const supply of supplies)
			for (const access of accesses)
				for (const listings of listingCounts)
					for (const set of weightSets) {
						const weights = { ...set, radius: 800, source: 'mapid' };
						const row = scoreOne(cell(demand, supply, access, listings), CAT, weights, SCALE);
						const comp = composeScore(row, weights);
						cases++;
						if (!comp) {
							broken.missing++;
							continue;
						}

						const printed = Math.round(row.score * 100);
						const last = comp.steps[comp.steps.length - 1];
						const deltaSum = comp.steps.reduce((a, s) => a + s.delta, 0);

						// The three claims the panel makes by putting these numbers in a column.
						if (last.after !== printed || comp.score !== printed) broken.total++;
						if (deltaSum !== last.after) broken.deltas++;
						if (comp.withoutTransit + comp.transitPoints !== comp.score) broken.split++;
						if (comp.transitPoints < 0 || comp.transitPoints > comp.transitCeiling)
							broken.ceiling++;

						if (comp.steps.some((s) => s.key === 'clamp')) clamped++;
						if (comp.gate !== 1) gateBit++;
						lowest = Math.min(lowest, comp.score);
						highest = Math.max(highest, comp.score);
					}

	check(`${cases} combinations, every one taken apart`, broken.missing === 0, `${broken.missing} returned null`);
	check('last running total = the score the engine printed', broken.total === 0, `${broken.total} disagreed`);
	check('steps add up to the total', broken.deltas === 0, `${broken.deltas} columns did not sum`);
	check('without-transit + transit = score', broken.split === 0, `${broken.split} splits did not close`);
	check('transit stays inside 0..ceiling', broken.ceiling === 0, `${broken.ceiling} outside`);
	// A sweep that never reaches the edges proves nothing about them.
	check(`the sweep reaches both ends (${lowest}..${highest})`, lowest === 0 && highest === 100);
	check(`the clamp fires somewhere (${clamped} cases)`, clamped > 0);
	check(`the space gate bites somewhere (${gateBit} cases)`, gateBit > 0);

	/* ── worked examples, so a reader can see what it is claiming ─────────── */

	const even = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'mapid' };

	// demand 0.89, supply 0.22, even weights: 0.5 + 0.445 − 0.11 = 0.835, no gate, full
	// access. The deltas are differences between rounded totals, which is why the
	// column reads 50 +45 −11 and not 50 +44.5 −11: 0.945 rounds up to 95 first.
	const strong = composeScore(scoreOne(cell(0.89, 0.22, 1, 5), CAT, even, SCALE), even);
	check(
		'well-served cell: 50 → +45 → −11 → gate 0 → transit 0 = 84',
		strong.score === 84 && strong.steps.map((s) => s.delta).join(',') === '50,45,-11,0,0',
		`got ${strong.score} from ${strong.steps.map((s) => `${s.key} ${s.delta}`).join(', ')}`
	);
	check(
		'…of which 34 points are its transit, 50 are not',
		strong.withoutTransit === 50 && strong.transitPoints === 34,
		`got ${strong.withoutTransit} + ${strong.transitPoints}`
	);

	const noTransit = composeScore(scoreOne(cell(0.89, 0.22, 0, 5), CAT, even, SCALE), even);
	check(
		'same cell with no transit at all scores the floor',
		noTransit.score === strong.withoutTransit && noTransit.transitPoints === 0,
		`got ${noTransit.score}, expected ${strong.withoutTransit}`
	);

	const blocked = composeScore(scoreOne(cell(0.89, 0.22, 1, 0), CAT, even, SCALE), even);
	const gateStep = blocked.steps.find((s) => s.key === 'gate');
	check(
		'nothing to rent: the gate step carries ×0.15 and the whole fall',
		gateStep.factor === 0.15 && gateStep.delta === -71 && blocked.score === 13,
		`got factor ${gateStep.factor}, delta ${gateStep.delta}, score ${blocked.score}`
	);

	const gateOff = { ...even, gate: false };
	check(
		'gate switched off: the same cell keeps its balance',
		composeScore(scoreOne(cell(0.89, 0.22, 1, 0), CAT, gateOff, SCALE), gateOff).score === 84
	);

	const overflow = { wd: 1, ws: 0, gate: true, radius: 800, source: 'mapid' };
	const clampCase = composeScore(scoreOne(cell(1, 0, 1, 5), CAT, overflow, SCALE), overflow);
	check(
		'demand alone can overshoot 100, and the clamp row says so',
		clampCase.steps.some((s) => s.key === 'clamp') && clampCase.score === 100,
		`steps: ${clampCase.steps.map((s) => s.key).join(' → ')}, score ${clampCase.score}`
	);
	check(
		'the clamp row is absent when it did not bite',
		!strong.steps.some((s) => s.key === 'clamp')
	);

	/* ── nothing computed, nothing explained ─────────────────────────────── */

	const nodata = scoreOne({ ...cell(0.5, 0.5, 0.5, 1), nodata: true }, CAT, even, SCALE);
	check('a cell with no mission data has no breakdown', composeScore(nodata, even) === null);

	const uncovered = scoreOne(
		{ ...cell(0.5, 0.5, 0.5, 1), covered: { kopi: false }, mapid: { kopi: null } },
		CAT,
		even,
		SCALE
	);
	check('a cell the source has not surveyed has no breakdown', composeScore(uncovered, even) === null);

	return failures;
}

const { composeScore, scoreOne } = await load();
console.log('Score-composition self-test (no network)\n');
const failures = selftest({ composeScore, scoreOne });
console.log(`\n${failures ? `${failures} FAILED` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
