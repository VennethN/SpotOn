import { isPremises, type Listing } from './premises';
import { MIN_BAND, applyBands, levelOn, rankRows, type Band, type Measure } from './rank';
import { stopTotal } from './transit';
import { haversine } from '$lib/utils/geo';
import type { HexBase, ScoredHex, UnitMetricKey } from '$lib/types';

/**
 * The map, pivoted on the unit rather than the cell.
 *
 * WHY A SECOND PIVOT EXISTS AT ALL
 *
 * Everything else in this product ranks CATCHMENTS: 562 hexagons, sorted by whichever
 * figure was asked about. That is the right shape for "where should I open", and the
 * wrong shape for the thing a reader does next. Nobody rents a hexagon. They rent a
 * particular shophouse on a particular street, at a particular asking price, and the
 * cell is context for that decision rather than the decision itself.
 *
 * A cell ranking cannot be turned into that by reading it harder. "Tebet scores 78" is
 * one number over twenty-odd units asking anywhere from Rp 2 billion to Rp 20 billion,
 * and the reader still has to work out which of them they can afford. Pivoting swaps
 * which of the two is the row and which is the column: each unit is a row, and the
 * catchment it stands in travels with it.
 *
 * ONE HOME CELL PER UNIT, AND WHY IT IS NOT THE SAME RULE AS THE COUNTS
 *
 * `join-property.mjs` counts a listing into EVERY cell whose 800 m catchment covers it,
 * which is correct for a count: a unit really is within walking distance of several
 * cell centres, and each of those catchments really does have it in reach.
 *
 * A pivot cannot do that. A row that appears five times, with five different scores
 * beside it, is not a list of places to rent — it is the same shophouse arguing with
 * itself. So each unit is given exactly one home cell: the nearest cell centre. The
 * choice is arbitrary in the sense that any of the covering cells would have been
 * defensible, and it is NOT arbitrary in the sense that matters — it is the cell whose
 * figures were computed from the tightest ring around this doorway.
 *
 * A unit with no cell centre within the walking radius gets none, and is dropped. That
 * is not a data gap: the grid only covers the walkable ring around transit, so a unit
 * outside every ring is a unit outside the area this product claims to know anything
 * about, and giving it the figures of a cell 2 km away would be inventing a catchment.
 */

export interface ScoredUnit {
	/** Stable within one build of the point file: its index. The listings have no id of
	    their own, and 1,915 of them share a coordinate with another, so nothing derived
	    from their columns can tell four units in one building apart. */
	id: string;
	listing: Omit<Listing, 'distance'>;
	/** The cell this unit stands in, and the row that cell scored for the active
	    category. `row` is null while that category's columns are still loading. */
	cellId: string;
	cellName: string;
	row: ScoredHex | null;
	/** Metres from the unit to its home cell's centre. */
	distance: number;
}

/**
 * Builds the unit rows: every premises with a home cell, in no particular order.
 *
 * Premises only. A warehouse and an office floor are commercial property on the market
 * and are counted in the cell panel, but a list of places to open a coffee shop in that
 * includes a warehouse is a list the reader has to filter by hand.
 */
export function buildUnits(
	cells: HexBase[],
	listings: Array<Omit<Listing, 'distance'>>,
	rowById: Map<string, ScoredHex>,
	radiusM: number
): ScoredUnit[] {
	const out: ScoredUnit[] = [];
	for (const [i, l] of listings.entries()) {
		if (!isPremises(l.type)) continue;

		// Nearest cell centre within the walking radius. The box test first, as
		// everywhere else in this codebase: 0.012° is ~1.3 km, comfortably wider than
		// the radius, and it discards nearly all 562 cells before any trigonometry.
		let best: HexBase | null = null;
		let bestD = Infinity;
		for (const c of cells) {
			if (Math.abs(c.lat - l.lat) > 0.012 || Math.abs(c.lon - l.lon) > 0.012) continue;
			const d = haversine(l.lat, l.lon, c.lat, c.lon);
			if (d < bestD) {
				bestD = d;
				best = c;
			}
		}
		if (!best || bestD > radiusM) continue;

		out.push({
			id: String(i),
			listing: l,
			cellId: best.id,
			cellName: best.name ?? `Petak ${best.id.slice(-6)}`,
			row: rowById.get(best.id) ?? null,
			distance: Math.round(bestD)
		});
	}
	return out;
}

/**
 * The figures a unit can be ranked by.
 *
 * Deliberately a separate table from `domain/metrics`, not an extension of it. Those
 * read a catchment; these read a unit standing in one, and half of them — the asking
 * price, the floor area, the number of storeys — do not exist at cell level at all.
 * Folding the two together would produce one registry where half the entries are null
 * for half the callers, which is the shape that invites a `?? 0` and ends the honesty.
 *
 * The cell-level entries are here too, read THROUGH the unit's home cell, because "the
 * cheapest unit in a catchment that actually has customers" is the question this pivot
 * exists to answer and it needs both halves in one sort.
 *
 * The ARITHMETIC is shared, in `domain/rank`. What differs between the two pivots is the
 * row type and the list of measures; the rules about bands, dropped rows and composing
 * filters are the same rules, and were written twice before they were written once.
 */
export interface UnitMetricDef extends Measure<ScoredUnit> {
	kind: 'rupiah' | 'area' | 'count' | 'pct' | 'metre';
}

/** Keyed rather than listed, so a key in the union without a definition here is a
    compile error rather than an `undefined` at the far end of a sort. */
export const UNIT_METRIC_MAP: Record<UnitMetricKey, UnitMetricDef> = {
	harga: { read: (u) => u.listing.price, kind: 'rupiah', best: 'asc' },
	harga_m2: { read: (u) => u.listing.ppm, kind: 'rupiah', best: 'asc' },
	luas_tanah: { read: (u) => u.listing.land, kind: 'area', best: 'desc' },
	luas_bangunan: { read: (u) => u.listing.build, kind: 'area', best: 'desc' },
	lantai: { read: (u) => u.listing.floors, kind: 'count', best: 'desc' },
	// Through the home cell. Null while the category's columns are still in the air, and
	// null is dropped from a ranking rather than sorted last — the same rule the cell
	// pivot follows, for the same reason, from the same module.
	skor_petak: { read: (u) => u.row?.score ?? null, kind: 'pct', best: 'desc' },
	permintaan_petak: { read: (u) => u.row?.demand ?? null, kind: 'pct', best: 'desc' },
	pesaing_petak: {
		read: (u) => (u.row && u.row.covered ? u.row.osm : null),
		kind: 'count',
		best: 'asc'
	},
	akses_petak: { read: (u) => u.row?.access ?? null, kind: 'pct', best: 'desc' },
	jarak_pusat: { read: (u) => u.distance, kind: 'metre', best: 'asc' }
};

export const UNIT_METRIC_KEYS = Object.keys(UNIT_METRIC_MAP) as UnitMetricKey[];

/**
 * Where one unit's figure sits among every unit that has one, 0 lowest to 1 highest.
 *
 * The unit pivot's half of `standingOf` in `domain/metrics`, through the same
 * arithmetic in `domain/rank` and under the same gate: below `MIN_BAND` readings a
 * standing is a fact about the sample, and a unit with no reading has none rather than
 * the lowest one.
 */
export function unitStanding(
	unit: ScoredUnit,
	key: UnitMetricKey,
	ladder: readonly number[]
): number | null {
	if (ladder.length < MIN_BAND) return null;
	return levelOn(UNIT_METRIC_MAP[key].read(unit), ladder);
}

export const isUnitMetric = (v: unknown): v is UnitMetricKey =>
	typeof v === 'string' && (UNIT_METRIC_KEYS as readonly string[]).includes(v);

/**
 * What a plain "show me places" is sorted by.
 *
 * Cheapest-first was the obvious answer and it is the wrong one, for a reason only
 * visible once the list exists. The listings carry real errors at the bottom of the
 * price range — a "Komersial lain" asking Rp 100 juta, a kiosk on 6 m² — so ascending by
 * price leads with exactly the rows least likely to be true. A first screen made of
 * probable typos is a bad first screen however honest each row is about itself.
 *
 * The home cell's score leads instead: it is what the rest of the product is about, it
 * has no equivalent junk end, and the reader is one press away from price if what they
 * came with is a budget.
 */
export const DEFAULT_UNIT_METRIC: UnitMetricKey = 'skor_petak';

/**
 * Which direction a list of units actually runs, given what the question asked for.
 *
 * One place, so the rule parser and the model reader cannot disagree about it — the
 * unit pivot's counterpart to `resolveOrder` in `domain/metrics`, and kept apart from it
 * for the reason that function's own registry is kept apart: the two disagree about
 * which end is "best" often enough for a shared answer to be wrong quietly. `pesaing`
 * wants the fewest first and `luas_bangunan` wants the largest, and a direction settled
 * for one and applied to the other answers backwards without erroring.
 *
 * No hour among these measures, so there is no equivalent of that function's second
 * rule: every unit measure is a quantity, and having more or less of it means something.
 */
export function resolveUnitOrder(key: UnitMetricKey, asked?: 'asc' | 'desc'): 'asc' | 'desc' {
	return asked ?? UNIT_METRIC_MAP[key].best;
}

/** A band filter, exactly as the cell pivot expresses one: a third of the current set,
    computed from the set, never a threshold anybody typed. */
export type UnitFilter = Band<UnitMetricKey>;

export const applyUnitFilters = (units: ScoredUnit[], filters: UnitFilter[]): ScoredUnit[] =>
	applyBands(units, filters, (k) => UNIT_METRIC_MAP[k]);

/** Ranks units by one figure, tie-broken by the home cell's opportunity score so two
    units asking the same money come back better-placed first. */
export const rankUnits = (
	units: ScoredUnit[],
	key: UnitMetricKey,
	order: 'asc' | 'desc'
): Array<{ unit: ScoredUnit; value: number }> =>
	rankRows(units, UNIT_METRIC_MAP[key], order, (u) => u.row?.score ?? 0).map(
		({ row, value }) => ({ unit: row, value })
	);

/** Where one unit sits in the ranked list, and the figure that put it there. */
export interface UnitRank {
	/** Position in the list as 0..1, with 1 at the top of it. */
	fraction: number;
	/** The reading of the measure the list is sorted by. */
	value: number;
}

/**
 * The ranked list, by unit id.
 *
 * POSITION, NOT MAGNITUDE. The values are prices, areas, scores and metres, and a scale
 * keyed on magnitude is unreadable on any measure with a long tail, which is all of them.
 *
 * Written once because two surfaces read it and they must not drift: the map colours each
 * dot from it, and the hover readout colours the figure it prints beside that dot. They
 * were the same rule in two places for a while, which is how a tooltip comes to describe
 * a dot in one shade while wearing another.
 *
 * A unit the sort could not rank is absent rather than given a position. That is what the
 * no-data grey is drawn from, and it is the same rule the ranking itself follows: an
 * unmeasured row is dropped, never sorted to the bottom as though it had been measured
 * and come last.
 */
export const unitRanks = (
	rows: ReadonlyArray<{ unit: ScoredUnit; value: number }>
): Map<string, UnitRank> => {
	const n = rows.length;
	return new Map(
		rows.map(({ unit, value }, i) => [unit.id, { fraction: n < 2 ? 1 : 1 - i / (n - 1), value }])
	);
};

/** How many transit nodes the unit's home cell captures. Read from the cell's own
    counts, so it is right before `stops.json` has arrived. */
export const unitStops = (u: ScoredUnit, cells: HexBase[]): number => {
	const cell = cells.find((c) => c.id === u.cellId);
	return cell ? stopTotal(cell.transit) : 0;
};
