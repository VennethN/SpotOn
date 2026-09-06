import { haversine } from '$lib/utils/geo';
import type { HexBase, TransitCounts } from '$lib/types';

/**
 * What a cell's transit access is actually made of.
 *
 * The grid stores transit as four COUNTS, because a count is all the score needs:
 * access is a weighted sum of them, damped by a square root. But a count is not what
 * someone choosing a location wants to read. "MRT ×2" says far less than "Blok M and
 * ASEAN, both a ten-minute walk" — the second names places they can picture, check,
 * and argue with.
 *
 * So the stops themselves are loaded separately (`static/data/stops.json`, written by
 * `scripts/build-stops.mjs` from the very same Overpass query the grid counted) and
 * matched back to a cell here, on demand, for one cell at a time.
 */

/** The four modes, densest last — the order they are listed in. */
export const MODES = ['mrt', 'krl', 'lrt', 'brt'] as const;
export type Mode = (typeof MODES)[number];

/**
 * Weights carried over from `build-hexes.mjs`, where access is computed. Repeated
 * here only to EXPLAIN a number the grid already decided, never to recompute it —
 * the panel reads `hex.access` as built.
 */
export const MODE_WEIGHT: Record<Mode, number> = { mrt: 1.0, krl: 0.9, lrt: 0.6, brt: 0.45 };

/**
 * The divisor in `access = min(1, √weighted ÷ 3.2)`, also from `build-hexes.mjs`.
 *
 * Carried here for the same reason as the weights: so the breakdown can PRINT the
 * formula that produced the index instead of describing it in prose that can drift
 * away from the arithmetic. Nothing reads it to recompute an access value.
 */
export const ACCESS_DIVISOR = 3.2;

/** Rail modes. Kept apart from BRT because they behave differently for a business:
    a rail station is a single fixed doorway with all-day, all-week footfall, while
    bus stops are many and spread out, so their crowd is thinner at any one of them. */
export const RAIL: Mode[] = ['mrt', 'krl', 'lrt'];

export interface Stop {
	name: string | null;
	mode: Mode;
	lat: number;
	lon: number;
	/** Metres from the cell centre — filled in when matched to a cell. */
	distance: number;
}

/** The on-disk shape: short keys, because this file carries ~1,100 of them. */
interface RawStop {
	n: string | null;
	m: Mode;
	y: number;
	x: number;
}

export interface StopsFile {
	meta: { count: number; byMode: Record<string, number> };
	stops: RawStop[];
}

export function parseStops(file: StopsFile): Omit<Stop, 'distance'>[] {
	return file.stops.map((s) => ({ name: s.n, mode: s.m, lat: s.y, lon: s.x }));
}

/**
 * The stops one cell captures, nearest first.
 *
 * The same test the grid used when it counted them: distance from the CELL CENTRE,
 * not from its boundary. Measuring from the boundary would return more stops than
 * the cell was credited with, and the panel would disagree with the score sitting
 * next to it.
 */
export function capturedStops(
	cell: Pick<HexBase, 'lat' | 'lon'>,
	stops: Omit<Stop, 'distance'>[],
	radiusM: number
): Stop[] {
	const out: Stop[] = [];
	// A cheap box test before the trigonometry: 0.012° is ~1.3 km, comfortably wider
	// than the walking radius, and it discards nearly all 1,100 stops immediately.
	const box = 0.012;
	for (const s of stops) {
		if (Math.abs(s.lat - cell.lat) > box || Math.abs(s.lon - cell.lon) > box) continue;
		const distance = haversine(cell.lat, cell.lon, s.lat, s.lon);
		if (distance <= radiusM) out.push({ ...s, distance });
	}
	return out.sort((a, b) => a.distance - b.distance);
}

/** Named stops of one mode, nearest first, deduplicated by name.
    Platforms of one station are separate OSM nodes, and a list that reads
    "Dukuh Atas, Dukuh Atas, Dukuh Atas" looks like a bug, not like three platforms. */
export function namedStops(stops: Stop[], modes: Mode[]): Stop[] {
	const seen = new Set<string>();
	const out: Stop[] = [];
	for (const s of stops) {
		if (!modes.includes(s.mode) || !s.name) continue;
		const key = s.name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(s);
	}
	return out;
}

/** Which access band this cell falls in — the key into the locale's wording. */
export type AccessBand = 'strongest' | 'strong' | 'fair' | 'thin';

export function accessBand(access: number): AccessBand {
	if (access >= 0.8) return 'strongest';
	if (access >= 0.55) return 'strong';
	if (access >= 0.3) return 'fair';
	return 'thin';
}

/**
 * How much this cell's transit access is worth to its opportunity score, as a
 * percentage uplift over a cell with no transit at all.
 *
 * `scoring.ts` multiplies every score by `0.6 + 0.4 × access`, so the worst-served
 * cell keeps 60% of its score and the best-served keeps all of it. Stating the
 * multiplier as "+X% against a cell with no transit" is the same fact in the form
 * someone can act on — and it is read from the same constants the engine uses rather
 * than being a second, prettier number invented for the panel.
 */
export const ACCESS_FLOOR = 0.6;
export const ACCESS_SPAN = 0.4;

export function accessUplift(access: number): number {
	return Math.round(((ACCESS_FLOOR + ACCESS_SPAN * access) / ACCESS_FLOOR - 1) * 100);
}

/** Modes actually present in this cell, densest-last order, with their counts. */
export function presentModes(transit: TransitCounts): Array<{ mode: Mode; n: number }> {
	return MODES.map((mode) => ({ mode, n: transit[mode] })).filter((m) => m.n > 0);
}

/**
 * A captured list of stops, counted back into the shape the grid holds.
 *
 * The grid's own counts are the ones on display wherever the range is measured from a
 * cell centre, because they are what the access index was computed from and they are
 * right before `stops.json` has arrived. A range measured from a doorway has no such
 * counts to read: `build-hexes.mjs` never stood in that doorway. So the nodes are
 * counted off the very list being named underneath them, which is honest for the same
 * reason the grid's figure is honest in the other case, and it is why the two can
 * never disagree with each other.
 *
 * The stop file is the whole of OpenStreetMap's transit nodes for the city rather than
 * a sample of it, so this counts what the grid would have counted had it been asked
 * about this point.
 */
export function countStops(stops: Stop[]): TransitCounts {
	const out: TransitCounts = { mrt: 0, krl: 0, lrt: 0, brt: 0 };
	for (const s of stops) out[s.mode] += 1;
	return out;
}

/**
 * Every transit node the cell captures, and the rail half of it.
 *
 * Read from the GRID's counts rather than from the stop list, so both are right on
 * the first frame — before `stops.json` has been fetched, and even if it never
 * arrives. This is also the count the score was computed from, which is the whole
 * reason it is the one on display.
 */
export const stopTotal = (t: TransitCounts): number => MODES.reduce((a, m) => a + t[m], 0);
export const railTotal = (t: TransitCounts): number => RAIL.reduce((a, m) => a + t[m], 0);

/** One mode's part of the weighted sum the access index was built from. */
export interface ModeShare {
	mode: Mode;
	/** Nodes of this mode inside the walking range. */
	n: number;
	weight: number;
	/** n × weight. */
	weighted: number;
	/** Its share of the whole weighted sum, 0..1. */
	share: number;
}

/**
 * Where a cell's access index comes from, mode by mode.
 *
 * Access is `min(1, √(Σ n×w) ÷ 3.2)` — a single number in which one MRT station and
 * two TransJakarta stops are indistinguishable. This splits the sum back up so the
 * reader can see which mode is actually carrying the cell, which is a different
 * question from how many stops there are.
 */
export function modeShares(transit: TransitCounts): ModeShare[] {
	const rows = MODES.map((mode) => ({
		mode,
		n: transit[mode],
		weight: MODE_WEIGHT[mode],
		weighted: transit[mode] * MODE_WEIGHT[mode]
	})).filter((r) => r.n > 0);
	const sum = rows.reduce((a, r) => a + r.weighted, 0);
	return rows.map((r) => ({ ...r, share: sum > 0 ? r.weighted / sum : 0 }));
}

/** The nodes of one mode: how many the grid counted, and which of them have names. */
export interface ModeStops {
	mode: Mode;
	/** Nodes counted by the grid — what the access index was computed from. */
	nodes: number;
	/** Distinct named stations among them, nearest first. */
	named: Stop[];
	/**
	 * Nodes with no name of their own. Platforms of one station are separate OSM
	 * nodes and a stop can simply be untagged, so this is nearly always > 0 — stating
	 * it is what keeps a list of four names under a count of nine from reading as a
	 * bug.
	 */
	unnamed: number;
}

/** The captured stops grouped by mode, densest-last, for the audit list. */
export function stopsByMode(transit: TransitCounts, stops: Stop[]): ModeStops[] {
	return MODES.filter((mode) => transit[mode] > 0).map((mode) => {
		const named = namedStops(stops, [mode]);
		return { mode, nodes: transit[mode], named, unnamed: Math.max(0, transit[mode] - named.length) };
	});
}
