import raw from '$lib/data/hexes.json';
import { CATEGORY_FIELDS } from '$lib/types';
import type { CategoryKey, CategorySlice, GridMeta, Hex, HexBase } from '$lib/types';

/**
 * SpotOn's data source.
 *
 * Every endpoint reads through this module and never touches the data file
 * directly. Once the MAPID API is available to curated teams, this is the only
 * file that changes: `loadHexes()` becomes an API call (a spatial join of
 * Struk/Menu/Properti Go onto the H3 cells) while the `Hex` contract stays the
 * same, so the UI needs no changes at all.
 *
 * The grid itself is rebuilt by `scripts/build-hexes.mjs`.
 */

interface RawFile {
	meta: GridMeta & {
		real: string;
		mock: string;
		regenerate: string;
	};
	hexes: Hex[];
}

const file = raw as unknown as RawFile;
const hexes: Hex[] = file.hexes;

export function loadHexes(): Hex[] {
	return hexes;
}

export function findHex(id: string): Hex | undefined {
	return hexes.find((h) => h.id === id);
}

/**
 * The grid without its per-category columns.
 *
 * Built once at module load, not per request: the file never changes while the
 * process is alive, and rebuilding 562 objects on every request would spend more
 * time than the bytes saved.
 */
const base: HexBase[] = hexes.map((h) => {
	const out = { ...h } as Partial<Hex>;
	for (const f of CATEGORY_FIELDS) delete out[f];
	return out as HexBase;
});

/** The grid without its per-category columns — the payload the app starts with. */
export function loadBase(): HexBase[] {
	return base;
}

/**
 * One category's columns for every cell, in the same order as `loadBase()`.
 *
 * `osm` distinguishes null from 0 exactly as the stored file does. A category OSM
 * cannot count has no key on `hex.osm`, and that missing key is what the scoring
 * engine reads as "never fetched" — so it is carried across as an explicit null
 * rather than being flattened to a zero that would read as "no competitors here".
 */
const sliceCache = new Map<CategoryKey, CategorySlice>();

export function loadCategorySlice(cat: CategoryKey): CategorySlice {
	const cached = sliceCache.get(cat);
	if (cached) return cached;

	const slice: CategorySlice = {
		cat,
		n: hexes.length,
		osm: hexes.map((h) => h.osm?.[cat] ?? null),
		mapid: hexes.map((h) => h.mapid?.[cat] ?? null),
		covered: hexes.map((h) => h.covered?.[cat] ?? false),
		busy: hexes.map((h) => h.busy?.[cat] ?? 0),
		listing: hexes.map((h) => h.listing?.[cat] ?? 0),
		d: hexes.map((h) => h.d?.[cat] ?? 0)
	};
	sliceCache.set(cat, slice);
	return slice;
}

export const grid = file.meta;

/* The provenance notes below are part of the API response and are read by users,
   so they stay in Indonesian like the rest of the product copy. */
/** Provenance metadata sent with every response so data claims can be traced. */
export const provenance = {
	source: 'osm+mock',
	grid: {
		resolution: file.meta.resolution,
		walkRadius: file.meta.walkRadius,
		hexes: file.meta.hexes,
		note: `Kisi heksagon H3 resolusi ${file.meta.resolution} (sisi ±531 m). Dipakai menggantikan catchment per halte: halte TransJakarta berjarak 400–500 m sedangkan jangkauan jalan kaki 800 m, sehingga catchment per halte akan bertumpuk dan menghitung pembeli yang sama berulang kali. Pada kisi, tiap petak dihitung sekali dan akses transit menjadi sifat petak.`
	},
	real: {
		label: 'OSM',
		note: `${file.meta.stops} simpul transit (MRT ${file.meta.stopsByMode.mrt ?? 0}, KRL ${file.meta.stopsByMode.krl ?? 0}, LRT ${file.meta.stopsByMode.lrt ?? 0}, TransJakarta ${file.meta.stopsByMode.brt ?? 0}) dan ${file.meta.pois} POI pesaing OSM, dari OpenStreetMap via Overpass API (ODbL).`
	},
	/* Harga tempat usaha. Ditulis terpisah dari `mock` karena memang bukan contoh, dan
	   terpisah dari `real` karena sumbernya bukan OSM. Satu hal yang wajib ikut
	   disebut: yang ada di katalog cuma listing JUAL. `listingType` dan `tipe3` ditulis
	   oleh skripnya dari hitungan sungguhan, jadi klaim itu terikat ke datanya, bukan
	   ke ingatan siapa pun. */
	property: file.meta.property
		? {
				label: 'MAPID',
				note: `${file.meta.property.listings} listing properti komersial dari katalog Data Premium MAPID, ${file.meta.property.coveredCities.length} kota administrasi. ${file.meta.property.cellsPriced} dari ${file.meta.property.cellsCovered} petak tercakup punya harga yang terbaca. SEMUANYA LISTING JUAL: tidak ada satu pun listing sewa untuk Jakarta di katalog, jadi harga di peta adalah harga jual yang diminta penjual, bukan sewa bulanan.`,
				tipe3: file.meta.property.tipe3
			}
		: null,
	mock: {
		label: 'MOCK',
		note: `Atribut misi MAPID (profil jam, Struk Go, Menu Go, Properti Go, metode pembayaran) masih CONTOH karena datasetnya belum publik. Dibangkitkan mengikuti akses transit dan kepadatan usaha yang nyata agar polanya masuk akal secara spasial, bukan acak buta. ${file.meta.nodata} dari ${file.meta.hexes} petak sengaja dibiarkan tanpa data.`
	},
	basemap: 'Produk final wajib memakai MAPID MAPS sebagai basemap.'
};
