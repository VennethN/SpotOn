/**
 * Self-test: the competitor point pipeline, names included. No network.
 *
 *   node scripts/selftest-pois.mjs
 *
 * WHY THIS EXISTS
 *
 * The map labels a competitor with its own name, and today it labels none of them,
 * because `src/lib/data/mapid-poi.json` was written before names were kept and holds
 * 24,630 points with 0 names between them. `fetch-mapid.mjs` reads the features'
 * NAMA column and now keeps it, but that line has never once run: it needs an API key
 * and a reachable catalogue.
 *
 * So every part of this pipeline that handles a name is code nobody has seen work.
 * Running the real data through it proves nothing at all — the whole name branch is
 * skipped, and it would go on being skipped after a bad edit. This runs the same
 * functions on a fixture that DOES carry names, so the day somebody re-fetches with a
 * key, the labels appear rather than the bug being discovered then.
 *
 * The two rules being pinned are the ones that are easy to get quietly wrong:
 *
 *   1. an absent name and a name that says "-" are the same fact, and neither is a
 *      label
 *   2. the same outlet in two datasets is one outlet, and it keeps whichever copy of
 *      it has a name
 *
 * Everything downstream of here — capture by distance, the label layers, the
 * collision ranking — is exercised in the browser instead, because it is about
 * pixels rather than about data.
 */

import { cleanName, dedupePoints } from './lib/mapid.mjs';
import { splitByCategory } from './build-pois.mjs';

let failures = 0;
function check(label, ok, detail) {
	if (!ok) failures++;
	console.log(`  ${ok ? '·' : 'FAIL'} ${label}${!ok && detail ? ` — ${detail}` : ''}`);
}

/* ── a name is a name, or it is nothing ──────────────────────────────────── */

console.log('cleanName');
check('a plain name survives', cleanName('Kopi Kenangan') === 'Kopi Kenangan');
check('surrounding space is trimmed', cleanName('  Fore Coffee  ') === 'Fore Coffee');
check('inner runs of space collapse', cleanName('Janji\n  Jiwa') === 'Janji Jiwa');
// Every one of these is how the catalogue spells "there is no name here". Read as a
// name, each becomes a label on the map saying nothing.
for (const empty of [undefined, null, '', '   ', '-', 'N/A', 'n/a', 'na']) {
	check(`${JSON.stringify(empty)} is not a name`, cleanName(empty) === null);
}
// A name that merely CONTAINS a dash is still a name. The rule is about the whole
// value standing in for absence, not about the character.
check('a dash inside a name is kept', cleanName('Kopi Soe - Menteng') === 'Kopi Soe - Menteng');

/* ── one outlet, one record, best name kept ──────────────────────────────── */

console.log('\ndedupePoints');
const dupes = [
	// The same shop in two datasets: COFFEE SHOP has no name for it, MAKANAN DAN
	// MINUMAN does. Kept in this order on purpose, because the naive filter-by-seen
	// keeps the first and would throw the name away.
	{ cat: 'kopi', lat: -6.2, lon: 106.8, name: null },
	{ cat: 'kopi', lat: -6.2, lon: 106.8, name: 'Tomoro Coffee' },
	// Named first, unnamed second: the name must not be overwritten by the blank.
	{ cat: 'kopi', lat: -6.3, lon: 106.9, name: 'Point Coffee' },
	{ cat: 'kopi', lat: -6.3, lon: 106.9, name: null },
	// Two datasets, two spellings, one shop. Whichever wins, it is still one shop.
	{ cat: 'kopi', lat: -6.4, lon: 106.7, name: 'Kopi Lain Hati' },
	{ cat: 'kopi', lat: -6.4, lon: 106.7, name: 'KOPI LAIN HATI' },
	// Same coordinates, different category: a coffee shop and a bakery can share a
	// doorway, and they are two competitors in two different rankings.
	{ cat: 'roti', lat: -6.2, lon: 106.8, name: 'Roti Bakar' }
];
const unique = dedupePoints(dupes);
check('duplicates collapse to one record each', unique.length === 4, `got ${unique.length}`);
check(
	'a name on the later copy is adopted',
	unique.find((p) => p.lat === -6.2 && p.cat === 'kopi')?.name === 'Tomoro Coffee'
);
check(
	'a name already held is not overwritten by a blank',
	unique.find((p) => p.lat === -6.3)?.name === 'Point Coffee'
);
check(
	'two spellings still collapse to one outlet',
	unique.filter((p) => p.lat === -6.4).length === 1
);
check(
	'the same doorway in another category is a separate competitor',
	unique.filter((p) => p.lat === -6.2).length === 2
);
check(
	'the input is not mutated',
	dupes[0].name === null,
	'dedupePoints wrote back into its argument'
);

/* ── the file the app actually fetches ───────────────────────────────────── */

console.log('\nsplitByCategory');
const file = {
	meta: {
		source: 'MAPID premium data (Data Premium)',
		byCategory: { kopi: 2, roti: 1, laundry: 0 },
		coverage: { kopi: ['JAKARTAPUSAT'], roti: [], laundry: [] }
	},
	points: [
		{ cat: 'kopi', lat: -6.123456, lon: 106.812345, name: 'Anomali Coffee Menteng' },
		{ cat: 'kopi', lat: -6.2, lon: 106.9, name: null },
		{ cat: 'roti', lat: -6.3, lon: 106.7, name: 'Holland Bakery' }
	]
};
const split = splitByCategory(file);
const byCat = Object.fromEntries(split.map((s) => [s.cat, s]));

check('every declared category gets a payload', split.length === 3, `got ${split.length}`);
check(
	'a category with no points still gets one',
	byCat.laundry?.payload.points.length === 0 && byCat.laundry?.payload.meta.count === 0
);
check('categories come out in a stable order', split.map((s) => s.cat).join(',') === 'kopi,laundry,roti');

const kopi = byCat.kopi.payload;
check('a named point carries its name in the third slot', kopi.points[0][2] === 'Anomali Coffee Menteng');
check('an unnamed point has no third slot at all', kopi.points[1].length === 2);
// Five decimals is ±1 m, which is under a pixel at any zoom this map reaches. Both
// directions are pinned: -6.123456 rounds away from zero to -6.12346, and the exact
// half in 106.812345 rounds up to 106.81235.
check(
	'coordinates are rounded to five decimals',
	kopi.points[0][0] === -6.12346 && kopi.points[0][1] === 106.81235,
	JSON.stringify(kopi.points[0].slice(0, 2))
);
check('meta.named counts only the named ones', kopi.meta.named === 1, `got ${kopi.meta.named}`);
check('meta.count is every point', kopi.meta.count === 2);
check('coverage is carried through per category', kopi.meta.coverage.join() === 'JAKARTAPUSAT');
check('a category read but empty carries an empty coverage list', byCat.roti.payload.meta.coverage.length === 0);

/* ── and the shape the app parses ────────────────────────────────────────── */

// `parseCompetitors` in `domain/competitors.ts` destructures [lat, lon, name] and
// falls back to null. Pinned here rather than only in TypeScript because the encoding
// above and that destructuring are one contract written in two files, and only this
// side of it is ever regenerated.
console.log('\nround trip');
const parsed = kopi.points.map(([lat, lon, name]) => ({ lat, lon, name: name ?? null }));
check('the named point parses back with its name', parsed[0].name === 'Anomali Coffee Menteng');
check('the unnamed point parses back as null, not undefined', parsed[1].name === null);

console.log(`\n${failures ? `${failures} FAILED` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
