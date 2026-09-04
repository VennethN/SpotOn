import { CATEGORY_KEYS } from './categories';
import type { Hex, CategoryKey, PoiSource, ScoredHex, Typology, Weights } from '$lib/types';

/**
 * Mesin Opportunity Score — hitungan saja.
 *
 * Pemformat angka (`pct`, jam, warna skala) dan penyusun kalimat dulu ikut
 * tinggal di sini, sehingga modul yang jadi rujukan kebenaran angka juga jadi
 * tempat orang mengubah tampilan. Sekarang keduanya terpisah: yang di sini
 * menghitung, `utils/format` menampilkan, `domain/narrate` menceritakan.
 */

/**
 * Radius 400 m ≈ seperempat luas radius 800 m. Hitungan POI & listing diskalakan
 * proporsional terhadap luas, bukan terhadap jari-jari.
 */
const areaFactor = (radius: number) => Math.pow(radius / 800, 2);

/**
 * Cacah pesaing menurut sumber aktif. `null` berarti BELUM TERCAKUP — kota ini
 * belum disurvei sumber tersebut.
 *
 * Membedakan null dari 0 adalah inti kejujuran mesin ini. Nol pesaing membuat
 * penawaran jatuh dan skor melambung; kalau ketiadaan data ikut dibaca sebagai
 * nol, justru wilayah yang paling sedikit diperiksa yang dinobatkan sebagai
 * peluang terbaik — persis kebalikan dari yang dicari pengguna.
 */
function poiCount(c: Hex, cat: CategoryKey, source: PoiSource, radius: number): number | null {
	if (c.nodata) return 0;
	if (source === 'mapid') {
		if (!c.covered?.[cat]) return null;
		return Math.round((c.mapid?.[cat] ?? 0) * areaFactor(radius));
	}
	// Sisi OSM juga bisa belum tercakup, dan dulu tidak bisa mengatakannya.
	//
	// `?? 0` yang lama diam-diam mengarang nol untuk kategori yang memang belum
	// pernah diambil dari OSM — dan itu bukan kemungkinan teoretis: menambah
	// kategori baru berarti `hexes.json` yang belum dibangun ulang tidak punya
	// kuncinya sama sekali. Akibatnya petak mana pun tampak tanpa pesaing, dan
	// justru kategori yang paling sedikit datanya yang menang di seluruh peta.
	//
	// Yang membedakan "nol" dari "belum diambil" adalah ADA TIDAKNYA KUNCI, bukan
	// nilainya: `build-hexes.mjs` menulis 0 secara eksplisit untuk tiap kategori
	// yang benar-benar diambil dan ternyata kosong.
	const n = c.osm?.[cat];
	return typeof n === 'number' ? Math.round(n * areaFactor(radius)) : null;
}

/** Skala normalisasi penawaran: catchment terpadat pada kategori ini. Petak yang
    belum tercakup tidak boleh ikut menentukan skala. */
function maxPoi(all: Hex[], cat: CategoryKey, source: PoiSource, radius: number): number {
	const counts = all
		.filter((c) => !c.nodata)
		.map((c) => poiCount(c, cat, source, radius))
		.filter((n): n is number => n !== null);
	return Math.max(1, ...counts);
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
		nProp: c.nProp
	};

	const count = poiCount(c, cat, w.source, w.radius);

	if (c.nodata) {
		return {
			...base,
			osm: 0,
			source: w.source,
			covered: false,
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

	// Belum tercakup: petak ini nyata dan berpenghuni, hanya saja sumber aktif
	// belum mensurvei kotanya. Menolak memberi skor adalah jawaban yang benar —
	// angka apa pun di sini akan mengarang persaingan yang belum pernah dilihat.
	if (count === null) {
		return {
			...base,
			osm: 0,
			source: w.source,
			covered: false,
			nodata: false,
			score: null,
			demand: c.d?.[cat] ?? 0,
			supply: null,
			ramai: c.ramai?.[cat] ?? 0,
			listings: 0,
			nTot: c.nStruk + c.nMenu + c.nProp,
			nontunai: c.nontunai ?? 0,
			jam: c.jam ?? [],
			puncak: -1,
			typology: 'Belum tercakup'
		};
	}

	const demand = c.d?.[cat] ?? 0;
	const ramai = c.ramai?.[cat] ?? 0;
	const supply = Math.min(1, (count / scale) * (0.55 + 0.9 * ramai));
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
		osm: count,
		source: w.source,
		covered: true,
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
	const scale = maxPoi(all, cat, w.source, w.radius);
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
		score: scoreOne(target, key, w, maxPoi(all, key, w.source, w.radius)).score
	}));
}
