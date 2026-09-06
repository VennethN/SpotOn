import { getContext, setContext } from 'svelte';
import { base } from '$app/paths';
import { CATEGORY_KEYS, orderCategories } from '$lib/domain/categories';
import {
	capturedCompetitors,
	parseCompetitors,
	type Competitor
} from '$lib/domain/competitors';
import { capturedOpen, parseHours, readHours, type OpenPlace } from '$lib/domain/activity';
import { priceLadder } from '$lib/domain/cost';
import { parseField, type FieldRecord } from '$lib/domain/field';
import { capturedListings, parseListings, type Listing } from '$lib/domain/premises';
import {
	DEFAULT_UNIT_METRIC,
	UNIT_METRIC_MAP,
	applyUnitFilters,
	buildUnits,
	rankUnits,
	unitRanks,
	type ScoredUnit,
	type UnitFilter
} from '$lib/domain/units';
import { capturedStops, parseStops, type Stop } from '$lib/domain/transit';
import { scoreAcrossCategories, scoreAll } from '$lib/domain/scoring';
import { DEFAULT_WEIGHTS, snapRadius } from '$lib/domain/weights';
import { lang } from './lang.svelte';
import { applyTheme, storedTheme, watchSystemDark, type Theme } from './theme.svelte';
import type {
	AiAnswer,
	AiEvent,
	AiStage,
	CategoryKey,
	CategorySlice,
	ChatTurn,
	GridMeta,
	Hex,
	HexBase,
	MeterKey,
	PoiSource,
	ScoredHex,
	UnitMetricKey,
	Weights
} from '$lib/types';

/** What the map is a list OF: catchments, or the units standing in them. */
export type Pivot = 'cell' | 'unit';

/**
 * How the reading is drawn: flat on the plan, or standing up off it.
 *
 * Not a second reading, and that is the whole rule this mode is held to. `relief`
 * raises each catchment by THE NUMBER ITS COLOUR ALREADY SHOWS, so the height and the
 * shade are two readings of one figure. A cell nobody surveyed is raised by nothing
 * and stays flat under its hatch, for the same reason it is given no colour: an
 * absence drawn as a low column is an absence dressed up as a finding.
 *
 * It is a view, so it is kept here rather than in `layers`. Those switch what is on the
 * map. This one only changes how the same thing is looked at.
 */
export type ViewMode = 'flat' | 'relief';

/**
 * Somebody watching an answer being worked out.
 *
 * Every method is optional and none of them is told a figure. The stages say which of
 * the two halves of the engine is running, and the deltas carry the one sentence the
 * model writes for itself. Everything computed arrives at the end, all at once, because
 * that is when it exists.
 */
export interface AskWatcher {
	stage?(stage: AiStage): void;
	/** More of the model's casual reply. A preview: the answer's own text is final. */
	delta?(text: string): void;
	/** Everything delta'd so far is void. It failed the fence in `domain/chat`. */
	reset?(): void;
}

/**
 * The streamed reply, read down to the answer inside it.
 *
 * NDJSON, so the framing is a newline and nothing else. A chunk off the network stops
 * wherever it stops, which is regularly halfway through a line, so the tail is kept
 * back and finished by the next chunk. Reading a chunk as if it were whole is what
 * turns a perfectly good answer into a parse error under a slow connection.
 *
 * Throws when the stream ends without an answer, which is the same thing a failed
 * request is to the caller: no answer came back.
 */
async function readEvents(res: Response, on: (event: AiEvent) => void): Promise<AiAnswer> {
	const reader = res.body?.getReader();
	if (!reader) throw new Error('Gagal memproses pertanyaan (jawaban kosong).');

	const decoder = new TextDecoder();
	let buf = '';
	let answer: AiAnswer | null = null;

	const take = (line: string) => {
		const text = line.trim();
		if (!text) return;
		let event: AiEvent;
		try {
			event = JSON.parse(text);
		} catch {
			// A line that is not JSON is a line from something other than this endpoint.
			// Nothing useful to do with it, and no reason to lose the answer over it.
			return;
		}
		if (event.kind === 'error') throw new Error(event.message);
		if (event.kind === 'answer') answer = event.answer;
		else on(event);
	};

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
		let nl: number;
		while ((nl = buf.indexOf('\n')) !== -1) {
			const line = buf.slice(0, nl);
			buf = buf.slice(nl + 1);
			take(line);
		}
	}
	// Whatever is left when the stream closes is a whole line without its newline.
	take(buf + decoder.decode());

	if (!answer) throw new Error('Gagal memproses pertanyaan (jawaban kosong).');
	return answer;
}

export type LayerKey = 'score' | 'routes' | 'poi' | 'label' | 'stops' | 'property' | 'field';
export type { Theme };

/**
 * What the map spends, without knowing whose account it is.
 *
 * `AccountState` implements this. The map is handed the interface rather than the
 * account so that this class never learns an email address, a plan name or a price: it
 * only ever asks whether there is one left and says when it has taken one.
 *
 * `take` and `settle` are separate because they answer at different speeds and the
 * interface needs the first one now. `take` is the browser's own reading, which is
 * instant and is what decides whether the card opens. `settle` is the server's, which
 * is the one that counts, and it comes back afterwards to correct the figure or to take
 * back a reading that two tabs bought with the same last credit.
 */
export interface Wallet {
	/** What is left on one meter, as the browser last saw it. */
	left(meter: MeterKey): number;
	/** Take one off that reading, now. False when there was nothing to take. */
	take(meter: MeterKey): boolean;
	/** Spend one analysis on the server. False means the server refused it. */
	settleAnalysis(): Promise<boolean>;
	/** Re-read the balances. The only way the browser learns what a question cost,
	    because that credit is spent inside the answer rather than beside it. */
	refresh(): Promise<void>;
}

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
	/**
	 * The business types the map is scoring, as one set.
	 *
	 * A LIST rather than a single key, and that is the change the whole product turns
	 * on. A question can name more than one — "kedai kopi dan toko roti" — and the map
	 * used to answer it by silently keeping the first: the reply spoke about bakeries
	 * while every colour on screen was about cafes. Now the outlets of every type in
	 * this set are counted together as rivals and all of them come out of the trade
	 * around each cell, so the picture is the answer to the question that was asked.
	 *
	 * EMPTY UNTIL SOMEBODY ASKS. It opened on coffee, and there was no defending that:
	 * a reader who had not said a word about coffee was handed a map coloured for it,
	 * with the legend naming a business type they never chose. Picking a different one
	 * to open on would have been just as arbitrary, and opening on all thirteen is not
	 * available either — the trade around a cell IS the thirteen counts added up, so a
	 * set of all of them subtracts the whole of itself and leaves every cell reading
	 * zero demand.
	 *
	 * So the opening map scores nothing and paints the one figure that needs no
	 * business type: how much trade stands in walking range. See `basis`.
	 *
	 * `setCategories` still refuses to make this empty AGAIN once a type has been
	 * named, which is not a contradiction of the above but the same rule read forwards:
	 * the reader asked about something, and silently dropping back to a map about
	 * nothing would throw their question away.
	 *
	 * It is set by ASKING. There is no other way in: the chips at the top of the map
	 * report what the last answer covered and nothing on them is pressable, so this
	 * field only ever moves because somebody asked a question.
	 */
	categories = $state<CategoryKey[]>([]);
	weights = $state<Weights>({ ...DEFAULT_WEIGHTS });
	/**
	 * Flat by default. A map opens as a map, and a reader who has not asked to tilt it
	 * should not have to work out which way they are facing before they can read a
	 * hexagon. The raised view is the one you choose.
	 */
	view = $state<ViewMode>('flat');
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
		property: true,
		/**
		 * The field records inside the SELECTED cell, at the spots they were filed from.
		 *
		 * On by default like the three above it, and for the same reason: it draws
		 * nothing until a cell is picked, and once one is, "somebody stood here and
		 * photographed a receipt" is the most concrete thing this map can say about a
		 * street. Every other layer is a catalogue's account of the place; this one is
		 * somebody's afternoon.
		 */
		field: true
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
	/**
	 * The reader has stepped inside the selected area's model, where the hour can be
	 * scrubbed.
	 *
	 * Held here rather than in the card that opens it, for two reasons. The model covers
	 * the whole screen, and on a compact layout the card lives inside a dragged sheet,
	 * which is a positioning context a full-screen surface cannot escape. And the state
	 * belongs to the selection: a model of a catchment nobody has selected is a model of
	 * nothing, so it is cleared wherever the selection is.
	 */
	zoomed = $state(false);
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

	/**
	 * The field records: what surveyors wrote down while standing in a catchment.
	 *
	 * 347 KB, and only ever needed once a cell is selected, so it is not in the page
	 * load. Fetched on the first selection and kept, exactly like the listings.
	 */
	fieldRecords = $state<FieldRecord[] | null>(null);
	/**
	 * The same records, indexed by the catchment they belong to.
	 *
	 * Built here rather than re-matched per selection, and NOT re-matched against the
	 * reader's walking radius the way the listings and the competitors are. Those are
	 * catalogues, and a catchment is whatever falls inside the radius you chose. These
	 * are individual records that get listed by name, each assigned exactly one cell at
	 * build time by `scripts/lib/home-cell.mjs`, and re-matching them would put the same
	 * receipt in five cards while the count above each list stayed right for none.
	 */
	fieldByCell = $derived.by(() => {
		const all = this.fieldRecords;
		if (!all) return null;
		const out = new Map<string, FieldRecord[]>();
		for (const r of all) {
			const list = out.get(r.cell);
			if (list) list.push(r);
			else out.set(r.cell, [r]);
		}
		return out;
	});
	/** The field file could not be read. Apart from `fieldRecords` for the same reason
	    `stopsFailed` is apart from `stops`: the counts on the card come from the grid
	    and survive this, only the records themselves are lost. */
	fieldFailed = $state(false);
	/**
	 * The businesses whose opening hours OpenStreetMap publishes, for the activity
	 * curve of a selected cell.
	 *
	 * Fetched on the first selection and kept, exactly like the property listings and
	 * for the same reason: it is not needed until a cell is open, and then it is needed
	 * for every cell after that.
	 *
	 * Not per category either. When a street wakes up is a fact about the street.
	 */
	openPlaces = $state<OpenPlace[] | null>(null);
	/** The hours file could not be read. Kept apart from `openPlaces` for the same
	    reason `listingsFailed` is kept apart from `listings`: how many businesses
	    around a cell publish readable hours comes from the grid and survives this, only
	    the curve is lost, and the panel can say so instead of waiting forever. */
	openPlacesFailed = $state(false);

	/** In-flight requests, so two callers asking for the same category share one fetch. */
	#inFlight = new Map<CategoryKey, Promise<void>>();
	#stopsJob: Promise<void> | null = null;
	#poiJobs = new Map<CategoryKey, Promise<void>>();
	#listingsJob: Promise<void> | null = null;
	#fieldJob: Promise<void> | null = null;
	#hoursJob: Promise<void> | null = null;

	constructor(base: HexBase[], meta?: GridMeta, wallet?: Wallet) {
		this.base = base;
		this.meta = meta ?? null;
		this.#wallet = wallet ?? null;
	}

	/**
	 * What the two metered actions are charged against.
	 *
	 * Optional, and the absence means unmetered. That is not a way round the meter: the
	 * app page will not render without an account, so the only callers that get here
	 * without one are the parts of this class exercised outside the app. Written as an
	 * absence rather than as a boolean so there is no `metered` flag anybody could set
	 * to false and turn the whole thing off.
	 */
	#wallet: Wallet | null;

	/**
	 * The meter that just refused, so the interface can say which and offer the way out.
	 *
	 * Held here rather than thrown, because neither refusal is an error: an account that
	 * has spent its week is working exactly as the tier it is on says it does. Cleared
	 * by the reader, and by the next thing that successfully spends.
	 */
	outOf = $state<MeterKey | null>(null);

	/**
	 * The session went away while the page stayed open.
	 *
	 * Separate from `outOf`, because it is a different sentence with a different way
	 * out: one is a balance and the other is a sign-in. Reported rather than acted on
	 * here, so nothing in this class navigates.
	 */
	signedOut = $state(false);

	/** The categories whose columns are loaded and therefore genuinely scoreable. */
	loaded = $derived(Object.keys(this.slices) as CategoryKey[]);

	/**
	 * WHICH FIGURE the heatmap is painting.
	 *
	 * An opportunity score needs a business type behind it, so before one is named
	 * there is none to paint. What can be painted is the trade standing around each
	 * cell: a count of every business in walking range whatever it sells, which is as
	 * real as any other column and belongs to no category at all.
	 *
	 * Two bases rather than an empty map, because "just show me the map" has to show
	 * something, and rather than one basis quietly standing for both, because the two
	 * answer different questions and the legend has to say which one is on screen.
	 */
	basis = $derived<'skor' | 'keramaian'>(this.categories.length ? 'skor' : 'keramaian');

	/**
	 * Are the active set's columns here yet — ALL of them?
	 *
	 * All, not any. Scoring a set of two with one half loaded would count the cafes and
	 * silently leave the bakeries out, and the map would look perfectly normal while
	 * being the answer to half the question.
	 */
	ready = $derived(this.categories.every((k) => Boolean(this.slices[k])));

	/** Is any of the active set still on its way, and did any of it fail? */
	sliceLoading = $derived(this.categories.some((k) => this.pending.includes(k)));
	sliceError = $derived(
		this.categories.map((k) => this.sliceErrors[k]).find((e) => e) ?? null
	);

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

			for (const k of keys) {
				const s = slices[k]!;
				// A null OSM count means this category has no OSM source at all. The key is
				// LEFT OUT rather than set to null, because the scoring engine reads a
				// missing key as "never fetched" — writing the key would make it read as a
				// fetched zero, i.e. no competitors, i.e. the best score on the map.
				if (s.osm[i] !== null) osm[k] = s.osm[i] as number;
				mapid[k] = s.mapid[i];
				covered[k] = s.covered[i];
			}
			return { ...h, osm, mapid, covered } as unknown as Hex;
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
		this.ready ? scoreAll(this.catchments, this.categories, this.weights) : []
	);

	/** Row by id — the map's hover handler needs this on every pointer move. */
	rowById = $derived(new Map(this.rows.map((r) => [r.id, r])));

	/**
	 * The single 0..1 the heatmap paints, per cell. Null means nothing may be painted.
	 *
	 * Here rather than in the map layer so there is one place that decides what a
	 * colour on this map MEANS. The layer used to read `score` directly, which was
	 * fine while a score was the only thing it could be showing and became a quiet
	 * lie the moment it was not: with no business type every score is null, and the
	 * layer would have drawn all 562 cells as unsurveyed.
	 */
	heatById = $derived(
		new Map(
			this.rows.map((r) => [
				r.id,
				this.basis === 'skor' ? r.score : r.covered ? r.demand : null
			])
		)
	);

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

	/* Coverage is a fact about the survey now, not about a flag rolled at build time. A
	   cell counts as covered when the ACTIVE source has read its city for the active
	   category, which is the same condition the engine refuses to score without. */
	coverage = $derived.by(() => {
		const rows = this.rows;
		// Only the pure-OSM reading covers the whole grid outright. The catalogue has not
		// read 100 cells, and "both" inherits OSM's reach for them rather than the gap.
		const everywhere = this.weights.source !== 'mapid';
		return {
			total: this.base.length,
			/* Cells the source in use has actually read, counted off the density column
			   because that is null exactly where a city was never surveyed. Read from the
			   base, so the greeting is right on the first frame rather than waiting for a
			   category. OSM covers the whole grid: it is one worldwide dataset, and what it
			   cannot do is per CATEGORY, which `covered` on the scored row says instead. */
			surveyed: everywhere
				? this.base.length
				: this.base.filter((c) => c.dens?.mapid !== null).length,
			/** Competitor total — needs the active category, so it is 0 until one is loaded. */
			poi: rows.reduce((a, r) => a + r.osm, 0),
			/**
			 * Cells the active source does not cover, so nothing can be read off them.
			 *
			 * Counted off `covered` and not off a null score. The two agreed while a score
			 * was the only thing the map could show; they stopped agreeing the moment the
			 * opening map had no business type, where every score is null and this would
			 * have reported the whole grid as unsurveyed.
			 */
			notCovered: rows.filter((r) => !r.covered).length,
			scored: rows.filter((r) => r.covered).length
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

	/**
	 * Fetch the columns for every type in the active set.
	 *
	 * In parallel, because none of them can be scored until all of them are here — the
	 * map stays on its previous colours either way, so waiting on the slowest is the
	 * cost of the answer rather than an extra one.
	 */
	async loadCategories(cats: readonly CategoryKey[] = this.categories): Promise<void> {
		await Promise.all(cats.map((k) => this.loadCategory(k)));
	}

	/** Load every category — what the per-format comparison in the detail panel needs. */
	async loadAllCategories(): Promise<void> {
		// The active set goes first and alone. Everything on screen is waiting on those;
		// letting the other eleven race them only makes them land later.
		await this.loadCategories();
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
	 * Load the field records, once.
	 *
	 * Failure is quiet in the same way `loadStops` is: every count the card leads with
	 * was written onto the grid by `join-missions.mjs` and is already here. Losing this
	 * file costs the reader the RECORDS — the receipt, the price, the photograph — and
	 * nothing else, and the panel says so rather than waiting on a request that is never
	 * coming back.
	 */
	loadField(): Promise<void> {
		if (this.fieldRecords || this.#fieldJob) return this.#fieldJob ?? Promise.resolve();
		this.#fieldJob = (async () => {
			try {
				const res = await fetch(`${base}/data/field.json`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				this.fieldRecords = parseField(await res.json());
				this.fieldFailed = false;
			} catch {
				this.fieldFailed = true;
			} finally {
				// Cleared either way, so a failure can be retried by the next selection
				// rather than every later one being answered by the request that failed.
				this.#fieldJob = null;
			}
		})();
		return this.#fieldJob;
	}

	/**
	 * Load the businesses' opening hours, once.
	 *
	 * Failure is quiet in the same way `loadListings` is. How many businesses stand
	 * around the cell, how many of them publish hours and how many of those could be
	 * read all come from the grid, which is already here. Losing this file costs the
	 * reader the CURVE and nothing else, and the panel says so rather than waiting on a
	 * request that is never coming back.
	 */
	loadHours(): Promise<void> {
		if (this.openPlaces || this.#hoursJob) return this.#hoursJob ?? Promise.resolve();
		this.#hoursJob = (async () => {
			try {
				const res = await fetch(`${base}/data/hours.json`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				this.openPlaces = parseHours(await res.json());
				this.openPlacesFailed = false;
			} catch {
				this.openPlacesFailed = true;
			} finally {
				// Cleared either way, so a failure can be retried by the next selection
				// rather than every later one being answered by the request that failed.
				this.#hoursJob = null;
			}
		})();
		return this.#hoursJob;
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

	/**
	 * WHERE THE WALKING RANGE IS MEASURED FROM.
	 *
	 * The centre of the selected cell, until a place is open in place mode, and then
	 * the place itself.
	 *
	 * The two pivots ask different questions and the range has to follow. In area mode
	 * the reader picked 800 m of city, so everything in reach of its centre is what
	 * they are looking at. In place mode they picked a shopfront, and a ring drawn
	 * around a cell centre 200 m up the road answers a question nobody asked: what a
	 * tenant walks is measured from their own front door.
	 *
	 * ONE PLACE DECIDES IT, because the ring on the map, the two fans drawn under it
	 * and the four sets those fans are drawn from all have to agree. As four separate
	 * reads of `selectedCell`, moving three of them would have put a circle on screen
	 * with lines reaching out past it.
	 *
	 * What this does NOT move is anything the grid measured at build time: the
	 * opportunity score, how busy a cell is, the competitor count that score was taken
	 * over, the access index, the median asking price and its rank. Every one of those
	 * was counted from the cell centre by the build scripts and has no doorway version
	 * to read, so they stay the catchment's and the copy beside them says so. Inventing
	 * a place-centred one would be interpolating a figure nobody measured, which is the
	 * one thing this product does not do.
	 */
	reach = $derived.by<{ lat: number; lon: number; place: boolean } | null>(() => {
		const unit = this.selectedUnit;
		if (unit) return { lat: unit.listing.lat, lon: unit.listing.lon, place: true };
		const cell = this.selectedCell;
		return cell ? { lat: cell.lat, lon: cell.lon, place: false } : null;
	});

	/** The range is measured from a place rather than from a cell centre. What every
	    surface pairing a grid figure with a captured set branches on. */
	reachIsPlace = $derived(this.reach?.place === true);

	/**
	 * The stops the selected CELL captures, nearest first.
	 *
	 * Kept apart from `selectedStops` for the score breakdown, which explains an access
	 * index the grid computed from the cell centre. A list of names measured from
	 * anywhere else cannot be the names of what those counts counted.
	 */
	cellStops = $derived.by(() => {
		const cell = this.selectedCell;
		if (!cell || !this.stops) return [];
		return capturedStops(cell, this.stops, this.weights.radius);
	});

	/** The stops within walking range of `reach`, nearest first. The very same list as
	    `cellStops` in area mode, so the common case pays for one pass and not two. */
	selectedStops = $derived.by(() => {
		const from = this.reach;
		if (!from || !this.stops) return [];
		if (!from.place) return this.cellStops;
		return capturedStops(from, this.stops, this.weights.radius);
	});

	/**
	 * The competitors within walking range of `reach`, nearest first.
	 *
	 * Empty on the OSM source, and that is the point: the positions ARE the MAPID
	 * dataset, so drawing them while an OSM count is on screen would show one source's
	 * competitors as though they were the other's. Nothing is drawn, and
	 * `poisUnavailable` below is what lets the interface say so instead of leaving the
	 * reader to wonder where the dots went.
	 *
	 * `RivalsPanel` already counts what this holds rather than the scored row's figure,
	 * and says so, which is why moving the centre costs nothing there: the panel was
	 * always a caption for the dots on the map.
	 */
	selectedPois = $derived.by(() => {
		const from = this.reach;
		// Positions exist only in the MAPID catalogue, so pure OSM draws nothing. Reading
		// both draws them: the dots are then a subset of what was counted rather than a
		// different source's shops, and `RivalsPanel` says as much beside them.
		if (!from || this.weights.source === 'osm') return [];
		/* Every type in the set, in one pool of dots — the same pool the engine counted
		   as this cell's rivals. Drawing only the first type's would put a count of
		   fourteen in the panel above a map showing nine. */
		const points = this.categories.flatMap((k) => this.pois[k] ?? []);
		if (!points.length) return [];
		return capturedCompetitors(from, points, this.weights.radius);
	});

	/** A cell is selected, but its competitors cannot be placed on the map. Either the
	    active source has no coordinates at all (OSM), or this category's file failed
	    to load. Both leave the count intact and only the positions missing. */
	poisUnavailable = $derived.by(() => {
		if (!this.selectedCell) return null;
		if (this.weights.source === 'osm') return 'source' as const;
		// One type's file failing is enough. The dots left on screen would be a subset of
		// the rivals the count beside them was taken over, and nothing would say so.
		if (this.categories.some((k) => this.poisFailed.includes(k))) return 'failed' as const;
		return null;
	});

	/**
	 * The property listings within walking range of `reach`, nearest first.
	 *
	 * In area mode this is the same distance test the join used, so these ARE the units
	 * the median asking price was taken over rather than a set that resembles them.
	 * Measured from a place they are what is on the market around that doorway, which
	 * is a different set from the one the median was read off, so `PropertyPanel` says
	 * which of the two each half of it is talking about.
	 *
	 * Empty for a cell whose city the catalogue has not been read for, which
	 * `selected.propCovered` is what tells apart from a cell where nothing is for sale.
	 */
	selectedListings = $derived.by(() => {
		const from = this.reach;
		if (!from || !this.listings) return [];
		return capturedListings(from, this.listings, this.weights.radius);
	});

	/**
	 * The field records belonging to the selected cell, nearest first.
	 *
	 * A lookup rather than a distance test. Membership was decided once, at build time,
	 * and these records keep it — see `domain/field`.
	 */
	selectedField = $derived.by(() => {
		const id = this.selectedId;
		if (!id || !this.fieldByCell) return [];
		return this.fieldByCell.get(id) ?? [];
	});

	/**
	 * The businesses with readable opening hours within walking range of `reach`.
	 *
	 * In area mode this is the same distance test `join-hours.mjs` used, so the curve
	 * drawn from these IS the count the grid printed above it. Measured from a place it
	 * is a different set, which is why the denominator every sentence about the curve
	 * quotes comes from `hoursReading` below rather than straight off the grid.
	 */
	selectedOpen = $derived.by(() => {
		const from = this.reach;
		if (!from || !this.openPlaces) return [];
		return capturedOpen(from, this.openPlaces, this.weights.radius);
	});

	/**
	 * What was counted about opening hours around `reach` — the figures every sentence
	 * about the curve is allowed to quote.
	 *
	 * In area mode `counted` is the grid's own reading and nothing has changed: how many
	 * businesses stand in range, how many published hours, how many of those could be
	 * read. Measured from a place the grid has no reading to give, so `readable` is
	 * counted off the very set the curve is drawn from and `counted` is null rather than
	 * the cell's borrowed and relabelled.
	 *
	 * Held here rather than in the three surfaces that draw the curve, because they all
	 * have to agree: the card's summary row, the panel and the model are one measurement
	 * looked at three ways.
	 */
	hoursReading = $derived.by(() => {
		const cell = this.selectedCell;
		if (!cell) return null;
		// No reading at all means a grid that has never been through `join-hours.mjs`.
		// That is a build state rather than a finding, and every caller draws nothing.
		const grid = readHours(cell, this.weights.radius);
		if (!grid) return null;
		return this.reachIsPlace
			? { readable: this.selectedOpen.length, counted: null }
			: { readable: grid.h, counted: grid };
	});

	/** The hours file is on its way and no curve can be drawn yet. Its own flag for the
	    same reason `listingsLoading` is: an empty capture reads the same whether the
	    file has not landed or has landed and holds nothing in range, and only one of
	    those is a finding. */
	hoursLoading = $derived.by(() => {
		if (!this.selectedCell || this.openPlacesFailed) return false;
		return this.openPlaces === null;
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

	/**
	 * Each unit's place in that list, by id.
	 *
	 * Held here rather than rebuilt by each surface that needs it, for the same reason
	 * `priceLadder` is: two of them do. The map colours every dot from it and the hover
	 * readout colours the figure it prints beside one, so as two separate expressions each
	 * would walk the whole ranked list again on every pointer move. One derived, read
	 * twice, is one pass.
	 */
	unitRanks = $derived(unitRanks(this.unitRows));

	/**
	 * Unit by id — the map's hover handler needs this on every pointer move.
	 *
	 * The counterpart of `rowById`, and here for the same reason it is: scanning 2,700
	 * units inside a `mousemove` is the mistake reading `rows` there used to be, paid per
	 * frame for what is a lookup.
	 */
	unitById = $derived(new Map(this.units.map((u) => [u.id, u])));

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
		this.zoomed = false;
		if (p === 'unit') {
			this.selectedId = null;
			void this.loadListings();
			void this.loadCategories();
		} else {
			this.selectedUnitId = null;
		}
	}

	/**
	 * Open one unit — and, with it, the catchment it stands in.
	 *
	 * `selectedId` follows deliberately. The unit card describes both halves, and the
	 * catchment half is drawn by the same panels the area card uses, every one of which
	 * reads the SELECTED CELL. Parameterising them to take an id instead would leave two
	 * ways of asking the same question, and the day they answered differently the card
	 * and the map would be describing different places.
	 *
	 * It is what the map wants too: the home cell is outlined, its competitors and its
	 * stations are drawn, and the reader can see the catchment the figures come from
	 * rather than being told its name.
	 */
	selectUnit(id: string | null) {
		// Charged on exactly the rule the catchment side is charged on, because it is the
		// same reading: everything the card draws about the cell underneath a unit is what
		// the area card draws, read from the same place at the same cost.
		const charge = Boolean(id) && id !== this.selectedUnitId;
		if (charge && !this.#takeReading()) return;

		this.selectedUnitId = id;
		const unit = id ? this.units.find((u) => u.id === id) : null;
		this.selectedId = unit?.cellId ?? null;
		this.zoomed = false;
		if (id) {
			if (charge) this.#settleReading('unit', id);
			void this.loadCategories();
			void this.loadStops();
			void this.loadPoiSet();
			void this.loadHours();
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

	/** The field records are on their way. The counts on the card are already here, so
	    this only gates the records themselves. */
	fieldLoading = $derived.by(() => {
		if (!this.selectedCell || this.fieldFailed) return false;
		return this.fieldRecords === null;
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
		return this.categories.some((k) => !this.pois[k]);
	});

	/** Turn the heatmap on, fetching the active set's columns if they are not here yet. */
	showHeatmap(): void {
		this.layers.score = true;
		void this.loadCategories();
	}

	/**
	 * One reading, taken off the account, before anything opens.
	 *
	 * The browser's own answer, so the card opens on the same frame the hexagon was
	 * clicked. Opening an area already waits on its points, its listings and its
	 * timetables and draws each as it lands, and a round trip in front of the card
	 * itself would be the one part of that the reader waits through with nothing on
	 * screen.
	 */
	#takeReading(): boolean {
		if (!this.#wallet) return true;
		if (!this.#wallet.take('analysis')) {
			this.outOf = 'analysis';
			return false;
		}
		this.outOf = null;
		return true;
	}

	/**
	 * The same reading, settled with the server, which is the one that counts.
	 *
	 * A refusal here can only be two tabs spending the same last credit, and the reading
	 * has to come back off the screen: leaving it open would be one reading given away
	 * every time somebody opens a second tab, which is the meter being wrong rather than
	 * generous.
	 *
	 * It only undoes what it paid for. A reader who has moved on to another place in the
	 * time the request took keeps what they are looking at now, because that one was
	 * charged for separately and settled on its own.
	 */
	#settleReading(kind: 'cell' | 'unit', id: string): void {
		if (!this.#wallet) return;
		void this.#wallet.settleAnalysis().then((kept) => {
			if (kept) return;
			if ((kind === 'cell' ? this.selectedId : this.selectedUnitId) !== id) return;
			this.outOf = 'analysis';
			this.selectedUnitId = null;
			this.selectedId = null;
			this.zoomed = false;
		});
	}

	select(id: string | null) {
		/* Closing costs nothing, and neither does reopening whatever is already open.
		   Two clicks on one hexagon are one reading of it, and a reader who taps twice
		   because the first one did not look like it registered must not pay twice for
		   finding that out. */
		const charge = Boolean(id) && id !== this.selectedId;
		if (charge && !this.#takeReading()) return;

		this.selectedId = id;
		// The model on screen is a model of this cell. Closing the card leaves nothing for
		// it to be of, and picking another cell would leave the reader inside a block they
		// did not ask to be standing in.
		this.zoomed = false;
		if (id) {
			if (charge) this.#settleReading('cell', id);
			// Picking a cell is a request for its figures, heatmap or no heatmap — the
			// area panel and Tapak's remark both read the scored row.
			void this.loadCategories();
			// …and for the stations it captures, which the same panel names and the map
			// draws. Both are cached after the first selection, so this is one cost paid
			// once rather than per cell.
			void this.loadStops();
			// …and for where its competitors actually stand, which the map draws beside
			// them. Cached per category, so switching back to a category already seen
			// costs nothing.
			void this.loadPoiSet();
			// …and for what is on the market in it. One file for every category, cached
			// after the first selection, so this too is a cost paid once.
			void this.loadListings();
			// …and for what somebody wrote down while standing in it. Cached the same way,
			// and most cells have nothing in it — which the card says, rather than
			// leaving a section that never fills.
			void this.loadField();
			// …and for when the businesses around it open their doors. One file for the
			// whole city, cached the same way.
			void this.loadHours();
		}
	}

	/** The competitor positions for every type in the set, fetched once each. */
	loadPoiSet(cats: readonly CategoryKey[] = this.categories): Promise<void[]> {
		return Promise.all(cats.map((k) => this.loadPois(k)));
	}

	/**
	 * Change which business types the map is scoring.
	 *
	 * An empty set is refused rather than accepted, and the reason is arithmetic: no
	 * types means no rivals to count, the engine reads no rivals as no competition, and
	 * no competition is the best score this map can award. A request to score nothing
	 * would light up the whole of Jakarta.
	 */
	setCategories(cats: readonly CategoryKey[]) {
		const next = orderCategories(cats);
		if (!next.length) return;
		if (next.length === this.categories.length && next.every((k, i) => k === this.categories[i])) {
			return;
		}
		this.categories = next;
		this.highlight = [];
		void this.loadCategories(next);
		// A cell is already open: its competitors are on the map and some of them belong
		// to a type being left behind. Fetched here rather than waiting for the next
		// selection, otherwise changing the set leaves the old dots on screen until the
		// user happens to click somewhere.
		if (this.selectedId) void this.loadPoiSet(next);
	}

	/** Score this one type and nothing else. */
	setCategory(cat: CategoryKey) {
		this.setCategories([cat]);
	}

	/**
	 * Change the walking radius every catchment is measured over.
	 *
	 * Snapped to a stop the data actually holds a reading for. The competitor counts
	 * scale by area at any radius, but a median asking price does not — `join-property`
	 * computes one per stop, so a radius between two of them has no price to show.
	 *
	 * The unit pivot re-homes on the way through, because which cell a unit belongs to is
	 * "the nearest centre within the radius" and the radius just moved. That fall-out is
	 * why this is a method rather than a field somebody sets.
	 */
	setRadius(radius: number) {
		const snapped = snapRadius(radius);
		if (snapped === this.weights.radius) return;
		this.weights.radius = snapped;
		// A unit outside the new radius has no home cell any more, so an id selected under
		// the old one can point at a row that no longer exists — and one still in range may
		// have been re-homed onto a different cell, which is the one the card must describe.
		if (this.pivot === 'unit' && this.selectedUnitId) {
			const still = this.units.find((u) => u.id === this.selectedUnitId);
			if (still) this.selectedId = still.cellId;
			else {
				this.selectedUnitId = null;
				this.selectedId = null;
			}
		}
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
		if (source !== 'osm' && this.selectedId) void this.loadPoiSet();
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

	/**
	 * Ask the recommendation engine (the server endpoint), and watch it work.
	 *
	 * The reply is read as a stream, so `watch` hears which stage is running and, on a
	 * casual turn, the model's sentence as it is written. All of that is optional: an
	 * `ask` with no watcher behaves exactly as it did when the endpoint replied in one
	 * piece, because the answer event carries the same object the JSON reply carried.
	 *
	 * What is NOT streamed is every figure on the screen. The answer arrives whole, and
	 * the map is repainted from it in one move — see `#apply`.
	 */
	async ask(
		question: string,
		/**
		 * The turns before this one, oldest first.
		 *
		 * Part of the question rather than part of watching it answered: a follow-up does
		 * not carry its own subject, and reading one means reading what it points back
		 * at. The map layer keeps no thread of its own and must not start. The
		 * conversation belongs to `Tapak`, so whoever holds it hands it over here.
		 */
		history: readonly ChatTurn[] = [],
		watch?: AskWatcher
	) {
		/* Refused here rather than after ninety seconds of streaming. The endpoint is the
		   one that really spends the credit and the one that would refuse it, but the
		   browser already knows the balance, and a wait that runs its full length and then
		   says the question was never affordable is the worst reading of the same fact. */
		if (this.#wallet && !this.#wallet.take('ai')) {
			this.outOf = 'ai';
			return;
		}
		this.outOf = null;
		this.aiLoading = true;
		this.aiError = null;
		try {
			const res = await fetch('/api/ai/query', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
				body: JSON.stringify({
					question,
					kategori: this.categories,
					weights: this.weights,
					lang: lang(),
					history,
					stream: true
				})
			});
			/* Two refusals that are not failures, and must not be reported as one. 402 is
			   the server's own count of the balance disagreeing with ours, which two tabs
			   asking at once can do. 401 is a session that expired between the page loading
			   and the question being asked. Both are answered by the notice over the map,
			   which says what happened and offers the way on, rather than by an error
			   bubble offering to try the same thing again. */
			if (res.status === 402) {
				this.outOf = 'ai';
				return;
			}
			if (res.status === 401) {
				this.signedOut = true;
				return;
			}
			if (!res.ok) throw new Error(`Gagal memproses pertanyaan (${res.status}).`);

			const data = await readEvents(res, (event) => {
				if (event.kind === 'stage') watch?.stage?.(event.stage);
				else if (event.kind === 'delta') watch?.delta?.(event.text);
				else if (event.kind === 'reset') watch?.reset?.();
			});
			await this.#apply(data);
		} catch (err) {
			this.aiError = err instanceof Error ? err.message : 'Terjadi kesalahan.';
		} finally {
			this.aiLoading = false;
			/* What the question actually cost is only knowable from the server: the credit
			   is spent inside the answer, so it cannot ride back on an event without
			   putting a figure in a stream that carries none. One small request once the
			   turn is over, against a wait that can run to ninety seconds. */
			void this.#wallet?.refresh();
		}
	}

	/**
	 * What an answer does to the map, applied in one move once the whole answer is in
	 * hand.
	 *
	 * Nothing here is allowed to happen a piece at a time. Every one of these changes
	 * invalidates the ones around it — a highlight belongs to a category set, a unit
	 * list belongs to a radius — so applying them as they arrived would leave the map
	 * marking places the finished answer never named.
	 */
	async #apply(data: AiAnswer) {
		this.ai = data;
		// Small talk leaves the map exactly as it was. Nothing was computed, so there
		// is nothing to show — and `query` on a chat turn is only the fallback parser's
		// reading of the sentence, which will happily find "warteg" inside "makasih,
		// warteg emang enak" and swing the whole map to a category the reader never
		// asked to see. A greeting must not repaint anything.
		if (data.chat) return;

		/* Tapak drives the two controls in `MapControls` as well as the map underneath
		   them. That is the whole reason the pivot switch was taken back out of this
		   panel: the conversation is not one of the modes, it is the thing that can
		   change them, so a control that replaced the conversation would take away the
		   thing operating it.

		   All three are applied BEFORE the highlight, and that order is load-bearing.
		   `setRadius` and `setPivot` both clear things the answer is about — a stale
		   unit selection, the previous highlight — so an answer that set the highlight
		   first would have it wiped by its own mode change and name places the map
		   never marked.

		   The radius goes first of the three. It decides which cell a unit belongs to,
		   so applying it after a pivot switch would build the whole unit list at the
		   old radius and immediately rebuild it at the new one. */
		this.setRadius(data.query.radius_m);
		// Absent means the question said nothing about the shape of the answer, and the
		// mode the reader had is left exactly as it was.
		if (data.query.pivot) this.setPivot(data.query.pivot);
		if (data.query.pivot === 'unit' && data.query.ukuran_unit) {
			this.unitSort = data.query.ukuran_unit;
			// `urut_unit` was resolved against the unit registry by whichever layer
			// understood the question. Falling back to the measure's own "best" here is
			// what an older query object gets, and it is the same answer the sort chips
			// give on a first press.
			this.unitOrder =
				data.query.urut_unit ?? UNIT_METRIC_MAP[data.query.ukuran_unit].best;
		}
		/* THE ANSWER DECIDES WHAT THE MAP IS SCORING. This is the line the whole
		   question box exists for: ask about cafes and bakeries together and the set
		   becomes those two, ask about laundries next and it becomes that one. The
		   reader never has to go and find a control to make the map agree with the
		   sentence above it.

		   Set through the setter rather than by assignment, so the competitor dots of
		   a type being left behind are refetched with everything else. Assigning the
		   field directly is what used to leave the previous category's dots sitting
		   under the new answer. */
		const answered = orderCategories(data.query.kategori);
		if (answered.length) this.setCategories(answered);
		/* The catchments the answer named, set AFTER the business types and not before.
		   `setCategories` clears the highlight on purpose — a set changed by hand
		   invalidates a ranking computed over the old one — so an answer that marked
		   the map first would have its own places wiped by its own change of set, and
		   name catchments the map never marked.

		   Kept even in unit mode, where they are not rows any more but still the places
		   the reply is about: `unitsFC` rings every unit standing in one, so the
		   sentence and the map agree about where to look. */
		this.highlight = data.highlight;
		// Tapak has just named places on the map, so the map has to be able to show
		// them: the answered set's columns are fetched and the heatmap comes on. This
		// is the path the heatmap is meant to arrive by — the user asked a question and
		// got an answer, rather than being handed a coloured map to interpret on their
		// own.
		await this.loadCategories();
		this.layers.score = true;
	}
}

export function setAppState(base: HexBase[], meta?: GridMeta, wallet?: Wallet): AppState {
	return setContext(KEY, new AppState(base, meta, wallet));
}

export function getAppState(): AppState {
	return getContext<AppState>(KEY);
}
