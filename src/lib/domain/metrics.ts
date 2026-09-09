import { MIN_BAND, applyBands, ladderOf, levelOn, rankRows, type Band, type Measure } from './rank';
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
export type MetricKind = 'pct' | 'count' | 'rupiah';

export interface MetricDef extends Measure<ScoredHex> {
	kind: MetricKind;
	/** Only meaningful for a MAPID-sourced figure that a city may not be covered for. */
	sourced?: 'mapid';
	/**
	 * Cannot be read without a business type behind it.
	 *
	 * Five of these nine measures can: how busy a cell is, what space costs, how much of
	 * it is on the market, and both transit readings are all facts about the PLACE. The
	 * other four are facts about a place AND a trade — rivals of what, saturated with
	 * what, a good opportunity for what — and asked with no trade named they have no
	 * answer at all rather than a weak one.
	 *
	 * Marked here rather than checked in the query layer so the two cannot drift: a
	 * measure added to the table declares this about itself, in the same place it
	 * declares which end is best.
	 */
	needsType?: true;
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
	skor: { read: (r) => r.score, kind: 'pct', best: 'desc', needsType: true },
	// Not marked: with no business type named there is nothing to subtract, so this is
	// the trade around the cell outright — which is a real reading and the one the
	// opening map is painted from.
	permintaan: { read: (r) => r.demand, kind: 'pct', best: 'desc' },
	penawaran: { read: (r) => r.supply, kind: 'pct', best: 'asc', needsType: true },
	pesaing: {
		// Null rather than the stored 0 when this cell's city has not been surveyed for
		// the active category. Sorting an unsurveyed cell to the top of "fewest
		// competitors" is exactly the failure the whole engine is built to refuse.
		read: (r) => (r.covered ? r.osm : null),
		kind: 'count',
		best: 'asc',
		sourced: 'mapid',
		needsType: true
	},
	// The same trade the demand side is scaled from, left as the count it is. Kept as
	// its own measure because "where is it busiest around here" is a question people
	// actually ask, and this is the one figure on the row that can answer it without
	// anybody inventing a footfall.
	keramaian: {
		read: (r) => (r.covered ? r.density : null),
		kind: 'count',
		best: 'desc',
		sourced: 'mapid'
	},
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
	simpul_transit: { read: (r) => stopTotal(r.transit), kind: 'count', best: 'desc' },
	/*
	 * The two field surveys that can be ranked, and the two that cannot.
	 *
	 * These read a COUNT of what somebody wrote down, and a count of one is exactly
	 * true. The other two figures the surveys produce — what a meal costs here, what
	 * share of the receipts were cashless — are an average and a share, and off one or
	 * two readings they describe an afternoon rather than a street. They are shown on
	 * the card, where the readings they came from are visible beside them, and they are
	 * deliberately not offered here as something to sort a city by.
	 *
	 * Both return null where NOTHING was recorded, never 0, which puts them under the
	 * rule the rest of this table lives by: an unmeasured cell is dropped from the
	 * ranking rather than sorted to the bottom of it. It matters more here than
	 * anywhere else in the table. 191 of the 562 cells carry any record at all, so a
	 * zero would rank 371 streets nobody has visited as streets where nothing happens,
	 * and they would fill the whole of "where is it quietest".
	 */
	struk_dicatat: {
		read: (r) => r.field?.struk ?? null,
		kind: 'count',
		best: 'desc'
	},
	sewa_ditawarkan: {
		read: (r) => r.field?.sewa ?? null,
		kind: 'count',
		best: 'desc'
	}
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

/** Can this question be answered at all with no business type named? */
export const needsBusinessType = (key: MetricKey): boolean =>
	Boolean(METRIC_MAP[key]?.needsType);

/**
 * Every reading of one measure across the grid, sorted, with the unmeasured left out.
 * The scale one cell's figure is read against.
 */
export const ladderFor = (rows: readonly ScoredHex[], key: MetricKey): number[] =>
	ladderOf(rows, METRIC_MAP[key]);

/**
 * Where one cell's figure sits among every cell that has one, 0 lowest to 1 highest.
 *
 * This is what makes an index readable. "Busyness 65" is a number on a scale, and the
 * scale is not the comparator a reader needs: whether 65 is a lot depends on what the
 * rest of the grid reads. A count is its own comparator, 207 businesses can be pictured,
 * so the card sets the four indices against the grid and leaves the counts alone.
 *
 * Null below `MIN_BAND` readings, for the reason the bands stop there: a standing among
 * five cells is a fact about the sample. And null where this cell has no reading at all,
 * which is never the bottom of the ladder, because "nobody counted" is not "the least".
 */
export function standingOf(
	row: ScoredHex,
	key: MetricKey,
	ladder: readonly number[]
): number | null {
	if (ladder.length < MIN_BAND) return null;
	return levelOn(METRIC_MAP[key].read(row), ladder);
}

/**
 * Which direction a ranking actually runs, given what the question asked for.
 *
 * One place, so the rule parser and the model reader cannot disagree about it.
 *
 * One rule: no direction asked for → the measure's own idea of "best". A second used to
 * stand here for hours of the day, which were reported and never ranked. The hourly
 * profile it read was generated, so both it and the rule are gone.
 */
export function resolveOrder(key: MetricKey, asked?: 'asc' | 'desc'): 'asc' | 'desc' {
	const def = METRIC_MAP[key] ?? METRIC_MAP[DEFAULT_METRIC];
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
