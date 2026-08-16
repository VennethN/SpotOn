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
function poiCount(c: Hex, cat: CategoryKey, source: PoiSource, radius: number): number | null {
	if (c.nodata) return 0;
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

/** Normalisation scale for supply: the densest catchment in this category. Cells
    that are not yet covered must not get a say in setting the scale. */
function maxPoi(all: Hex[], cat: CategoryKey, source: PoiSource, radius: number): number {
	const counts = all
		.filter((c) => !c.nodata)
		.map((c) => poiCount(c, cat, source, radius))
		.filter((n): n is number => n !== null);
	return Math.max(1, ...counts);
}

function typologyOf(
	demand: number,
	supply: number,
	busy: number,
	listings: number
): Typology {
	if (supply > 0.6 && busy < 0.45) return 'saturated';
	if (demand > 0.55 && supply < 0.32) return 'underserved';
	if (demand > 0.55 && listings === 0) return 'busy-limited-space';
	return 'competitive';
}

/**
 * The Opportunity Score of one catchment for one category.
 *
 *   Gap   = (wd·demand − ws·supply) / (wd + ws)
 *   Score = clamp(Gap + 0.5) × space_gate × transit_access × cost_of_space
 *
 * Supply is not merely a competitor count: density is weighted by how busy those
 * competitors are, so busy competitors push the opportunity down harder than quiet
 * ones. The availability of commercial space is treated as a gate — with no space
 * the opportunity cannot be acted on at all, it is not just more expensive.
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
	cat: CategoryKey,
	w: Weights,
	scale: number,
	ladder: number[] = []
): ScoredHex {
	const base = {
		id: c.id,
		name: cellName(c),
		lat: c.lat,
		lon: c.lon,
		boundary: c.boundary,
		transit: c.transit,
		access: c.access,
		nStruk: c.nStruk,
		nMenu: c.nMenu,
		nProp: c.nProp
	};

	const count = poiCount(c, cat, w.source, w.radius);

	// What is on the market here, and what that costs. Read for every branch below,
	// including the ones with no score: the listings are real MAPID data and stay true
	// whether or not the mission attributes for this cell exist, exactly as the transit
	// counts do. A panel that can say nothing about the opportunity can still say what
	// space is going for.
	const price = priceOf(c, w.radius);
	const level = priceLevel(price, ladder);
	const cost = costFactor(level);
	const units = unitsOf(c, w.radius);
	const propCovered = c.propCovered ?? false;
	const space = { price, priceLevel: level, costFactor: cost, units, propCovered };

	if (c.nodata) {
		return {
			...base,
			...space,
			osm: 0,
			source: w.source,
			covered: false,
			nodata: true,
			score: null,
			demand: null,
			supply: null,
			busy: 0,
			listings: 0,
			nTot: 0,
			cashless: 0,
			hourly: [],
			peakHour: -1,
			typology: 'no-data'
		};
	}

	// Not yet covered: this cell is real and inhabited, the active source simply has
	// not surveyed its city. Refusing to give it a score is the correct answer — any
	// number here would invent competition nobody has ever looked at.
	if (count === null) {
		return {
			...base,
			...space,
			osm: 0,
			source: w.source,
			covered: false,
			nodata: false,
			score: null,
			demand: c.d?.[cat] ?? 0,
			supply: null,
			busy: c.busy?.[cat] ?? 0,
			listings: 0,
			nTot: c.nStruk + c.nMenu + c.nProp,
			cashless: c.cashless ?? 0,
			hourly: c.hourly ?? [],
			peakHour: -1,
			typology: 'not-covered'
		};
	}

	const demand = c.d?.[cat] ?? 0;
	const busy = c.busy?.[cat] ?? 0;
	const supply = Math.min(1, (count / scale) * (0.55 + 0.9 * busy));
	const listings = Math.round((c.listing?.[cat] ?? 0) * areaFactor(w.radius));
	const gate = w.gate ? (listings > 0 ? 1 : GATE_BLOCKED) : 1;
	// Transit access is REAL data (OSM), unlike the mission indicators which are
	// still samples — so it enters as a multiplier of its own rather than being
	// folded into demand. That way a cell served by both the MRT and TransJakarta
	// really is worth more, and its contribution can be traced separately from the
	// figures that are still samples.
	//
	// The floor and the span come from `domain/transit`, which is also where the
	// panel reads them to say what that access was worth. Written out here as well
	// they were two constants kept in step by hand — and the panel's job is to
	// explain THIS multiplication, not one that resembles it.
	const accessFactor = ACCESS_FLOOR + ACCESS_SPAN * c.access;
	const gap = (w.wd * demand - w.ws * supply) / Math.max(0.0001, w.wd + w.ws);
	const score = Math.max(0, Math.min(1, gap + BALANCE_POINT)) * gate * accessFactor * cost;
	const hourly = c.hourly ?? [];
	const peak = hourly.length ? hourly.indexOf(Math.max(...hourly)) : -1;

	return {
		...base,
		...space,
		osm: count,
		source: w.source,
		covered: true,
		nodata: false,
		score,
		demand,
		supply,
		busy,
		listings,
		nTot: c.nStruk + c.nMenu + c.nProp,
		cashless: c.cashless ?? 0,
		hourly,
		peakHour: peak,
		typology: typologyOf(demand, supply, busy, listings)
	};
}

/** Score every catchment for one category. */
export function scoreAll(all: Hex[], cat: CategoryKey, w: Weights): ScoredHex[] {
	const scale = maxPoi(all, cat, w.source, w.radius);
	// The price scale, built once for the whole run exactly as `scale` is. Not filtered
	// to the cells with mission data: what a shopfront is being asked for is real MAPID
	// data and does not stop being true because the sample attributes for that cell were
	// never generated. Leaving those cells out would shorten the ladder every catchment
	// is ranked against, and move prices nobody disputes.
	const ladder = priceLadder(all, w.radius);
	return all.map((c) => scoreOne(c, cat, w, scale, ladder));
}

/**
 * Score one catchment across every category — for the "opportunity per business type"
 * panel.
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
		score: scoreOne(target, key, w, maxPoi(all, key, w.source, w.radius), ladder).score
	}));
}
