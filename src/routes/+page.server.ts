import { CATEGORIES } from '$lib/domain/categories';
import { describeQuery, narrate } from '$lib/domain/narrate';
import { runQuery } from '$lib/domain/nlq';
import { DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { DICT, LANGS, type Copy, type Lang } from '$lib/i18n';
import { grid, loadHexes } from '$lib/server/source';
import type { CategoryKey, StructuredQuery } from '$lib/types';
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
 * The mission attributes themselves are still SAMPLES, and that marker reaches the
 * screen too.
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
	scriptFor('warung', false),
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
			metrik: 'penawaran efektif (pesaing × keramaian)',
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
			metrik: 'N titik data misi per catchment',
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
	const withData = hexes.filter((h) => !h.nodata);

	// The 24-hour profile across the whole area: receipts per hour, summed over the
	// cells that do have data. Its shape is real for this dataset — not a decorative curve.
	const hourly = Array.from({ length: 24 }, (_, h) =>
		withData.reduce((a, r) => a + (r.hourly?.[h] ?? 0), 0)
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
			nodata: grid.nodata,
			withData: grid.hexes - grid.nodata,
			resolution: grid.resolution,
			walkRadius: grid.walkRadius,
			stops: grid.stops,
			stopsByMode: grid.stopsByMode,
			pois: grid.pois,
			poisByCategory: grid.poisByCategory,
			categories: CATEGORIES.length,
			missionPoints: withData.reduce((a, r) => a + r.nStruk + r.nMenu + r.nProp, 0)
		},
		// One character per cell, in grid order: 1 = no data yet. Sent as text so 558
		// booleans do not become 558 lines of JSON.
		coverageMask: hexes.map((h) => (h.nodata ? '1' : '0')).join(''),
		hourly,
		conversation
	};
};
