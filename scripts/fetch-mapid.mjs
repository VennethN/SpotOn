/**
 * Mengambil POI premium MAPID dari proyek GEO MAPID, lalu menyimpannya sebagai
 * satu berkas titik yang siap di-join ke kisi heksagon.
 *
 *   node scripts/fetch-mapid.mjs
 *
 * Keluaran: `src/lib/data/mapid-poi.json`
 *
 * KENAPA LEWAT PROYEK, BUKAN KATALOG
 *
 * Katalog data premium bisa dibaca tanpa login, tapi endpoint daftarnya
 * mengabaikan `page`, `limit`, dan segala bentuk parameter pencarian — ia selalu
 * mengembalikan 20 entri yang sama. Jadi menemukan dataset Jakarta di antara
 * ~20.000 entri tidak mungkin dilakukan dari skrip.
 *
 * Yang bisa: membaca layer mana pun kalau id-nya sudah diketahui. Maka pembagian
 * kerjanya begini — dataset dicari dan di-Impor sekali lewat antarmuka GEO MAPID
 * (kotak pencariannya bekerja), dan skrip ini menemukan sendiri seluruh layer di
 * proyek itu beserta isinya. Tidak ada id yang perlu disalin tangan.
 *
 * Kunci `MAPID_API_KEY` hanya bisa membaca. Mengimpor adalah operasi tulis pada
 * akun MAPID dan memerlukan sesi login pengguna — itu sebabnya langkah impor
 * memang tinggal di antarmuka, bukan di sini.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEOSERVER = 'https://geoserver.mapid.io';

/**
 * `get_layer` memotong di 200 fitur tanpa memberi tahu — tidak ada penanda
 * "masih ada lagi" pada responsnya. Layer RESTORAN Jakarta Pusat sebenarnya
 * berisi 1.160 titik, jadi tanpa `limit` yang eksplisit 83% datanya hilang
 * diam-diam dan cacah pesaing jadi terlalu kecil. Nilai ini jauh di atas
 * layer terbesar yang ada; naikkan bila suatu saat ada yang menyentuhnya.
 */
const FEATURE_LIMIT = 100000;

/** Proyek GEO MAPID tempat dataset diimpor. Dari URL editor: /editor/<id>. */
const PROJECT_ID = process.env.MAPID_PROJECT_ID || '6a7c1672fb8d434002151fa7';

function apiKey() {
	const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	const m = raw.match(/^MAPID_API_KEY=(.*)$/m);
	const key = (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
	if (!key) throw new Error('MAPID_API_KEY belum diisi di .env');
	return key;
}

/**
 * Taksonomi MAPID (TIPE_1 → TIPE_2 → TIPE_3) dipetakan ke lima kategori SpotOn.
 * Dicocokkan dari yang paling spesifik ke paling umum: sebuah gerai bisa
 * bertipe "MAKANAN DAN MINUMAN / MINUMAN / COFFEESHOP", dan yang menentukan
 * kategorinya adalah TIPE_3, bukan TIPE_1.
 */
const RULES = [
	{ cat: 'kopi', re: /COFFEE|KOPI|KEDAI KOPI|CAFE|KAFE/i },
	{ cat: 'apotek', re: /APOTEK|APOTIK|FARMASI|PHARMAC/i },
	{ cat: 'laundry', re: /LAUNDRY|BINATU|CUCI/i },
	{ cat: 'minimarket', re: /MINIMARKET|MART|SWALAYAN|SUPERMARKET|KELONTONG|INDOMARET|ALFAMART/i },
	{ cat: 'warung', re: /RESTORAN|RESTAURANT|WARUNG|RUMAH MAKAN|MAKANAN|FAST ?FOOD|KULINER/i }
];

function classify(props = {}) {
	// Sengaja HANYA membaca kolom TIPE, tidak pernah NAMA. Menebak dari nama
	// pernah membuat satu halte TransJakarta terhitung sebagai minimarket
	// hanya karena namanya memuat "MART" — dan pesaing palsu menekan skor
	// petak yang sebenarnya kosong. Layer non-usaha (halte) tidak punya kolom
	// TIPE sama sekali, jadi aturan ini sekaligus menyaringnya keluar.
	for (const src of [props.TIPE_3, props.TIPE_2, props.TIPE_1]) {
		const s = String(src ?? '').trim();
		if (!s || s === '-') continue;
		for (const r of RULES) if (r.re.test(s)) return r.cat;
	}
	return null;
}

async function get(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
		}
	}
}

async function main() {
	const key = apiKey();
	console.log(`Proyek ${PROJECT_ID}\n`);

	console.log('[1/2] Membaca daftar layer…');
	const listed = await get(
		`${GEOSERVER}/layers_new/get_layer_list?api_key=${key}&project_id=${PROJECT_ID}`,
		'get_layer_list'
	);
	const layers = Object.values(listed).filter((l) => l && typeof l === 'object' && l._id);
	console.log(`      ${layers.length} layer\n`);

	console.log('[2/2] Mengambil isi tiap layer…');
	const points = [];
	const perLayer = [];
	const unmatched = new Map();

	for (const [i, l] of layers.entries()) {
		const data = await get(
			`${GEOSERVER}/layers_new/get_layer?api_key=${key}&layer_id=${l._id}&project_id=${PROJECT_ID}&limit=${FEATURE_LIMIT}`,
			l.name
		);
		const feats = data.features ?? [];
		let kept = 0;

		for (const f of feats) {
			const c = f.geometry?.coordinates;
			if (!Array.isArray(c) || c.length < 2) continue;
			const cat = classify(f.properties);
			if (!cat) {
				const t = f.properties?.TIPE_3 || f.properties?.TIPE_2 || f.properties?.TIPE_1 || '?';
				unmatched.set(t, (unmatched.get(t) ?? 0) + 1);
				continue;
			}
			points.push({
				lat: Math.round(c[1] * 1e5) / 1e5,
				lon: Math.round(c[0] * 1e5) / 1e5,
				cat,
				kabkot: f.properties?.KABKOT ?? null
			});
			kept++;
		}

		perLayer.push({ name: l.name, features: feats.length, kept });
		console.log(
			`  [${String(i + 1).padStart(2)}/${layers.length}] ${String(feats.length).padStart(5)} fitur → ${String(kept).padStart(5)} terpakai · ${l.name.slice(0, 52)}`
		);
	}

	// Dedup: satu gerai bisa muncul di dua layer (mis. COFFEE SHOP dan MAKANAN
	// DAN MINUMAN untuk kota yang sama). Tanpa ini pesaing terhitung dobel.
	const seen = new Set();
	const unique = points.filter((p) => {
		const k = `${p.cat}|${p.lat}|${p.lon}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});

	const byCat = unique.reduce((a, p) => ((a[p.cat] = (a[p.cat] ?? 0) + 1), a), {});
	const byKab = unique.reduce((a, p) => ((a[p.kabkot ?? '?'] = (a[p.kabkot ?? '?'] ?? 0) + 1), a), {});

	const out = {
		meta: {
			source: 'MAPID premium data (Data Premium) via geoserver.mapid.io',
			project_id: PROJECT_ID,
			layers: perLayer,
			total: unique.length,
			duplicatesDropped: points.length - unique.length,
			byCategory: byCat,
			byKabkot: byKab,
			note: 'Cakupan mengikuti dataset yang sudah diimpor ke proyek. Kota yang belum diimpor TIDAK berarti tidak punya pesaing — join ke kisi wajib memperlakukannya sebagai "belum tercakup", bukan nol.',
			regenerate: 'node scripts/fetch-mapid.mjs'
		},
		points: unique
	};

	const dest = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));

	console.log(`\n${unique.length} titik unik (${points.length - unique.length} duplikat dibuang)`);
	console.log('per kategori:', byCat);
	console.log('per kota    :', byKab);
	if (unmatched.size) {
		const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
		console.log('tipe tak terpetakan:', Object.fromEntries(top));
	}
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
