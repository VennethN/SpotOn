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
	radius_m: number;
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
	why: string;
	evidence: string;
}

export interface AiAnswer {
	query: StructuredQuery;
	/** Who translated the question — the model, or the fallback rule parser. */
	parsedBy?: 'model' | 'rules';
	/** Filled in when the model admits it did not understand; there are no results to show. */
	notUnderstood?: string;
	headline: string;
	items: Recommendation[];
	/** Ids of the catchments highlighted on the map. */
	highlight: string[];
	provenance: string[];
}
