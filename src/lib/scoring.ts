import { CATEGORY_KEYS } from './categories';
import type { Hex, CategoryKey, ScoredHex, Typology, Weights } from './types';

export const DEFAULT_WEIGHTS: Weights = { wd: 0.5, ws: 0.5, gate: true, radius: 800 };

/**
 * Radius 400 m ≈ seperempat luas radius 800 m. Hitungan POI & listing diskalakan
 * proporsional terhadap luas, bukan terhadap jari-jari.
 */
const areaFactor = (radius: number) => Math.pow(radius / 800, 2);

const osmCount = (c: Hex, cat: CategoryKey, radius: number) =>
	c.nodata ? 0 : Math.round((c.osm[cat] ?? 0) * areaFactor(radius));

/** Skala normalisasi penawaran: catchment terpadat pada kategori ini. */
function maxOsm(all: Hex[], cat: CategoryKey, radius: number): number {
	return Math.max(1, ...all.filter((c) => !c.nodata).map((c) => osmCount(c, cat, radius)));
}

function typologyOf(
	demand: number,
	supply: number,
	ramai: number,
	listings: number
): Typology {
	if (supply > 0.6 && ramai < 0.45) return 'Jenuh';
	if (demand > 0.55 && supply < 0.32) return 'Underserved';
	if (demand > 0.55 && listings === 0) return 'Ramai, ruang terbatas';
	return 'Kompetitif';
}

/**
 * Opportunity Score satu catchment untuk satu kategori.
 *
 *   Gap  = (wd·permintaan − ws·penawaran) / (wd + ws)
 *   Skor = clamp(Gap + 0.5) × gerbang_ruang_usaha
 *
 * Penawaran bukan sekadar cacah pesaing: kepadatan dibobot kondisi pembeli, jadi
 * pesaing yang ramai menekan peluang lebih keras daripada pesaing yang sepi.
 * Ketersediaan ruang usaha diperlakukan sebagai gerbang — tanpa ruang, peluang
 * tidak dapat dieksekusi, bukan sekadar lebih mahal.
 */
export function scoreOne(
	c: Hex,
	cat: CategoryKey,
	w: Weights,
	scale: number
): ScoredHex {
	const base = {
		id: c.id,
		// Semua petak saat ini punya simpul transit bernama dalam jangkauan, tapi
		// itu sifat data OSM hari ini — bukan jaminan. Penanda petak dipakai bila
		// suatu saat tidak ada, supaya antarmuka tidak perlu menangani null.
		name: c.name ?? `Petak ${c.id.slice(-6)}`,
		lat: c.lat,
		lon: c.lon,
		boundary: c.boundary,
		transit: c.transit,
		access: c.access,
		nStruk: c.nStruk,
		nMenu: c.nMenu,
		nProp: c.nProp,
		osm: osmCount(c, cat, w.radius)
	};

	if (c.nodata) {
		return {
			...base,
			nodata: true,
			score: null,
			demand: null,
			supply: null,
			ramai: 0,
			listings: 0,
			nTot: 0,
			nontunai: 0,
			jam: [],
			puncak: -1,
			typology: 'Belum terdata'
		};
	}

	const demand = c.d?.[cat] ?? 0;
	const ramai = c.ramai?.[cat] ?? 0;
	const supply = Math.min(1, (base.osm / scale) * (0.55 + 0.9 * ramai));
	const listings = Math.round((c.listing?.[cat] ?? 0) * areaFactor(w.radius));
	const gate = w.gate ? (listings > 0 ? 1 : 0.15) : 1;
	// Akses transit adalah data NYATA (OSM), tidak seperti indikator misi yang
	// masih contoh — jadi ia masuk sebagai pengali tersendiri, bukan dilebur ke
	// dalam permintaan. Dengan begitu petak yang dilayani MRT sekaligus
	// TransJakarta benar-benar bernilai lebih tinggi, dan sumbangannya bisa
	// ditelusuri terpisah dari angka yang masih contoh.
	const accessFactor = 0.6 + 0.4 * c.access;
	const gap = (w.wd * demand - w.ws * supply) / Math.max(0.0001, w.wd + w.ws);
	const score = Math.max(0, Math.min(1, gap + 0.5)) * gate * accessFactor;
	const jam = c.jam ?? [];
	const peak = jam.length ? jam.indexOf(Math.max(...jam)) : -1;

	return {
		...base,
		nodata: false,
		score,
		demand,
		supply,
		ramai,
		listings,
		nTot: c.nStruk + c.nMenu + c.nProp,
		nontunai: c.nontunai ?? 0,
		jam,
		puncak: peak,
		typology: typologyOf(demand, supply, ramai, listings)
	};
}

/** Skor seluruh catchment untuk satu kategori. */
export function scoreAll(all: Hex[], cat: CategoryKey, w: Weights): ScoredHex[] {
	const scale = maxOsm(all, cat, w.radius);
	return all.map((c) => scoreOne(c, cat, w, scale));
}

/** Skor satu catchment di seluruh kategori — untuk panel "peluang per jenis usaha". */
export function scoreAcrossCategories(
	all: Hex[],
	id: string,
	w: Weights
): Array<{ key: CategoryKey; score: number | null }> {
	const target = all.find((c) => c.id === id);
	if (!target) return [];
	return CATEGORY_KEYS.map((key) => ({
		key,
		score: scoreOne(target, key, w, maxOsm(all, key, w.radius)).score
	}));
}

/** Posisi 0..6 pada skala warna peluang. */
export function rampIndex(score: number): number {
	return Math.max(0, Math.min(6, Math.round(score * 6)));
}

export function rampVar(score: number | null): string {
	if (score === null) return 'var(--nodata)';
	return `var(--ramp-${rampIndex(score)})`;
}

/**
 * Frasa penawaran harus mencerminkan KEDUA pendorongnya (jumlah pesaing ×
 * keramaian). Kalau hanya keramaian yang dibaca, narasinya bisa berlawanan
 * dengan skornya sendiri.
 */
export function supplyPhrase(r: ScoredHex): string {
	const padat = (r.supply ?? 0) >= 0.6;
	const ramai = r.ramai >= 0.45;
	if (padat && ramai) return 'jumlahnya padat dan mayoritas ramai → penawaran kuat, celah pasar sempit';
	if (padat && !ramai)
		return 'jumlahnya padat tetapi mayoritas sepi/sedang → pasar penuh namun lesu, indikasi jenuh';
	if (!padat && ramai)
		return 'jumlahnya sedikit tetapi mayoritas ramai → permintaan tampak tertahan, ada ruang masuk';
	return 'jumlahnya sedikit dan mayoritas sepi/sedang → penawaran lemah';
}

export const pct = (v: number | null | undefined): string =>
	v === null || v === undefined ? '—' : String(Math.round(v * 100));

export const hh = (h: number): string => (h < 0 ? '—' : `${String(h).padStart(2, '0')}:00`);
