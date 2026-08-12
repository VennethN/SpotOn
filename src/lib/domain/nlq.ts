import { id as ID } from '$lib/i18n/id';
import { formatHour, pct } from '$lib/utils/format';
import { CATEGORY_MAP } from './categories';
import { supplyPhrase } from './narrate';
import { scoreAll } from './scoring';

/* The prose in this file is API output — `headline`, `why`, `evidence`, and the
   provenance notes. The interface never shows it verbatim; what the user reads is
   rebuilt by `narrate` in whichever language is selected. So the sentences here are
   pinned to Indonesian, a stable contract for API consumers. The same goes for the
   structured-query field names and the keyword patterns, which have to match
   Indonesian questions. */
import type {
	AiAnswer,
	Hex,
	CategoryKey,
	PoiSource,
	Recommendation,
	ScoredHex,
	StructuredQuery,
	Weights
} from '$lib/types';

/**
 * Matched in order, first match wins — so the specific has to sit above the
 * general. `boba` before `minuman`, and both before `warung`, which catches the
 * word "makan": without that order "kedai minuman" would read as a warung, because
 * the question almost always contains the word makan or jajan.
 */
const KEYWORDS: Array<[RegExp, CategoryKey]> = [
	[/kopi|coffee|kafe|cafe|espresso|latte/i, 'kopi'],
	// `jus` and `asing` below MUST be fenced with `\b`. Without it, both match in
	// the middle of very common words — "justru" becomes a drinks stall,
	// "masing-masing" becomes a foreign restaurant — and that match silently
	// overrides the category the user has selected and pans the map with it.
	[/boba|milk ?tea|thai tea|\bjus\b|juice|es krim|ice cream|dessert|minuman|drink/i, 'minuman'],
	[/roti|bakery|kue|donat|donut|pastri|pastry|cake/i, 'roti'],
	[/apotek|obat|farmasi|pharmac/i, 'apotek'],
	[/laundry|binatu|cuci baju/i, 'laundry'],
	[/bengkel|servis motor|service motor|montir|repair/i, 'bengkel'],
	[/kelontong|toko sembako|sembako|grocery/i, 'kelontong'],
	[/minimarket|swalayan|indomaret|alfamart|convenience/i, 'minimarket'],
	[/cepat saji|fast ?food|kfc|mcd|mcdonald|burger/i, 'cepatsaji'],
	[/\bmie\b|bakso|ramen|noodle|bakmi/i, 'mie'],
	[/seafood|ikan bakar|kepiting|udang/i, 'seafood'],
	[
		/jepang|japanese|korea|korean|sushi|thai|cina|chinese|western|\basing\b|italia|pizza|steak/i,
		'restoasing'
	],
	// Last and loosest: anything mentioning food without naming a type lands here,
	// because a rice warung really is the most sensible default for the question
	// "I want to open somewhere to eat".
	[/warteg|warung|rumah makan|nasi|padang|soto|resto|makan|food/i, 'warteg']
];

/**
 * Translates a natural-language question into a structured query.
 *
 * In the finished product this layer is run by an LLM doing function-calling
 * against a limited list of spatial operations; the output shape stays this same
 * object. The model only picks the operation and fills in the arguments — every
 * number is still computed by the scoring engine, so there is no value the model
 * could invent.
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

/** Matches catchment names mentioned in the question (for the COMPARE intent). */
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

/**
 * The label for whichever competitor source is in use.
 *
 * Every sentence used to say "OSM" whatever the source was, and that is no longer
 * merely untidy: since the default moved to MAPID, the default note on every answer
 * names the wrong source. In a product whose whole promise is figures you can
 * trace, misnaming where a figure came from is the most expensive mistake there is.
 */
const sourceLabel = (s: PoiSource | undefined) => (s === 'mapid' ? 'MAPID' : 'OSM');

const evidence = (r: ScoredHex) =>
	`N misi = ${r.nTot} (struk ${r.nStruk} · menu ${r.nMenu} · properti ${r.nProp}) · pesaing ${sourceLabel(r.source)} = ${r.osm}`;

/**
 * Runs a structured query against the scoring engine and assembles the
 * justification. Every "Why here?" sentence only cites figures that also appear in
 * the panel, so the user can audit it.
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
 * Runs a structured query — wherever it came from.
 *
 * Split out from `parseQuestion` so a model-produced query runs down exactly the
 * same path as a rule-produced one. There is a single scoring engine, so there are
 * never two versions of the truth: swapping the understanding layer never changes
 * how the numbers are computed.
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
		w.source === 'mapid'
			? `Sumber pesaing (nyata): MAPID Data Premium, ${def.mapidSet}, around:${w.radius}.`
			: `Sumber pesaing (nyata): OpenStreetMap via Overpass API, ${def.osmTag}, around:${w.radius}.`,
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
				why: `${r.osm} pesaing sejenis dalam radius ${w.radius} m, ${pct(r.busy)}% berkondisi ramai. Permintaan ${pct(r.demand)} tidak melampauinya.`,
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
				why: `Permintaan ${pct(r.demand)} · penawaran ${pct(r.supply)} (${r.osm} pesaing OSM, ${pct(r.busy)}% ramai) · ${r.listings} listing ${def.propertyCategory}.`,
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
			why: `Permintaan ${pct(r.demand)} (${r.nStruk} struk, puncak ${formatHour(r.peakHour)}, non-tunai ${pct(r.cashless)}%); ${r.osm} pesaing dalam radius ${w.radius} m dengan ${pct(r.busy)}% ramai — ${supplyPhrase(r, ID)} → penawaran ${pct(r.supply)}; tersedia ${r.listings} listing ${def.propertyCategory}.`,
			evidence: evidence(r)
		})),
		highlight: cands.map((r) => r.id),
		provenance
	};
}
