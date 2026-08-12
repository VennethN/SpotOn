import { getContext, setContext } from 'svelte';
import { CATEGORY_MAP } from '$lib/domain/categories';
import { scoreAcrossCategories, scoreAll } from '$lib/domain/scoring';
import { DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { lang } from './lang.svelte';
import { applyTheme, storedTheme, watchSystemDark, type Theme } from './theme.svelte';
import type { AiAnswer, Hex, CategoryKey, ScoredHex, Weights, PoiSource } from '$lib/types';

export type LayerKey = 'score' | 'routes' | 'poi' | 'nodata' | 'label';
export type { Theme };

const KEY = Symbol('spoton');

/**
 * SpotOn's interface state.
 *
 * Scoring is recomputed on the client every time a weight changes so the sliders
 * feel instant — routing weights through the network would put latency right in the
 * input path. The scoring engine is the exact same module the server uses
 * (`$lib/scoring`), so there are never two versions of the truth.
 */
export class AppState {
	catchments = $state<Hex[]>([]);
	category = $state<CategoryKey>('kopi');
	weights = $state<Weights>({ ...DEFAULT_WEIGHTS });
	layers = $state<Record<LayerKey, boolean>>({
		score: true,
		routes: true,
		poi: false,
		nodata: true,
		label: true
	});
	selectedId = $state<string | null>(null);
	highlight = $state<string[]>([]);
	ai = $state<AiAnswer | null>(null);
	aiLoading = $state(false);
	aiError = $state<string | null>(null);
	theme = $state<Theme>('system');
	/** The system dark preference, watched so the effective theme stays reactive. */
	systemDark = $state(false);
	/** The panel currently on screen in the compact layout. */
	sheetTab = $state<'recommendations' | 'detail' | 'table' | 'controls'>('recommendations');
	tableOpen = $state(false);

	constructor(catchments: Hex[]) {
		this.catchments = catchments;
	}

	get definition() {
		return CATEGORY_MAP[this.category];
	}

	/** Every catchment, scored for the active category. */
	get rows(): ScoredHex[] {
		return scoreAll(this.catchments, this.category, this.weights);
	}

	get selected(): ScoredHex | null {
		return this.rows.find((r) => r.id === this.selectedId) ?? null;
	}

	/** The selected catchment's opportunity across every category — for comparing business formats. */
	get selectedAcrossCategories() {
		if (!this.selectedId) return [];
		return scoreAcrossCategories(this.catchments, this.selectedId, this.weights);
	}

	get coverage() {
		const rows = this.rows;
		const withData = rows.filter((r) => !r.nodata);
		return {
			total: rows.length,
			withData: withData.length,
			withoutData: rows.length - withData.length,
			missionPoints: withData.reduce((a, r) => a + r.nTot, 0),
			poi: rows.reduce((a, r) => a + r.osm, 0),
			/** Real cells left unscored because the active source does not cover them. */
			notCovered: rows.filter((r) => !r.nodata && r.score === null).length,
			scored: rows.filter((r) => r.score !== null).length
		};
	}

	select(id: string | null) {
		this.selectedId = id;
		if (id) this.sheetTab = 'detail';
	}

	setCategory(cat: CategoryKey) {
		this.category = cat;
		this.highlight = [];
	}

	/** Switch the competitor-count source. The highlight is cleared with it: the
	    ranking is recomputed from different data, so the highlighted ids no longer
	    mean what the user meant when they highlighted them. */
	setSource(source: PoiSource) {
		this.weights.source = source;
		this.highlight = [];
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		applyTheme(theme);
	}

	/** The effective theme, once the system preference is taken into account. */
	get resolvedTheme(): 'light' | 'dark' {
		if (this.theme !== 'system') return this.theme;
		return this.systemDark ? 'dark' : 'light';
	}

	/** Restores the theme choice and watches the system preference. Returns its cleanup. */
	initTheme(): () => void {
		this.theme = storedTheme();
		return watchSystemDark((dark) => (this.systemDark = dark));
	}

	/** Ask the recommendation engine (the server endpoint). */
	async ask(question: string) {
		this.aiLoading = true;
		this.aiError = null;
		try {
			const res = await fetch('/api/ai/query', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					question,
					kategori: this.category,
					weights: this.weights,
					lang: lang()
				})
			});
			if (!res.ok) throw new Error(`Gagal memproses pertanyaan (${res.status}).`);
			const data: AiAnswer = await res.json();
			this.ai = data;
			this.highlight = data.highlight;
			// The parsed query is allowed to change the active category — the map has to
			// follow to the category that was actually answered, not stay on the old one.
			if (data.query.kategori !== this.category) this.category = data.query.kategori;
		} catch (err) {
			this.aiError = err instanceof Error ? err.message : 'Terjadi kesalahan.';
		} finally {
			this.aiLoading = false;
		}
	}
}

export function setAppState(catchments: Hex[]): AppState {
	return setContext(KEY, new AppState(catchments));
}

export function getAppState(): AppState {
	return getContext<AppState>(KEY);
}
