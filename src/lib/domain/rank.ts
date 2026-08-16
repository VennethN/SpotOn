/**
 * Ranking and band-filtering, over any set of rows and any measure of them.
 *
 * WHY THIS IS ONE MODULE AND NOT TWO
 *
 * The product ranks two different things — catchments (`domain/metrics`) and the units
 * standing in them (`domain/units`) — and the arithmetic for both is identical. It was
 * written twice, and the copies had already started to differ in their comments while
 * agreeing in their code, which is the stage right before they differ in their code too.
 *
 * What varies between the two is the ROW TYPE and the list of measures. What does not
 * vary is any of the rules below, and every one of them is a rule this product cares
 * about rather than an implementation detail:
 *
 * - A band is a THIRD OF THE CURRENT SET, computed when the query runs. There is
 *   deliberately no way to express a threshold, because a number the understanding
 *   layer supplied would be the only figure in an answer that came from nobody's data.
 * - A row with nothing measured is DROPPED, never sorted to the end. A list of "the
 *   cheapest units" whose tail is really "the units nobody priced" is worse than a
 *   shorter list, because nothing on screen separates the two.
 * - Filters COMPOSE: each one narrows what the last one left, so the second band is a
 *   third of the survivors rather than a third of the world. Applied independently and
 *   intersected they would give a different, and wrong, answer.
 *
 * Both registries describe their measures through `Measure` below, so a measure added
 * to either one gets all of this for free and cannot get a subtly different version.
 */

/**
 * One readable figure of a row.
 *
 * `read` returns null where this row has never been measured for it — which is not the
 * same as zero, and is the distinction the whole engine is built around.
 *
 * `best` is which end a plain "best" means, and it is not the same for every figure.
 * The best opportunity score is the highest; the best asking price is the LOWEST; the
 * best competitor count is the lowest for somebody opening a shop. Getting it wrong
 * inverts an answer without erroring.
 */
export interface Measure<Row> {
	read: (row: Row) => number | null;
	best: 'asc' | 'desc';
}

/**
 * A filter naming a measure and a band rather than a threshold.
 *
 * `rendah` and `tinggi` are the bottom and top third of the current set. `ada` is
 * "there is any at all", the only one of the three that is a fact about a row rather
 * than about its position among the others.
 */
export interface Band<Key extends string> {
	ukuran: Key;
	arah: 'rendah' | 'tinggi' | 'ada';
}

/**
 * How few readings make a "third" meaningless.
 *
 * Below six, a third is one or two rows, and a band that narrow says more about the
 * sample than about the city. The filter is then skipped rather than applied to
 * nonsense — a filter that silently keeps everything is easier to notice than one that
 * silently keeps two things.
 */
export const MIN_BAND = 6;

/** Where the bottom and top thirds of a measure fall, from the rows themselves. */
export function tercile<Row>(
	rows: readonly Row[],
	m: Measure<Row>
): { low: number; high: number } | null {
	const vals = rows
		.map((r) => m.read(r))
		.filter((v): v is number => v !== null)
		.sort((a, b) => a - b);
	if (vals.length < MIN_BAND) return null;
	return {
		low: vals[Math.floor(vals.length / 3)],
		high: vals[Math.floor((vals.length * 2) / 3)]
	};
}

/**
 * Applies band filters in order, each to what the last one left.
 *
 * A row that has never been measured for a filtered figure is dropped, not kept: the
 * reader asked for cheap places, and a place whose price nobody knows is not one that is
 * known to be cheap.
 */
export function applyBands<Row, Key extends string>(
	rows: readonly Row[],
	filters: readonly Band<Key>[],
	measureOf: (key: Key) => Measure<Row> | undefined
): Row[] {
	let out = [...rows];
	for (const f of filters) {
		const m = measureOf(f.ukuran);
		if (!m) continue;
		if (f.arah === 'ada') {
			out = out.filter((r) => {
				const v = m.read(r);
				return v !== null && v > 0;
			});
			continue;
		}
		const band = tercile(out, m);
		if (!band) continue;
		out = out.filter((r) => {
			const v = m.read(r);
			if (v === null) return false;
			return f.arah === 'rendah' ? v <= band.low : v >= band.high;
		});
	}
	return out;
}

/**
 * Ranks rows by one measure, dropping the ones it cannot read.
 *
 * `tieBreak` is what settles two rows holding the same value, and both callers pass the
 * opportunity score: two catchments equally busy, or two units asking the same money,
 * come back in an order that still means something rather than in file order.
 */
export function rankRows<Row>(
	rows: readonly Row[],
	m: Measure<Row> | undefined,
	order: 'asc' | 'desc',
	tieBreak: (row: Row) => number
): Array<{ row: Row; value: number }> {
	if (!m) return [];
	const sign = order === 'asc' ? 1 : -1;
	return rows
		.map((row) => ({ row, value: m.read(row) }))
		.filter((x): x is { row: Row; value: number } => x.value !== null)
		.sort((a, b) => sign * (a.value - b.value) || tieBreak(b.row) - tieBreak(a.row));
}
