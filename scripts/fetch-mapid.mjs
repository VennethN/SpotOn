/**
 * Mengambil POI premium MAPID langsung dari katalog, lalu menyimpannya sebagai
 * satu berkas titik yang siap di-join ke kisi heksagon.
 *
 *   node scripts/fetch-mapid.mjs
 *
 * Keluaran:
 *   src/lib/data/mapid-poi.json  — titik + deklarasi cakupan
 *   docs/mapid-layers.md         — daftar dataset yang dibaca, untuk disinkronkan
 *
 * TIDAK ADA LAGI LANGKAH IMPOR MANUAL
 *
 * Versi sebelumnya hanya bisa membaca layer yang sudah diimpor tangan ke proyek
 * GEO MAPID, jadi menambah satu kota berarti membuka antarmuka dan menekan
 * Impor. Ternyata pembatasnya bukan kepemilikan layer melainkan `project_id`
 * yang dikirim — penjelasan lengkapnya di `scripts/lib/mapid.mjs`. Dengan
 * proyek sendiri sebagai tiket baca, seluruh katalog premium bisa dibaca
 * langsung dan skrip ini menemukan sendiri dataset yang dibutuhkan.
 *
 * Proyek GEO MAPID tetap dibaca, karena dataset misi kompetisi akan datang
 * sebagai proyek terpisah yang dibagikan — bukan sebagai entri katalog.
 *
 * CAKUPAN DIDEKLARASIKAN, BUKAN DISIMPULKAN DARI TITIK
 *
 * Dulu daftar "kota mana yang sudah tercakup" dihitung mundur dari KABKOT titik
 * yang lolos klasifikasi. Itu mencampur dua hal yang justru menjadi inti janji
 * proyek ini: dataset yang TIDAK ADA, dan dataset yang ada tapi kebetulan nol
 * baris setelah disaring. Keduanya menghasilkan "tidak ada titik", padahal yang
 * pertama berarti "belum dicek" dan yang kedua "sudah dicek, memang kosong".
 *
 * Sekarang cakupan ditulis dari MANIFEST: begitu dataset sebuah kota berhasil
 * dibaca, kota itu tercakup untuk kategori yang dijanjikan dataset tersebut —
 * berapa pun titik yang akhirnya lolos.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	mapidKey,
	matchesDataset,
	normKota,
	projectId,
	readLayer,
	searchPremium,
	listProjectLayers
} from './lib/mapid.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CATEGORIES = [
	'kopi',
	'minuman',
	'roti',
	'warung',
	'minimarket',
	'kelontong',
	'laundry',
	'bengkel',
	'apotek'
];

/** Lima kota administrasi DKI. Katalog memberi satu dataset per kota. */
const KOTA = ['JAKARTA PUSAT', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR', 'JAKARTA UTARA'];

/**
 * Dataset yang dicari, dan kategori SpotOn apa yang cakupannya dijamin oleh
 * masing-masing.
 *
 * `covers` bukan sama dengan hasil klasifikasi. Dataset MAKANAN DAN MINUMAN
 * memuat kedai kopi DAN rumah makan, jadi keberadaannya menutup dua kategori
 * sekaligus — sekalipun untuk kota tertentu isinya kebetulan tidak memuat satu
 * kedai kopi pun. Itulah bedanya "sudah diperiksa" dari "ada isinya".
 *
 * `force` memakukan seluruh isi satu dataset ke satu kategori, melewati RULES.
 * Dipakai hanya untuk dataset yang memang berisi satu jenis usaha saja dan yang
 * taksonominya tidak bisa dibaca. BRAND COFFEE SHOP adalah kasusnya: TIPE_3-nya
 * berisi nama merek, dan "STARBUCKS" tidak memuat kata coffee maupun kopi. Tanpa
 * `force` ia jatuh ke TIPE_2 "MINUMAN" dan seluruh gerai Starbucks terhitung
 * sebagai kedai minuman, bukan kedai kopi. Jangan pakai `force` pada dataset
 * payung seperti MAKANAN DAN MINUMAN atau LAYANAN ATAU JASA — isinya campuran,
 * dan memakukannya justru membuang perbedaan yang mau kita lihat.
 *
 * KENAPA LAUNDRY TIDAK PUNYA BARIS SENDIRI
 *
 * Sempat disimpulkan "laundry tidak ada di katalog premium" karena tidak ada
 * dataset yang bernama LAUNDRY. Yang dicari waktu itu hanya NAMA DATASET,
 * padahal laundry ada sebagai subtipe di dalam dataset lain: LAYANAN ATAU JASA
 * → TIPE_3 "BINATU (LAUNDRY)", 3.723 titik di kelima kota. Kekeliruan yang
 * sama sempat menyembunyikan SPBU, yang di katalog bernama PENGISIAN BAHAN
 * BAKAR. Pelajarannya: tidak ketemu lewat nama bukan tidak ada — periksa
 * taksonomi TIPE di dalam dataset payung sebelum menyimpulkan.
 */
const MANIFEST = [
	{ term: 'COFFEE SHOP', covers: ['kopi'] },
	{ term: 'BRAND COFFEE SHOP', covers: ['kopi'], force: 'kopi' },
	{ term: 'MINUMAN', covers: ['kopi', 'minuman'] },
	{ term: 'ROTI DAN KUE', covers: ['roti'] },
	{ term: 'RESTORAN', covers: ['warung'] },
	{ term: 'MAKANAN DAN MINUMAN', covers: ['kopi', 'minuman', 'roti', 'warung'] },
	{ term: 'MINIMARKET', covers: ['minimarket'] },
	{ term: 'TOKO KELONTONG', covers: ['kelontong'] },
	{ term: 'LAYANAN ATAU JASA', covers: ['laundry', 'bengkel'] },
	{ term: 'PERAWATAN DAN PERBAIKAN OTOMOTIF', covers: ['bengkel'] },
	{ term: 'APOTEK', covers: ['apotek'] }
];

/**
 * Taksonomi MAPID (TIPE_1 → TIPE_2 → TIPE_3) dipetakan ke sembilan kategori SpotOn.
 * Dicocokkan dari yang paling spesifik ke paling umum: sebuah gerai bisa
 * bertipe "MAKANAN DAN MINUMAN / MINUMAN / COFFEESHOP", dan yang menentukan
 * kategorinya adalah TIPE_3, bukan TIPE_1.
 */
const RULES = [
	{ cat: 'kopi', re: /COFFEE|KOPI|KEDAI KOPI|CAFE|KAFE/i },
	{ cat: 'apotek', re: /APOTEK|APOTIK|FARMASI|PHARMAC/i },
	// Dulu memuat `CUCI` juga. Dibuang karena "CUCI MOBIL" adalah bengkel, bukan
	// binatu — dan aturan ini diperiksa lebih dulu, jadi satu kata yang terlalu
	// longgar akan merebutnya. Waktu itu tidak ketahuan sebab kategori laundry
	// memang belum punya satu titik pun.
	{ cat: 'laundry', re: /LAUNDRY|BINATU/i },
	{ cat: 'bengkel', re: /BENGKEL|PERBAIKAN OTOMOTIF|SERVIS (MOTOR|MOBIL)/i },
	{ cat: 'roti', re: /ROTI|KUE|BAKERY|PASTRI|DONAT/i },
	// `^MINUMAN$` diikat ke seluruh nilai, bukan potongan. TIPE_1 untuk SEMUA
	// gerai makanan berbunyi "MAKANAN DAN MINUMAN", jadi pola yang longgar akan
	// menyapu setiap restoran ke kategori minuman begitu TIPE_2 dan TIPE_3-nya
	// kosong.
	{ cat: 'minuman', re: /^MINUMAN$|BOBA|MILK ?TEA|THAI TEA|JUS$|JUICE|ES KRIM|DESSERT/i },
	{ cat: 'kelontong', re: /KELONTONG|SEMBAKO/i },
	// `KELONTONG` sudah dipindah ke kategorinya sendiri di atas.
	{ cat: 'minimarket', re: /MINIMARKET|MART|SWALAYAN|SUPERMARKET|INDOMARET|ALFAMART/i },
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

/** Pola penamaan terbitan resmi katalog MAPID. */
const CANONICAL = /\bDI\s+(KOTA|KABUPATEN)\b.*\bTAHUN\s+\d{4}/i;

/** Nama dataset tanpa jejak impor, supaya salinan di proyek bisa dikenali
    sebagai dataset katalog yang sama dan tidak ditarik dua kali. */
function canonicalName(name) {
	return String(name ?? '')
		.replace(/\s+IMPORTED AT.*$/i, '')
		.trim()
		.toUpperCase();
}

async function main() {
	const key = mapidKey();
	console.log(`Proyek ${projectId()} (dipakai sebagai tiket baca)\n`);

	// ── 1. Temukan dataset yang dibutuhkan di katalog premium ──────────────
	console.log('[1/3] Mencari dataset di katalog premium…');
	const wanted = [];
	const missing = [];

	for (const { term, covers, force } of MANIFEST) {
		for (const kota of KOTA) {
			const hits = await searchPremium(`${term} ${kota}`);
			// Pencocokan AND per kata membuat kueri sempit ini nyaris selalu
			// tepat, tapi tetap diverifikasi: nama harus diawali istilahnya DAN
			// memuat kotanya, supaya "MAKANAN DAN MINUMAN" tidak menyerap
			// dataset lain yang kebetulan memuat kata "MAKANAN".
			const cocok = hits.filter((l) => matchesDataset(l.name, term, kota));
			// Kadang ada lebih dari satu yang cocok — Jakarta Selatan punya
			// "APOTEK DI KOTA ADMINISTRASI …" sekaligus "Apotek - Jakarta
			// Selatan". Mengambil yang pertama berarti menyerahkan pilihan pada
			// urutan peringkat pencarian, yang bisa bergeser kapan saja dan
			// menukar dataset lengkap dengan yang lebih kecil tanpa ada yang
			// sadar. Terbitan resmi katalog selalu bernama menurut pola
			// "<ISTILAH> DI KOTA/KABUPATEN <WILAYAH> TAHUN <TAHUN>", jadi itu
			// yang didahulukan.
			const hit = cocok.find((l) => CANONICAL.test(l.name ?? '')) ?? cocok[0];
			if (hit) {
				wanted.push({
					id: hit._id,
					name: hit.name,
					term,
					kota,
					covers,
					force: force ?? null,
					origin: 'katalog'
				});
			} else {
				missing.push({ term, kota });
			}
		}
		const got = wanted.filter((w) => w.term === term).length;
		console.log(`      ${term.padEnd(21)} ${got}/${KOTA.length} kota`);
	}

	// ── 2. Tambahkan layer yang ada di proyek dan bukan salinan katalog ────
	// Inilah jalan masuk dataset misi kompetisi: ia hadir sebagai proyek
	// terpisah yang dibagikan, tidak pernah sebagai entri katalog.
	console.log('\n[2/3] Membaca daftar layer di proyek…');
	const known = new Set(wanted.map((w) => canonicalName(w.name)));
	const projectLayers = await listProjectLayers(key);
	let skipped = 0;
	for (const l of projectLayers) {
		if (known.has(canonicalName(l.name))) {
			skipped++;
			continue;
		}
		wanted.push({
			id: l._id,
			name: l.name,
			term: null,
			kota: null,
			covers: [],
			force: null,
			origin: 'proyek'
		});
	}
	console.log(
		`      ${projectLayers.length} layer · ${skipped} salinan katalog dilewati · ` +
			`${projectLayers.length - skipped} khas proyek`
	);

	// ── 3. Ambil isinya ────────────────────────────────────────────────────
	console.log(`\n[3/3] Mengambil isi ${wanted.length} layer…`);
	const points = [];
	const perLayer = [];
	const unmatched = new Map();
	const coverage = Object.fromEntries(CATEGORIES.map((c) => [c, new Set()]));

	for (const [i, w] of wanted.entries()) {
		const { features } = await readLayer(w.id, key, w.name);
		let kept = 0;

		for (const f of features) {
			const c = f.geometry?.coordinates;
			if (!Array.isArray(c) || c.length < 2) continue;
			const cat = w.force ?? classify(f.properties);
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

		// Cakupan dari manifest: dataset berhasil dibaca ⇒ kotanya tercakup
		// untuk kategori yang dijanjikan, berapa pun titik yang lolos.
		for (const cat of w.covers) coverage[cat]?.add(normKota(w.kota));

		// Layer khas proyek tidak menjanjikan apa-apa, jadi cakupannya hanya
		// bisa dibaca dari isinya — kembali ke penyimpulan, tapi terbatas di
		// sini saja dan sudah cukup: yang dijanjikan manifest tidak ikut kena.
		if (w.origin === 'proyek') {
			for (const f of features) {
				const cat = classify(f.properties);
				const kab = f.properties?.KABKOT;
				if (cat && kab) coverage[cat]?.add(normKota(kab));
			}
		}

		perLayer.push({
			id: w.id,
			name: w.name,
			origin: w.origin,
			term: w.term,
			kota: w.kota,
			covers: w.covers,
			force: w.force,
			features: features.length,
			kept
		});
		console.log(
			`  [${String(i + 1).padStart(2)}/${wanted.length}] ${String(features.length).padStart(5)} fitur → ` +
				`${String(kept).padStart(5)} terpakai · ${w.name.slice(0, 58)}`
		);
	}

	// Dedup: satu gerai bisa muncul di dua dataset (mis. COFFEE SHOP dan
	// MAKANAN DAN MINUMAN untuk kota yang sama). Tanpa ini pesaing terhitung
	// dobel dan petak yang ramai terlihat dua kali lebih ramai.
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
			project_id: projectId(),
			read: 'Langsung dari katalog premium — layer_id katalog + project_id milik sendiri. Tidak ada langkah impor manual.',
			layers: perLayer,
			missing,
			total: unique.length,
			duplicatesDropped: points.length - unique.length,
			byCategory: byCat,
			byKabkot: byKab,
			coverage: Object.fromEntries(CATEGORIES.map((c) => [c, [...coverage[c]].sort()])),
			coverageRule:
				'Ditulis dari dataset yang berhasil dibaca, bukan disimpulkan dari titik yang lolos klasifikasi. Kota yang tidak terdaftar berarti BELUM DICEK — bukan nol pesaing.',
			regenerate: 'node scripts/fetch-mapid.mjs'
		},
		points: unique
	};

	const dest = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));

	writeFileSync(resolve(ROOT, 'docs/mapid-layers.md'), report(perLayer, missing, coverage, out.meta));

	console.log(`\n${unique.length} titik unik (${points.length - unique.length} duplikat dibuang)`);
	console.log('per kategori:', byCat);
	console.log('per kota    :', byKab);
	console.log('cakupan     :');
	for (const c of CATEGORIES) {
		const k = [...coverage[c]].sort();
		console.log(`  ${c.padEnd(11)} ${k.length ? `${k.length}/5 · ${k.join(', ')}` : '(tidak ada dataset)'}`);
	}
	if (unmatched.size) {
		const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
		console.log('tipe tak terpetakan:', Object.fromEntries(top));
	}
	console.log(`\n→ ${dest}`);
	console.log('→ docs/mapid-layers.md');
}

/** Laporan Markdown: apa yang dibaca, dan apa yang perlu disinkronkan tangan. */
function report(perLayer, missing, coverage, meta) {
	const katalog = perLayer.filter((l) => l.origin === 'katalog');
	const proyek = perLayer.filter((l) => l.origin === 'proyek');
	const fmt = (n) => n.toLocaleString('id-ID');

	const L = [
		'<!-- Dihasilkan `node scripts/fetch-mapid.mjs` — jangan disunting tangan. -->',
		'',
		'# Dataset MAPID yang dibaca SpotOn',
		'',
		`${katalog.length} dataset katalog premium + ${proyek.length} layer khas proyek · ` +
			`${fmt(meta.total)} titik unik setelah ${fmt(meta.duplicatesDropped)} duplikat dibuang.`,
		'',
		'Semuanya dibaca **langsung dari katalog**, tanpa langkah impor. Yang dikirim ke',
		'`get_layer` adalah `layer_id` katalog beserta `project_id` proyek kita sendiri —',
		'server memeriksa kepemilikan proyek, bukan keanggotaan layer di dalamnya.',
		'',
		'## Perlu disinkronkan manual?',
		'',
		'**Tidak untuk menjalankan SpotOn.** Skrip menemukan dan membaca sendiri seluruh',
		'dataset di bawah ini setiap kali dijalankan; berkas `mapid-poi.json` yang',
		'dihasilkan sudah lengkap.',
		'',
		'Impor lewat antarmuka GEO MAPID hanya perlu bila dataset ini ingin ikut terlihat',
		'di dalam proyek — untuk ditata, digayakan, atau dipakai orang lain di tim. Daftar',
		'lengkap beserta tautannya ada di bawah; tekan **Impor** di masing-masing.',
		'',
		'## Katalog premium',
		''
	];

	const byTerm = new Map();
	for (const l of katalog) {
		if (!byTerm.has(l.term)) byTerm.set(l.term, []);
		byTerm.get(l.term).push(l);
	}
	for (const [term, list] of byTerm) {
		L.push(`### ${term} — menutup \`${list[0].covers.join('`, `')}\``, '');
		L.push('| Kota | Dataset | Fitur | Terpakai | Buka |');
		L.push('|---|---|--:|--:|---|');
		for (const l of list) {
			L.push(
				`| ${l.kota} | \`${l.name}\` | ${fmt(l.features)} | ${fmt(l.kept)} | ` +
					`[layer](https://geo.mapid.io/layer/${l.id}) |`
			);
		}
		L.push('');
	}

	if (proyek.length) {
		L.push('## Khas proyek', '');
		L.push('Ada di proyek GEO MAPID tapi bukan salinan dataset katalog di atas. Inilah jalan');
		L.push('masuk dataset misi kompetisi, yang datang sebagai proyek terpisah yang dibagikan.');
		L.push('');
		L.push('| Dataset | Fitur | Terpakai |');
		L.push('|---|--:|--:|');
		for (const l of proyek) L.push(`| \`${l.name}\` | ${fmt(l.features)} | ${fmt(l.kept)} |`);
		L.push('');
	}

	L.push('## Cakupan yang dihasilkan', '');
	L.push('| Kategori | Kota tercakup | Keterangan |');
	L.push('|---|--:|---|');
	for (const [cat, set] of Object.entries(coverage)) {
		const k = [...set].sort();
		L.push(
			`| ${cat} | ${k.length}/5 | ${k.length ? k.join(', ') : '**tidak ada dataset di katalog**'} |`
		);
	}
	L.push('');
	L.push('Cakupan ditulis dari dataset yang berhasil dibaca, **bukan** disimpulkan dari titik');
	L.push('yang lolos klasifikasi. Dataset yang ada tapi kebetulan kosong tetap terhitung');
	L.push('"sudah dicek"; kota yang datasetnya tidak ada sama sekali tetap **belum dicek** dan');
	L.push('tidak boleh diberi nilai nol pesaing.');
	L.push('');

	if (missing.length) {
		const byT = new Map();
		for (const m of missing) {
			if (!byT.has(m.term)) byT.set(m.term, []);
			byT.get(m.term).push(m.kota);
		}
		L.push('## Dicari, tidak ketemu', '');
		for (const [term, kotas] of byT) {
			L.push(`- **${term}** — ${kotas.length === 5 ? 'kelima kota' : kotas.join(', ')}`);
		}
		L.push('');
		L.push('Tetap dicari ulang setiap kali skrip jalan. Dibiarkan di manifest supaya');
		L.push('ketiadaannya terus diuji, bukan pelan-pelan berubah jadi asumsi — dan supaya');
		L.push('dataset ini terambil sendiri kalau suatu saat MAPID menerbitkannya.');
		L.push('');
	}

	return L.join('\n');
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
