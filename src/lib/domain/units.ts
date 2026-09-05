import { isPremises } from './cost';
import type { Listing } from './premises';
import { stopTotal } from './transit';
import { haversine } from '$lib/utils/geo';
import type { HexBase, ScoredHex } from '$lib/types';

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
 * Deliberately a separate list from `domain/metrics`, not an extension of it. Those read
 * a catchment; these read a unit standing in one, and half of them — the asking price,
 * the floor area, the number of storeys — do not exist at cell level at all. Folding the
 * two together would produce one registry where half the entries are null for half the
 * callers, which is the shape that invites a `?? 0` and ends the honesty.
 *
 * The cell-level entries are here too, read THROUGH the unit's home cell, because "the
 * cheapest unit in a catchment that actually has customers" is the question this pivot
 * exists to answer and it needs both halves in one sort.
 */
export const UNIT_METRIC_KEYS = [
	'harga',
	'harga_m2',
	'luas_tanah',
	'luas_bangunan',
	'lantai',
	'skor_petak',
	'permintaan_petak',
	'pesaing_petak',
	'akses_petak',
	'jarak_pusat'
] as const;

export type UnitMetricKey = (typeof UNIT_METRIC_KEYS)[number];

export interface UnitMetricDef {
	key: UnitMetricKey;
	read: (u: ScoredUnit) => number | null;
	kind: 'rupiah' | 'area' | 'count' | 'pct' | 'metre';
	/** Which end a plain "best" means. Cheapest price, highest score. */
	best: 'asc' | 'desc';
}

export const UNIT_METRICS: UnitMetricDef[] = [
	{ key: 'harga', read: (u) => u.listing.price, kind: 'rupiah', best: 'asc' },
	{ key: 'harga_m2', read: (u) => u.listing.ppm, kind: 'rupiah', best: 'asc' },
	{ key: 'luas_tanah', read: (u) => u.listing.land, kind: 'area', best: 'desc' },
	{ key: 'luas_bangunan', read: (u) => u.listing.build, kind: 'area', best: 'desc' },
	{ key: 'lantai', read: (u) => u.listing.floors, kind: 'count', best: 'desc' },
	// Through the home cell. Null while the category's columns are still in the air, and
	// null is dropped from a ranking rather than sorted last — the same rule the cell
	// pivot follows, for the same reason.
	{ key: 'skor_petak', read: (u) => u.row?.score ?? null, kind: 'pct', best: 'desc' },
	{ key: 'permintaan_petak', read: (u) => u.row?.demand ?? null, kind: 'pct', best: 'desc' },
	{
		key: 'pesaing_petak',
		read: (u) => (u.row && u.row.covered ? u.row.osm : null),
		kind: 'count',
		best: 'asc'
	},
	{ key: 'akses_petak', read: (u) => u.row?.access ?? null, kind: 'pct', best: 'desc' },
	{ key: 'jarak_pusat', read: (u) => u.distance, kind: 'metre', best: 'asc' }
];

export const UNIT_METRIC_MAP = Object.fromEntries(UNIT_METRICS.map((m) => [m.key, m])) as Record<
	UnitMetricKey,
	UnitMetricDef
>;

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

/** A band filter, exactly as the cell pivot expresses one: a third of the set, computed
    from the set, never a threshold anybody typed. */
export interface UnitFilter {
	ukuran: UnitMetricKey;
	arah: 'rendah' | 'tinggi' | 'ada';
}

function tercile(units: ScoredUnit[], def: UnitMetricDef): { low: number; high: number } | null {
	const vals = units
		.map((u) => def.read(u))
		.filter((v): v is number => v !== null)
		.sort((a, b) => a - b);
	if (vals.length < 6) return null;
	return {
		low: vals[Math.floor(vals.length / 3)],
		high: vals[Math.floor((vals.length * 2) / 3)]
	};
}

export function applyUnitFilters(units: ScoredUnit[], filters: UnitFilter[]): ScoredUnit[] {
	let out = units;
	for (const f of filters) {
		const def = UNIT_METRIC_MAP[f.ukuran];
		if (!def) continue;
		if (f.arah === 'ada') {
			out = out.filter((u) => {
				const v = def.read(u);
				return v !== null && v > 0;
			});
			continue;
		}
		const band = tercile(out, def);
		if (!band) continue;
		out = out.filter((u) => {
			const v = def.read(u);
			if (v === null) return false;
			return f.arah === 'rendah' ? v <= band.low : v >= band.high;
		});
	}
	return out;
}

/**
 * Ranks units by one figure.
 *
 * Units with nothing measured for it are dropped rather than sorted last, as in the cell
 * pivot: a list of "the cheapest units" whose tail is really "the units with no price on
 * them" is worse than a shorter list, because nothing on screen separates the two.
 *
 * The tie-break is the home cell's opportunity score, so two units asking the same money
 * come back with the better-placed one first rather than in file order.
 */
export function rankUnits(
	units: ScoredUnit[],
	key: UnitMetricKey,
	order: 'asc' | 'desc'
): Array<{ unit: ScoredUnit; value: number }> {
	const def = UNIT_METRIC_MAP[key];
	if (!def) return [];
	const sign = order === 'asc' ? 1 : -1;
	return units
		.map((unit) => ({ unit, value: def.read(unit) }))
		.filter((x): x is { unit: ScoredUnit; value: number } => x.value !== null)
		.sort(
			(a, b) => sign * (a.value - b.value) || (b.unit.row?.score ?? 0) - (a.unit.row?.score ?? 0)
		);
}

/** How many transit nodes the unit's home cell captures. Read from the cell's own
    counts, so it is right before `stops.json` has arrived. */
export const unitStops = (u: ScoredUnit, cells: HexBase[]): number => {
	const cell = cells.find((c) => c.id === u.cellId);
	return cell ? stopTotal(cell.transit) : 0;
};
