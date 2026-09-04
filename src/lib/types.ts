/** Kunci jenis usaha yang dinilai SpotOn. */
export type CategoryKey = 'kopi' | 'warung' | 'minimarket' | 'laundry' | 'apotek';

export type PerCategory<T> = Record<CategoryKey, T>;

/**
 * Satu catchment stasiun beserta indikator mentahnya — bentuk persis yang
 * dikembalikan API. Kolomnya sengaja mengikuti dataset misi MAPID agar sumber
 * mock bisa ditukar dengan API MAPID tanpa menyentuh UI.
 */
/** Cacah simpul transit dalam jangkauan jalan kaki, per moda. */
export interface TransitCounts {
	mrt: number;
	krl: number;
	lrt: number;
	brt: number;
}

export interface Hex {
	/** Indeks sel H3 (resolusi 8). */
	id: string;
	/** Nama simpul transit terdekat yang bernama; null bila tidak ada. */
	name: string | null;
	lat: number;
	lon: number;
	/** Cincin batas heksagon, [lon, lat] — dihitung sekali saat build. */
	boundary: [number, number][];
	/** Simpul transit dalam jangkauan jalan kaki (OSM, nyata). */
	transit: TransitCounts;
	/** Akses transit 0..1 — jumlah berbobot moda, diredam akar. */
	access: number;
	/** Jumlah POI pesaing per kategori dalam radius 800 m (OSM/Overpass). */
	osm: PerCategory<number>;
	/** N titik Struk Go dalam catchment. */
	nStruk: number;
	/** N titik Menu Go. */
	nMenu: number;
	/** N titik Properti Go. */
	nProp: number;
	/** Tidak ada satu pun titik misi di catchment ini — skor tidak diinterpolasi. */
	nodata?: boolean;
	/** Rasio transaksi non-tunai (Struk Go, proksi daya beli). */
	nontunai?: number;
	/** Profil 24 jam transaksi (Struk Go, kolom `Waktu Transaksi`). */
	jam?: number[];
	/** Rasio pesaing berkondisi ramai (Menu Go, kolom `Kondisi Pembeli`). */
	ramai?: PerCategory<number>;
	/** Listing komersial cocok kategori (Properti Go, kolom `Kategori Properti`). */
	listing?: PerCategory<number>;
	/** Sinyal permintaan ter-normalisasi per kategori (Struk Go). */
	d?: PerCategory<number>;
}

export type Typology = 'Underserved' | 'Kompetitif' | 'Jenuh' | 'Ramai, ruang terbatas' | 'Belum terdata';

/** Bobot & gerbang yang bisa diatur pengguna langsung di antarmuka. */
export interface Weights {
	/** Bobot permintaan, 0..1. */
	wd: number;
	/** Bobot persaingan, 0..1. */
	ws: number;
	/** Wajibkan tersedianya listing ruang usaha. */
	gate: boolean;
	/** Radius catchment dalam meter. */
	radius: number;
}

/** Hasil skoring satu catchment untuk satu kategori usaha. */
export interface ScoredHex {
	id: string;
	/** Selalu terisi: nama simpul transit terdekat, atau penanda petak bila tak ada. */
	name: string;
	lat: number;
	lon: number;
	boundary: [number, number][];
	transit: TransitCounts;
	/** Akses transit 0..1 (OSM, nyata) — pengali pada skor akhir. */
	access: number;
	nodata: boolean;
	/** 0..1 — null bila belum terdata. */
	score: number | null;
	demand: number | null;
	supply: number | null;
	/** Rasio pesaing ramai, 0..1. */
	ramai: number;
	/** Jumlah pesaing OSM pada radius aktif. */
	osm: number;
	/** Listing ruang usaha cocok kategori pada radius aktif. */
	listings: number;
	/** Total titik data misi (struk + menu + properti). */
	nTot: number;
	nStruk: number;
	nMenu: number;
	nProp: number;
	nontunai: number;
	jam: number[];
	/** Jam puncak transaksi, -1 bila tidak ada data. */
	puncak: number;
	typology: Typology;
}

export type Intent = 'RANK' | 'FLAG_SATURATED' | 'COMPARE' | 'COVERAGE';

/** Query terstruktur hasil parsing — ditampilkan apa adanya agar dapat diaudit. */
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

/** Satu baris rekomendasi: klaim + angka pendukung + N di baliknya. */
export interface Recommendation {
	id: string;
	name: string;
	/** Nilai yang diperingkat (skor untuk RANK, penawaran untuk FLAG_SATURATED). */
	value: number | null;
	why: string;
	evidence: string;
}

export interface AiAnswer {
	query: StructuredQuery;
	/** Siapa yang menerjemahkan pertanyaannya — model, atau pengurai aturan cadangan. */
	parsedBy?: 'model' | 'aturan';
	/** Terisi bila model mengaku tidak paham; tidak ada hasil yang perlu ditampilkan. */
	notUnderstood?: string;
	headline: string;
	items: Recommendation[];
	/** Id catchment yang di-highlight di peta. */
	highlight: string[];
	provenance: string[];
}
