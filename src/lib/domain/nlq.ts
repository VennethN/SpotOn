import { id as ID } from '$lib/i18n/id';
import { formatHour, pct } from '$lib/utils/format';
import { CATEGORY_MAP } from './categories';
import { supplyPhrase } from './narrate';
import { scoreAll } from './scoring';

/* Teks di berkas ini adalah keluaran API — `headline`, `why`, `evidence`, dan
   provenans. Antarmuka tidak menampilkannya apa adanya; yang dibaca pengguna
   disusun ulang oleh `narrate` dalam bahasa yang sedang dipilih. Jadi kalimat di
   sini dipatok bahasa Indonesia, satu kontrak yang stabil untuk pemakai API. */
import type {
	AiAnswer,
	Hex,
	CategoryKey,
	Recommendation,
	ScoredHex,
	StructuredQuery,
	Weights
} from '$lib/types';

/**
 * Dicocokkan berurutan, yang pertama cocok menang — jadi yang spesifik harus
 * di atas yang umum. `boba` sebelum `minuman`, dan keduanya sebelum `warung`
 * yang menangkap kata "makan": tanpa urutan itu "kedai minuman" akan terbaca
 * warung karena pertanyaannya nyaris selalu memuat kata makan atau jajan.
 */
const KEYWORDS: Array<[RegExp, CategoryKey]> = [
	[/kopi|coffee|kafe|cafe|espresso|latte/i, 'kopi'],
	[/boba|milk ?tea|thai tea|jus|juice|es krim|ice cream|dessert|minuman|drink/i, 'minuman'],
	[/roti|bakery|kue|donat|donut|pastri|pastry|cake/i, 'roti'],
	[/apotek|obat|farmasi|pharmac/i, 'apotek'],
	[/laundry|binatu|cuci baju/i, 'laundry'],
	[/bengkel|servis motor|service motor|montir|repair/i, 'bengkel'],
	[/kelontong|toko sembako|sembako|grocery/i, 'kelontong'],
	[/minimarket|swalayan|indomaret|alfamart|convenience/i, 'minimarket'],
	[/warung|makan|nasi|soto|resto|food/i, 'warung']
];

/**
 * Menerjemahkan pertanyaan bahasa natural menjadi query terstruktur.
 *
 * Pada produk final lapisan ini dijalankan LLM dengan function-calling ke daftar
 * operasi spasial terbatas; bentuk keluarannya tetap objek ini. Modelnya hanya
 * memilih operasi dan mengisi argumen — seluruh angka tetap dihitung mesin skor,
 * sehingga tidak ada nilai yang bisa dikarang model.
 */
export function parseQuestion(q: string, w: Weights, fallback: CategoryKey): StructuredQuery {
	const out: StructuredQuery = {
		intent: 'RANK',
		metrik: 'gap permintaan − penawaran',
		kategori: fallback,
		radius_m: w.radius,
		filter: {},
		urut: 'desc',
		limit: 5
	};

	for (const [re, cat] of KEYWORDS) {
		if (re.test(q)) {
			out.kategori = cat;
			break;
		}
	}

	if (/belum terdata|tidak ada data|kosong|cakupan/i.test(q)) {
		out.intent = 'COVERAGE';
		out.metrik = 'N titik data misi per catchment';
		out.urut = 'asc';
		out.limit = 99;
		delete out.filter;
	} else if (/jenuh|saturasi|penuh|hindari|jangan/i.test(q)) {
		out.intent = 'FLAG_SATURATED';
		out.metrik = 'penawaran efektif (pesaing × keramaian)';
	} else if (/banding|compare|\bvs\b|versus/i.test(q)) {
		out.intent = 'COMPARE';
		out.metrik = 'profil lengkap 2 catchment';
		out.limit = 2;
	}

	if (out.filter && /modal kecil|murah|terjangkau/i.test(q)) {
		out.filter.ruang_sewa_tersedia = true;
		out.filter.tier_harga = 'rendah';
	}
	if (out.filter && /dekat|mrt|stasiun|transit/i.test(q)) {
		out.filter.dalam_catchment_transit = `${w.radius} m`;
	}
	return out;
}

/** Mencocokkan nama catchment yang disebut di pertanyaan (untuk intent COMPARE). */
function matchNames(q: string, rows: ScoredHex[]): ScoredHex[] {
	const ql = q.toLowerCase();
	return rows
		.map((r) => ({
			r,
			hit: r.name
				.toLowerCase()
				.split(/\s+/)
				.filter((wd) => wd.length > 2)
				.reduce((acc, wd) => acc + (ql.includes(wd) ? wd.length : 0), 0)
		}))
		.filter((m) => m.hit > 0)
		.sort((a, b) => b.hit - a.hit)
		.slice(0, 2)
		.map((m) => m.r);
}

const evidence = (r: ScoredHex) =>
	`N misi = ${r.nTot} (struk ${r.nStruk} · menu ${r.nMenu} · properti ${r.nProp}) · pesaing OSM = ${r.osm}`;

/**
 * Menjalankan query terstruktur terhadap mesin skor dan menyusun justifikasi.
 * Setiap kalimat "Kenapa di sini?" hanya merujuk angka yang juga tampil di panel,
 * sehingga pengguna dapat mengauditnya.
 */
export function answer(
	question: string,
	catchments: Hex[],
	w: Weights,
	fallback: CategoryKey
): AiAnswer {
	return runQuery(parseQuestion(question, w, fallback), question, catchments, w);
}

/**
 * Menjalankan query terstruktur — dari mana pun asalnya.
 *
 * Dipisahkan dari `parseQuestion` supaya query hasil model bisa dijalankan lewat
 * jalur yang sama persis dengan query hasil aturan. Mesin skornya satu, jadi
 * tidak ada dua versi kebenaran: mengganti lapisan pemahaman tidak pernah
 * mengubah cara angkanya dihitung.
 */
export function runQuery(
	query: StructuredQuery,
	question: string,
	catchments: Hex[],
	w: Weights
): AiAnswer {
	const cat = query.kategori;
	const def = CATEGORY_MAP[cat];
	const rows = scoreAll(catchments, cat, w);
	const provenance = [
		`Alur: pertanyaan → parsing niat → function-calling ke daftar operasi spasial terbatas → PostGIS mengeksekusi → peta & panel diperbarui.`,
		`Angka tidak dikarang model: LLM hanya memilih operasi dan mengisi argumen; seluruh nilai dihitung basis data dan ditautkan ke titik sumbernya.`,
		`Sumber pesaing (nyata): OpenStreetMap via Overpass API, ${def.osmTag}, around:${w.radius}.`,
		`Sumber lain (contoh): Struk Go · Menu Go · Properti Go — struktur mengikuti kolom asli.`
	];

	if (query.intent === 'COVERAGE') {
		const nd = rows.filter((r) => r.nodata);
		return {
			query,
			headline: `${nd.length} catchment tanpa data misi MAPID. Kawasan tersebut tidak diberi nilai — ditampilkan apa adanya dan diusulkan sebagai prioritas survey activities berikutnya.`,
			items: nd.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: null,
				why: `Tidak ada titik Struk/Menu/Properti Go. Namun OSM mencatat ${r.osm} ${def.name.toLowerCase()} di radius ${w.radius} m — indikasi kawasan aktif yang belum tersentuh survei.`,
				evidence: 'N misi = 0 · estimasi 1 hari lapangan untuk memotret papan menu & storefront'
			})),
			highlight: nd.map((r) => r.id),
			provenance
		};
	}

	if (query.intent === 'FLAG_SATURATED') {
		const sat = rows
			.filter((r) => !r.nodata)
			.sort((a, b) => (b.supply ?? 0) - (a.supply ?? 0))
			.slice(0, 5);
		return {
			query,
			headline: `Lima catchment dengan penawaran efektif tertinggi untuk ${def.name} — pesaing padat dan mayoritas ramai, sehingga celah pasar paling sempit. Disarankan dihindari.`,
			items: sat.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: r.supply,
				why: `${r.osm} pesaing sejenis dalam radius ${w.radius} m, ${pct(r.ramai)}% berkondisi ramai. Permintaan ${pct(r.demand)} tidak melampauinya.`,
				evidence: evidence(r)
			})),
			highlight: sat.map((r) => r.id),
			provenance
		};
	}

	if (query.intent === 'COMPARE') {
		const picked = matchNames(question, rows);
		query.target = picked.map((r) => r.name);
		if (picked.length < 2) {
			return {
				query,
				headline: 'Sebutkan dua nama catchment untuk dibandingkan, misalnya "Bandingkan Blok M BCA dan Bundaran HI".',
				items: [],
				highlight: [],
				provenance
			};
		}
		const [a, b] = picked;
		const win = (a.score ?? 0) >= (b.score ?? 0) ? a : b;
		const lose = win === a ? b : a;
		const reason =
			(win.demand ?? 0) > (lose.demand ?? 0)
				? 'permintaan lebih tinggi'
				: 'penawaran eksisting lebih lemah';
		return {
			query,
			headline: `Untuk ${def.name}, ${win.name} unggul (${pct(win.score)} vs ${pct(lose.score)}) — terutama karena ${reason}.`,
			items: picked.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: r.score,
				why: `Permintaan ${pct(r.demand)} · penawaran ${pct(r.supply)} (${r.osm} pesaing OSM, ${pct(r.ramai)}% ramai) · ${r.listings} listing ${def.propKat}.`,
				evidence: evidence(r)
			})),
			highlight: picked.map((r) => r.id),
			provenance
		};
	}

	// RANK
	let cands = rows.filter((r) => !r.nodata);
	if (query.filter?.ruang_sewa_tersedia) cands = cands.filter((r) => r.listings > 0);
	cands = cands.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, query.limit);
	const skipped = rows.filter((r) => r.nodata).length;

	return {
		query,
		headline:
			`${cands.length} catchment teratas untuk ${def.name} berdasarkan selisih permintaan − penawaran, digerbang ketersediaan ruang usaha.` +
			(skipped ? ` ${skipped} catchment dikecualikan karena belum terdata.` : ''),
		items: cands.map<Recommendation>((r) => ({
			id: r.id,
			name: r.name,
			value: r.score,
			why: `Permintaan ${pct(r.demand)} (${r.nStruk} struk, puncak ${formatHour(r.puncak)}, non-tunai ${pct(r.nontunai)}%); ${r.osm} pesaing dalam radius ${w.radius} m dengan ${pct(r.ramai)}% ramai — ${supplyPhrase(r, ID)} → penawaran ${pct(r.supply)}; tersedia ${r.listings} listing ${def.propKat}.`,
			evidence: evidence(r)
		})),
		highlight: cands.map((r) => r.id),
		provenance
	};
}
