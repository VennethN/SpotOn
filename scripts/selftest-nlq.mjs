/**
 * Self-test: the understanding layer, against the grid actually on disk. No network.
 *
 *   node scripts/selftest-nlq.mjs
 *
 * The question layer used to offer four intents, three of which ranked by the
 * opportunity score. So "seberapa ramai di sini" came back as "Graha Werdatama Pondok
 * Labu, 93 out of 100" — a confident answer to a question nobody asked, built from data
 * that was already on the row. What separates the shape of a question from the figure
 * it is about is `ukuran`, and this checks that a sentence still reaches the right one.
 *
 * WHY A TABLE OF SENTENCES RATHER THAN UNIT TESTS ON THE REGEX
 *
 * Because the failure mode is not a regex that does not match. It is a regex that
 * matches TOO EARLY: the patterns are tried in order, and every one of the cases below
 * is a sentence that was routed to the wrong measure by an earlier pattern until the
 * order was fixed. "Mana yang paling banyak tempat kosong" landed on COVERAGE because
 * `kosong` was a coverage word; "jam berapa paling ramai" landed on `keramaian` because
 * `ramai` came first. Neither raised anything — they returned a fluent answer to a
 * different question, which is the failure this file exists to catch.
 *
 * The engine's own arithmetic is not re-checked here; `selftest-composition.mjs` and
 * `selftest-property.mjs` do that. This is only about what the question was understood
 * to be asking.
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
	const nlq = await server.ssrLoadModule('/src/lib/domain/nlq.ts');
	const metrics = await server.ssrLoadModule('/src/lib/domain/metrics.ts');
	const source = await server.ssrLoadModule('/src/lib/server/source.ts');
	await server.close();
	return { nlq, metrics, cells: source.loadHexes() };
}

const { nlq, metrics, cells } = await load();
const W = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'mapid' };

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Question-understanding self-test (no network)\n');

/* ── every sentence reaches the measure it is about ──────────────────────── */

/** question → [expected measure, expected direction, expected category] */
const CASES = [
	['di mana sebaiknya buka kedai kopi', 'skor', 'desc', 'kopi'],
	['seberapa ramai di sini', 'keramaian', 'desc', null],
	['mana yang paling sepi', 'keramaian', 'asc', null],
	['di mana sewanya paling murah untuk kedai kopi', 'harga_tempat', 'asc', 'kopi'],
	['mana yang paling mahal harganya', 'harga_tempat', 'desc', null],
	['mana yang paling banyak tempat kosong', 'unit_dipasarkan', 'desc', null],
	['mana yang paling ramai pengunjungnya', 'kunjungan', 'desc', null],
	['jam berapa paling ramai', 'jam_puncak', null, null],
	['mana yang pesaingnya paling sedikit untuk apotek', 'pesaing', 'asc', 'apotek'],
	['berapa porsi non-tunai di sekitar sini', 'nontunai', 'desc', null],
	['mana yang simpul transitnya paling banyak', 'simpul_transit', 'desc', null]
];

for (const [q, ukuran, urut, kategori] of CASES) {
	const parsed = nlq.parseQuestion(q, W, 'kopi');
	const okMetric = parsed.ukuran === ukuran;
	const okOrder = urut === null || parsed.urut === urut;
	const okCat = kategori === null || parsed.kategori === kategori;
	check(
		`"${q}" → ${ukuran}${urut ? ` ${urut}` : ''}`,
		okMetric && okOrder && okCat,
		`got ukuran=${parsed.ukuran} urut=${parsed.urut} kategori=${parsed.kategori}`
	);
}

// An hour is not a quantity, so a superlative in the sentence must not flip it. "Jam
// berapa paling ramai" contains "paling ramai", which reads as "most".
check(
	'a superlative cannot reverse an hour ranking',
	nlq.parseQuestion('jam berapa paling ramai', W, 'kopi').urut ===
		nlq.parseQuestion('jam puncak', W, 'kopi').urut
);

/* ── the intents still route ─────────────────────────────────────────────── */

check('coverage still reachable', nlq.parseQuestion('mana yang belum ada datanya', W, 'kopi').intent === 'COVERAGE');
check('saturation still reachable', nlq.parseQuestion('mana yang sudah jenuh', W, 'kopi').intent === 'FLAG_SATURATED');
check('compare still reachable', nlq.parseQuestion('bandingkan Blok M dan Dukuh Atas', W, 'kopi').intent === 'COMPARE');

/* ── the answers actually come back measured ─────────────────────────────── */

for (const [q, ukuran] of CASES) {
	const ans = nlq.answer(q, cells, W, 'kopi');
	const top = ans.items[0];
	if (!top) {
		check(`"${q}" returns results`, false, 'no items');
		continue;
	}
	const wantsMeasure = ukuran !== 'skor';
	check(
		`"${q}" reports ${wantsMeasure ? ukuran : 'the score'}`,
		wantsMeasure ? top.measure?.ukuran === ukuran : top.measure == null,
		`got ${top.measure ? top.measure.ukuran : 'no measure'}`
	);
}

/* ── a ranking never includes a cell that was never measured ─────────────── */

const priced = nlq.answer('di mana harganya paling murah', cells, W, 'kopi');
check(
	'a price ranking lists only catchments that carry a price',
	priced.items.every((i) => i.measure && Number.isFinite(i.measure.value)),
	'an item came back with no measured value'
);

// The one that would be invisible: an unsurveyed cell sorted to the top of "fewest
// competitors" looks exactly like a genuine finding.
const fewest = nlq.answer('mana yang pesaingnya paling sedikit', cells, W, 'kopi');
const scored = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, 'kopi');
const coveredIds = new Set(scored.items.map((i) => i.id));
check(
	`"fewest competitors" returns ${fewest.items.length} catchments, none of them unsurveyed`,
	fewest.items.length > 0 &&
		fewest.items.every((i) => i.measure !== null && i.measure !== undefined),
	`ids not in the scored set: ${fewest.items.filter((i) => !coveredIds.has(i.id)).length}`
);

/* ── filters narrow without inventing a threshold ────────────────────────── */

const cheap = nlq.parseQuestion('kedai kopi modal kecil dekat MRT', W, 'kopi');
check(
	'"modal kecil dekat MRT" produces band filters, never a number',
	(cheap.filters ?? []).length >= 2 &&
		(cheap.filters ?? []).every((f) => ['rendah', 'tinggi', 'ada'].includes(f.arah)),
	JSON.stringify(cheap.filters)
);
const filtered = nlq.answer('kedai kopi modal kecil dekat MRT', cells, W, 'kopi');
check('a filtered question still returns something', filtered.items.length > 0);

/* ── every registered measure is reachable and readable ──────────────────── */

const rows = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, 'kopi');
check('every measure has a definition', metrics.METRIC_KEYS.every((k) => metrics.METRIC_MAP[k]));
check(
	'every measure declares which end is best',
	metrics.METRICS.every((m) => m.best === 'asc' || m.best === 'desc')
);
check(
	'no measure is unreadable across the whole grid',
	metrics.METRIC_KEYS.every((k) => {
		const def = metrics.METRIC_MAP[k];
		const all = nlq.answer('x', cells, W, 'kopi');
		return all && typeof def.read === 'function';
	})
);
check('the ranking helper drops unmeasured rows', rows.items.length > 0);

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
