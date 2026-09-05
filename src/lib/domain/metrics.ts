import { stopTotal } from './transit';
import type { ScoredHex } from '$lib/types';

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
 * model choose the second from a list. Everything below is that list, and it is the
 * single place a new measure has to be added: the tool schema the model sees, the rule
 * parser's keywords, the sort, the filters and the sentence all read from here.
 *
 * WHAT THE MODEL CAN AND CANNOT DO
 *
 * It picks a key from this list and a direction. It never supplies a value, and there
 * is deliberately no way for it to: a filter is expressed as `rendah` or `tinggi`, and
 * the threshold for those is computed from the grid's own distribution at query time.
 * A model asked for "cheap areas" cannot answer "under 30 million", because that number
 * would be the one figure on the screen that came from nobody's data.
 *
 * NULL IS NOT ZERO HERE EITHER
 *
 * `read` returns null for a cell where the figure was never measured — an unsurveyed
 * competitor count, a catchment with no asking price. Those cells are dropped from a
 * ranking on that measure rather than sorted to the bottom of it, because the bottom of
 * a ranking is a claim and "not measured" is not one.
 */

export const METRIC_KEYS = [
	'skor',
	'permintaan',
	'penawaran',
	'pesaing',
	'keramaian',
	'kunjungan',
	'jam_puncak',
	'nontunai',
	'listing',
	'harga_tempat',
	'unit_dipasarkan',
	'akses_transit',
	'simpul_transit'
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/** How a value is written out. The words belong to the locale files; this is the shape. */
export type MetricKind = 'pct' | 'count' | 'hour' | 'rupiah';

export interface MetricDef {
	key: MetricKey;
	/** The figure, or null where this cell has never been measured for it. */
	read: (r: ScoredHex) => number | null;
	kind: MetricKind;
	/**
	 * Which end of this measure a plain "best" means.
	 *
	 * Not the same for every figure, and getting it wrong inverts the answer silently.
	 * The best score is the highest; the best asking price is the LOWEST; the best
	 * competitor count is the lowest for someone opening a shop. `desc` means "most
	 * first" and `asc` means "least first"; `best` names which of those a user means
	 * when they say "the best" without saying more.
	 */
	best: 'asc' | 'desc';
	/** Only meaningful for a MAPID-sourced figure that a city may not be covered for. */
	sourced?: 'mapid';
}

export const METRICS: MetricDef[] = [
	{ key: 'skor', read: (r) => r.score, kind: 'pct', best: 'desc' },
	{ key: 'permintaan', read: (r) => r.demand, kind: 'pct', best: 'desc' },
	{ key: 'penawaran', read: (r) => r.supply, kind: 'pct', best: 'asc' },
	{
		key: 'pesaing',
		// Null rather than the stored 0 when this cell's city has not been surveyed for
		// the active category. Sorting an unsurveyed cell to the top of "fewest
		// competitors" is exactly the failure the whole engine is built to refuse.
		read: (r) => (r.covered ? r.osm : null),
		kind: 'count',
		best: 'asc',
		sourced: 'mapid'
	},
	{ key: 'keramaian', read: (r) => (r.nodata ? null : r.busy), kind: 'pct', best: 'desc' },
	{ key: 'kunjungan', read: (r) => (r.nodata ? null : r.nStruk), kind: 'count', best: 'desc' },
	{
		key: 'jam_puncak',
		// -1 is the engine's "no hourly profile", and an hour is not a quantity to be
		// ranked by size anyway — it is reported, and sorted only so the list is stable.
		read: (r) => (r.peakHour >= 0 ? r.peakHour : null),
		kind: 'hour',
		best: 'asc'
	},
	{ key: 'nontunai', read: (r) => (r.nodata ? null : r.cashless), kind: 'pct', best: 'desc' },
	{ key: 'listing', read: (r) => (r.nodata ? null : r.listings), kind: 'count', best: 'desc' },
	{
		key: 'harga_tempat',
		read: (r) => r.price,
		kind: 'rupiah',
		// Cheapest first. Somebody asking about the price of space is looking for a place
		// they can afford, not for the most expensive address on the map.
		best: 'asc',
		sourced: 'mapid'
	},
	{
		key: 'unit_dipasarkan',
		read: (r) => (r.propCovered ? r.units : null),
		kind: 'count',
		best: 'desc',
		sourced: 'mapid'
	},
	{ key: 'akses_transit', read: (r) => r.access, kind: 'pct', best: 'desc' },
	{ key: 'simpul_transit', read: (r) => stopTotal(r.transit), kind: 'count', best: 'desc' }
];

export const METRIC_MAP = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<
	MetricKey,
	MetricDef
>;

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

/**
 * A filter the model is allowed to ask for.
 *
 * `rendah` and `tinggi` are the bottom and top third of the grid ON THAT MEASURE,
 * computed from the data every time the query runs. `ada` is "there is any at all",
 * which is the only one of the three that is a fact about a cell rather than about its
 * position among the others.
 */
export interface MetricFilter {
	ukuran: MetricKey;
	arah: 'rendah' | 'tinggi' | 'ada';
}

/** Where the bottom and top thirds of a measure actually fall, from the grid itself. */
function tercile(rows: ScoredHex[], def: MetricDef): { low: number; high: number } | null {
	const vals = rows
		.map((r) => def.read(r))
		.filter((v): v is number => v !== null)
		.sort((a, b) => a - b);
	// Below this a "third" is one or two cells, and a band that narrow says more about
	// the sample than about the city.
	if (vals.length < 6) return null;
	return {
		low: vals[Math.floor(vals.length / 3)],
		high: vals[Math.floor((vals.length * 2) / 3)]
	};
}

/**
 * Applies the filters to a set of rows.
 *
 * A cell that has never been measured for a filtered figure is dropped, not kept: the
 * user asked for cheap areas, and an area whose price nobody knows is not one that is
 * known to be cheap.
 */
export function applyFilters(rows: ScoredHex[], filters: MetricFilter[]): ScoredHex[] {
	let out = rows;
	for (const f of filters) {
		const def = METRIC_MAP[f.ukuran];
		if (!def) continue;
		if (f.arah === 'ada') {
			out = out.filter((r) => {
				const v = def.read(r);
				return v !== null && v > 0;
			});
			continue;
		}
		const band = tercile(out, def);
		if (!band) continue;
		out = out.filter((r) => {
			const v = def.read(r);
			if (v === null) return false;
			return f.arah === 'rendah' ? v <= band.low : v >= band.high;
		});
	}
	return out;
}

/**
 * Ranks rows by one measure.
 *
 * Cells with nothing measured are removed rather than sorted last. A list titled "the
 * quietest catchments" whose tail is really "the catchments nobody has been to" is
 * worse than a shorter list, because nothing on screen distinguishes the two.
 *
 * The tie-break is the opportunity score, so two catchments equal on the measure asked
 * about come back in an order that still means something rather than in file order.
 */
export function rankBy(
	rows: ScoredHex[],
	key: MetricKey,
	order: 'asc' | 'desc'
): Array<{ row: ScoredHex; value: number }> {
	const def = METRIC_MAP[key];
	if (!def) return [];
	const sign = order === 'asc' ? 1 : -1;
	return rows
		.map((row) => ({ row, value: def.read(row) }))
		.filter((x): x is { row: ScoredHex; value: number } => x.value !== null)
		.sort((a, b) => sign * (a.value - b.value) || (b.row.score ?? 0) - (a.row.score ?? 0));
}
