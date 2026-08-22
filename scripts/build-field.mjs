/**
 * Writes the field records the app shows for a selected catchment.
 *
 *   node scripts/build-field.mjs
 *
 * Output: `static/data/field.json`
 *
 * The grid already knows HOW MANY receipts, eateries, premises and community notes sit
 * inside a catchment — `join-missions.mjs` wrote that. What it does not keep is the
 * records themselves, and those are the whole point of this survey. "Twelve receipts
 * were recorded here" and "somebody paid by QRIS at Nasi Uduk Bu May on 20 August" are
 * the same fact at two different distances from a decision, and only the second can be
 * argued with.
 *
 * Membership is decided by `lib/home-cell.mjs`, the same module and therefore the same
 * answer `join-missions.mjs` counted with. That is the point of it being a module: the
 * list on the card cannot come to disagree with the count above it.
 *
 * Served from `static/` rather than imported, like the stops, the competitor points and
 * the property listings: fetched by URL when a cell is actually selected, so none of it
 * is in the JS bundle and the browser caches it as an ordinary asset.
 *
 * NAMED KEYS RATHER THAN A TUPLE, AND ON PURPOSE
 *
 * `build-property.mjs` and `build-pois.mjs` both pack their rows into fixed-length
 * arrays, because they carry thousands of rows of identical shape and the key names
 * cost more than the figures. Neither is true here. There are a few hundred records,
 * their shapes differ by survey — a receipt has a payment method, an eatery has a price
 * and a queue, a note has an author — and a tuple wide enough for all four would be
 * mostly nulls with a comment explaining which slot meant what.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignHomeCells } from './lib/home-cell.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * How much of a community note travels to the browser.
 *
 * The notes run to a few paragraphs and the card shows the opening of one, so the whole
 * text would be bytes nobody reads. Cut on a word boundary and marked with the agreed
 * ellipsis, never mid-word: a sentence that stops in the middle of "trotoar" reads as a
 * file that broke rather than as a passage that continues.
 */
const NOTE_CHARS = 220;

function shorten(text) {
	const s = String(text ?? '').replace(/\s+/g, ' ').trim();
	if (s.length <= NOTE_CHARS) return s || null;
	const cut = s.slice(0, NOTE_CHARS);
	const space = cut.lastIndexOf(' ');
	return `${(space > NOTE_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function main() {
	const grid = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/hexes.json'), 'utf8'));
	const mission = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/data/mission.json'), 'utf8'));
	const cells = grid.hexes ?? [];
	const records = mission.records ?? [];
	const radius = grid.meta?.walkRadius ?? 800;

	const { byCell, outside } = assignHomeCells(records, cells, radius);

	const rows = [];
	for (const [cell, mine] of byCell) {
		for (const r of mine) {
			const row = { cell, m: r.mission, lat: r.lat, lon: r.lon, d: r.distance };
			// Only the keys a record actually carries. An absent field stays absent all
			// the way to the interface, which is what lets the card say "no price was
			// written down" rather than printing a zero somebody would read as free.
			for (const key of ['place', 'kind', 'date', 'pay', 'dish', 'price', 'crowd', 'offer', 'address', 'photo', 'by', 'community']) {
				if (r[key] !== undefined && r[key] !== null) row[key] = r[key];
			}
			if (typeof r.cashless === 'boolean') row.cashless = r.cashless;
			if (r.mission === 'catatan') {
				row.title = r.title ?? null;
				row.body = shorten(r.body);
			}
			rows.push(row);
		}
	}

	// Nearest first inside a cell, and by cell otherwise, so the file is grouped as the
	// app groups it and the diff between two builds stays readable.
	rows.sort((a, b) => (a.cell < b.cell ? -1 : a.cell > b.cell ? 1 : a.d - b.d));

	const payload = {
		meta: {
			source: mission.meta.source,
			note: 'Catatan lapangan MAPID Apps. Persis catatan yang dihitung join-missions.mjs untuk kolom `field` tiap petak, jadi daftar di kartu sama dengan angka di atasnya.',
			records: rows.length,
			outside,
			cells: byCell.size,
			byMission: grid.meta?.mission?.byMission ?? {},
			regenerate: 'node scripts/build-field.mjs'
		},
		records: rows
	};

	const dir = resolve(ROOT, 'static/data');
	mkdirSync(dir, { recursive: true });
	const dest = resolve(dir, 'field.json');
	writeFileSync(dest, JSON.stringify(payload));

	const kb = Math.round(JSON.stringify(payload).length / 1024);
	console.log(`  ${rows.length} records in ${byCell.size} cells · ${outside} outside the grid · ${kb} KB`);
	console.log(`\n→ ${dest}`);
}

try {
	main();
} catch (err) {
	console.error('Failed:', err.message);
	process.exit(1);
}
