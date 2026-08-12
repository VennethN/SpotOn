import type { Weights } from '$lib/types';

/**
 * Weights & gates: the default values, and the single place they are sanitised.
 *
 * There used to be two independent guards — one reading the query string, one
 * reading the JSON body — each with its own `clamp01`. Two copies of the same rule
 * means sooner or later the two diverge, and one endpoint starts accepting weights
 * the other rejects.
 */
export const DEFAULT_WEIGHTS: Weights = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'osm' };

const clamp01 = (v: unknown, fallback: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

/**
 * Weights from any origin → weights the scoring engine can safely use.
 *
 * The radius deliberately accepts only 400 or 800: the engine can only rescale its
 * precomputed counts to those two values. Any other number would produce figures
 * that look plausible while resting on nothing.
 */
export function normalizeWeights(partial: Partial<Weights> | undefined): Weights {
	const p = partial ?? {};
	return {
		wd: clamp01(p.wd, DEFAULT_WEIGHTS.wd),
		ws: clamp01(p.ws, DEFAULT_WEIGHTS.ws),
		gate: typeof p.gate === 'boolean' ? p.gate : DEFAULT_WEIGHTS.gate,
		radius: p.radius === 400 ? 400 : 800,
		source: p.source === 'mapid' ? 'mapid' : 'osm'
	};
}
