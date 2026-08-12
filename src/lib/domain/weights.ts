import type { CategoryKey, Weights } from '$lib/types';

/**
 * The business type the map opens on.
 *
 * A named constant because the page load has to fetch this category's columns
 * before the first paint — the heatmap is on from the start, so the load and the
 * interface state have to agree on which category that is. Hard-coded in two places,
 * they would sooner or later disagree, and the map would open having downloaded one
 * category and be showing another.
 */
export const DEFAULT_CATEGORY: CategoryKey = 'kopi';

/**
 * Weights & gates: the default values, and the single place they are sanitised.
 *
 * There used to be two independent guards — one reading the query string, one
 * reading the JSON body — each with its own `clamp01`. Two copies of the same rule
 * means sooner or later the two diverge, and one endpoint starts accepting weights
 * the other rejects.
 */
/**
 * The default `source` is MAPID, not OSM.
 *
 * It used to be OSM, and the reasoning held at the time: MAPID covered only one
 * city for one category, so making it the default meant greeting the user with a
 * mostly empty map. That reason has run out. MAPID now covers all thirteen
 * categories across all five administrative cities, and is denser than OSM in every
 * one of them — 16× on laundry, 13× on drinks stalls.
 *
 * What settles it points the other way entirely. Four food categories (warteg, mie,
 * seafood, foreign restaurants) have no OSM source at all, because `cuisine` tagging
 * in Jakarta is far too sparse and knows neither warteg nor Padang restaurants. With
 * an OSM default, a user who picks Warteg — the business type people in Jakarta are
 * most likely to ask about — would see the entire map marked "not covered" before
 * touching anything.
 *
 * OSM is still on the switch, and is still never mixed into a single score.
 */
export const DEFAULT_WEIGHTS: Weights = {
	wd: 0.5,
	ws: 0.5,
	gate: true,
	radius: 800,
	source: 'mapid'
};

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
		// An unrecognised value falls back to the default, not to a hand-written
		// 'osm'. This once read `? 'mapid' : 'osm'`, which meant the real source
		// default lived in two places — and moving it in DEFAULT_WEIGHTS would have
		// had no effect here at all.
		source: p.source === 'mapid' || p.source === 'osm' ? p.source : DEFAULT_WEIGHTS.source
	};
}
