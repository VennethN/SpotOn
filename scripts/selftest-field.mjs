/**
 * The field-survey pipeline, checked against the files it produced.
 *
 *   node scripts/selftest-field.mjs
 *
 * Three joins run over this data and each of them could drift from the others without
 * anything failing to build: `join-missions.mjs` writes the per-cell counts,
 * `build-field.mjs` writes the records those counts were taken over, and the app lists
 * the records under the counts. A card that says "12 receipts" above a list of nine is
 * exactly the kind of wrong that looks fine.
 *
 * So the counts are recomputed here from the records and compared, rather than both
 * being read from the same place and agreeing trivially.
 */

import { readFileSync } from 'node:fs';
import { haversine } from './lib/geo.mjs';
import { metres } from './lib/home-cell.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

const grid = read('src/lib/data/hexes.json');
const client = read('static/data/field.json');
const cells = grid.hexes;
const records = client.records;
const meta = grid.meta.mission;

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Field-survey self-test (no network)\n');

check('the grid has been through the mission join', Boolean(meta));
check('the client file holds records', records.length > 0);

/* ── one earth, and no local copy of it ──────────────────────────────────── */

/*
 * `home-cell.mjs` decides which catchment a record belongs to, and it used to measure
 * on `const R = 6_371_000` — a THIRD earth beside the 6371008.8 the joins carried and
 * the 6378137 `src/lib/utils/geo.ts` measures with. Nothing on this layer drifted
 * because of it, since a record's cell is decided once at build time and the browser
 * never recounts. That is luck rather than design: the moment anything here starts
 * measuring twice, three earths would put a record in one cell and its count in
 * another. So the identity is asserted rather than the answers.
 */
check(
	'the home-cell rule measures on the shared earth, not a copy of it',
	metres === haversine,
	'home-cell.mjs has its own distance function again'
);

/* ── the two files describe the same set ─────────────────────────────────── */

const byId = new Map(cells.map((c) => [c.id, c]));
check(
	'every record belongs to a cell that exists',
	records.every((r) => byId.has(r.cell)),
	records.filter((r) => !byId.has(r.cell)).length + ' orphans'
);

const KINDS = ['struk', 'menu', 'properti', 'catatan'];
const counted = new Map();
for (const r of records) {
	const per = counted.get(r.cell) ?? { struk: 0, menu: 0, properti: 0, catatan: 0, sewa: 0 };
	per[r.m]++;
	if (r.offer === 'sewa') per.sewa++;
	counted.set(r.cell, per);
}

let mismatch = 0;
for (const cell of cells) {
	const per = counted.get(cell.id);
	const stored = cell.field;
	if (!per && !stored) continue;
	if (!per || !stored) {
		mismatch++;
		continue;
	}
	for (const k of [...KINDS, 'sewa']) if (per[k] !== stored[k]) mismatch++;
}
check(
	'every count on the grid equals the records the client file carries',
	mismatch === 0,
	`${mismatch} disagreements`
);

/* ── a cell nobody visited has no field block, not a row of zeroes ───────── */

check(
	'a cell with no records carries no `field` key at all',
	cells.every((c) => (counted.has(c.id) ? Boolean(c.field) : c.field === undefined))
);
check(
	`${meta.cells} of the ${cells.length} cells have anything at all`,
	meta.cells === counted.size && meta.cells < cells.length,
	`${meta.cells} vs ${counted.size}`
);

/* ── one record, one cell ────────────────────────────────────────────────── */

const seen = new Map();
for (const r of records) {
	const where = seen.get(r.id);
	if (where !== undefined && where !== r.cell) seen.set(r.id, 'DUPLICATE');
	else seen.set(r.id, r.cell);
}
check(
	'no record appears in two catchments',
	[...seen.values()].every((v) => v !== 'DUPLICATE')
);

/**
 * Ids are unique inside a cell.
 *
 * The regression this exists for: the card keys its lists by this id, and a keyed list
 * with two identical keys throws in the middle of an update. What that looked like was
 * a panel frozen on "loading" forever with the data sitting in memory behind it, and
 * nothing in the build said a word. It was keyed on what was visible before, and 112 of
 * the property records share one placeholder photograph.
 */
let dupInCell = 0;
for (const [cellId] of counted) {
	const ids = records.filter((r) => r.cell === cellId).map((r) => r.id);
	if (new Set(ids).size !== ids.length) dupInCell++;
}
check('ids are unique inside every catchment, which is what the card keys on', dupInCell === 0);
check(
	'every record carries an id',
	records.every((r) => typeof r.id === 'string' && r.id.length > 0)
);

/* ── the derived figures need readings behind them ───────────────────────── */

const MIN = meta.minReadings;
let thin = 0;
let missingShare = 0;
for (const cell of cells) {
	const f = cell.field;
	if (!f) continue;
	const mine = records.filter((r) => r.cell === cell.id);
	const paid = mine.filter((r) => r.m === 'struk' && typeof r.cashless === 'boolean').length;
	const priced = mine.filter((r) => r.m === 'menu' && typeof r.price === 'number').length;
	if (f.nontunai !== null && paid < MIN) thin++;
	if (f.harga !== null && priced < MIN) thin++;
	// And the other way: enough readings and no figure written is a figure lost.
	if (f.nontunai === null && paid >= MIN) missingShare++;
	if (f.harga === null && priced >= MIN) missingShare++;
}
check(`no share or median is written off fewer than ${MIN} readings`, thin === 0, `${thin} too thin`);
check('and none is withheld where the readings are there', missingShare === 0, `${missingShare} lost`);

/* ── the rental claim is read off the data ───────────────────────────────── */

const sewa = records.filter((r) => r.offer === 'sewa').length;
check(
	`the ${meta.sewa} rentals the grid claims are the ${sewa} in the records`,
	meta.sewa === sewa
);
check(
	'every rental record is a property record',
	records.filter((r) => r.offer).every((r) => r.m === 'properti')
);

/* ── nothing here reaches the score ──────────────────────────────────────── */

/* The engine's own guarantee is asserted in selftest-nlq.mjs, on the scoring module
   itself. What is checked here is the shape that makes it possible: the field block is
   a leaf on the cell, and no scoring column has been folded into it. */
const SCORING_COLUMNS = ['osm', 'mapid', 'dens', 'covered', 'prop', 'access', 'transit'];
check(
	'the field block holds no scoring column',
	cells.every((c) => !c.field || SCORING_COLUMNS.every((k) => !(k in c.field)))
);

console.log(failures ? `\n${failures} failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
