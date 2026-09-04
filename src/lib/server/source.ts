import raw from '$lib/data/hexes.json';
import type { Hex } from '$lib/types';

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
	meta: {
		resolution: number;
		walkRadius: number;
		hexes: number;
		nodata: number;
		stops: number;
		stopsByMode: Record<string, number>;
		pois: number;
		poisByCategory: Record<string, number>;
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
		note: `${file.meta.stops} simpul transit (MRT ${file.meta.stopsByMode.mrt ?? 0}, KRL ${file.meta.stopsByMode.krl ?? 0}, LRT ${file.meta.stopsByMode.lrt ?? 0}, TransJakarta ${file.meta.stopsByMode.brt ?? 0}) dan ${file.meta.pois} POI pesaing OSM — OpenStreetMap via Overpass API (ODbL).`
	},
	mock: {
		label: 'MOCK',
		note: `Atribut misi MAPID (profil jam, Struk Go, Menu Go, Properti Go, metode pembayaran) masih CONTOH karena datasetnya belum publik. Dibangkitkan mengikuti akses transit dan kepadatan usaha yang nyata agar polanya masuk akal secara spasial, bukan acak buta. ${file.meta.nodata} dari ${file.meta.hexes} petak sengaja dibiarkan tanpa data.`
	},
	basemap: 'Produk final wajib memakai MAPID MAPS sebagai basemap.'
};
