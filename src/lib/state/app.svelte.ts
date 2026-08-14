import { getContext, setContext } from 'svelte';
import { base } from '$app/paths';
import { CATEGORY_KEYS, CATEGORY_MAP } from '$lib/domain/categories';
import {
	capturedCompetitors,
	parseCompetitors,
	type Competitor
} from '$lib/domain/competitors';
import { priceLadder } from '$lib/domain/cost';
import { capturedListings, parseListings, type Listing } from '$lib/domain/premises';
import {
	DEFAULT_UNIT_METRIC,
	UNIT_METRIC_MAP,
	applyUnitFilters,
	buildUnits,
	rankUnits,
	type ScoredUnit,
	type UnitFilter,
	type UnitMetricKey
} from '$lib/domain/units';
import { capturedStops, parseStops, type Stop } from '$lib/domain/transit';
import { scoreAcrossCategories, scoreAll } from '$lib/domain/scoring';
import { DEFAULT_CATEGORY, DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { lang } from './lang.svelte';
import { applyTheme, storedTheme, watchSystemDark, type Theme } from './theme.svelte';
import type {
	AiAnswer,
	CategoryKey,
	CategorySlice,
	GridMeta,
	Hex,
	HexBase,
	PoiSource,
	ScoredHex,
	Weights
} from '$lib/types';

/** What the map is a list OF: catchments, or the units standing in them. */
export type Pivot = 'cell' | 'unit';

export type LayerKey = 'score' | 'routes' | 'poi' | 'nodata' | 'label' | 'stops' | 'property';
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
	/**
	 * What the grid file knows about itself, carried through from the page load.
	 *
	 * Here so the panels can state the SIZE and the RULES of the evidence from the data
	 * rather than from a number somebody typed into a sentence: how many property
	 * listings were read, how many cities they cover, and how many priced units a cell
	 * needs before the join will take a median from them. Rebuild the grid and every
	 * sentence quoting them follows, which is the whole point.
	 */
	meta = $state<GridMeta | null>(null);
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
		/**
		 * The competitors the SELECTED cell captures — never the whole city's.
		 *
		 * Off by default while this drew an invented scatter over all 562 cells at
		 * once, which was the right call for what it was then. It now draws the real
		 * MAPID positions for one cell at a time, so it is on for exactly the reason
		 * the transit nodes are: it only appears once a cell is picked, and when it
		 * does it is answering the question the reader just asked by picking it.
		 */
		poi: true,
		nodata: true,
		label: true,
		/**
		 * The transit nodes the SELECTED cell captures — never the whole city's 1,105.
		 * On by default because it only ever draws once a cell is picked, and when it
		 * does it is answering the question the reader just asked by picking it.
		 */
		stops: true,
		/**
		 * The units on the market in the SELECTED cell, at their real addresses.
		 *
		 * On by default for the same reason the competitors are: it draws nothing until a
		 * cell is picked. And the moment one is, "which of these could I actually take,
		 * and what is it asking" is the question the panel's median is an average of —
		 * the median tells the reader what a square metre costs around here, the marks
		 * tell them which doorways that came from.
		 */
		property: true
	});
	/**
	 * What the map is a list OF.
	 *
	 * `cell` is the product as it was: 562 catchments, ranked by whichever figure was
	 * asked about. `unit` pivots that — every shopfront on the market becomes a row, and
	 * the catchment it stands in becomes context travelling with it.
	 *
	 * Not a filter and not a layer, which is why it is a mode rather than a switch in the
	 * legend: it changes what a row IS, so the ranking, the panel and the map marks all
	 * mean something different on either side of it. Nobody rents a hexagon.
	 */
	pivot = $state<Pivot>('cell');
	/** The unit the reader has open, in unit mode. Kept apart from `selectedId`, which
	    is a cell: switching pivot must not leave one reading the other's id. */
	selectedUnitId = $state<string | null>(null);
	/** What the unit list is sorted by, and which way. */
	unitSort = $state<UnitMetricKey>(DEFAULT_UNIT_METRIC);
	// The default measure's own idea of "best", rather than a hard-coded direction:
	// changing `DEFAULT_UNIT_METRIC` used to leave this pointing the wrong way.
	unitOrder = $state<'asc' | 'desc'>(UNIT_METRIC_MAP[DEFAULT_UNIT_METRIC].best);
	/** Band filters on the unit list — thirds of the set, never a typed threshold. */
	unitFilters = $state<UnitFilter[]>([]);

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

	/**
	 * Transit stops, for naming and drawing what a cell captures.
	 *
	 * 68 KB, and only ever needed once a cell is selected — so it is not in the page
	 * load. Fetched on the first selection and kept.
	 */
	stops = $state<Omit<Stop, 'distance'>[] | null>(null);
	/**
	 * The stop file could not be read.
	 *
	 * Kept apart from `stops` because "not here yet" and "not coming" are different
	 * facts, and a panel has to say different things about them: the first is a
	 * loading line, the second is a fallback to the counts. With one null standing for
	 * both, a single failed fetch left every panel announcing that it was still
	 * loading — for the rest of the session, with nothing on the way.
	 */
	stopsFailed = $state(false);

	/**
	 * Competitor positions, by category, for drawing what a cell captures.
	 *
	 * Per category rather than one file, because only the active category is ever
	 * drawn and the whole set is 532 KB against 12 to 78 KB for one of them. Fetched
	 * on the first selection and kept, exactly like the stops.
	 *
	 * MAPID only. There are no OSM coordinates on disk — see `domain/competitors`.
	 */
	pois = $state<Partial<Record<CategoryKey, Array<Omit<Competitor, 'distance'>>>>>({});
	/** Categories whose point file could not be read. Kept apart from `pois` for the
	    same reason `stopsFailed` is kept apart from `stops`: "not here yet" and "not
	    coming" are different facts, and only one of them is worth waiting on. */
	poisFailed = $state<CategoryKey[]>([]);

	/**
	 * Commercial property listings, for showing what is actually on the market around a
	 * selected cell.
	 *
	 * 231 KB, and only ever needed once a cell is selected — so it is not in the page
	 * load. Fetched on the first selection and kept, exactly like the stops.
	 *
	 * Not per category, because it is not a per-category fact: what a square metre of
	 * shopfront costs is a property of the place, not of the business going into it.
	 */
	listings = $state<Array<Omit<Listing, 'distance'>> | null>(null);
	/** The listing file could not be read. Kept apart from `listings` for the same
	    reason `stopsFailed` is kept apart from `stops`: the price and the count on
	    screen come from the grid and survive this, only the individual units are lost. */
	listingsFailed = $state(false);

	/** In-flight requests, so two callers asking for the same category share one fetch. */
	#inFlight = new Map<CategoryKey, Promise<void>>();
	#stopsJob: Promise<void> | null = null;
	#poiJobs = new Map<CategoryKey, Promise<void>>();
	#listingsJob: Promise<void> | null = null;

	constructor(base: HexBase[], initial?: CategorySlice, meta?: GridMeta) {
		this.base = base;
		// The opening category arrives with the page, so the first paint is already
		// scored. Anything else is fetched on demand from here on.
		if (initial) this.slices = { [initial.cat]: initial };
		this.meta = meta ?? null;
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
	 * Every asking price on the grid, sorted — the scale one catchment's price is read
	 * against.
	 *
	 * Held here rather than rebuilt by each panel that needs it. Two of them do, and
	 * `$derived` alone would not have saved them from each other: they are separate
	 * expressions, so each would run its own pass over 562 cells every time the grid or
	 * the radius changed. One derived, read twice, is one pass.
	 *
	 * The scoring engine still builds its own inside `scoreAll`, and that is deliberate:
	 * `domain/scoring` is a pure function of the data handed to it, and reaching into
	 * interface state for a figure the score depends on would put the two out of reach of
	 * the self-test that checks them against each other.
	 */
	priceLadder = $derived(priceLadder(this.catchments, this.weights.radius));

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
	 * Load the transit stops, once.
	 *
	 * Failure does not take the panels down with it: the counts they lead with come
	 * from the grid, which is already here, so losing this file costs the reader the
	 * NAMES and nothing else. But it is not silent either — `stopsFailed` is what lets
	 * a panel drop its loading line and fall back, instead of waiting on a request
	 * that is never coming back.
	 */
	loadStops(): Promise<void> {
		if (this.stops || this.#stopsJob) return this.#stopsJob ?? Promise.resolve();
		this.#stopsJob = (async () => {
			try {
				const res = await fetch(`${base}/data/stops.json`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				this.stops = parseStops(await res.json());
				this.stopsFailed = false;
			} catch {
				this.stopsFailed = true;
			} finally {
				// Cleared either way, the same shape `loadCategory` uses for its in-flight
				// map. Left in place after a failure it is a retry that can never happen:
				// the guard above sees a job, hands back its settled promise, and every
				// later selection is answered by the request that already failed.
				this.#stopsJob = null;
			}
		})();
		return this.#stopsJob;
	}

	/**
	 * Load one category's competitor positions, once.
	 *
	 * Failure is quiet in the same way `loadStops` is: the counts the panels lead with
	 * come from the grid, which is already here, so losing this file costs the reader
	 * the POSITIONS and nothing else. The score, the ranking and every figure on
	 * screen are untouched by it.
	 */
	loadPois(cat: CategoryKey): Promise<void> {
		if (this.pois[cat]) return Promise.resolve();
		const running = this.#poiJobs.get(cat);
		if (running) return running;

		const job = (async () => {
			try {
				const res = await fetch(`${base}/data/pois/${cat}.json`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				this.pois = { ...this.pois, [cat]: parseCompetitors(await res.json()) };
				this.poisFailed = this.poisFailed.filter((k) => k !== cat);
			} catch {
				if (!this.poisFailed.includes(cat)) this.poisFailed = [...this.poisFailed, cat];
			} finally {
				// Cleared either way, so a failure can be retried by the next selection
				// rather than every later one being answered by the request that failed.
				this.#poiJobs.delete(cat);
			}
		})();

		this.#poiJobs.set(cat, job);
		return job;
	}

	/**
	 * Load the commercial property listings, once.
	 *
	 * Failure is quiet in the same way `loadStops` is: the asking price the panel leads
	 * with, the count of units on the market and the cost multiplier on the score all
	 * come from the grid, which is already here. Losing this file costs the reader the
	 * INDIVIDUAL UNITS and nothing else, and the panel says so rather than waiting on a
	 * request that is never coming back.
	 */
	loadListings(): Promise<void> {
		if (this.listings || this.#listingsJob) return this.#listingsJob ?? Promise.resolve();
		this.#listingsJob = (async () => {
			try {
				const res = await fetch(`${base}/data/property.json`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				this.listings = parseListings(await res.json());
				this.listingsFailed = false;
			} catch {
				this.listingsFailed = true;
			} finally {
				// Cleared either way, so a failure can be retried by the next selection
				// rather than every later one being answered by the request that failed.
				this.#listingsJob = null;
			}
		})();
		return this.#listingsJob;
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

	/**
	 * The competitors the selected cell captures, nearest first.
	 *
	 * Empty on the OSM source, and that is the point: the positions ARE the MAPID
	 * dataset, so drawing them while an OSM count is on screen would show one source's
	 * competitors as though they were the other's. Nothing is drawn, and
	 * `poisUnavailable` below is what lets the interface say so instead of leaving the
	 * reader to wonder where the dots went.
	 */
	selectedPois = $derived.by(() => {
		const cell = this.selectedCell;
		if (!cell || cell.nodata || this.weights.source !== 'mapid') return [];
		const points = this.pois[this.category];
		if (!points) return [];
		return capturedCompetitors(cell, points, this.weights.radius);
	});

	/** A cell is selected, but its competitors cannot be placed on the map. Either the
	    active source has no coordinates at all (OSM), or this category's file failed
	    to load. Both leave the count intact and only the positions missing. */
	poisUnavailable = $derived.by(() => {
		if (!this.selectedCell || this.selectedCell.nodata) return null;
		if (this.weights.source !== 'mapid') return 'source' as const;
		if (this.poisFailed.includes(this.category)) return 'failed' as const;
		return null;
	});

	/**
	 * The property listings the selected cell captures, nearest first.
	 *
	 * The same distance test the join used, so these ARE the units the median asking
	 * price was taken over rather than a set that resembles them. Empty for a cell whose
	 * city the catalogue has not been read for, which `selected.propCovered` is what
	 * tells apart from a cell where nothing is on the market.
	 */
	selectedListings = $derived.by(() => {
		const cell = this.selectedCell;
		if (!cell || !this.listings) return [];
		return capturedListings(cell, this.listings, this.weights.radius);
	});

	/**
	 * Every unit on the market, with the catchment it stands in attached.
	 *
	 * Built only in unit mode. It walks 2,700 listings against 562 cells, and in cell
	 * mode nothing reads the result — paying for it on every weight change so it can sit
	 * unused is the kind of cost that only shows up on somebody else's laptop.
	 */
	units = $derived.by(() => {
		if (this.pivot !== 'unit' || !this.listings) return [];
		return buildUnits(this.base, this.listings, this.rowById, this.weights.radius);
	});

	/**
	 * The units left after the filters, before the sort drops anything.
	 *
	 * Kept apart from `unitRows` so the panel can tell the two subtractions apart. A unit
	 * removed by a filter and a unit with no reading for the measure being sorted by are
	 * different facts, and reporting both as "filtered out" tells the reader they
	 * narrowed something they did not touch.
	 */
	unitFiltered = $derived(applyUnitFilters(this.units, this.unitFilters));

	/** The unit list as the reader has it: filtered, then ranked. */
	unitRows = $derived(rankUnits(this.unitFiltered, this.unitSort, this.unitOrder));

	get selectedUnit(): ScoredUnit | null {
		if (this.pivot !== 'unit' || !this.selectedUnitId) return null;
		return this.units.find((u) => u.id === this.selectedUnitId) ?? null;
	}

	/**
	 * Switch what the map is a list of.
	 *
	 * The listings are fetched here rather than on the first selection, because in unit
	 * mode they are not a detail of a chosen cell — they ARE the rows, and a mode that
	 * opens empty and fills in a moment later reads as a mode that failed.
	 *
	 * Each side's selection is dropped on the way out. A cell id and a unit id are not
	 * interchangeable, and leaving one set means switching back lands on whatever was
	 * open three modes ago rather than on what the reader is looking at.
	 */
	setPivot(p: Pivot) {
		if (this.pivot === p) return;
		this.pivot = p;
		this.highlight = [];
		if (p === 'unit') {
			this.selectedId = null;
			void this.loadListings();
			void this.loadCategory(this.category);
		} else {
			this.selectedUnitId = null;
		}
	}

	/** Open one unit. Its home cell's competitors and stations are fetched with it: the
	    panel describes the catchment around the unit, and that is what draws it. */
	selectUnit(id: string | null) {
		this.selectedUnitId = id;
		if (id) {
			void this.loadCategory(this.category);
			void this.loadStops();
			void this.loadPois(this.category);
		}
	}

	/** The listings are on their way and no conclusion can be drawn yet. Worth its own
	    flag for the same reason `poisLoading` is: an empty list reads the same whether
	    the file has not landed or has landed and holds nothing within reach, and only
	    one of those is a finding. */
	listingsLoading = $derived.by(() => {
		if (!this.selectedCell || this.listingsFailed) return false;
		return this.listings === null;
	});

	/**
	 * The points are on their way and no conclusion can be drawn yet.
	 *
	 * Worth its own flag, because without it an empty `selectedPois` reads the same
	 * whether the file has not landed or has landed and holds nothing inside the
	 * range — and the interface would announce "no competitors here" for as long as
	 * the request took. That is a finding, and it would be being reported before
	 * anything had been looked at.
	 */
	poisLoading = $derived.by(() => {
		if (this.poisUnavailable || !this.selectedCell) return false;
		return !this.pois[this.category];
	});

	/** Turn the heatmap on, fetching the active category's columns if they are not here yet. */
	showHeatmap(): void {
		this.layers.score = true;
		void this.loadCategory(this.category);
	}

	select(id: string | null) {
		this.selectedId = id;
		if (id) {
			// Picking a cell is a request for its figures, heatmap or no heatmap — the
			// area panel and Tapak's remark both read the scored row.
			void this.loadCategory(this.category);
			// …and for the stations it captures, which the same panel names and the map
			// draws. Both are cached after the first selection, so this is one cost paid
			// once rather than per cell.
			void this.loadStops();
			// …and for where its competitors actually stand, which the map draws beside
			// them. Cached per category, so switching back to a category already seen
			// costs nothing.
			void this.loadPois(this.category);
			// …and for what is on the market in it. One file for every category, cached
			// after the first selection, so this too is a cost paid once.
			void this.loadListings();
		}
	}

	setCategory(cat: CategoryKey) {
		this.category = cat;
		this.highlight = [];
		void this.loadCategory(cat);
		// A cell is already open: its competitors are on the map and they belong to the
		// category being left behind. Fetched here rather than waiting for the next
		// selection, otherwise switching category leaves the previous category's dots
		// on screen until the user happens to click somewhere.
		if (this.selectedId) void this.loadPois(cat);
	}

	/** Switch the competitor-count source. The highlight is cleared with it: the
	    ranking is recomputed from different data, so the highlighted ids no longer
	    mean what the user meant when they highlighted them. */
	setSource(source: PoiSource) {
		this.weights.source = source;
		this.highlight = [];
		// Only MAPID carries positions, so switching to it with a cell already open has
		// to fetch them — otherwise the competitors stay off the map until the next
		// click, and switching source looks like it did nothing.
		if (source === 'mapid' && this.selectedId) void this.loadPois(this.category);
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
			// Small talk leaves the map exactly as it was. Nothing was computed, so there
			// is nothing to show — and `query` on a chat turn is only the fallback parser's
			// reading of the sentence, which will happily find "warteg" inside "makasih,
			// warteg emang enak" and swing the whole map to a category the reader never
			// asked to see. A greeting must not repaint anything.
			if (data.chat) return;
			this.highlight = data.highlight;
			// The parsed query is allowed to change the active category — the map has to
			// follow to the category that was actually answered, not stay on the old one.
			if (data.query.kategori !== this.category) {
				this.category = data.query.kategori;
				// Same reason as in `setCategory`: a cell left open would otherwise keep
				// showing the previous category's competitors under the new answer.
				if (this.selectedId) void this.loadPois(this.category);
			}
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

export function setAppState(
	base: HexBase[],
	initial?: CategorySlice,
	meta?: GridMeta
): AppState {
	return setContext(KEY, new AppState(base, initial, meta));
}

export function getAppState(): AppState {
	return getContext<AppState>(KEY);
}
