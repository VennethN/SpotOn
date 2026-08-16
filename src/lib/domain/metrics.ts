import { applyBands, rankRows, type Band, type Measure } from './rank';
import { stopTotal } from './transit';
import type { MetricKey, ScoredHex } from '$lib/types';

/**
 * Every figure a question can be asked about.
 *
 * WHY THIS EXISTS
 *
 * The understanding layer used to offer four intents, and three of them ranked by the
 * opportunity score. So "seberapa ramai di sini" — how busy is it around here — came
 * back as "Graha Werdatama Pondok Labu, 93 out of 100", which is a confident answer to
 * a question nobody asked. The data to answer it was already on the row.
 *
 * The fix is not more intents. It is to separate the SHAPE of the question (rank these,
 * compare those, flag the saturated ones) from the FIGURE it is about, and to let the
 * model choose the second from a list. This table is that list, and it is the single
 * place a new measure has to be added: the tool schema the model sees, the rule parser's
 * keywords, the sort, the filters and the sentence all read from here.
 *
 * WHAT THE MODEL CAN AND CANNOT DO
 *
 * It picks a key from this list and a direction. It never supplies a value, and there is
 * deliberately no way for it to: a filter is expressed as `rendah` or `tinggi`, and the
 * threshold for those is computed from the grid's own distribution at query time. A
 * model asked for "cheap areas" cannot answer "under 30 million", because that number
 * would be the one figure on the screen that came from nobody's data.
 *
 * NULL IS NOT ZERO HERE EITHER
 *
 * `read` returns null for a cell where the figure was never measured — an unsurveyed
 * competitor count, a catchment with no asking price. Those cells are dropped from a
 * ranking on that measure rather than sorted to the bottom of it, because the bottom of
 * a ranking is a claim and "not measured" is not one. `domain/rank` is where that rule
 * lives, shared with the unit pivot so the two cannot come to disagree about it.
 */

/** How a value is written out. The words belong to the locale files; this is the shape. */
export type MetricKind = 'pct' | 'count' | 'hour' | 'rupiah';

export interface MetricDef extends Measure<ScoredHex> {
	kind: MetricKind;
	/** Only meaningful for a MAPID-sourced figure that a city may not be covered for. */
	sourced?: 'mapid';
}

/**
 * The table, keyed rather than listed.
 *
 * `Record<MetricKey, MetricDef>` is what makes this exhaustive: a key added to the union
 * in `types.ts` without a definition here, or a definition here that is not in the
 * union, is a compile error. The previous shape was an array plus a
 * `Object.fromEntries(...) as Record<…>` cast, and a cast is exactly the place where
 * "every measure has a definition" stops being true without anything saying so.
 */
export const METRIC_MAP: Record<MetricKey, MetricDef> = {
	skor: { read: (r) => r.score, kind: 'pct', best: 'desc' },
	permintaan: { read: (r) => r.demand, kind: 'pct', best: 'desc' },
	penawaran: { read: (r) => r.supply, kind: 'pct', best: 'asc' },
	pesaing: {
		// Null rather than the stored 0 when this cell's city has not been surveyed for
		// the active category. Sorting an unsurveyed cell to the top of "fewest
		// competitors" is exactly the failure the whole engine is built to refuse.
		read: (r) => (r.covered ? r.osm : null),
		kind: 'count',
		best: 'asc',
		sourced: 'mapid'
	},
	keramaian: { read: (r) => (r.nodata ? null : r.busy), kind: 'pct', best: 'desc' },
	kunjungan: { read: (r) => (r.nodata ? null : r.nStruk), kind: 'count', best: 'desc' },
	jam_puncak: {
		// -1 is the engine's "no hourly profile", and an hour is not a quantity to be
		// ranked by size anyway — it is reported, and sorted only so the list is stable.
		read: (r) => (r.peakHour >= 0 ? r.peakHour : null),
		kind: 'hour',
		best: 'asc'
	},
	nontunai: { read: (r) => (r.nodata ? null : r.cashless), kind: 'pct', best: 'desc' },
	listing: { read: (r) => (r.nodata ? null : r.listings), kind: 'count', best: 'desc' },
	harga_tempat: {
		read: (r) => r.price,
		kind: 'rupiah',
		// Cheapest first. Somebody asking about the price of space is looking for a place
		// they can afford, not for the most expensive address on the map.
		best: 'asc',
		sourced: 'mapid'
	},
	unit_dipasarkan: {
		read: (r) => (r.propCovered ? r.units : null),
		kind: 'count',
		best: 'desc',
		sourced: 'mapid'
	},
	akses_transit: { read: (r) => r.access, kind: 'pct', best: 'desc' },
	simpul_transit: { read: (r) => stopTotal(r.transit), kind: 'count', best: 'desc' }
};

/**
 * The keys, in the table's own order.
 *
 * Derived rather than written out a second time. Two hand-kept lists of the same
 * thirteen strings is one list that will one day be twelve, and the one that goes short
 * is whichever the model reads.
 */
export const METRIC_KEYS = Object.keys(METRIC_MAP) as MetricKey[];

export const isMetric = (v: unknown): v is MetricKey =>
	typeof v === 'string' && (METRIC_KEYS as readonly string[]).includes(v);

/** The measure a plain "where should I open" is about. */
export const DEFAULT_METRIC: MetricKey = 'skor';

/**
 * Which direction a ranking actually runs, given what the question asked for.
 *
 * One place, so the rule parser and the model reader cannot disagree about it. Two
 * rules, and the second is the interesting one:
 *
 * 1. No direction asked for → the measure's own idea of "best".
 * 2. An HOUR ignores the direction asked for entirely. "Jam berapa paling ramai" — what
 *    hour is busiest — contains the words "paling ramai", which read as "most" and
 *    would sort the catchments by latest peak hour. The superlative in that sentence
 *    describes the busyness, not the clock, and an hour is not a quantity to have more
 *    of. It is reported, and sorted only so the list comes back in a stable order.
 */
export function resolveOrder(key: MetricKey, asked?: 'asc' | 'desc'): 'asc' | 'desc' {
	const def = METRIC_MAP[key] ?? METRIC_MAP[DEFAULT_METRIC];
	if (def.kind === 'hour') return def.best;
	return asked ?? def.best;
}

/** A filter the model is allowed to ask for: a measure and a band, never a threshold. */
export type MetricFilter = Band<MetricKey>;

/** Applies the filters. The rules — bands from the current set, unmeasured rows
    dropped, filters composing in order — are `domain/rank`'s, shared with the unit
    pivot so there is one version of them rather than two that agree today. */
export const applyFilters = (rows: ScoredHex[], filters: MetricFilter[]): ScoredHex[] =>
	applyBands(rows, filters, (k) => METRIC_MAP[k]);

/** Ranks catchments by one measure, tie-broken by the opportunity score. */
export const rankBy = (
	rows: ScoredHex[],
	key: MetricKey,
	order: 'asc' | 'desc'
): Array<{ row: ScoredHex; value: number }> =>
	rankRows(rows, METRIC_MAP[key], order, (r) => r.score ?? 0);
