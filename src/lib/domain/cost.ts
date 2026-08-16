import type { Hex } from '$lib/types';

/**
 * What a shopfront costs here, and what that is worth to a score.
 *
 * THIS IS A SALE PRICE. IT IS NOT A RENT.
 *
 * The question this started from was rent, and the answer from the data is that MAPID
 * does not publish it: every property dataset in the premium catalogue for DKI Jakarta
 * is a sale listing, tallied and re-tallied on every fetch by
 * `scripts/fetch-property.mjs`, which writes the count into the file it produces. What
 * the catalogue does publish is an asking price per m², on 40 datasets covering all
 * five cities.
 *
 * A monthly rent could be produced from a sale price with a yield assumption. It is
 * not, anywhere, and the naming is deliberate: `price`, `pricePerM2`, `costFactor` —
 * never `rent`. That assumption would be the only figure on the screen that came from
 * nobody's data, and it would sit inside a product whose entire claim is that its
 * figures do not.
 *
 * WHY IT ONLY EVER DEDUCTS
 *
 * `costFactor` runs from 1 down to `COST_FLOOR` and never above 1. A cell with no
 * listing in range gets exactly 1 — no deduction — and the panel says which of the two
 * reasons it is. The alternative, treating an unmeasured cell as median-priced, is
 * interpolation: it would put a price on a place nobody has surveyed and let that
 * invented price move a ranking. Refusing to interpolate is the same rule that keeps
 * an unsurveyed cell's competitor count at null instead of zero.
 *
 * The consequence is that "cheapest on the grid" and "no price known" score alike. They
 * are told apart in words, in the panel and in the breakdown, rather than by inventing
 * a difference in the arithmetic.
 */

/**
 * The most the cost of space can take off a score, and therefore the multiplier the
 * dearest catchment on the grid receives.
 *
 * 0.75 puts it below the transit multiplier's span (0.6 to 1.0) on purpose. Where the
 * customers are is a harder fact than what a landlord is asking: the asking price is
 * one negotiation away from being wrong, it is a price to BUY rather than to occupy,
 * and it is read from whatever handful of units happen to be listed this quarter. It
 * should tilt a ranking, not decide it.
 */
export const COST_FLOOR = 0.75;
export const COST_SPAN = 1 - COST_FLOOR;

/**
 * How many catchments have to carry a price before the deduction applies at all.
 *
 * The price level is a rank among the catchments that have one, so with three
 * observations the dearest of the three is "dearer than everywhere" and loses a
 * quarter of its score on the strength of two comparisons. Below this count no cell is
 * ranked against any other and every factor is 1, which the panel states.
 */
export const MIN_LADDER = 8;

/** The median asking price per m² of premises in range, at the active radius. `null`
    means no unit was listed within reach, or too few were priced for the join to read
    a median off them. It never means space here is free. */
export function priceOf(c: Pick<Hex, 'prop'>, radius: number): number | null {
	return atRadius(c, radius)?.p ?? null;
}

/**
 * One cell's property reading at one radius.
 *
 * The join writes a stop for every radius the interface offers, so this is a lookup
 * rather than arithmetic. An unknown radius returns nothing rather than the nearest
 * stop: a price labelled 650 m that was measured at 800 m is a figure with the wrong
 * number attached, which is worse than no figure.
 */
export function atRadius(c: Pick<Hex, 'prop'>, radius: number) {
	return c.prop?.r?.[String(radius)] ?? null;
}

/** Premises on the market within reach, at the active radius. */
export function unitsOf(c: Pick<Hex, 'prop'>, radius: number): number {
	return atRadius(c, radius)?.u ?? 0;
}

/** How many priced units the median was read from. Zero is what tells "nothing listed"
    apart from "listed, but none of them published a price". */
export function pricedOf(c: Pick<Hex, 'prop'>, radius: number): number {
	return atRadius(c, radius)?.q ?? 0;
}

/**
 * Every price on the grid, sorted — the scale a single cell's price is read against.
 *
 * Built per scoring run from the cells that actually carry one, exactly as `maxPoi`
 * builds the supply scale from the cells that are covered. Cells with no listing are
 * left out rather than entered as zero, which would put the whole grid's median on the
 * floor and make every real price look extortionate.
 */
export function priceLadder(all: Array<Pick<Hex, 'prop'>>, radius: number): number[] {
	const out: number[] = [];
	for (const c of all) {
		const p = priceOf(c, radius);
		if (p !== null) out.push(p);
	}
	return out.sort((a, b) => a - b);
}

/**
 * Where one price sits on that scale, 0 at the cheapest catchment and 1 at the dearest.
 *
 * A rank rather than a ratio to the median. Asking prices per m² in Jakarta run across
 * two orders of magnitude and a handful of very large land parcels sit at the bottom of
 * the per-m² scale, so a ratio would be dragged around by whichever outliers happened
 * to be listed. A rank cannot be.
 *
 * Ties take the midpoint of the run they belong to, so twenty catchments quoting the
 * same round number all receive the same level instead of being spread across it by the
 * order they happened to be sorted in.
 */
export function priceLevel(price: number | null, ladder: number[]): number | null {
	if (price === null || ladder.length < MIN_LADDER) return null;
	let below = 0;
	while (below < ladder.length && ladder[below] < price) below++;
	let atOrBelow = below;
	while (atOrBelow < ladder.length && ladder[atOrBelow] === price) atOrBelow++;
	// The midpoint of the tied run, divided by the last index rather than the length:
	// the cheapest observation must land on 0 and the dearest on 1, and dividing by the
	// length leaves the dearest short of it.
	const mid = (below + atOrBelow - 1) / 2;
	return mid / (ladder.length - 1);
}

/** The multiplier one price level earns. `null` — nothing listed in range, or too few
    prices on the grid to rank against — is 1, never a guess at the middle. */
export function costFactor(level: number | null): number {
	if (level === null) return 1;
	return COST_FLOOR + COST_SPAN * (1 - Math.max(0, Math.min(1, level)));
}

/** The grid's median asking price per m², for stating one catchment against the rest.
    Null until `MIN_LADDER` catchments carry a price. */
export function medianPrice(ladder: number[]): number | null {
	if (ladder.length < MIN_LADDER) return null;
	const mid = Math.floor(ladder.length / 2);
	return ladder.length % 2 ? ladder[mid] : (ladder[mid - 1] + ladder[mid]) / 2;
}

/** Everything the panel needs to state a catchment's cost of space, in one place so
    the sentence and the multiplier can never be built from different numbers. */
export interface CostReading {
	/** Median asking price per m² of premises in range. Null = nothing listed. */
	price: number | null;
	/** Its rank on the grid, 0..1. Null when there is no price, or too few to rank. */
	level: number | null;
	/** The multiplier the score was actually given. */
	factor: number;
	/** The grid's median, for "×1.4 of the median" style comparisons. */
	median: number | null;
	/** Premises on the market within reach. */
	units: number;
	/** How many of those published a price, i.e. how thick the median's evidence is. */
	priced: number;
	/** Has this cell's city been read from the property catalogue at all? */
	covered: boolean;
	/**
	 * Why there is no price level, when there is none. Null when there is one.
	 *
	 * Five states rather than one "no data", because they are five different things to
	 * tell a reader and only the first of them means nobody has looked. Collapsing them
	 * would make a catchment nobody has surveyed read exactly like one that was surveyed
	 * and found empty, which is the single confusion this whole product exists to refuse.
	 *
	 * - `uncovered` the catalogue has not been read for this city
	 * - `empty`     read, and nothing is on the market within reach
	 * - `unpriced`  units are on the market, not one of them published a price
	 * - `thin`      some published a price, too few for the join to take a median from
	 * - `ungraded`  this cell has a price, the grid has too few to rank it against
	 */
	absence: 'uncovered' | 'empty' | 'unpriced' | 'thin' | 'ungraded' | null;
}

export function readCost(
	c: Pick<Hex, 'prop' | 'propCovered'>,
	ladder: number[],
	radius: number
): CostReading {
	const price = priceOf(c, radius);
	const level = priceLevel(price, ladder);
	const units = unitsOf(c, radius);
	const priced = pricedOf(c, radius);
	const covered = c.propCovered ?? false;

	// The silences, told apart rather than collapsed into one "no data". Which one it is
	// decides what the panel can honestly say, and only the first means nobody looked.
	//
	// The order matters: each test is only reached once the one above it has been ruled
	// out, so `unpriced` really does mean "listed and not one price among them" rather
	// than "no price, for some reason".
	let absence: CostReading['absence'] = null;
	if (level === null) {
		if (!covered) absence = 'uncovered';
		else if (units === 0) absence = 'empty';
		else if (priced === 0) absence = 'unpriced';
		else if (price === null) absence = 'thin';
		else absence = 'ungraded';
	}

	return {
		price,
		level,
		factor: costFactor(level),
		median: medianPrice(ladder),
		units,
		priced,
		covered,
		absence
	};
}

