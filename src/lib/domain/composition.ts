import { BALANCE_POINT, GATE_BLOCKED } from './scoring';
import { ACCESS_FLOOR, ACCESS_SPAN } from './transit';
import type { ScoredHex, Weights } from '$lib/types';

/**
 * The Opportunity Score, taken back apart.
 *
 * `scoring.ts` turns four figures into one number. A single number is what a map
 * needs and the last thing a person deciding where to put their money needs: they
 * want to know WHICH of the four moved it, and by how much. This reads the same
 * arithmetic back out, step by step, on the 0–100 scale the panel prints.
 *
 * Nothing here recomputes the score from raw data. Every term is built from the
 * figures the engine already stored on the row — trade around the cell, its own
 * rivals, premises on the market, access — and from the engine's own exported
 * constants, so the column of steps always lands on the score sitting above it. A
 * breakdown that disagreed with its own total would discredit the number it exists to
 * explain.
 *
 * Transit is pulled out twice on purpose. It is a step like any other in the
 * waterfall, AND the split of the final score into "what any cell would keep" and
 * "what these stations added" is worth stating separately, in points rather than in
 * the percentage `accessUplift` gives.
 *
 * The cost of space is the last step: a multiplier of at
 * most 1, taken off the end. On a catchment where no asking price could be read it is
 * exactly 1 and the row says so, rather than being dropped — a step that disappears
 * when it finds nothing is indistinguishable from a step that found nothing to charge.
 */

export type StepKey = 'start' | 'demand' | 'supply' | 'clamp' | 'gate' | 'access' | 'cost';

export interface CompositionStep {
	key: StepKey;
	/** Score points this step moves, signed, on the 0–100 scale. */
	delta: number;
	/** The running total after it, same scale. */
	after: number;
	/** Multiplicative steps state their factor; additive ones have none. */
	factor: number | null;
}

export interface Composition {
	steps: CompositionStep[];
	/** Demand against competition alone, before the gate and transit, 0–100. */
	balance: number;
	/** The space gate's multiplier, and whether it actually cost this cell anything. */
	gate: number;
	gateBites: boolean;
	/** The transit multiplier, `ACCESS_FLOOR + ACCESS_SPAN × access`. */
	accessFactor: number;
	/** What this cell would score with no transit within walking range at all. */
	withoutTransit: number;
	/** Points its transit access adds on top of that — `withoutTransit + this = score`. */
	transitPoints: number;
	/** The most transit could add to this cell, i.e. what a perfectly served one gets. */
	transitCeiling: number;
	/** The cost-of-space multiplier, and whether it actually cost this cell anything.
	    It is 1, and bites nothing, wherever no price could be read. */
	costFactor: number;
	costBites: boolean;
	/** Score points the asking price took off, as a positive number. Zero when unpriced. */
	costPoints: number;
	/** The final score, 0–100, rounded exactly as the panel prints it. */
	score: number;
}

/** 0..1 → the 0–100 points the interface shows. */
const pts = (v: number) => Math.round(v * 100);

/**
 * Take one scored row apart. `null` for a cell with no score — nothing to explain
 * where nothing was computed, and inventing a breakdown for an unscored cell would
 * be exactly the interpolation this product refuses to do.
 */
export function composeScore(row: ScoredHex, w: Weights): Composition | null {
	if (row.score === null || row.demand === null || row.supply === null) return null;

	const sum = Math.max(0.0001, w.wd + w.ws);
	const demandTerm = (w.wd * row.demand) / sum;
	const supplyTerm = (w.ws * row.supply) / sum;
	const raw = BALANCE_POINT + demandTerm - supplyTerm;
	const balance = Math.max(0, Math.min(1, raw));
	const gate = w.gate && row.units === 0 ? GATE_BLOCKED : 1;
	const gated = balance * gate;
	const accessFactor = ACCESS_FLOOR + ACCESS_SPAN * row.access;
	const travelled = gated * accessFactor;
	// Read off the row rather than recomputed from the price. The engine has already
	// decided what the cost of space was worth here, including the cases where it was
	// worth nothing because no price could be read, and a second derivation of the same
	// number is a second thing to keep in step.
	const costFactor = row.costFactor;
	const score = travelled * costFactor;

	/**
	 * Every step is rounded against the RUNNING TOTAL, and each delta is the
	 * difference between two rounded totals — never rounded on its own.
	 *
	 * Rounded separately, "50 +21 −12" prints a column that does not add up to the 59
	 * underneath it, off by a point often enough to be noticed. Here the arithmetic on
	 * screen is exact by construction; only the last decimal moves.
	 */
	const marks: Array<{ key: StepKey; at: number; factor: number | null }> = [
		{ key: 'start', at: BALANCE_POINT, factor: null },
		{ key: 'demand', at: BALANCE_POINT + demandTerm, factor: null },
		{ key: 'supply', at: raw, factor: null }
	];
	// Only shown when it actually bit. A "kept within 0–100" row on every cell is a
	// rule nobody needed to know; on the one cell it moved, it is the explanation for
	// a step that otherwise does not add up.
	if (balance !== raw) marks.push({ key: 'clamp', at: balance, factor: null });
	marks.push({ key: 'gate', at: gated, factor: gate });
	marks.push({ key: 'access', at: travelled, factor: accessFactor });
	// Shown on every cell, including the ones it did not move. Unlike the clamp, this
	// step is not a rule nobody needed to know: a reader comparing two catchments has to
	// be able to see that one of them was marked down for its asking price and the other
	// was left alone because nothing there is priced. Dropping the row on the second
	// would make the two look identically untouched.
	marks.push({ key: 'cost', at: score, factor: costFactor });

	const steps: CompositionStep[] = [];
	let running = 0;
	for (const m of marks) {
		const after = pts(m.at);
		steps.push({
			key: m.key,
			delta: m.key === 'start' ? after : after - running,
			after,
			factor: m.factor
		});
		running = after;
	}

	// The floor is what every cell keeps whatever its transit; the rest is what these
	// particular stations bought. Derived by subtraction from the printed score rather
	// than rounded on its own, so the two halves add up to the total exactly.
	//
	// Both halves are measured AFTER the cost of space, so they still add up to the
	// score printed above them. Splitting the pre-cost total instead would leave the two
	// segments summing to a number the panel never shows.
	const withoutTransit = pts(gated * ACCESS_FLOOR * costFactor);

	return {
		steps,
		balance: pts(balance),
		gate,
		gateBites: gate !== 1,
		accessFactor,
		withoutTransit,
		transitPoints: pts(score) - withoutTransit,
		transitCeiling: pts(gated * costFactor) - withoutTransit,
		costFactor,
		costBites: costFactor !== 1,
		costPoints: pts(travelled) - pts(score),
		score: pts(score)
	};
}
