/**
 * The figures a question can be asked about, and the measures of one unit on the market.
 *
 * Here rather than in `domain/metrics` and `domain/units` for the same reason
 * `CategoryKey` is here: this file is the leaf that every layer may import, and a key
 * union declared in the domain would make it import back upwards. It did, briefly, and
 * a type-only cycle is still a cycle — the module everything depends on had come to
 * depend on two modules that depend on it.
 *
 * The tables that give these keys meaning stay in the domain, declared as
 * `Record<Key, …>` so a key added here without a definition, or a definition added
 * there without a key, is a compile error rather than a gap nobody notices.
 */
export type MetricKey =
	| 'skor'
	| 'permintaan'
	| 'penawaran'
	| 'pesaing'
	| 'keramaian'
	| 'harga_tempat'
	| 'unit_dipasarkan'
	| 'akses_transit'
	| 'simpul_transit'
	| 'struk_dicatat'
	| 'sewa_ditawarkan';

/** The measures of one unit on the market — see `domain/units`. */
export type UnitMetricKey =
	| 'harga'
	| 'harga_m2'
	| 'luas_tanah'
	| 'luas_bangunan'
	| 'lantai'
	| 'skor_petak'
	| 'permintaan_petak'
	| 'pesaing_petak'
	| 'akses_petak'
	| 'jarak_pusat';

/** What a casual turn is allowed to be about — see `domain/chat`. */
export type ChatTopic = 'sapaan' | 'tentang' | 'usaha';

/**
 * One turn of the conversation, as the understanding layer is told about it.
 *
 * THE THREAD IS PART OF THE QUESTION. Without it every message was read from a blank
 * slate, and a follow-up is by definition a sentence that does not carry its own
 * subject: "kenapa yang itu", "yang kedua gimana", "kalau apotek". Each of those parsed
 * as a whole new question and came back as the previous answer all over again.
 *
 * `places` is the names an answer put on screen, and nothing else about it. NO FIGURES
 * TRAVEL BACK. A number that went out and came back would be a number the model has
 * seen written down and could repeat in a sentence of its own, which is the one thing
 * the fence in `domain/chat` exists to prevent. Names are what a follow-up points at,
 * and names are all that is needed to resolve one.
 */
export interface ChatTurn {
	who: 'user' | 'tapak';
	text: string;
	/** The catchments this turn named, when it was an answer that named any. */
	places?: string[];
}

/**
 * The parts a day is greeted in — see `domain/daypart`.
 *
 * Kept in Indonesian for the same reason `CategoryKey` is: these are the bands the
 * language the product is written in actually divides a day into, and there is no
 * English set of five that lines up with them. English copy words each band its own
 * way rather than renaming the band.
 */
export type DayPart = 'dini_hari' | 'pagi' | 'siang' | 'sore' | 'malam';

/**
 * One greeting, worded three ways.
 *
 * A tuple rather than an array so the two dictionaries cannot come to hold different
 * numbers of wordings: `domain/daypart` picks a position inside this, and a position
 * that exists in one language and not the other is a sentence that vanishes for half
 * the readers. `WORDINGS` there counts what this holds.
 */
export type Greetings = [string, string, string];

/** The commercial property families the catalogue publishes — see `domain/premises`. */
export type PropertyType =
	| 'ruko'
	| 'toko'
	| 'ruang'
	| 'rukan'
	| 'komersial'
	| 'kantor'
	| 'gedung'
	| 'gudang';

/** Keys of the business types SpotOn scores. Kept in Indonesian: they are the
    domain's own vocabulary and the values stored in the generated datasets. */
export type CategoryKey =
	| 'kopi'
	| 'minuman'
	| 'roti'
	| 'warteg'
	| 'cepatsaji'
	| 'mie'
	| 'seafood'
	| 'restoasing'
	| 'minimarket'
	| 'kelontong'
	| 'laundry'
	| 'bengkel'
	| 'apotek';

export type PerCategory<T> = Record<CategoryKey, T>;

/** Count of transit nodes within walking range, per mode. */
export interface TransitCounts {
	mrt: number;
	krl: number;
	lrt: number;
	brt: number;
}

/**
 * One cell of the grid, with every figure that was measured for it.
 *
 * EVERY FIELD HERE IS COUNTED FROM A PUBLISHED DATASET. Nothing is generated, and
 * nothing may be: the product's whole claim is that a reader can trace any number on
 * screen back to OpenStreetMap or to the MAPID catalogue. The invented mission
 * columns this shape used to carry (a 24-hour profile, receipt and menu tallies, a
 * cashless share, a per-category busy share, rental listings that do not exist) are
 * gone, along with the random flag that declared one cell in six dataless.
 */
export interface Hex {
	/** H3 cell index (resolution 8). */
	id: string;
	/** Name of the nearest named transit node; null if there is none. */
	name: string | null;
	lat: number;
	lon: number;
	/** The hexagon's boundary ring, [lon, lat] — computed once at build time. */
	boundary: [number, number][];
	/** Transit nodes within walking range (OSM, real). */
	transit: TransitCounts;
	/** Transit access 0..1 — a weighted count of modes, damped by a square root. */
	access: number;
	/** Number of competitor POIs per category within a 800 m radius (OSM/Overpass). */
	osm: PerCategory<number>;
	/**
	 * Every counted business in walking range, whatever its category, per source.
	 *
	 * This is the demand side of the score, and it is the same points as `osm` and
	 * `mapid` totalled rather than a second survey — a place ringed by trade is a place
	 * people already come to. The category being asked about is subtracted before it is
	 * read, so what remains is the OTHER trade around it and a street's own rivals never
	 * count as its footfall.
	 *
	 * `mapid` is null where that city was never surveyed, exactly as the counts are: a
	 * zero would call an unread city empty.
	 */
	dens: { osm: number; mapid: number | null };
	/** The administrative city this cell falls in (OSM admin_level=5 boundaries); null if outside. */
	city?: string | null;
	/** MAPID competitor counts per category; null means not yet covered. */
	mapid?: PerCategory<number | null>;
	/** Per category: has this city's MAPID dataset been imported. */
	covered?: PerCategory<boolean>;
	/**
	 * Commercial property on the market within walking range (MAPID premium catalogue).
	 *
	 * Absent, rather than zeroed, when this cell's city has not been read. See
	 * `propCovered`.
	 */
	prop?: PropertyStats;
	/** Has this cell's city been read from the property catalogue. */
	propCovered?: boolean;
	/**
	 * What surveyors actually recorded inside this catchment (MAPID Apps field surveys).
	 *
	 * ABSENT, NEVER ZEROED, where nobody went. 191 of the 562 cells carry one, and that
	 * ratio is why nothing in here reaches the score: a street somebody walked and a
	 * street nobody walked are not a high reading and a low one, and an engine given a
	 * zero cannot tell them apart.
	 */
	field?: FieldStats;
	/**
	 * How many businesses in walking range publish opening hours anybody can read.
	 *
	 * The counting half of the activity signal, and a CATALOGUE figure rather than a
	 * field one: OpenStreetMap claims to cover the whole city, so a cell where nobody
	 * publishes hours is a finding about the city and not about where a surveyor walked.
	 * That is why this carries a denominator and `field` above deliberately does not.
	 *
	 * The WHEN lives in `static/data/hours.json` and is matched to a cell in the browser,
	 * exactly as the property listings are, because a week of 24 hours per cell per
	 * radius is 118,000 numbers and the panel needs one cell's worth.
	 *
	 * Absent means `join-hours.mjs` has not been run on this grid. That is not the same
	 * as a cell where nobody publishes hours, which is `h: 0` with an `n` beside it.
	 */
	hours?: HoursStats;
}

/**
 * What was recorded inside one catchment, by somebody who went there.
 *
 * A different KIND of figure from everything else on a cell. The competitor counts and
 * the property listings are catalogues: they claim to hold every cafe and every unit on
 * the market, and a count of zero from them is a finding. These are field records, and
 * they claim nothing of the sort — twelve receipts here and none next door says a
 * surveyor stood here, not that the street next door has no trade.
 *
 * So every name in this shape says RECORDED, and the interface repeats the word. The
 * counts are exact and the two derived figures need three readings behind them, below
 * which they are null rather than an average of one afternoon.
 */
export interface FieldStats {
	/** Receipts photographed here (Struk Go). */
	struk: number;
	/** Eateries surveyed here (Menu Go). */
	menu: number;
	/** Property records filed here (Properti Go). */
	properti: number;
	/** Community notes about this place. */
	catatan: number;
	/**
	 * Of the property records, the ones offered for RENT.
	 *
	 * The first rental figure this project has ever carried. The MAPID premium
	 * catalogue publishes none for Jakarta, which is why the score's cost of space is an
	 * asking price to buy and is called one everywhere it travels. These are a different
	 * survey with a different question on the form, and they say "Disewa" outright.
	 */
	sewa: number;
	/** Share of the receipts paid without cash, 0..1. Null below three readings. */
	nontunai: number | null;
	/** Median of what the eateries here charge on average, rupiah. Null below three
	    readings, and never cleaned: see `scripts/fetch-missions.mjs`. */
	harga: number | null;
}

/**
 * What is on the market around one cell, at both walking radii.
 *
 * THE PRICES ARE ASKING PRICES FOR SALE. There is no rent in the MAPID catalogue for
 * Jakarta, which `scripts/fetch-property.mjs` establishes by tallying the sale-or-rent
 * column across every property dataset published for the province, on every run. The
 * naming follows: `price`, never `rent`.
 *
 * Not per category. What a square metre of shopfront costs is a property of the place,
 * not of the business going into it, so this rides in the base payload rather than in
 * the per-category slices — one copy for all thirteen categories instead of thirteen
 * copies of the same figure.
 */
export interface PropertyStats {
	/** One reading per walking radius, keyed by it. `scripts/join-property.mjs` writes a
	    stop for every radius the interface can be set to. */
	r: Record<string, PropertyAtRadius>;
	/** How the listings within the widest radius break down by type. */
	by: Record<string, number>;
}

/** What is on the market inside one radius. */
export interface PropertyAtRadius {
	/** Every commercial listing in range, premises or not. */
	n: number;
	/** Of those, the ones a small business could occupy. */
	u: number;
	/**
	 * Median asking price per m² of those premises, in rupiah.
	 *
	 * `null` means not one unit in range published a price. Never 0: space that nobody
	 * priced and space that costs nothing are different claims.
	 *
	 * Computed per radius rather than rescaled from another. A count can be scaled by
	 * area, a median cannot — half a median is not the price of anything.
	 */
	p: number | null;
	/**
	 * How many priced premises that median was read from.
	 *
	 * Kept even where the median came back null, because it is what tells "nothing is
	 * listed here" apart from "two units are listed and two is too thin to read a price
	 * off". The join needs three before it writes one.
	 */
	q: number;
}

/**
 * What is open around one cell, at both walking radii.
 *
 * THIS IS NOT FOOTFALL. It counts doors, from the `opening_hours` tag in
 * OpenStreetMap: how many businesses in range say they are open, not how many people
 * walk through them. Google's popular times are built from phones the product cannot
 * see. The MAPID Apps field surveys carry receipts, which is the demand side of the same
 * hour, and not one of them carries a time of day — see `domain/field`. So this stays
 * the only half of the hour anybody has counted.
 *
 * Not per category. When a street wakes up is a property of the street, so this rides
 * in the base payload like the property figures do rather than in the per-category
 * slices.
 */
export interface HoursStats {
	/** One reading per walking radius, keyed by it — `scripts/join-hours.mjs` writes a
	    stop for every radius the interface can be set to. */
	r: Record<string, HoursAtRadius>;
}

/** What was counted inside one radius. */
export interface HoursAtRadius {
	/** Every business in range, whether or not it publishes hours. The denominator, and
	    the reason the panel can say how thin the reading is instead of implying the
	    curve covers the whole street. */
	n: number;
	/**
	 * Of those, the ones whose published hours could actually be read.
	 *
	 * Three facts are kept apart on purpose: `n - p` never published hours at all,
	 * `p - h` published them in a form the reader refuses to guess at (holidays,
	 * seasons, "sunset"), and `h` is what the curve is drawn from.
	 */
	h: number;
	/** Of those, how many published an `opening_hours` tag of any kind. */
	p: number;
}

/**
 * What is on the market around one cell, at both walking radii.
 *
 * THE PRICES ARE ASKING PRICES FOR SALE. There is no rent in the MAPID catalogue for
 * Jakarta, which `scripts/fetch-property.mjs` establishes by tallying the sale-or-rent
 * column across every property dataset published for the province, on every run. The
 * naming follows: `price`, never `rent`.
 *
 * Not per category. What a square metre of shopfront costs is a property of the place,
 * not of the business going into it, so this rides in the base payload rather than in
 * the per-category slices — one copy for all thirteen categories instead of thirteen
 * copies of the same figure.
 */
export interface PropertyStats {
	/** One reading per walking radius, keyed by it. `scripts/join-property.mjs` writes a
	    stop for every radius the interface can be set to. */
	r: Record<string, PropertyAtRadius>;
	/** How the listings within the widest radius break down by type. */
	by: Record<string, number>;
}

/** What is on the market inside one radius. */
export interface PropertyAtRadius {
	/** Every commercial listing in range, premises or not. */
	n: number;
	/** Of those, the ones a small business could occupy. */
	u: number;
	/**
	 * Median asking price per m² of those premises, in rupiah.
	 *
	 * `null` means not one unit in range published a price. Never 0: space that nobody
	 * priced and space that costs nothing are different claims.
	 *
	 * Computed per radius rather than rescaled from another. A count can be scaled by
	 * area, a median cannot — half a median is not the price of anything.
	 */
	p: number | null;
	/**
	 * How many priced premises that median was read from.
	 *
	 * Kept even where the median came back null, because it is what tells "nothing is
	 * listed here" apart from "two units are listed and two is too thin to read a price
	 * off". The join needs three before it writes one.
	 */
	q: number;
}

/** The `Hex` fields that hold one entry per business category. */
export const CATEGORY_FIELDS = ['osm', 'mapid', 'covered'] as const;
export type CategoryField = (typeof CATEGORY_FIELDS)[number];

/**
 * A cell without its per-category columns — what the first request carries.
 *
 * Those dictionaries grow with every category added, while the reader looks at ONE
 * category at a time. So they travel separately, as `CategorySlice`, and the page
 * starts with the geometry and the per-cell figures that every category shares.
 */
export type HexBase = Omit<Hex, CategoryField>;

/**
 * One category's columns for the whole grid, aligned BY INDEX to the base array.
 *
 * Columnar rather than one object per cell: repeating the key names across 562 cells
 * costs more bytes than the numbers themselves.
 *
 * `n` exists to be checked. The alignment is positional, so a slice served by a
 * different build than the base would silently attach every figure to the wrong
 * cell — a map that looks perfectly normal and is wrong everywhere. The client
 * refuses a slice whose length does not match rather than render that.
 */
export interface CategorySlice {
	cat: CategoryKey;
	/** Number of cells — must equal the base array's length. */
	n: number;
	/** Competitor counts (OSM). `null` = this category has no OSM source at all. */
	osm: (number | null)[];
	/** Competitor counts (MAPID). `null` = this city has not been surveyed. */
	mapid: (number | null)[];
	covered: boolean[];
}

/**
 * Which survey the competitor counts are read from.
 *
 * `both` is the default and it does NOT add the two together. They are two surveys of
 * the same city, not two halves of one: 1,569 cafes in OpenStreetMap and 4,753 in the
 * MAPID catalogue are mostly the SAME cafes counted twice, and there is no shared id
 * to match them on. Added, a street with eight coffee shops would be reported as
 * having fourteen, and the competition side of every score would be inflated by an
 * amount nobody could account for.
 *
 * What `both` does instead is read each cell from whichever survey actually reached
 * it, and where both did, from the one that found more. Nothing is ever counted twice,
 * every figure still comes from a single named survey, and the result is a floor
 * rather than a guess: at least this many, because somebody counted them.
 *
 * The two are still selectable on their own, which is the other half of why they are
 * not merged into one number — a reader comparing the surveys has to be able to see
 * each of them as it is.
 */
export type PoiSource = 'osm' | 'mapid' | 'both';

/** Opportunity profile of a cell. These are internal keys — the label the reader
    sees comes from the `typology` dictionary in the locale files. */
export type Typology =
	| 'underserved'
	| 'competitive'
	| 'saturated'
	/** Trade all around it, and not one unit of premises on the market. */
	| 'busy-limited-space'
	/** The active source has not surveyed this city — different from "no competitors". */
	| 'not-covered'
	/**
	 * No business type has been named yet, so there is no opportunity to profile.
	 *
	 * Kept apart from `not-covered` because the two are opposite kinds of silence. That
	 * one is a gap in the survey and this one is a question nobody has asked: the cell
	 * has been counted perfectly well, and what is missing is the business type to
	 * count it FOR.
	 */
	| 'no-type';

/** Weights & gates the user can set directly in the interface. */
export interface Weights {
	/** Demand weight, 0..1. */
	wd: number;
	/** Competition weight, 0..1. */
	ws: number;
	/** Require commercial space to actually be listed. */
	gate: boolean;
	/** Catchment radius in metres. */
	radius: number;
	/** The competitor-count source currently in use. */
	source: PoiSource;
}

/** The scoring result for one catchment and one business category. */
export interface ScoredHex {
	id: string;
	/** Always filled in: the nearest transit node's name, or a cell marker if there is none. */
	name: string;
	lat: number;
	lon: number;
	boundary: [number, number][];
	transit: TransitCounts;
	/** Transit access 0..1 (OSM, real) — a multiplier on the final score. */
	access: number;
	/** 0..1 — null when the active source has not surveyed this city. */
	score: number | null;
	/**
	 * How much trade there is around this cell OTHER than the category asked about,
	 * 0..1 against the busiest cell on the grid. Null when uncovered.
	 */
	demand: number | null;
	supply: number | null;
	/** Businesses of every kind in range, the count `demand` is scaled from. */
	density: number;
	/** The source used for the `osm` figure above. */
	source?: PoiSource;
	/** Whether this cell is covered by the active source; false → score is null. */
	covered?: boolean;
	/** Number of competitors at the active radius, according to the active source. */
	osm: number;
	/**
	 * Median ASKING PRICE FOR SALE per m² of premises within the active radius, rupiah.
	 * Null when nothing in range published one. Never a rent — MAPID publishes none.
	 */
	price: number | null;
	/** Where that price ranks on the grid, 0 cheapest to 1 dearest. Null when there is
	    no price, or too few across the grid to rank against. */
	priceLevel: number | null;
	/** The multiplier the cost of space applied to this score. 1 when unpriced. */
	costFactor: number;
	/** Premises on the market within the active radius. */
	units: number;
	/** Has this cell's city been read from the property catalogue at all. */
	propCovered: boolean;
	/** What surveyors recorded here, or null where nobody went. Rides along the row
	    untouched by the arithmetic: it is evidence beside the score, not a term in it. */
	field: FieldStats | null;
	typology: Typology;
}

/**
 * The shapes a question can have.
 *
 * `EXPLAIN` is the one that is not about a list. Every other intent answers "which
 * places", and a reader who has just been handed five of them asks the obvious next
 * thing: why that one. Answered without it, "kenapa Setiabudi Astra" parsed as a fresh
 * ranking and came back as the very same five names, which reads as a guide that is
 * not listening.
 */
export type Intent = 'RANK' | 'FLAG_SATURATED' | 'COMPARE' | 'COVERAGE' | 'EXPLAIN';

/**
 * The structured query a question parses into — shown verbatim so it can be
 * audited.
 *
 * The field names stay in Indonesian: this object is both the LLM tool schema and
 * the documented API contract (intent, metrik, kategori, radius, filter) described
 * in the proposal.
 */
export interface StructuredQuery {
	intent: Intent;
	metrik: string;
	/**
	 * The business type — or types — the question was about.
	 *
	 * A LIST, and that is a change in the contract rather than a widening of it. A
	 * question can name more than one ("kedai kopi dan toko roti"), and answering it by
	 * keeping only the first quietly threw half the question away: the map coloured
	 * itself for cafes while the sentence above it claimed to have considered bakeries
	 * too. One name is a list of one, so nothing about a single-type question changes.
	 *
	 * Never empty. A question naming no type at all is answered for whatever the reader
	 * already had in force, which is what `fallback` carries in.
	 */
	kategori: CategoryKey[];
	/**
	 * The walking radius the answer was computed over.
	 *
	 * Was always a copy of whatever the reader had set, i.e. an output. It is now an
	 * input too: a question that names a distance is answered at that distance, and the
	 * map follows so the figures on screen are the figures in the reply. Snapped to a
	 * stop the property data actually holds — see `domain/weights`.
	 */
	radius_m: number;
	/**
	 * What the answer is a list OF: catchments, or the units standing in them.
	 *
	 * Optional, and absent means "leave the mode alone". That is the important half:
	 * most questions say nothing about the shape of the answer, and a query object that
	 * always carried a pivot would flip the map back to catchments on every unrelated
	 * question the reader asked while looking at units.
	 */
	pivot?: 'cell' | 'unit';
	/**
	 * Which figure a list of UNITS is sorted by — the unit pivot's counterpart to
	 * `ukuran`. Kept apart from it because the two registries measure different things:
	 * a unit has an asking price and a floor count, a catchment has neither.
	 */
	ukuran_unit?: UnitMetricKey;
	/**
	 * Which way that list of units runs.
	 *
	 * Its own field rather than a second reading of `urut`, which is resolved against the
	 * CATCHMENT measure. The two registries disagree about which end is "best" often
	 * enough for the reuse to be wrong quietly: `pesaing` counts rivals and wants the
	 * fewest first, `luas_bangunan` measures floor area and wants the largest, and a
	 * direction settled for one applied to the other silently answers backwards.
	 */
	urut_unit?: 'asc' | 'desc';
	/**
	 * WHICH figure the question is about, as a key from `domain/metrics`.
	 *
	 * The intent is the shape of the question — rank these, compare those — and this is
	 * the measure it is about. Kept apart because they vary independently: "where is
	 * busiest", "where is space cheapest" and "where should I open" are all rankings,
	 * and answering the first two with the third is how "how busy is it here" used to
	 * come back as an opportunity score.
	 *
	 * Absent on an older query object, which is read as the opportunity score.
	 */
	ukuran?: MetricKey;
	/**
	 * Filters, each naming a measure and a band rather than a threshold.
	 *
	 * `rendah` and `tinggi` are the bottom and top third of the grid on that measure,
	 * worked out from the data when the query runs. There is deliberately no way to
	 * express "under 30 million": a number the understanding layer supplied would be the
	 * only figure in the answer that came from nobody's data.
	 */
	filters?: Array<{ ukuran: MetricKey; arah: 'rendah' | 'tinggi' | 'ada' }>;
	/** The original filter block. Kept because it is a published API shape, and still
	    written alongside `filters` for the cases it can express. */
	filter?: {
		ruang_sewa_tersedia?: boolean;
		tier_harga?: 'rendah' | 'menengah' | 'tinggi';
		dalam_catchment_transit?: string;
	};
	target?: string[];
	urut: 'asc' | 'desc';
	limit: number;
}

/** One recommendation row: the claim + its supporting figures + the N behind them. */
export interface Recommendation {
	id: string;
	name: string;
	/** The ranked value (score for RANK, supply for FLAG_SATURATED). */
	value: number | null;
	/**
	 * The figure the question was actually about, when it was not the score.
	 *
	 * Carried separately from `value` so a list can lead with the measure that was
	 * asked for while the score stays available beside it. Null for a question that was
	 * about the score, where the two would be the same number printed twice.
	 */
	measure?: { ukuran: MetricKey; value: number; text: string } | null;
	why: string;
	evidence: string;
}

/**
 * What the grid file knows about itself.
 *
 * Written by `scripts/build-hexes.mjs`, so these counts can never drift from the
 * data they describe: rebuild the grid and every figure quoting them follows. The
 * interface reads them rather than repeating numbers in prose.
 */
export interface GridMeta {
	resolution: number;
	walkRadius: number;
	hexes: number;
	/** Transit nodes captured by the grid (OSM). */
	stops: number;
	stopsByMode: Record<string, number>;
	/** Competitor POIs counted from OpenStreetMap. */
	pois: number;
	poisByCategory: Record<string, number>;
	/** Present once the MAPID premium join has been run. */
	mapid?: {
		source: string;
		points: number;
		coveredCities?: Record<string, string[]>;
	};
	/** Present once the property join has been run. */
	property?: {
		source: string;
		listings: number;
		/** States in words that these are sale prices, not rents. Written by the fetch. */
		listingType: string;
		/** The sale-or-rent column tallied across every dataset read, so the claim above
		    is a measurement rather than a note somebody left behind. */
		tipe3: Record<string, number>;
		coveredCities: string[];
		cellsCovered: number;
		cellsPriced: number;
		/** Priced units a cell needs in range before it is given a price at all. */
		minPriced: number;
		/** Median asking price per m² across the grid, at 800 m. */
		medianPrice: number | null;
	};
	/** Present once the field surveys have been joined. */
	mission?: {
		source: string;
		/** Records read, across the grid's whole extent. */
		records: number;
		/** Of those, the ones that landed in a catchment. */
		placed: number;
		/** And the ones inside the extent but outside every catchment in it. */
		outside: number;
		/** Cells carrying at least one record. */
		cells: number;
		byMission: Record<string, number>;
		/** Property records offered for rent rather than for sale. */
		sewa: number;
		/** Readings a derived figure needs before it is written at all. */
		minReadings: number;
		/** Every closed vocabulary the records use, tallied on the run that read them. */
		vocab: Record<string, Record<string, number>>;
	};
	/** Present once the opening-hours join has been run. */
	hours?: {
		source: string;
		/** In words: which OSM tags were counted as a business, and which were not. */
		counted: string;
		/** In words: that this counts doors open and not people through them. */
		note: string;
		/** Businesses counted in the bounding box, whether or not they publish hours. */
		businesses: number;
		/** Of those, how many published an `opening_hours` tag of any kind. */
		published: number;
		/** Of those, how many could be read without guessing at them. */
		readable: number;
		/** Why the rest were refused, by reason — see `scripts/lib/hours.mjs`. */
		unreadable: Record<string, number>;
		/** Readable businesses a cell needs in range before a curve is drawn for it. */
		minReadable: number;
		cellsReadable: number;
		cellsThin: number;
		cellsEmpty: number;
		/** How long the average readable business is open, in hours a week. */
		openHoursPerWeek: number;
	};
}

/**
 * One catchment, taken apart into the figures its score is made of.
 *
 * WHY THIS IS STRUCTURED AND NOT A SENTENCE
 *
 * The engine already writes a `why` line for every row it ranks, and that line is API
 * output: Indonesian, fixed, a contract for anything reading the endpoint directly. What
 * the reader sees has to be rebuilt in their own language, which means the reply that
 * EXPLAINS a place needs its parts rather than its prose. Same rule as `measure` on a
 * recommendation, applied to a whole answer.
 *
 * Every field here is read off the scored row. Not one of them is written by the model,
 * which is what keeps "why is it good" a question about the data rather than an
 * invitation to be told a story.
 */
export interface Explanation {
	id: string;
	name: string;
	/** The walking radius every count below was measured at. */
	radius: number;
	/**
	 * False when the active source has never surveyed this cell's city. Everything that
	 * depends on counting competitors is then null, and the reply says so rather than
	 * reading an unread street as an empty one.
	 */
	covered: boolean;
	/** The opportunity score, 0..1. Null on an unsurveyed cell. */
	score: number | null;
	/** Trade around the cell other than the types asked about, 0..1. */
	demand: number | null;
	/** How tightly the same types are already packed in, 0..1. */
	supply: number | null;
	/** Businesses of every kind in range, the count `demand` is scaled from. */
	density: number;
	/** Competitors of the types asked about, from the active source. */
	rivals: number;
	/** Transit nodes in range, and the access index they add up to, 0..1. */
	stops: number;
	access: number;
	/** Premises on the market in range, and the median asking price per m² among them. */
	units: number;
	price: number | null;
	/**
	 * Where that price ranks on the grid, 0 cheapest to 1 dearest, and what the cost of
	 * space therefore multiplied the score by.
	 *
	 * Both, because the multiplier alone cannot be said out loud. It is below 1 for
	 * everything except the cheapest catchment on the grid, so a sentence reading it as
	 * "space here is expensive" would say that of a catchment in the cheapest tenth. The
	 * level is the figure the score panel already prints, and it is true at any point on
	 * the ladder. Null is nothing listed in range, or too few prices across the grid to
	 * rank against, and both of those are a multiplier of exactly 1.
	 */
	priceLevel: number | null;
	costFactor: number;
}

/* NOTHING FROM `field` IS IN HERE, and the omission is deliberate. The surveys are
   evidence that rides beside a score, never a term in it, so a shape whose whole job is
   to say what a score is MADE OF is the last place they belong: listed among the parts,
   "nobody has been down this street" would read as one of the reasons for the number. */

export interface AiAnswer {
	query: StructuredQuery;
	/** Who translated the question — the model, or the fallback rule parser. */
	parsedBy?: 'model' | 'rules';
	/** Filled in when the model admits it did not understand; there are no results to show. */
	notUnderstood?: string;
	/**
	 * Filled in when the turn was small talk rather than a question about the data.
	 *
	 * There are no results, no highlight and no map change — that is the point. `text`
	 * is the model's own sentence and has already passed `domain/chat`'s fence: two
	 * sentences at most and not one digit. Absent means the model wrote nothing usable
	 * or there was no model, and the interface says the canned line for the topic
	 * instead, in the reader's language.
	 */
	chat?: { topik: ChatTopic; text?: string };
	/**
	 * The question was understood and cannot be answered yet: it asks for a figure that
	 * needs a business type, and none has been named.
	 *
	 * Kept apart from `notUnderstood`, which it would otherwise be mistaken for. That
	 * one is a dead end — the data cannot answer this at all — and this one is a
	 * question waiting on one more word. The interface says so and offers the types,
	 * rather than apologising for a limitation that is not there.
	 */
	needsCategory?: true;
	/**
	 * Filled in when the question was "why that one" rather than "which ones".
	 *
	 * The place is still in `items` as a single row, so the map can be pointed at it the
	 * same way every other answer's places are. What this adds is the arithmetic behind
	 * it, taken apart, so the reply can say what the score is MADE OF instead of quoting
	 * it back. Absent on every other shape of answer.
	 */
	explain?: Explanation;
	headline: string;
	items: Recommendation[];
	/** Ids of the catchments highlighted on the map. */
	highlight: string[];
	provenance: string[];
}

/**
 * What the engine is doing right now, for a reader watching it happen.
 *
 * Two steps, because there are two, and they take very different amounts of time.
 * Understanding the question means a call out to a shared free model, which is where
 * nearly all of the wait is spent. Computing is the scoring engine on the grid, which
 * is fast.
 *
 * Saying which one is running is the honest version of a progress bar: nothing here is
 * a percentage of anything, so nothing pretends to be.
 */
export type AiStage =
	/** The question is with the model, and nothing has come back yet. */
	| 'reading'
	/**
	 * The model that had it did not answer, and the next one in the chain is taking
	 * over. This is where the longest silences are: a model that is full still takes
	 * its full attempt budget to say so.
	 */
	| 'retrying'
	/** The model has named the operation and is writing out its arguments. */
	| 'choosing'
	/** The operation is understood and the scoring engine is running it on the data. */
	| 'computing';

/**
 * One line of a streamed answer.
 *
 * The endpoint can answer in one piece, as it always has, or as a stream of these.
 * `answer` carries exactly the object the one-piece reply carries, so a consumer that
 * only wants the result can ignore everything before it and lose nothing.
 *
 * `delta` is the only place model-written text arrives in pieces, and it is a PREVIEW:
 * the sentence in the final `answer` is the authoritative one. That matters because the
 * casual reply has to clear `domain/chat`'s fence, and a reply that fails it is thrown
 * away rather than repaired. `reset` is what says so — everything streamed so far is
 * void, drop it.
 */
export type AiEvent =
	| { kind: 'stage'; stage: AiStage }
	| { kind: 'delta'; text: string }
	| { kind: 'reset' }
	| { kind: 'answer'; answer: AiAnswer }
	| { kind: 'error'; message: string };

/**
 * What a plan is called, and what an account is metered on.
 *
 * Here for the reason every other key union is here: this file is the leaf, and the
 * tables that give these keys meaning live in `domain/plans` as `Record<Key, …>`, so a
 * tier added on one side and not the other is a compile error rather than a silent gap.
 *
 * Three tiers, in the order they are offered. `free` is not a trial: it is a plan, it
 * never expires, and it refills every week like the other two.
 */
export type PlanKey = 'free' | 'personal' | 'premier';

/**
 * The two things an account is charged for.
 *
 * `ai` is one question put to the understanding layer. `analysis` is one area or one
 * unit opened by hand, which is the moment its competitors, its stations, its listings
 * and its opening hours are all read and put on the screen.
 *
 * Closing a card costs nothing, and reopening what is already open costs nothing
 * either. Two clicks on the same hexagon are one reading of it.
 */
export type MeterKey = 'ai' | 'analysis';

/** A one-off top-up, bought outright rather than subscribed to. See `domain/plans`. */
export type PackKey = 'ai_pack' | 'analysis_pack';

/**
 * What is left on one meter.
 *
 * Two pots, kept apart because they expire differently. `weekLeft` is this week's
 * allowance and whatever is unspent goes when the week turns. `extra` was bought
 * outright and stays until it is used.
 *
 * The weekly pot is spent first, and that order is the whole reason the two are stored
 * separately: spending the bought credits first would quietly throw away the ones the
 * subscription was about to replace anyway.
 */
export interface Balance {
	/** What the plan grants each week. Restated here so a reader is never shown a
	    remainder without the whole it is a remainder of. */
	week: number;
	/** Unspent from this week's allowance. */
	weekLeft: number;
	/** Bought outright, and it does not expire. */
	extra: number;
}

/**
 * One account's standing with the meters, at a moment.
 *
 * `weekStart` is the Monday the current allowance belongs to, as an epoch. Stored
 * rather than derived from a timestamp of the last spend, because an account that was
 * quiet for three weeks has to come back to one week's allowance, not to three.
 */
export interface Allowance {
	plan: PlanKey;
	/** Epoch of 00:00 on the Monday this allowance was granted, Jakarta time. */
	weekStart: number;
	meters: Record<MeterKey, Balance>;
}

/**
 * An account as the browser is allowed to see it.
 *
 * Deliberately not the stored record: no password hash, no session tokens, no Mongo
 * `_id`. What crosses to the client is who this is, what they are paying for, and what
 * is left.
 */
export interface AccountView {
	id: string;
	email: string;
	name: string;
	allowance: Allowance;
	/**
	 * There is no database behind this account.
	 *
	 * Said out loud rather than inferred, because the interface has to be able to tell
	 * the reader that nothing they do here is being kept. A demo account is real while
	 * the process lives and gone when it restarts, and a purchase on it moves no money.
	 */
	demo: boolean;
}
