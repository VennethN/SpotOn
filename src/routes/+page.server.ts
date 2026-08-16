import { CATEGORIES } from '$lib/domain/categories';
import { describeQuery, narrate } from '$lib/domain/narrate';
import { runQuery } from '$lib/domain/nlq';
import { scoreAll } from '$lib/domain/scoring';
import { DEFAULT_CATEGORY, DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { DICT, LANGS, type Copy, type Lang } from '$lib/i18n';
import { grid, loadHexes } from '$lib/server/source';
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
	lines: (c: Copy) => { choice: string; chip: string; ask: string; answer: string; preface: string };
	query: StructuredQuery;
}

const W = DEFAULT_WEIGHTS;

export interface DemoSet {
	id: string;
	category: CategoryKey;
	choice: string;
	chip: string;
	ask: string;
	answer: string;
	preface: string;
	captured: string[];
	sentence: string;
	results: Array<{ name: string; value: number | null }>;
	more: number;
}

const rank = (category: CategoryKey, smallBudget: boolean): StructuredQuery => ({
	intent: 'RANK',
	metrik: 'gap permintaan − penawaran',
	kategori: category,
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
			chip: c.category[category].short,
			ask: c.tapak.budgetAsk(c.category[category].name.toLowerCase()),
			answer: smallBudget ? c.tapak.budgetTight : c.tapak.budgetLoose,
			preface: smallBudget ? c.tapak.prefaceTight : c.tapak.prefaceLoose
		}),
		query: rank(category, smallBudget)
	};
}

/** The small-budget branch alternates so both sides of the conversation are seen. */
const SCRIPTS: Script[] = [
	scriptFor('kopi', true),
	scriptFor('warteg', false),
	{
		id: 'jenuh',
		category: 'minimarket',
		lines: (c) => ({
			choice: c.category.minimarket.name,
			chip: c.demo.saturatedChip,
			ask: c.demo.saturatedAsk,
			answer: c.demo.saturatedYes,
			preface: c.demo.saturatedPreface
		}),
		query: {
			intent: 'FLAG_SATURATED',
			metrik: 'pesaing sejenis dibanding usaha lain di sekitarnya',
			kategori: 'minimarket',
			radius_m: W.radius,
			urut: 'desc',
			limit: 3
		}
	},
	scriptFor('laundry', true),
	scriptFor('apotek', false),
	{
		id: 'coverage',
		category: 'kopi',
		lines: (c) => ({
			choice: c.demo.coverageAsk,
			chip: c.demo.coverageChip,
			ask: c.demo.coverageReply,
			answer: c.demo.coverageYes,
			preface: c.demo.coveragePreface
		}),
		query: {
			intent: 'COVERAGE',
			metrik: 'petak yang kotanya belum disurvei sumber aktif',
			kategori: 'kopi',
			radius_m: W.radius,
			urut: 'asc',
			limit: 99
		}
	}
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
	const field = sampleScores(
		scored.map((r) => r.score),
		91
	);

	/* The cell on the stage at the top of the page. The busiest surveyed one, because
	   the scene it drives is a busy street, and every figure beside it is that cell's
	   own count rather than a number chosen to look good in a screenshot. */
	const busiest = scored.reduce((a, r) => (r.density > (a?.density ?? -1) ? r : a), scored[0]);
	const topDensity = Math.max(1, ...scored.map((r) => r.density));

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
			listings: grid.property?.listings ?? 0
		},
		coverage: coverageMap(hexes),
		spread,
		field,
		stage: {
			name: busiest.name,
			businesses: busiest.density,
			rivals: busiest.osm,
			units: busiest.units,
			share: Math.min(1, busiest.density / topDensity)
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
 * The coverage picture: every cell WHERE IT ACTUALLY IS.
 *
 * What stood here was one hexagon per cell laid out in grid order, 31 to a row. Grid
 * order is by transit access, so the picture had the shape of a rectangle and the holes
 * in it fell wherever the sort happened to put them. It looked exactly like a map of
 * Jakarta and was a map of nothing, which is the one thing this section is about not
 * doing.
 *
 * These are the real centres, in a plain equirectangular projection with the longitudes
 * scaled by the cosine of the middle latitude so the city is not stretched sideways.
 * The radius is derived from the closest pair of cells on the grid rather than typed in,
 * so the hexagons tile at whatever resolution the grid is rebuilt at.
 */
function coverageMap(hexes: Hex[]) {
	const lats = hexes.map((h) => h.lat);
	const lons = hexes.map((h) => h.lon);
	const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
	const kx = Math.cos((latMid * Math.PI) / 180);
	const x0 = Math.min(...lons) * kx;
	const y0 = Math.max(...lats);
	const raw = hexes.map((h) => ({
		x: h.lon * kx - x0,
		y: y0 - h.lat,
		surveyed: h.dens.mapid !== null
	}));

	// Scale so the field is 1000 units wide, whatever the city's extent.
	const w = Math.max(...raw.map((p) => p.x)) || 1;
	const k = 1000 / w;
	const pts = raw.map((p) => ({
		x: Math.round(p.x * k * 10) / 10,
		y: Math.round(p.y * k * 10) / 10,
		s: p.surveyed
	}));

	// The nearest neighbour of a handful of cells, which is one cell pitch. Sampled
	// rather than computed for all 562, because this is a drawing size and not a figure
	// anybody reads.
	let pitch = Infinity;
	for (let i = 0; i < pts.length; i += 17) {
		for (const q of pts) {
			if (q === pts[i]) continue;
			const d = Math.hypot(q.x - pts[i].x, q.y - pts[i].y);
			if (d > 0.01 && d < pitch) pitch = d;
		}
	}

	return {
		pts,
		height: Math.round(Math.max(...pts.map((p) => p.y)) * 10) / 10,
		/** Centre to vertex. A pointy-top hexagon's width is `sqrt(3) x` this. */
		radius: Math.round((pitch / Math.sqrt(3)) * 100) / 100
	};
}

/**
 * `n` values taken evenly across a ranking, best first.
 *
 * Evenly rather than the top `n`: the point of the field is the SPREAD of the grid, and
 * a sample of its best cells would show a plateau and call it Jakarta.
 */
function sampleScores(scores: Array<number | null>, n: number): Array<number | null> {
	const sorted = [...scores].sort((a, b) => (b ?? -1) - (a ?? -1));
	if (sorted.length <= n) return sorted;
	return Array.from({ length: n }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (n - 1))]);
}

function densitySpread(counts: number[]): Array<{ upTo: number; cells: number }> {
	const top = Math.max(1, ...counts);
	const bands = 12;
	const width = Math.ceil(top / bands);
	const out = Array.from({ length: bands }, (_, i) => ({ upTo: width * (i + 1), cells: 0 }));
	for (const n of counts) out[Math.min(bands - 1, Math.floor(n / width))].cells++;
	return out;
}
