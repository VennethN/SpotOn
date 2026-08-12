import raw from '$lib/data/hexes.json';
import type { Hex } from '$lib/types';

/**
 * Sumber data SpotOn.
 *
 * Seluruh endpoint membaca lewat modul ini, tidak pernah menyentuh berkas data
 * secara langsung. Saat API MAPID tersedia bagi tim terkurasi, satu-satunya
 * berkas yang berubah adalah berkas ini: `loadHexes()` diganti menjadi
 * pemanggilan API (spatial join Struk/Menu/Properti Go ke petak H3) dan kontrak
 * `Hex` tetap sama, sehingga UI tidak perlu disentuh.
 *
 * Kisinya dibangun ulang oleh `scripts/build-hexes.mjs`.
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

/** Metadata provenans yang ikut dikirim di setiap respons agar klaim data dapat ditelusuri. */
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
		note: `${file.meta.stops} simpul transit (MRT ${file.meta.stopsByMode.mrt ?? 0}, KRL ${file.meta.stopsByMode.krl ?? 0}, LRT ${file.meta.stopsByMode.lrt ?? 0}, TransJakarta ${file.meta.stopsByMode.brt ?? 0}) dan ${file.meta.pois} POI pesaing sembilan kategori — OpenStreetMap via Overpass API (ODbL).`
	},
	mock: {
		label: 'MOCK',
		note: `Atribut misi MAPID (profil jam, Struk Go, Menu Go, Properti Go, metode pembayaran) masih CONTOH karena datasetnya belum publik. Dibangkitkan mengikuti akses transit dan kepadatan usaha yang nyata agar polanya masuk akal secara spasial, bukan acak buta. ${file.meta.nodata} dari ${file.meta.hexes} petak sengaja dibiarkan tanpa data.`
	},
	basemap: 'Produk final wajib memakai MAPID MAPS sebagai basemap.'
};
