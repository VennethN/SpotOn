import { CATEGORY_KEYS, CATEGORY_MAP } from './categories';
import type { Hex, CategoryKey, PoiSource, ScoredHex, Typology, Weights } from '$lib/types';

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
 *   Score = clamp(Gap + 0.5) × commercial_space_gate
 *
 * Supply is not merely a competitor count: density is weighted by how busy those
 * competitors are, so busy competitors push the opportunity down harder than quiet
 * ones. The availability of commercial space is treated as a gate — with no space
 * the opportunity cannot be acted on at all, it is not just more expensive.
 */
export function scoreOne(
	c: Hex,
	cat: CategoryKey,
	w: Weights,
	scale: number
): ScoredHex {
	const base = {
		id: c.id,
		// Every cell currently has a named transit node within range, but that is a
		// property of today's OSM data — not a guarantee. A cell marker is used if
		// one day there is none, so the interface never has to handle a null.
		name: c.name ?? `Petak ${c.id.slice(-6)}`,
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

	if (c.nodata) {
		return {
			...base,
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
	const gate = w.gate ? (listings > 0 ? 1 : 0.15) : 1;
	// Transit access is REAL data (OSM), unlike the mission indicators which are
	// still samples — so it enters as a multiplier of its own rather than being
	// folded into demand. That way a cell served by both the MRT and TransJakarta
	// really is worth more, and its contribution can be traced separately from the
	// figures that are still samples.
	const accessFactor = 0.6 + 0.4 * c.access;
	const gap = (w.wd * demand - w.ws * supply) / Math.max(0.0001, w.wd + w.ws);
	const score = Math.max(0, Math.min(1, gap + 0.5)) * gate * accessFactor;
	const hourly = c.hourly ?? [];
	const peak = hourly.length ? hourly.indexOf(Math.max(...hourly)) : -1;

	return {
		...base,
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
	return all.map((c) => scoreOne(c, cat, w, scale));
}

/** Score one catchment across every category — for the "opportunity per business type" panel. */
export function scoreAcrossCategories(
	all: Hex[],
	id: string,
	w: Weights
): Array<{ key: CategoryKey; score: number | null }> {
	const target = all.find((c) => c.id === id);
	if (!target) return [];
	return CATEGORY_KEYS.map((key) => ({
		key,
		score: scoreOne(target, key, w, maxPoi(all, key, w.source, w.radius)).score
	}));
}
