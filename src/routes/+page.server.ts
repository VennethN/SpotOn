import { CATEGORIES } from '$lib/domain/categories';
import { describeQuery, narrate } from '$lib/domain/narrate';
import { runQuery } from '$lib/domain/nlq';
import { scoreAll } from '$lib/domain/scoring';
import { DEFAULT_CATEGORY, DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { DICT, LANGS, type Copy, type Lang } from '$lib/i18n';
import { projectGrid, sampleEven } from '$lib/server/gridmap';
import { grid, loadHexes } from '$lib/server/source';
import { rampIndex } from '$lib/utils/format';
import type { CategoryKey, Hex, StructuredQuery } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * The landing page's content is computed on the server, not written by hand.
 *
 * Two reasons, and both are about honesty:
 *
 * 1. **The figures must not go stale.** The counts of cells, transit nodes, and
 *    competitors are read from the same grid file the map uses. Once the grid is
 *    rebuilt, the landing page stays correct without anyone having to remember to
 *    update it — hand-written numbers here once fell badly out of date.
 * 2. **The sample conversation is answered by the same engine.** The questions are
 *    predetermined, but the answers are computed by `runQuery` from the data — not
 *    an invented transcript. What the landing page promises is exactly what the
 *    user will find inside the app.
 *
 * There is no third reason any more. This file used to add that the mission attributes
 * were samples and that the marker reached the screen too. Those attributes are gone:
 * every figure this page prints is now counted from OpenStreetMap or from the MAPID
 * catalogue, so there is nothing left to disclaim.
 */

/**
 * A set of predetermined questions — the answers are still computed by the engine.
 *
 * The text is not stored here but pulled from the per-language dictionary, so one
 * script produces the Indonesian and the English conversation from exactly the same
 * computation. Both are computed at build time and shipped together; this page is
 * static, so there is no second request when the reader switches language.
 */
interface Script {
	id: string;
	category: CategoryKey;
	/** Pulls the conversation's text from the requested language's dictionary. */
	lines: (c: Copy) => { choice: string; question: string };
	query: StructuredQuery;
}

const W = DEFAULT_WEIGHTS;

/** The cell the front page models from the basemap. See `load` for why this one. */
const SHOWCASE = 'Setiabudi Astra';

export interface DemoSet {
	id: string;
	category: CategoryKey;
	/** The business type, for the map's caption. Not spoken as a turn. */
	choice: string;
	/** The whole question, asked in one go rather than drawn out over four turns. */
	question: string;
	captured: string[];
	sentence: string;
	results: Array<{ name: string; value: number | null }>;
	more: number;
}

const rank = (category: CategoryKey, smallBudget: boolean): StructuredQuery => ({
	intent: 'RANK',
	metrik: 'gap permintaan − penawaran',
	kategori: [category],
	radius_m: W.radius,
	filter: {
		dalam_catchment_transit: `${W.radius} m`,
		...(smallBudget ? { ruang_sewa_tersedia: true, tier_harga: 'rendah' as const } : {})
	},
	urut: 'desc',
	limit: 3
});

function scriptFor(category: CategoryKey, smallBudget: boolean): Script {
	return {
		id: category,
		category,
		lines: (c) => ({
			choice: c.category[category].name,
			question: smallBudget
				? c.demo.askCheap(c.category[category].many)
				: c.demo.askOpen(c.category[category].many)
		}),
		query: rank(category, smallBudget)
	};
}

/**
 * The small-budget branch alternates so both sides of the conversation are seen.
 *
 * A sixth script asking about data coverage used to close the loop, and it has gone
 * because it stopped having anything to show. Reading both surveys rather than one
 * closed the gap it was built to admit: it now answers "0 cells unsurveyed" and paints
 * an empty map, which is a demonstration of nothing.
 */
const SCRIPTS: Script[] = [
	scriptFor('kopi', true),
	scriptFor('warteg', false),
	{
		id: 'jenuh',
		category: 'minimarket',
		lines: (c) => ({
			choice: c.category.minimarket.name,
			question: c.demo.askSaturated(c.category.minimarket.many)
		}),
		query: {
			intent: 'FLAG_SATURATED',
			metrik: 'pesaing sejenis dibanding usaha lain di sekitarnya',
			kategori: ['minimarket'],
			radius_m: W.radius,
			urut: 'desc',
			limit: 3
		}
	},
	scriptFor('laundry', true),
	scriptFor('apotek', false)
];

/**
 * Not one figure here depends on the request: the grid is a file bundled with the
 * build. So this page is rendered once at build time and served as a static file —
 * no server function is woken up just to recompute the same answer.
 */
export const prerender = true;

export const load: PageServerLoad = () => {
	const hexes = loadHexes();
	const surveyed = hexes.filter((h) => h.dens.mapid !== null);

	/* How the trade the demand side reads is spread across the grid: cells bucketed by
	   how many businesses stand in walking range of them. It replaces a 24-hour profile
	   of receipts that were generated hour by hour, and unlike that curve every column
	   here is a count of cells that exist. */
	const spread = densitySpread(surveyed.map((h) => h.dens.mapid as number));

	/* The 3D field on the way down the page, scored by the very engine the app runs on.
	   91 cells because that is what the scene's five rings hold, sampled evenly across
	   the ranking so the sample keeps the shape of the whole grid rather than showing
	   its best 91 cells. */
	const scored = scoreAll(hexes, DEFAULT_CATEGORY, W);
	const field = sampleEven(
		scored.map((r) => r.score),
		91
	);

	/* The cell on the stage at the top of the page. The busiest surveyed one, because
	   the scene it drives is a busy street, and every figure beside it is that cell's
	   own count rather than a number chosen to look good in a screenshot. */
	const busiest = scored.reduce((a, r) => (r.density > (a?.density ?? -1) ? r : a), scored[0]);
	const topDensity = Math.max(1, ...scored.map((r) => r.density));

	/* The cell modelled from the basemap further down. Chosen by name rather than by
	   count, and the reason is what the model shows: a building stands at the height the
	   tile carries, and a height is only visible where there are heights. The busiest
	   cell is a kampung, which at the size of a whole disc is a texture. Setiabudi is the
	   business district, and its towers are what a reader can see the model doing. The
	   figure beside it is still that cell's own count. Should the grid ever lose the
	   cell, the busiest stands in rather than the page breaking. */
	const shown = scored.find((r) => r.name === SHOWCASE) ?? busiest;

	/**
	 * WHAT THE MAP LOOKS LIKE AFTER EACH QUESTION.
	 *
	 * The conversation on this page used to be a chat box on its own, which asked the
	 * visitor to take on trust the one thing the product is: that asking repaints a map.
	 * So the map is here, it is the real grid at its real coordinates, and it is scored
	 * by the same engine the app runs — ask about coffee and the coffee map appears,
	 * ask about minimarkets and every cell moves.
	 *
	 * Computed ONCE and not per language, because a map has no language. Sent as a
	 * string of one character per cell, in the same order as `coverage.pts`, so the
	 * whole five-question sequence costs under three kilobytes: a digit is the cell's
	 * step on the seven-colour ramp, and a dot is a cell the active source has not
	 * surveyed, which is drawn as an outline rather than as a low score.
	 */
	const queryMaps = Object.fromEntries(
		SCRIPTS.map((s) => {
			const rows = scoreAll(hexes, s.query.kategori, W);
			const ans = runQuery(s.query, '', hexes, W);
			// The places the answer actually named, as indices into the same point array.
			// Five at most: this is a picture of an answer, not a table of one.
			const named = new Set(ans.highlight.slice(0, 5));
			return [
				s.id,
				{
					bands: rows.map((r) => (r.score === null ? '.' : String(rampIndex(r.score)))).join(''),
					marks: hexes.flatMap((h, i) => (named.has(h.id) ? [i] : []))
				}
			];
		})
	);

	// One computation per script, two scripts' worth of copy. The figures are identical
	// across languages because they come from the very same `runQuery`.
	const conversation = Object.fromEntries(
		LANGS.map((l) => [
			l,
			SCRIPTS.map((s) => {
				const c = DICT[l];
				const lines = s.lines(c);
				const ans = runQuery(s.query, lines.choice, hexes, W);
				return {
					id: s.id,
					category: s.category,
					...lines,
					captured: describeQuery(ans.query, c),
					sentence: narrate(ans, c),
					// Top three only: the landing page promises a reading, not a table.
					results: ans.items.slice(0, 3).map((i) => ({ name: i.name, value: i.value })),
					more: Math.max(0, ans.items.length - 3)
				};
			})
		])
	) as Record<Lang, DemoSet[]>;

	return {
		grid: {
			hexes: grid.hexes,
			surveyed: surveyed.length,
			unsurveyed: grid.hexes - surveyed.length,
			resolution: grid.resolution,
			walkRadius: grid.walkRadius,
			stops: grid.stops,
			stopsByMode: grid.stopsByMode,
			pois: grid.pois,
			poisByCategory: grid.poisByCategory,
			categories: CATEGORIES.length,
			mapidPoints: grid.mapid?.points ?? 0,
			listings: grid.property?.listings ?? 0,
			/* Null until the field surveys have been joined, and the page drops the
			   sentence about them rather than making a claim the data cannot back. The
			   figure is the records that actually landed in a catchment, not everything
			   read, because that is the number a reader can go and find. */
			fieldNotes: grid.mission ? grid.mission.placed : null
		},
		coverage: coverageMap(hexes),
		queryMaps,
		spread,
		field,
		stage: {
			name: busiest.name,
			businesses: busiest.density,
			rivals: busiest.osm,
			units: busiest.units,
			share: Math.min(1, busiest.density / topDensity)
		},
		/* The cell modelled from the basemap. Where it is and its own boundary go with
		   it so the model can be read in the browser around the real point. */
		showcase: {
			name: shown.name,
			lat: shown.lat,
			lon: shown.lon,
			boundary: shown.boundary,
			businesses: shown.density
		},
		conversation
	};
};

/**
 * The density column chart: how many cells sit in each band of business count.
 *
 * Bands rather than raw values because 562 cells will not fit across a chart, and
 * evenly spaced because the reader is meant to see the shape of the distribution — most
 * cells quiet, a long tail of dense ones — rather than a ranking.
 */
/**
 * The coverage picture: every cell where it actually is, marked surveyed or not.
 *
 * The projection is shared with the account page through `server/gridmap`, so the two
 * cannot come to disagree about where a cell sits. What is local to this page is the
 * VALUE attached to each point, which here is a single flag: has this cell's city been
 * read from the catalogue at all.
 */
function coverageMap(hexes: Hex[]) {
	const plan = projectGrid(hexes);
	return {
		pts: plan.pts.map((p, i) => ({ ...p, s: hexes[i].dens.mapid !== null })),
		height: plan.height,
		radius: plan.radius
	};
}

function densitySpread(counts: number[]): Array<{ upTo: number; cells: number }> {
	const top = Math.max(1, ...counts);
	const bands = 12;
	const width = Math.ceil(top / bands);
	const out = Array.from({ length: bands }, (_, i) => ({ upTo: width * (i + 1), cells: 0 }));
	for (const n of counts) out[Math.min(bands - 1, Math.floor(n / width))].cells++;
	return out;
}
