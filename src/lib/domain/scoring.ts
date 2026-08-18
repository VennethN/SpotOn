import { CATEGORY_KEYS, CATEGORY_MAP } from './categories';
import { costFactor, priceLadder, priceLevel, priceOf, unitsOf } from './cost';
import { ACCESS_FLOOR, ACCESS_SPAN } from './transit';
import type { Hex, HexBase, CategoryKey, PoiSource, ScoredHex, Typology, Weights } from '$lib/types';

/**
 * A cell's display name.
 *
 * Every cell currently has a named transit node within range, but that is a property
 * of today's OSM data — not a guarantee. A cell marker is used if one day there is
 * none, so the interface never has to handle a null.
 *
 * Exported because the map labels cells before any category has been scored, and a
 * cell must not be called one thing on the map and another in the panel.
 */
export const cellName = (c: Pick<HexBase, 'id' | 'name'>): string =>
	c.name ?? `Petak ${c.id.slice(-6)}`;

/**
 * The Opportunity Score engine — arithmetic only.
 *
 * Number formatters (`pct`, hours, ramp colours) and sentence builders used to
 * live here too, which made the module that is the source of truth for the numbers
 * also the place people went to change the presentation. The two are now separate:
 * this file computes, `utils/format` displays, `domain/narrate` narrates.
 */

/**
 * A 400 m radius covers ≈ a quarter of the area of an 800 m one. POI and listing
 * counts are scaled in proportion to area, not to the radius.
 */
const areaFactor = (radius: number) => Math.pow(radius / 800, 2);

/**
 * One business type, or several asked about together.
 *
 * A question naming one type and a question naming three differ only in the LENGTH of
 * this list, so there is one code path through the whole engine and the single
 * category is not a special case of anything. What "several" means arithmetically is
 * stated once, in `poiCount` and `otherTrade` below: the types compete for the same
 * customer, so their outlets are counted together as rivals and taken out of the trade
 * around the cell together.
 *
 * A bare key is still accepted because most callers have exactly one and writing
 * `['kopi']` at every one of them would be noise around a decision they are not making.
 */
export type Cats = CategoryKey | readonly CategoryKey[];

const catList = (c: Cats): readonly CategoryKey[] => (typeof c === 'string' ? [c] : c);

/**
 * Where a cell sits before a single figure has been read: dead level, demand and
 * competition cancelling out. The gap is a deviation FROM this, in both directions.
 */
export const BALANCE_POINT = 0.5;

/**
 * What is left of a score when the space gate is on and nothing is up for rent.
 *
 * Not zero: the demand is real and the shop next door may come free next month, so
 * the cell is pushed to the bottom of the ranking rather than struck off it.
 *
 * Exported because `domain/composition` prints this step back to the reader, and a
 * breakdown quoting a multiplier the engine no longer applies would be worse than
 * showing no breakdown at all.
 */
export const GATE_BLOCKED = 0.15;

/**
 * Competitor count according to the active source. `null` means NOT YET COVERED —
 * this city has not been surveyed by that source.
 *
 * Telling null apart from 0 is the heart of this engine's honesty. Zero
 * competitors makes supply collapse and the score soar; if missing data were read
 * as zero, the areas that have been examined least would be crowned the best
 * opportunities — the exact opposite of what the user is looking for.
 */
function oneCount(c: Hex, cat: CategoryKey, source: PoiSource, radius: number): number | null {
	if (source === 'mapid') {
		if (!c.covered?.[cat]) return null;
		return Math.round((c.mapid?.[cat] ?? 0) * areaFactor(radius));
	}
	// The OSM side can be uncovered too, and it used to have no way of saying so.
	//
	// The old `?? 0` silently invented a zero for categories that had never been
	// fetched from OSM at all — and that is not a theoretical possibility: adding a
	// new category means a `hexes.json` that has not been rebuilt does not carry its
	// key. The consequence is that every cell looks competitor-free, and the category
	// with the least data wins across the whole map.
	//
	// What separates "zero" from "never fetched" is WHETHER THE KEY EXISTS, not its
	// value: `build-hexes.mjs` writes an explicit 0 for every category it genuinely
	// fetched and found empty.
	//
	// The `osmTag` check in front of it is not a duplicate. One reads the shape of
	// the data, the other states an intent: a category with no OSM tag can never be
	// counted from OSM, and that is a decision taken in `categories.ts` — not
	// something to be inferred from a key happening to be absent from a file.
	if (!CATEGORY_MAP[cat]?.osmTag) return null;
	const n = c.osm?.[cat];
	return typeof n === 'number' ? Math.round(n * areaFactor(radius)) : null;
}

/**
 * Rivals for the whole set of business types asked about, added together.
 *
 * Added rather than averaged, because that is what a rival IS. Somebody weighing a
 * cafe that also sells bread is competing with every cafe on the street AND every
 * bakery on it; the two counts are of different shops, so the total is the number of
 * doors already selling to the customer they want.
 *
 * ONE UNCOUNTED TYPE MAKES THE WHOLE SET UNCOUNTED. If MAPID has not read this city
 * for bakeries, then "cafes and bakeries here" has no answer — and a sum that quietly
 * skipped the missing half would report the cafes alone as though they were the lot,
 * which is the same lie as reading a null as a zero, told at set level.
 *
 * An empty set is null for the same reason and not 0: no business type asked about
 * means no rivals to count, and a zero there would make every cell on the map look
 * competitor-free, which is the best score this product can award.
 */
function poiCount(c: Hex, cats: readonly CategoryKey[], source: PoiSource, radius: number): number | null {
	if (!cats.length) return null;
	let total = 0;
	for (const cat of cats) {
		const n = oneCount(c, cat, source, radius);
		if (n === null) return null;
		total += n;
	}
	return total;
}

/** Normalisation scale for supply: the densest catchment in this category. Cells
    that are not yet covered must not get a say in setting the scale. */
function maxPoi(all: Hex[], cats: readonly CategoryKey[], source: PoiSource, radius: number): number {
	const counts = all
		.map((c) => poiCount(c, cats, source, radius))
		.filter((n): n is number => n !== null);
	return Math.max(1, ...counts);
}

/**
 * The trade around a cell that is NOT the category being asked about, at this radius.
 *
 * The subtraction is the point. Density is every counted business in range, so for a
 * category as common as minimarkets it is largely a count of minimarkets — and left
 * whole it would tell a would-be minimarket owner that the fuller a street is of
 * minimarkets the more demand there is for another. Taking the category out leaves
 * the footfall its rivals are living off, which is what the demand side is meant to
 * be reading.
 *
 * Null means the source has not surveyed here, and the same rule as `poiCount`
 * applies: a zero would call an unread city empty of trade.
 */
function otherTrade(c: Hex, cats: readonly CategoryKey[], source: PoiSource, radius: number): number | null {
	const total = source === 'mapid' ? c.dens?.mapid : c.dens?.osm;
	if (total === null || total === undefined) return null;
	// Every type asked about comes out, not just the first. Ask about cafes and bakeries
	// on a street of cafes and bakeries and leaving either one in would count that
	// street's own rivals as the footfall they are supposed to be living off.
	const own = poiCount(c, cats, source, radius) ?? 0;
	return Math.max(0, Math.round(total * areaFactor(radius)) - own);
}

/** Normalisation scale for demand, set the same way `maxPoi` sets supply's. */
function maxTrade(all: Hex[], cats: readonly CategoryKey[], source: PoiSource, radius: number): number {
	const counts = all
		.map((c) => otherTrade(c, cats, source, radius))
		.filter((n): n is number => n !== null);
	return Math.max(1, ...counts);
}

/**
 * The shape of a cell, read off the two figures the score is made of plus what is on
 * the market.
 *
 * `units` is premises genuinely listed in the MAPID catalogue, not a per-category
 * count of rentals: there are no rentals to count. So "busy, no space" now means the
 * catalogue holds nothing a small business could take here, which is a claim the data
 * can actually carry.
 */
function typologyOf(demand: number, supply: number, units: number): Typology {
	if (supply > 0.6) return 'saturated';
	if (demand > 0.55 && supply < 0.32) return 'underserved';
	if (demand > 0.55 && units === 0) return 'busy-limited-space';
	return 'competitive';
}

/**
 * The Opportunity Score of one catchment for one business type, or for several
 * asked about at once.
 *
 *   Gap   = (wd·demand − ws·supply) / (wd + ws)
 *   Score = clamp(Gap + 0.5) × space_gate × transit_access × cost_of_space
 *
 * EVERY TERM IS COUNTED, NONE IS GENERATED. Demand is the trade around the cell other
 * than this category, supply is this category's own rivals, access is transit nodes,
 * the gate is premises actually on the market, and the cost is the median asking price
 * per m². Supply used to be weighted by how busy the rivals were, and the space gate
 * used to read a per-category rental count: both of those columns were invented and
 * both are gone, so what is left is thinner and true.
 *
 * WHAT THE SPACE COSTS IS THE ONE THAT IS ONLY EXPENSIVE
 *
 * The cost of space enters last and as a multiplier of at most 1, so it can shade a
 * ranking without deciding it, and so an unpriced catchment is never given a made-up
 * price to be judged on. `domain/cost` holds the reasoning and the constants, and the
 * panel reads them from there so the explanation cannot drift from the arithmetic.
 *
 * These are ASKING PRICES FOR SALE. MAPID publishes no rent for Jakarta, which
 * `scripts/fetch-property.mjs` re-establishes on every run.
 */
export function scoreOne(
	c: Hex,
	cat: Cats,
	w: Weights,
	scale: number,
	ladder: number[] = [],
	tradeScale = 1
): ScoredHex {
	const cats = catList(cat);
	const base = {
		id: c.id,
		name: cellName(c),
		lat: c.lat,
		lon: c.lon,
		boundary: c.boundary,
		transit: c.transit,
		access: c.access
	};

	const count = poiCount(c, cats, w.source, w.radius);
	const trade = otherTrade(c, cats, w.source, w.radius);

	// What is on the market here, and what that costs. Read for every branch below,
	// including the one with no score: the property catalogue is a separate survey with
	// its own coverage, so a cell whose competitors nobody has counted can still have a
	// price somebody published. A panel that can say nothing about the opportunity can
	// still say what space is going for.
	const price = priceOf(c, w.radius);
	const level = priceLevel(price, ladder);
	const cost = costFactor(level);
	const units = unitsOf(c, w.radius);
	const propCovered = c.propCovered ?? false;
	const space = { price, priceLevel: level, costFactor: cost, units, propCovered };

	// Not yet covered: this cell is real and inhabited, the active source simply has
	// not surveyed its city. Refusing to give it a score is the correct answer — any
	// number here would invent competition nobody has ever looked at.
	if (count === null || trade === null) {
		return {
			...base,
			...space,
			osm: 0,
			source: w.source,
			covered: false,
			score: null,
			demand: null,
			supply: null,
			density: trade ?? 0,
			typology: 'not-covered'
		};
	}

	const demand = Math.min(1, trade / tradeScale);
	const supply = Math.min(1, count / scale);
	// The gate is premises on the market, from the property catalogue. It used to be a
	// per-category count of rentals, which was invented twice over: the figure was
	// generated, and the catalogue holds no rentals for Jakarta to generate it from.
	const gate = w.gate ? (units > 0 ? 1 : GATE_BLOCKED) : 1;
	// Transit access enters as a multiplier of its own rather than being folded into
	// demand, so that a cell served by both the MRT and TransJakarta really is worth
	// more and its contribution can be traced on its own.
	//
	// The floor and the span come from `domain/transit`, which is also where the
	// panel reads them to say what that access was worth. Written out here as well
	// they were two constants kept in step by hand — and the panel's job is to
	// explain THIS multiplication, not one that resembles it.
	const accessFactor = ACCESS_FLOOR + ACCESS_SPAN * c.access;
	const gap = (w.wd * demand - w.ws * supply) / Math.max(0.0001, w.wd + w.ws);
	const score = Math.max(0, Math.min(1, gap + BALANCE_POINT)) * gate * accessFactor * cost;

	return {
		...base,
		...space,
		osm: count,
		source: w.source,
		covered: true,
		score,
		demand,
		supply,
		density: trade,
		typology: typologyOf(demand, supply, units)
	};
}

/**
 * Score every catchment for the business type — or types — being asked about.
 *
 * Both scales are built over the SET, not per type and then combined. The densest
 * street for "cafes and bakeries" is the street with the most of the two together, and
 * that is the only cell that should read 100% supply; scaling each type against its own
 * busiest street and adding the results would let a set of three exceed 1 on a street
 * that is nowhere near the busiest for any of them.
 */
export function scoreAll(all: Hex[], cat: Cats, w: Weights): ScoredHex[] {
	const cats = catList(cat);
	const scale = maxPoi(all, cats, w.source, w.radius);
	const tradeScale = maxTrade(all, cats, w.source, w.radius);
	// The price scale, built once for the whole run exactly as the other two are.
	const ladder = priceLadder(all, w.radius);
	return all.map((c) => scoreOne(c, cats, w, scale, ladder, tradeScale));
}

/**
 * Score one catchment across every category — for the "opportunity per business type"
 * panel.
 *
 * One type at a time here even when the map is showing several, and deliberately: this
 * panel answers "which single business would do best on this corner", so combining them
 * would be answering a question nobody asked it.
 *
 * `keys` exists because the client loads categories one at a time: a category whose
 * columns have not arrived is left OUT of the comparison rather than scored from
 * nothing. Scored anyway it would come back "not covered", which claims the source
 * has not surveyed here — a statement about the data, made on the strength of a
 * request that simply has not finished.
 */
export function scoreAcrossCategories(
	all: Hex[],
	id: string,
	w: Weights,
	keys: readonly CategoryKey[] = CATEGORY_KEYS
): Array<{ key: CategoryKey; score: number | null }> {
	const target = all.find((c) => c.id === id);
	if (!target) return [];
	// One ladder for the whole comparison. The cost of space is a property of the place,
	// not of the business type going into it, so it is the same figure in every row —
	// rebuilding it per category would be 13 passes over the grid to reach 13 identical
	// answers.
	const ladder = priceLadder(all, w.radius);
	// The display order is `categories.ts`'s, not the order the columns happened to
	// arrive in — otherwise the list reshuffles itself as each request lands.
	const wanted = new Set(keys);
	return CATEGORY_KEYS.filter((key) => wanted.has(key)).map((key) => ({
		key,
		score: scoreOne(
			target,
			[key],
			w,
			maxPoi(all, [key], w.source, w.radius),
			ladder,
			maxTrade(all, [key], w.source, w.radius)
		).score
	}));
}
