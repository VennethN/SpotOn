/**
 * Joins the MAPID Apps field surveys onto the hexagon grid.
 *
 *   node scripts/join-missions.mjs
 *
 * Reads `src/lib/data/hexes.json` and `src/lib/data/mission.json`, then rewrites
 * `hexes.json` with one addition per cell:
 *
 *   field — what surveyors actually recorded inside this catchment
 *
 * EACH RECORD GETS EXACTLY ONE HOME CELL
 *
 * This is the rule `domain/units` uses for property listings, and deliberately NOT the
 * one `join-property.mjs` uses for counting them. That join counts a listing into every
 * catchment that reaches it, which is right for a density and fatal for a list: the
 * interface names these records — a shop, a receipt, a note about a pavement — and the
 * same receipt appearing in five catchments would be five receipts to anyone reading.
 *
 * So a record belongs to the nearest cell centre within one walking radius, and to
 * nothing at all if there is no centre in range. A record outside the grid is dropped
 * here and counted in the report rather than being pulled to the closest edge.
 *
 * THE FIELD BLOCK IS ABSENT, NOT ZEROED, WHERE NOBODY WENT
 *
 * 74 of the 562 cells have any record at all, and that number is the reason this data
 * never reaches the score. A survey somebody walked and a survey nobody walked are not
 * a high reading and a low one, and a zero here would be read as "nothing happens on
 * this street" by an engine that cannot tell the difference. `field` therefore exists
 * only on the cells that have something in it, and the counts inside it are counts of
 * WHAT WAS RECORDED — which is what the interface calls them.
 *
 * A SHARE AND A MEDIAN NEED MORE THAN ONE READING; A COUNT DOES NOT
 *
 * "Eighteen receipts were recorded here" is true of a cell with eighteen receipts. "All
 * of the receipts here were cashless" is a claim about a street, and off one receipt it
 * is a claim about one afternoon. So the derived figures — the cashless share, the
 * typical price of a meal — need `MIN_READINGS` behind them and are null below it,
 * following the rule `join-property.mjs` already applies to its median.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignHomeCells } from './lib/home-cell.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hexPath = resolve(ROOT, 'src/lib/data/hexes.json');
const missionPath = resolve(ROOT, 'src/lib/data/mission.json');

/**
 * How many readings a derived figure needs before it is written.
 *
 * Three, the same as the property join's price rule, and for the same reason: two
 * readings that disagree have no middle, and one reading is not a distribution. The
 * counts beside it are written from one, because a count of one is exactly true.
 */
const MIN_READINGS = 3;

const median = (xs) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

function main() {
	const grid = JSON.parse(readFileSync(hexPath, 'utf8'));
	const mission = JSON.parse(readFileSync(missionPath, 'utf8'));
	const cells = grid.hexes ?? [];
	const records = mission.records ?? [];
	if (!cells.length) throw new Error('hexes.json holds no cells');
	if (!records.length) throw new Error('mission.json holds no records — run fetch-missions.mjs first');

	const radius = grid.meta?.walkRadius ?? 800;

	const { byCell, outside } = assignHomeCells(records, cells, radius);

	const tally = { cells: 0, struk: 0, menu: 0, properti: 0, catatan: 0, sewa: 0 };

	for (const cell of cells) {
		const mine = byCell.get(cell.id);
		if (!mine?.length) {
			// Nothing was recorded here. The absence is written as an absence: no key at
			// all, so nothing downstream can read it as a reading of zero.
			delete cell.field;
			continue;
		}
		tally.cells++;

		const struk = mine.filter((r) => r.mission === 'struk');
		const menu = mine.filter((r) => r.mission === 'menu');
		const properti = mine.filter((r) => r.mission === 'properti');
		const catatan = mine.filter((r) => r.mission === 'catatan');

		const paid = struk.filter((r) => typeof r.cashless === 'boolean');
		const prices = menu.map((r) => r.price).filter((p) => typeof p === 'number');
		const sewa = properti.filter((r) => r.offer === 'sewa');

		const field = {
			struk: struk.length,
			menu: menu.length,
			properti: properti.length,
			catatan: catatan.length,
			/** Of the property records here, the ones offered for rent. The first rental
			    figure this project has ever been able to carry. */
			sewa: sewa.length,
			/** Share of the receipts here that were paid without cash, 0..1. Null below
			    `MIN_READINGS` receipts whose method was recognised. */
			nontunai: paid.length >= MIN_READINGS ? paid.filter((r) => r.cashless).length / paid.length : null,
			/** Median of what the eateries here charge on average, rupiah. Null below
			    `MIN_READINGS` priced records. */
			harga: prices.length >= MIN_READINGS ? median(prices) : null
		};

		cell.field = field;
		tally.struk += struk.length;
		tally.menu += menu.length;
		tally.properti += properti.length;
		tally.catatan += catatan.length;
		tally.sewa += sewa.length;
	}

	grid.meta.mission = {
		source: mission.meta.source,
		records: records.length,
		/** Records that landed in a catchment. The rest are inside the grid's bounding
		    box and outside every catchment in it, which is most of the box. */
		placed: records.length - outside,
		outside,
		cells: tally.cells,
		byMission: {
			struk: tally.struk,
			menu: tally.menu,
			properti: tally.properti,
			catatan: tally.catatan
		},
		/** Property records offered for rent rather than for sale. Written from the join
		    so any sentence quoting it follows the data. */
		sewa: tally.sewa,
		minReadings: MIN_READINGS,
		vocab: mission.meta.vocab,
		rule: 'Tiap catatan lapangan punya satu petak: pusat petak terdekat dalam radius jalan kaki. Petak tanpa catatan tidak punya kolom `field` sama sekali, bukan nol.',
		regenerate: 'node scripts/fetch-missions.mjs && node scripts/join-missions.mjs'
	};

	writeFileSync(hexPath, JSON.stringify(grid));

	console.log(`  records            : ${records.length}`);
	console.log(`  placed in a cell   : ${records.length - outside} · outside every catchment ${outside}`);
	console.log(`  cells with records : ${tally.cells} of ${cells.length}`);
	console.log(`  by survey          : struk ${tally.struk} · menu ${tally.menu} · properti ${tally.properti} · catatan ${tally.catatan}`);
	console.log(`  offered for rent   : ${tally.sewa}`);
	const withShare = cells.filter((c) => c.field?.nontunai !== null && c.field?.nontunai !== undefined).length;
	const withPrice = cells.filter((c) => c.field?.harga !== null && c.field?.harga !== undefined).length;
	console.log(`  cells with a cashless share : ${withShare} · with a meal price : ${withPrice}`);
	console.log(`\n→ ${hexPath}`);
}

try {
	main();
} catch (err) {
	console.error('Failed:', err.message);
	process.exit(1);
}
