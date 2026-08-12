/**
 * Membangun kisi heksagon Jakarta beserta atributnya.
 *
 *   node scripts/build-hexes.mjs
 *
 * Keluaran: `src/lib/data/hexes.json`.
 *
 * KENAPA HEKSAGON, BUKAN CATCHMENT PER HALTE
 *
 * Halte TransJakarta berjarak 400–500 m satu sama lain, sedangkan radius jalan
 * kaki yang dipakai 800 m. Kalau tiap halte diberi catchment sendiri, catchment
 * yang bersebelahan nyaris bertumpuk seluruhnya: pembeli yang sama dihitung tiga
 * empat kali, dan "5 kawasan teratas" hanya akan mengembalikan lima halte
 * berdampingan di koridor yang sama. Menambah 995 halte ke model lama justru
 * membuat skornya kurang bisa dipercaya, bukan lebih.
 *
 * Kisi heksagon menyelesaikannya: tiap petak dihitung sekali, tidak ada wilayah
 * yang tumpang tindih, dan akses transit menjadi *sifat* sebuah petak — sehingga
 * lokasi yang dilayani MRT sekaligus TransJakarta memang bernilai lebih tinggi
 * daripada yang hanya dilayani salah satunya.
 *
 * Resolusi 8 (sisi ±531 m, lebar ±1 km) dipilih supaya satu petak sebanding
 * dengan catchment 800 m yang dipakai sebelumnya, dan tetap terbaca pada peta
 * seluruh kota.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, sleep } from './lib/overpass.mjs';
import * as h3 from 'h3-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RES = 8;
/** Jangkauan jalan kaki yang dipakai untuk menghitung akses & pesaing. */
const WALK_M = 800;
const BBOX = '-6.42,106.65,-6.05,107.05';


/* ── jarak ────────────────────────────────────────────────────────────────── */

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function haversine(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const la1 = rad(aLat);
	const la2 = rad(bLat);
	const x =
		Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

/** Indeks spasial kasar: ember 0.01° (±1.1 km) — cukup untuk radius 800 m. */
function makeIndex(points) {
	const cell = 0.01;
	const map = new Map();
	for (const p of points) {
		const k = `${Math.floor(p.lat / cell)}|${Math.floor(p.lon / cell)}`;
		let arr = map.get(k);
		if (!arr) map.set(k, (arr = []));
		arr.push(p);
	}
	return {
		near(lat, lon, radius) {
			const out = [];
			const gy = Math.floor(lat / cell);
			const gx = Math.floor(lon / cell);
			const span = Math.ceil(radius / 1100) + 1;
			for (let dy = -span; dy <= span; dy++) {
				for (let dx = -span; dx <= span; dx++) {
					const arr = map.get(`${gy + dy}|${gx + dx}`);
					if (!arr) continue;
					for (const p of arr) {
						if (haversine(lat, lon, p.lat, p.lon) <= radius) out.push(p);
					}
				}
			}
			return out;
		}
	};
}

/* ── deterministik ────────────────────────────────────────────────────────── */

function hashSeed(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function mulberry32(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/* ── klasifikasi ──────────────────────────────────────────────────────────── */

function transitMode(tags = {}) {
	const op = (tags.operator ?? '') + ' ' + (tags.network ?? '');
	if (tags.station === 'subway' || tags.subway === 'yes') return 'mrt';
	if (tags.station === 'light_rail' || tags.light_rail === 'yes') return 'lrt';
	if (tags.railway === 'station' || tags.railway === 'halt') return 'krl';
	if (/transjakarta/i.test(op)) return 'brt';
	return null;
}

function poiCategory(tags = {}) {
	if (tags.amenity === 'cafe') return 'kopi';
	if (tags.amenity === 'ice_cream') return 'minuman';
	if (tags.shop === 'beverages' || tags.shop === 'bubble_tea') return 'minuman';
	if (tags.shop === 'bakery' || tags.shop === 'pastry') return 'roti';
	if (tags.amenity === 'fast_food') return 'cepatsaji';
	// `amenity=restaurant` sengaja TIDAK dipetakan. Sejak warung dipecah jadi
	// warteg/mie/seafood/resto asing, tidak ada satu kategori pun yang pantas
	// menampungnya, dan OSM tidak bisa memilahnya: cuma 48,9% gerai makan di
	// Jakarta Pusat punya tag `cuisine`, kosakatanya tidak mengenal warteg
	// maupun rumah makan Padang, dan `seafood` tidak muncul sama sekali di
	// sampel. Menebak-nebak dari `cuisine` akan menghasilkan cacah yang berat
	// sebelah, paling parah untuk warteg yang paling jarang ditandai. Jadi
	// keempat kategori itu dinyatakan tidak tercakup OSM lewat `osmTag: null`,
	// dan restoran biasa tidak dihitung ke mana-mana.
	if (tags.shop === 'convenience' || tags.shop === 'supermarket') return 'minimarket';
	// Sengaja dipisah dari minimarket: `convenience` di OSM dipakai untuk gerai
	// berjaringan, sedangkan `grocery`/`general`/`kiosk` untuk toko kelontong
	// milik warga. Bagi orang yang mau membuka usaha keduanya pesaing yang
	// berbeda, jadi menggabungkannya menyembunyikan justru yang dicari.
	if (tags.shop === 'grocery' || tags.shop === 'general' || tags.shop === 'kiosk')
		return 'kelontong';
	if (tags.shop === 'laundry' || tags.shop === 'dry_cleaning') return 'laundry';
	if (tags.shop === 'car_repair' || tags.shop === 'motorcycle_repair') return 'bengkel';
	if (tags.amenity === 'pharmacy') return 'apotek';
	return null;
}

/**
 * POI diambil beberapa kueri, bukan satu.
 *
 * Waktu masih lima kategori, delapan nilai tag muat dalam satu kueri dan
 * Overpass melayaninya tanpa keluhan. Sembilan kategori butuh delapan belas
 * nilai, dan kueri itu mulai dibalas `504 Gateway Timeout` berulang-ulang —
 * bukan sibuk, melainkan tidak selesai dalam jatah waktunya. Dipecah begini
 * tiap kueri jauh lebih ringan, dan kegagalan satu kelompok tidak menyeret
 * seluruh pengambilan.
 *
 * Ada jeda di antara kelompok karena Overpass dipakai bersama-sama; menembakkan
 * empat kueri sekaligus adalah cara cepat untuk dijadikan tamu yang tidak
 * diundang lagi.
 */
const POI_GROUPS = [
	{ key: 'amenity', values: 'cafe|restaurant|fast_food|pharmacy|ice_cream' },
	{ key: 'shop', values: 'convenience|supermarket|grocery|general|kiosk' },
	{ key: 'shop', values: 'bakery|pastry|beverages|bubble_tea' },
	{ key: 'shop', values: 'laundry|dry_cleaning|car_repair|motorcycle_repair' }
];

/** Bobot moda: kapasitas angkut berbeda, jadi kontribusi aksesnya berbeda. */
const MODE_WEIGHT = { mrt: 1.0, krl: 0.9, lrt: 0.6, brt: 0.45 };

/**
 * URUTANNYA SENGAJA BUKAN URUTAN TAMPIL di `src/lib/domain/categories.ts`.
 *
 * Daftar ini hanya dipakai untuk membangkitkan atribut contoh (`ramai`,
 * `listing`, `d`), dan tiap kategori menarik tiga angka dari pengacak yang
 * disemai id petak. Selama lima kategori lama tetap di depan dan yang baru
 * ditambahkan di belakang, angka contoh kelimanya tidak berubah sama sekali
 * saat kisi dibangun ulang — yang berubah hanya tambahan di ujung. Menyisipkan
 * kategori baru di tengah akan menggeser seluruh urutan undian dan mengubah
 * ribuan angka contoh tanpa satu pun alasan nyata.
 */
const CATEGORIES = [
	'kopi',
	'warteg',
	'minimarket',
	'laundry',
	'apotek',
	'minuman',
	'roti',
	'kelontong',
	'bengkel',
	'cepatsaji',
	'mie',
	'seafood',
	'restoasing'
];

/**
 * Kategori yang benar-benar punya sumber di OSM. HANYA ini yang boleh muncul
 * sebagai kunci pada `hexes.json.osm`.
 *
 * Ada tidaknya kunci itulah yang dibaca mesin skor sebagai "sudah diambil dan
 * ternyata nol" versus "belum tercakup". Menulis nol untuk kategori yang tidak
 * punya tag OSM akan menyatakan seluruh Jakarta bebas pesaing warteg — dan
 * karena nol pesaing adalah skor terbaik yang bisa diberikan peta ini, seluruh
 * peringkatnya jadi bohong. Daftar ini harus cocok dengan `osmTag` yang tidak
 * null di `src/lib/domain/categories.ts`.
 */
const OSM_CATEGORIES = new Set([
	'kopi',
	'minuman',
	'roti',
	'cepatsaji',
	'minimarket',
	'kelontong',
	'laundry',
	'bengkel',
	'apotek'
]);

/* ── program ──────────────────────────────────────────────────────────────── */

async function main() {
	console.log(`Kisi heksagon H3 resolusi ${RES} · radius jalan kaki ${WALK_M} m\n`);

	// 1) simpul transit — satu kueri untuk semua moda
	console.log('[1/4] Mengambil simpul transit…');
	const transitQuery = `[out:json][timeout:180];(
node["station"="subway"](${BBOX});
node["railway"="station"](${BBOX});
node["railway"="halt"](${BBOX});
node["station"="light_rail"](${BBOX});
node["highway"="bus_stop"]["operator"~"TransJakarta",i](${BBOX});
node["public_transport"="platform"]["operator"~"TransJakarta",i](${BBOX});
);out body;`;
	const transitRaw = await overpass(transitQuery, 'transit');

	const stops = [];
	const seen = new Set();
	for (const el of transitRaw.elements) {
		if (el.type !== 'node' || el.lat == null) continue;
		const mode = transitMode(el.tags);
		if (!mode) continue;
		// Halte arah berlawanan sering dua simpul terpisah ±30 m; dedup kasar
		// supaya satu tempat henti tidak dihitung dua kali.
		const key = `${mode}|${el.lat.toFixed(4)}|${el.lon.toFixed(4)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		stops.push({ lat: el.lat, lon: el.lon, mode, name: el.tags?.name ?? null });
	}
	const byMode = stops.reduce((a, s) => ((a[s.mode] = (a[s.mode] ?? 0) + 1), a), {});
	console.log(`      ${stops.length} simpul:`, byMode);

	await sleep(4000);

	// 2) POI pesaing — dipecah beberapa kueri, lihat catatan di POI_GROUPS
	console.log('[2/4] Mengambil POI pesaing…');
	const pois = [];
	for (const [gi, g] of POI_GROUPS.entries()) {
		const q = `[out:json][timeout:180];(
node["${g.key}"~"^(${g.values})$"](${BBOX});
way["${g.key}"~"^(${g.values})$"](${BBOX});
);out center;`;
		const raw = await overpass(q, `poi ${gi + 1}/${POI_GROUPS.length}`);
		let n = 0;
		for (const el of raw.elements) {
			const lat = el.lat ?? el.center?.lat;
			const lon = el.lon ?? el.center?.lon;
			if (lat == null || lon == null) continue;
			const cat = poiCategory(el.tags);
			if (!cat) continue;
			pois.push({ lat, lon, cat });
			n++;
		}
		console.log(`      [${gi + 1}/${POI_GROUPS.length}] ${String(n).padStart(5)} POI · ${g.key}=${g.values.slice(0, 46)}`);
		if (gi < POI_GROUPS.length - 1) await sleep(4000);
	}
	const byCat = pois.reduce((a, p) => ((a[p.cat] = (a[p.cat] ?? 0) + 1), a), {});
	console.log(`      ${pois.length} POI:`, byCat);

	// 3) kisi: semua petak yang bersinggungan dengan jangkauan jalan kaki simpul transit
	console.log('[3/4] Membangun kisi…');
	const cells = new Set();
	for (const s of stops) {
		const home = h3.latLngToCell(s.lat, s.lon, RES);
		// gridDisk 1 menutup petak tetangga; lebar petak ±1 km, jadi ini sudah
		// mencakup jangkauan 800 m dari simpul mana pun di dalamnya.
		for (const c of h3.gridDisk(home, 1)) cells.add(c);
	}
	console.log(`      ${cells.size} petak`);

	const stopIndex = makeIndex(stops);
	const poiIndex = makeIndex(pois);

	// 4) atribut per petak
	console.log('[4/4] Menghitung atribut…');
	const hexes = [];
	let nodataCount = 0;

	for (const id of cells) {
		const [lat, lon] = h3.cellToLatLng(id);
		const nearStops = stopIndex.near(lat, lon, WALK_M);
		if (nearStops.length === 0) continue; // petak tanpa akses transit bukan urusan produk ini

		const transit = { mrt: 0, krl: 0, lrt: 0, brt: 0 };
		for (const s of nearStops) transit[s.mode]++;

		// Akses: jumlah berbobot, diredam akar supaya halte ke-11 tidak dihitung
		// sepenting halte pertama.
		const weighted =
			transit.mrt * MODE_WEIGHT.mrt +
			transit.krl * MODE_WEIGHT.krl +
			transit.lrt * MODE_WEIGHT.lrt +
			transit.brt * MODE_WEIGHT.brt;
		const access = Math.min(1, Math.sqrt(weighted) / 3.2);

		const nearPois = poiIndex.near(lat, lon, WALK_M);
		const osm = Object.fromEntries([...OSM_CATEGORIES].map((c) => [c, 0]));
		for (const p of nearPois) osm[p.cat]++;

		// Nama manusiawi: simpul transit terdekat yang punya nama.
		let label = null;
		let best = Infinity;
		for (const s of nearStops) {
			if (!s.name) continue;
			const d = haversine(lat, lon, s.lat, s.lon);
			if (d < best) {
				best = d;
				label = s.name;
			}
		}

		const rnd = mulberry32(hashSeed(id));

		// ── atribut misi MAPID: CONTOH ──────────────────────────────────────
		// Belum publik, jadi dibangkitkan — tapi tidak acak buta: bentuknya
		// mengikuti akses transit dan kepadatan usaha yang NYATA, supaya polanya
		// masuk akal secara spasial. Tetap wajib ditandai contoh di antarmuka.
		const nodata = rnd() < 0.18;
		if (nodata) nodataCount++;

		const activity = access * 0.65 + Math.min(1, nearPois.length / 60) * 0.35;

		let jam = null;
		let nStruk = 0;
		let nMenu = 0;
		let nProp = 0;
		let nontunai = 0;
		let ramai = null;
		let listing = null;
		let d = null;

		if (!nodata) {
			const peakHour = rnd() < 0.5 ? 12 : 19;
			const scale = 8 + activity * 46;
			jam = Array.from({ length: 24 }, (_, h) => {
				const morning = Math.exp(-((h - 7.5) ** 2) / 5) * 0.55;
				const noon = Math.exp(-((h - 12) ** 2) / 6) * (peakHour === 12 ? 1 : 0.7);
				const evening = Math.exp(-((h - 19) ** 2) / 7) * (peakHour === 19 ? 1 : 0.72);
				const night = h >= 1 && h <= 4 ? 0 : 0.05;
				return Math.round((morning + noon + evening + night) * scale * (0.85 + rnd() * 0.3));
			});
			nStruk = jam.reduce((a, v) => a + v, 0);
			nMenu = Math.round(nearPois.length * (0.3 + rnd() * 0.5));
			nProp = Math.round(4 + activity * 26 * (0.5 + rnd()));
			nontunai = Math.round((0.28 + access * 0.5 + rnd() * 0.12) * 100) / 100;

			ramai = {};
			listing = {};
			d = {};
			for (const c of CATEGORIES) {
				ramai[c] = Math.round((0.2 + rnd() * 0.6) * 100) / 100;
				listing[c] = Math.round(rnd() * (nProp / 4));
				d[c] = Math.round(Math.min(1, activity * (0.55 + rnd() * 0.7)) * 100) / 100;
			}
		}

		hexes.push({
			id,
			lat: Math.round(lat * 1e5) / 1e5,
			lon: Math.round(lon * 1e5) / 1e5,
			boundary: h3
				.cellToBoundary(id)
				.map(([blat, blon]) => [Math.round(blon * 1e5) / 1e5, Math.round(blat * 1e5) / 1e5]),
			name: label,
			transit,
			access: Math.round(access * 1000) / 1000,
			osm,
			nodata: nodata || undefined,
			jam: jam ?? undefined,
			nStruk,
			nMenu,
			nProp,
			nontunai: nodata ? undefined : nontunai,
			ramai: ramai ?? undefined,
			listing: listing ?? undefined,
			d: d ?? undefined
		});
	}

	hexes.sort((a, b) => b.access - a.access);

	const meta = {
		resolution: RES,
		walkRadius: WALK_M,
		hexes: hexes.length,
		nodata: nodataCount,
		stops: stops.length,
		stopsByMode: byMode,
		pois: pois.length,
		poisByCategory: byCat,
		real: 'Simpul transit (MRT, KRL, LRT, TransJakarta) dan POI pesaing: OpenStreetMap via Overpass API (ODbL).',
		mock: 'Atribut misi MAPID (jam, struk, menu, properti, non-tunai) dibangkitkan mengikuti akses transit dan kepadatan usaha nyata — tetap CONTOH sampai API MAPID tersedia.',
		regenerate: 'node scripts/build-hexes.mjs'
	};

	const dest = resolve(ROOT, 'src/lib/data/hexes.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify({ meta, hexes }));

	console.log(`\n${hexes.length} petak tersimpan (${nodataCount} belum terdata)`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
