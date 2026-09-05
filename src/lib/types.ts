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
	| 'kunjungan'
	| 'jam_puncak'
	| 'nontunai'
	| 'listing'
	| 'harga_tempat'
	| 'unit_dipasarkan'
	| 'akses_transit'
	| 'simpul_transit';

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

/**
 * One station catchment with its raw indicators — exactly the shape the API
 * returns. The columns deliberately follow the MAPID mission datasets so the mock
 * source can be swapped for the MAPID API without touching the UI.
 */
/** Count of transit nodes within walking range, per mode. */
export interface TransitCounts {
	mrt: number;
	krl: number;
	lrt: number;
	brt: number;
}

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
	/** Number of Struk Go points in the catchment. */
	nStruk: number;
	/** Number of Menu Go points. */
	nMenu: number;
	/** Number of Properti Go points. */
	nProp: number;
	/** Not a single mission point in this catchment — the score is not interpolated. */
	nodata?: boolean;
	/** Share of cashless transactions (Struk Go, a proxy for spending power). */
	cashless?: number;
	/** 24-hour transaction profile (Struk Go, the `Waktu Transaksi` column). */
	hourly?: number[];
	/** Share of competitors in a busy state (Menu Go, the `Kondisi Pembeli` column). */
	busy?: PerCategory<number>;
	/** Commercial listings matching the category (Properti Go, `Kategori Properti` column). */
	listing?: PerCategory<number>;
	/** Normalised demand signal per category (Struk Go). */
	d?: PerCategory<number>;
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
export const CATEGORY_FIELDS = ['osm', 'mapid', 'covered', 'busy', 'listing', 'd'] as const;
export type CategoryField = (typeof CATEGORY_FIELDS)[number];

/**
 * A cell without its per-category columns — what the first request carries.
 *
 * Those six dictionaries are two thirds of the grid's weight (464 KB of 693 KB) and
 * they grow with every category added, while the reader looks at ONE category at a
 * time. So they travel separately, as `CategorySlice`, and the page starts with the
 * geometry and the per-cell figures that every category shares.
 */
export type HexBase = Omit<Hex, CategoryField>;

/**
 * One category's columns for the whole grid, aligned BY INDEX to the base array.
 *
 * Columnar rather than one object per cell: repeating six key names across 562 cells
 * costs more bytes than the numbers themselves. A slice is ~17 KB against the ~44 KB
 * the same figures take as objects.
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
	busy: number[];
	listing: number[];
	d: number[];
}

/**
 * The competitor data source. The two are deliberately kept apart and never mixed
 * into one score: OSM is volunteered and widespread but uneven, MAPID is surveyed
 * and uniform but covers only some cities so far. Merging them would produce a
 * number whose provenance nobody could account for.
 */
export type PoiSource = 'osm' | 'mapid';

/** Opportunity profile of a cell. These are internal keys — the label the reader
    sees comes from the `typology` dictionary in the locale files. */
export type Typology =
	| 'underserved'
	| 'competitive'
	| 'saturated'
	| 'busy-limited-space'
	/** No mission points in this cell. */
	| 'no-data'
	/** The active source has not surveyed this city — different from "no competitors". */
	| 'not-covered';

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
	nodata: boolean;
	/** 0..1 — null when there is no data yet. */
	score: number | null;
	demand: number | null;
	supply: number | null;
	/** Share of competitors that are busy, 0..1. */
	busy: number;
	/** The source used for the `osm` figure above. */
	source?: PoiSource;
	/** Whether this cell is covered by the active source; false → score is null. */
	covered?: boolean;
	/** Number of competitors at the active radius, according to the active source. */
	osm: number;
	/** Commercial listings matching the category at the active radius. */
	listings: number;
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
	/** Total mission data points (receipts + menus + properties). */
	nTot: number;
	nStruk: number;
	nMenu: number;
	nProp: number;
	cashless: number;
	hourly: number[];
	/** Peak transaction hour, -1 when there is no data. */
	peakHour: number;
	typology: Typology;
}

export type Intent = 'RANK' | 'FLAG_SATURATED' | 'COMPARE' | 'COVERAGE';

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
	kategori: CategoryKey;
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
	nodata: number;
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
}

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
	headline: string;
	items: Recommendation[];
	/** Ids of the catchments highlighted on the map. */
	highlight: string[];
	provenance: string[];
}
