import { getContext, setContext } from 'svelte';
import { base } from '$app/paths';
import { CATEGORY_KEYS, CATEGORY_MAP } from '$lib/domain/categories';
import { capturedStops, parseStops, type Stop } from '$lib/domain/transit';
import { scoreAcrossCategories, scoreAll } from '$lib/domain/scoring';
import { DEFAULT_CATEGORY, DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { lang } from './lang.svelte';
import { applyTheme, storedTheme, watchSystemDark, type Theme } from './theme.svelte';
import type {
	AiAnswer,
	CategoryKey,
	CategorySlice,
	Hex,
	HexBase,
	PoiSource,
	ScoredHex,
	Weights
} from '$lib/types';

export type LayerKey = 'score' | 'routes' | 'poi' | 'nodata' | 'label' | 'stops';
export type { Theme };

const KEY = Symbol('spoton');

/**
 * SpotOn's interface state.
 *
 * Scoring is recomputed on the client every time a weight changes so the sliders
 * feel instant — routing weights through the network would put latency right in the
 * input path. The scoring engine is the exact same module the server uses
 * (`$lib/scoring`), so there are never two versions of the truth.
 *
 * HOW THE DATA ARRIVES
 *
 * In two parts. `base` holds the geometry and the per-cell figures every category
 * shares; it comes with the page. `slices` holds the per-category columns, fetched
 * one category at a time and kept once fetched, so going back to a category already
 * seen costs nothing. `catchments` stitches them back into the `Hex` shape the
 * scoring engine has always taken, so nothing downstream of here knows the data
 * arrived in pieces.
 */
export class AppState {
	/** The grid, minus per-category columns — loaded with the page. */
	base = $state<HexBase[]>([]);
	/** Per-category columns, by category, as they arrive. */
	slices = $state<Partial<Record<CategoryKey, CategorySlice>>>({});
	category = $state<CategoryKey>(DEFAULT_CATEGORY);
	weights = $state<Weights>({ ...DEFAULT_WEIGHTS });
	layers = $state<Record<LayerKey, boolean>>({
		/**
		 * The opportunity heatmap is ON from the first frame.
		 *
		 * It is what the product is: a map with an opinion about where to open. Opening
		 * on a plain grid and asking the user to press a button to see it puts the whole
		 * point one step away, and an uncoloured grid reads as a map that failed to load.
		 *
		 * It stays a switch — the legend can turn it off, which is worth having when
		 * reading the streets underneath. But off is the state you choose, not the one
		 * you are given.
		 *
		 * This is why the default category's columns are fetched by the page load
		 * alongside the base grid rather than after mount: on from the start means
		 * coloured from the start, with no flash of a grey grid in between.
		 */
		score: true,
		routes: true,
		poi: false,
		nodata: true,
		label: true,
		/**
		 * The transit nodes the SELECTED cell captures — never the whole city's 1,105.
		 * On by default because it only ever draws once a cell is picked, and when it
		 * does it is answering the question the reader just asked by picking it.
		 */
		stops: true
	});
	selectedId = $state<string | null>(null);
	highlight = $state<string[]>([]);
	ai = $state<AiAnswer | null>(null);
	aiLoading = $state(false);
	aiError = $state<string | null>(null);
	/**
	 * Categories with a request in the air, and categories whose request failed.
	 *
	 * Kept PER CATEGORY rather than as one "loading" flag, because the user can
	 * switch category while a request is still out. A single flag set by whoever
	 * started and cleared by whoever finished gets stuck on: ask for kopi, switch to
	 * a category already cached (which starts and clears nothing), and kopi's reply
	 * arrives to find itself no longer the active category — so it never clears the
	 * flag, and the legend claims to be loading for the rest of the session.
	 */
	pending = $state<CategoryKey[]>([]);
	sliceErrors = $state<Partial<Record<CategoryKey, string>>>({});
	theme = $state<Theme>('system');
	/** The system dark preference, watched so the effective theme stays reactive. */
	systemDark = $state(false);
	/** The panel currently on screen in the compact layout. */
	sheetTab = $state<'recommendations' | 'detail' | 'table' | 'controls'>('recommendations');
	tableOpen = $state(false);

	/**
	 * Transit stops, for naming and drawing what a cell captures.
	 *
	 * 68 KB, and only ever needed once a cell is selected — so it is not in the page
	 * load. Fetched on the first selection and kept.
	 */
	stops = $state<Omit<Stop, 'distance'>[] | null>(null);

	/** In-flight requests, so two callers asking for the same category share one fetch. */
	#inFlight = new Map<CategoryKey, Promise<void>>();
	#stopsJob: Promise<void> | null = null;

	constructor(base: HexBase[], initial?: CategorySlice) {
		this.base = base;
		// The opening category arrives with the page, so the first paint is already
		// scored. Anything else is fetched on demand from here on.
		if (initial) this.slices = { [initial.cat]: initial };
	}

	get definition() {
		return CATEGORY_MAP[this.category];
	}

	/** The categories whose columns are loaded and therefore genuinely scoreable. */
	loaded = $derived(Object.keys(this.slices) as CategoryKey[]);

	/** Are the active category's columns here yet? */
	ready = $derived(Boolean(this.slices[this.category]));

	/** Is the ACTIVE category still on its way, and did it fail? */
	sliceLoading = $derived(this.pending.includes(this.category));
	sliceError = $derived(this.sliceErrors[this.category] ?? null);

	/**
	 * The base cells with every loaded category's columns stitched back on.
	 *
	 * `$derived.by` and not a getter: this runs over 562 cells, and `rows` below runs
	 * the whole scoring engine over the result. As plain getters they were recomputed
	 * on EVERY read — and one of those reads sits in the map's `mousemove` handler,
	 * so moving the pointer across the map rescored the entire grid, tens of times a
	 * second. Cached, it recomputes only when the data or the weights actually change.
	 */
	catchments: Hex[] = $derived.by(() => {
		const slices = this.slices;
		const keys = Object.keys(slices) as CategoryKey[];
		// Nothing loaded: hand back the base rather than allocate 562 objects holding
		// six empty dictionaries. The cast is safe because `rows` refuses to score
		// until `ready`, and `scoreAcrossCategories` is given `loaded`, which is empty
		// here — so nothing reads the per-category fields in this state.
		if (!keys.length) return this.base as unknown as Hex[];

		return this.base.map((h, i) => {
			const osm: Record<string, number> = {};
			const mapid: Record<string, number | null> = {};
			const covered: Record<string, boolean> = {};
			const busy: Record<string, number> = {};
			const listing: Record<string, number> = {};
			const d: Record<string, number> = {};

			for (const k of keys) {
				const s = slices[k]!;
				// A null OSM count means this category has no OSM source at all. The key is
				// LEFT OUT rather than set to null, because the scoring engine reads a
				// missing key as "never fetched" — writing the key would make it read as a
				// fetched zero, i.e. no competitors, i.e. the best score on the map.
				if (s.osm[i] !== null) osm[k] = s.osm[i] as number;
				mapid[k] = s.mapid[i];
				covered[k] = s.covered[i];
				busy[k] = s.busy[i];
				listing[k] = s.listing[i];
				d[k] = s.d[i];
			}
			return { ...h, osm, mapid, covered, busy, listing, d } as Hex;
		});
	});

	/**
	 * Every catchment, scored for the active category.
	 *
	 * Empty until that category's columns have arrived. Scoring without them would
	 * mark every cell "not covered" — which reads as "MAPID has not surveyed here",
	 * a claim about the data rather than about the loading, and not true.
	 */
	rows: ScoredHex[] = $derived.by(() =>
		this.ready ? scoreAll(this.catchments, this.category, this.weights) : []
	);

	/** Row by id — the map's hover handler needs this on every pointer move. */
	rowById = $derived(new Map(this.rows.map((r) => [r.id, r])));

	get selected(): ScoredHex | null {
		return this.rowById.get(this.selectedId ?? '') ?? null;
	}

	/**
	 * The selected catchment's opportunity across every category — for comparing
	 * business formats. Only the categories actually loaded are compared; the panel
	 * asks for the rest and they appear as they land.
	 */
	get selectedAcrossCategories() {
		if (!this.selectedId) return [];
		return scoreAcrossCategories(this.catchments, this.selectedId, this.weights, this.loaded);
	}

	coverage = $derived.by(() => {
		const rows = this.rows;
		const withData = this.base.filter((c) => !c.nodata);
		return {
			// Cell counts come from the base, so the coverage pill and Tapak's greeting
			// are right from the first frame rather than reading zero until a category
			// has been picked.
			total: this.base.length,
			withData: withData.length,
			withoutData: this.base.length - withData.length,
			missionPoints: withData.reduce((a, c) => a + c.nStruk + c.nMenu + c.nProp, 0),
			/** Competitor total — needs the active category, so it is 0 until one is loaded. */
			poi: rows.reduce((a, r) => a + r.osm, 0),
			/** Real cells left unscored because the active source does not cover them. */
			notCovered: rows.filter((r) => !r.nodata && r.score === null).length,
			scored: rows.filter((r) => r.score !== null).length
		};
	});

	/**
	 * Fetch one category's columns, once.
	 *
	 * Already loaded → nothing happens. Already in flight → the caller waits on the
	 * same request instead of starting a second one; the category picker and the
	 * heatmap button both ask for the same category within the same tick often enough
	 * for that to matter.
	 */
	async loadCategory(cat: CategoryKey): Promise<void> {
		if (this.slices[cat]) return;
		const running = this.#inFlight.get(cat);
		if (running) return running;

		const job = (async () => {
			this.pending = [...this.pending, cat];
			// A retry starts clean: a stale message next to a request that is running
			// again reads as a failure that has just happened.
			if (this.sliceErrors[cat]) {
				const { [cat]: _gone, ...rest } = this.sliceErrors;
				this.sliceErrors = rest;
			}
			try {
				const res = await fetch(`/api/catchments/${cat}`);
				if (!res.ok) throw new Error(`Gagal memuat data kategori (${res.status}).`);
				const slice: CategorySlice = await res.json();
				// Positional alignment is the whole contract of a slice. A length that does
				// not match means the base and the slice came from different builds, and
				// attaching the figures anyway would shift every cell's competitors onto its
				// neighbour — wrong everywhere, and visible nowhere.
				if (slice.n !== this.base.length) {
					throw new Error(
						`Data kategori tidak sepadan dengan kisi (${slice.n} ≠ ${this.base.length}).`
					);
				}
				this.slices = { ...this.slices, [cat]: slice };
			} catch (err) {
				this.sliceErrors = {
					...this.sliceErrors,
					[cat]: err instanceof Error ? err.message : 'Gagal memuat data kategori.'
				};
			} finally {
				this.#inFlight.delete(cat);
				this.pending = this.pending.filter((k) => k !== cat);
			}
		})();

		this.#inFlight.set(cat, job);
		return job;
	}

	/** Load every category — what the per-format comparison in the detail panel needs. */
	async loadAllCategories(): Promise<void> {
		// The active category goes first and alone. Everything on screen is waiting on
		// that one; letting twelve others race it only makes it land later.
		await this.loadCategory(this.category);
		await Promise.all(CATEGORY_KEYS.map((key) => this.loadCategory(key)));
	}

	/**
	 * Load the transit stops, once. Failure is silent on purpose: the stops enrich
	 * the area panel, and losing them must not take the panel's other figures with
	 * them — the counts it leads with come from the grid, which is already here.
	 */
	loadStops(): Promise<void> {
		if (this.stops || this.#stopsJob) return this.#stopsJob ?? Promise.resolve();
		this.#stopsJob = (async () => {
			try {
				const res = await fetch(`${base}/data/stops.json`);
				if (!res.ok) return;
				this.stops = parseStops(await res.json());
			} catch {
				/* the panel falls back to counts alone */
			}
		})();
		return this.#stopsJob;
	}

	/**
	 * The selected cell as the GRID holds it.
	 *
	 * Not the same thing as `selected`, which is the scored row and stays null until
	 * the active category's columns land. Everything built from real data — the cell's
	 * transit counts, its access index, the stops it captures — is already here on the
	 * first frame, and reading it through this rather than through the scored row is
	 * what lets the map and the transit panel answer immediately.
	 */
	selectedCell = $derived(this.base.find((h) => h.id === this.selectedId) ?? null);

	/** The stops the selected cell captures, nearest first. */
	selectedStops = $derived.by(() => {
		const cell = this.selectedCell;
		if (!cell || !this.stops) return [];
		return capturedStops(cell, this.stops, this.weights.radius);
	});

	/** Turn the heatmap on, fetching the active category's columns if they are not here yet. */
	showHeatmap(): void {
		this.layers.score = true;
		void this.loadCategory(this.category);
	}

	select(id: string | null) {
		this.selectedId = id;
		if (id) this.sheetTab = 'detail';
		if (id) {
			// Picking a cell is a request for its figures, heatmap or no heatmap — the
			// area panel and Tapak's remark both read the scored row.
			void this.loadCategory(this.category);
			// …and for the stations it captures, which the same panel names and the map
			// draws. Both are cached after the first selection, so this is one cost paid
			// once rather than per cell.
			void this.loadStops();
		}
	}

	setCategory(cat: CategoryKey) {
		this.category = cat;
		this.highlight = [];
		void this.loadCategory(cat);
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
			// Tapak has just named places on the map, so the map has to be able to show
			// them: the answered category's columns are fetched and the heatmap comes on.
			// This is the path the heatmap is meant to arrive by — the user asked a
			// question and got an answer, rather than being handed a coloured map to
			// interpret on their own.
			await this.loadCategory(data.query.kategori);
			this.layers.score = true;
		} catch (err) {
			this.aiError = err instanceof Error ? err.message : 'Terjadi kesalahan.';
		} finally {
			this.aiLoading = false;
		}
	}
}

export function setAppState(base: HexBase[], initial?: CategorySlice): AppState {
	return setContext(KEY, new AppState(base, initial));
}

export function getAppState(): AppState {
	return getContext<AppState>(KEY);
}
