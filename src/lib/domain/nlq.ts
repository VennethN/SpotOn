import { id as ID } from '$lib/i18n/id';
import { pct } from '$lib/utils/format';
import { CATEGORY_KEYS, CATEGORY_MAP, orderCategories } from './categories';
import {
	DEFAULT_METRIC,
	METRIC_MAP,
	applyFilters,
	needsBusinessType,
	rankBy,
	resolveOrder,
	type MetricFilter
} from './metrics';
import { supplyPhrase } from './narrate';
import { stopTotal } from './transit';
import { scoreAll } from './scoring';
import { resolveUnitOrder } from './units';
import { snapRadius } from './weights';

/* The prose in this file is API output — `headline`, `why`, `evidence`, and the
   provenance notes. The interface never shows it verbatim; what the user reads is
   rebuilt by `narrate` in whichever language is selected. So the sentences here are
   pinned to Indonesian, a stable contract for API consumers. The same goes for the
   structured-query field names and the keyword patterns, which have to match
   Indonesian questions. */
import type {
	AiAnswer,
	Explanation,
	Hex,
	CategoryKey,
	MetricKey,
	PoiSource,
	Recommendation,
	ScoredHex,
	StructuredQuery,
	UnitMetricKey,
	Weights
} from '$lib/types';

/**
 * The business types a question names — ALL of them, not the first.
 *
 * "Kedai kopi dan toko roti" is one question about two types, and reading only the
 * first was the whole reason the map could never answer it: the reply named bakeries
 * and the map coloured itself for cafes. Every pattern here is tried and every hit is
 * kept, so a sentence naming three types comes back with three.
 *
 * These are the SPECIFIC patterns. The catch-all below them is not in this list, and
 * that separation is what makes collecting every match safe: it matches the bare word
 * "makan", which sits inside almost every question about food, so gathered alongside
 * the others it would attach a rice warung to "restoran jepang" and to "toko roti"
 * alike. It fires only when nothing specific did — exactly the fallback it always was.
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
	]
];

/**
 * Last and loosest: anything mentioning food without naming a type lands here, because
 * a rice warung really is the most sensible default for "I want to open somewhere to
 * eat". Kept out of the list above so it can only ever be a fallback — see the note there.
 */
const ANY_FOOD: [RegExp, CategoryKey] = [
	/warteg|warung|rumah makan|nasi|padang|soto|resto|makan|food/i,
	'warteg'
];

/**
 * Every business type a question names, in display order and without repeats.
 *
 * Empty when the question names none, which is the caller's cue to use whatever the
 * reader already had in force rather than to guess at one.
 */
export function categoriesIn(q: string): CategoryKey[] {
	const hits = KEYWORDS.filter(([re]) => re.test(q)).map(([, cat]) => cat);
	if (!hits.length && ANY_FOOD[0].test(q)) hits.push(ANY_FOOD[1]);
	return orderCategories(hits);
}

/**
 * Which figure a question is about, when it names one.
 *
 * Matched in order like the categories above, specific before general. This is the
 * fallback parser's half of what the model does with the `ukuran` argument, and the two
 * have to be able to reach the same measures — otherwise losing the model key silently
 * narrows what the product can answer, which is the worst moment for it to narrow.
 *
 * The patterns are Indonesian first because the questions are, with the English words
 * people actually mix in alongside.
 */
const METRIC_WORDS: Array<[RegExp, MetricKey]> = [
	// A receipt is a receipt. Narrow on purpose: "belanja" on its own is shopping in
	// general and belongs to the busyness measure below.
	[/struk|receipt|nota\b/i, 'struk_dicatat'],
	/*
	 * Premises somebody is OFFERING to let, which is a different question from what
	 * space costs, and it has to be split from it by hand.
	 *
	 * `harga_tempat` owns the bare word "sewa" and keeps it. That measure is the asking
	 * price to BUY, named that way everywhere because MAPID's catalogue holds no rentals
	 * for Jakarta, and "berapa sewa di sini" is a question about money that this is the
	 * only figure for. What lands here instead are the words that ask about the OFFER —
	 * disewakan, dikontrakkan, for rent — because the field survey now records those and
	 * nothing else in the product can answer them.
	 */
	/* The English here has to name the OFFER and only the offer. A bare "for rent" does
	   not: "why did it score 1 for rent" means "on the rent measure" and is a question
	   about the price, and it landed here instead and was answered with a count of
	   rental listings. The Indonesian words carry no such second reading and stay as
	   they are. */
	[
		/disewakan|dikontrakkan|dikontrakan|sewaan|to let|(?:space|premises|unit|shop|place|units|shops)\s+(?:for rent|to rent|available)|available to rent|up for rent/i,
		'sewa_ditawarkan'
	],
	// Price of space, before anything else: "harga" on its own most often means this,
	// and it is the only measure with a currency attached.
	/* The English half was missing outright, and the unit list two functions down had
	   carried `cheap|price` all along, so the two registries disagreed about the same
	   question in the same language. Every English question about money fell past this
	   line to the opportunity score, and "what is the rent at Pusdiklat BPS" came back a
	   grid-wide ranking. `for rent` and `to let` still reach the survey of offers above,
	   because that pattern is tried first: a bare "rent" is a question about the price. */
	[
		/harga|sewa|biaya|mahal|murah|terjangkau|modal kecil|rp\b|rupiah|rent|rental|price|pricing|cost|expensive|cheap|afford|budget/i,
		'harga_tempat'
	],
	// "tempat kosong" is a vacancy, not a gap in the data. The coverage intent below
	// used to take the word `kosong` on its own and answer "here is what we have not
	// surveyed" to a question about empty shopfronts.
	[
		/unit|ruko|kios|tempat usaha|tempat kosong|ruang kosong|dipasarkan|dijual|properti|listing|lowong/i,
		'unit_dipasarkan'
	],
	// Busyness is now a count of the trade standing around a cell, so the words that
	// used to reach for a receipt tally or a clock land here instead. That is the honest
	// answer to all of them: this is the only thing about the crowd that anybody counted.
	[
		/ramai|rame|sepi|keramaian|crowd|busy|sibuk|kunjungan|traffic|pengunjung|footfall|pembeli/i,
		'keramaian'
	],
	[/pesaing|saingan|kompetitor|competitor|rival/i, 'pesaing'],
	[/permintaan|demand/i, 'permintaan'],
	[/penawaran|supply|jenuh|saturasi/i, 'penawaran'],
	[/simpul|halte|stasiun|mrt|krl|lrt|transjakarta|angkutan/i, 'simpul_transit'],
	[/akses|transit|dekat/i, 'akses_transit'],
	[/skor|score|peluang|opportunity|terbaik|bagus|cocok|rekomendasi/i, 'skor']
];

/**
 * Which figure a list of UNITS is about, when the question names one.
 *
 * A second list rather than a mapping off the one above, because the two registries
 * measure different things and the overlap is smaller than it looks. "Harga" on a
 * catchment is a median per m² across everything in range; on a unit it is the number
 * on that one doorway. Collapsing them would make the panel quote a grid statistic as
 * though it were an asking price.
 */
const UNIT_METRIC_WORDS: Array<[RegExp, UnitMetricKey]> = [
	[/per m2|per m²|permeter|per meter|harga tanah/i, 'harga_m2'],
	[/harga|murah|mahal|termurah|termahal|budget|modal|rp\b|rupiah|cheap|price/i, 'harga'],
	[/luas bangunan|bangunan|luas terbangun|building/i, 'luas_bangunan'],
	[/luas tanah|tanah|kavling|land|plot/i, 'luas_tanah'],
	[/lantai|tingkat|floors?|storey/i, 'lantai'],
	[/dekat pusat|jarak|terdekat|nearest|closest/i, 'jarak_pusat'],
	[/pesaing|saingan|kompetitor|competitor|rival/i, 'pesaing_petak'],
	[/akses|transit|stasiun|mrt|krl|lrt|halte/i, 'akses_petak'],
	[/permintaan|demand/i, 'permintaan_petak'],
	[/skor|score|peluang|terbaik|bagus|cocok|opportunity|best/i, 'skor_petak']
];

/** Words that flip a ranking away from the measure's own idea of "best". */
const MOST = /paling banyak|terbanyak|tertinggi|termahal|paling ramai|paling mahal|paling tinggi|most|highest/i;
const LEAST = /paling sedikit|tersedikit|terendah|termurah|paling sepi|paling murah|paling rendah|least|lowest|cheapest/i;

/**
 * Phrases that say WHAT the answer should be a list of.
 *
 * Deliberately narrow, and much narrower than the `unit_dipasarkan` measure above. The
 * two are easy to confuse and mean opposite things: "which AREA has the most units on
 * the market" is a ranking of catchments by a property count, while "which UNIT is
 * cheapest" is a ranking of doorways. So a bare mention of the word ruko does not move
 * the pivot — only a phrase that puts the unit in the subject position does, or one
 * naming the mode outright.
 *
 * Absent from both lists means the mode is left exactly as the reader had it. Most
 * questions say nothing about this, and a parser that guessed would flip the map out
 * from under anyone browsing units the moment they asked about anything else.
 */
const UNIT_PIVOT =
	/per tempat|per unit|per ruko|per bangunan|mode tempat|(?:ruko|kios|unit|toko|tempat|properti|bangunan|listing)\s+(?:usaha\s+)?(?:mana|apa)|daftar (?:tempat|unit|ruko|properti|listing)|tempat yang (?:bisa|dapat) (?:saya |aku )?(?:sewa|beli|tempati)|which (?:unit|shop|place|property)|list of (?:units|places|shops)/i;
const CELL_PIVOT =
	/per petak|per kawasan|per area|per catchment|mode petak|(?:petak|kawasan|daerah|wilayah|area|lokasi)\s+mana|which (?:area|neighbourhood|neighborhood|district)/i;

/**
 * A distance named in the question, in metres.
 *
 * Only an explicit figure with a unit attached. "Sepuluh menit jalan kaki" is a
 * walking TIME, and turning it into metres takes a pace assumption — which would put a
 * number on screen that came from nobody's data, in the one product whose promise is
 * that none of them do.
 */
const RADIUS_WORDS = /(\d{3,4})\s*(?:m\b|meter|metre|metres|meters)/i;

/**
 * A question about one place already named, rather than a search for new ones.
 *
 * "Kenapa Setiabudi Astra" used to parse as a fresh ranking, so the reply was the same
 * five names all over again with the same sentence over them. That is the single most
 * common follow-up there is, and answering it by repeating yourself reads as a guide
 * that has stopped listening.
 */
const WHY = /\b(kenapa|mengapa|knp|kok|why|alasan\w*|jelas\w+|explain)\b/i;

/**
 * What may stand in for a name in a follow-up, and nothing else.
 *
 * The same shape as the greeting rule in `domain/chat`, for the same reason. Strip the
 * why-word, and if what is left is a pointer or is nothing at all, the question is
 * pointing at the place just named. Anything else is a question carrying its own
 * subject: "kenapa lokasi penting" is not a question about a catchment, and answering
 * it with the top one's arithmetic would be answering something nobody asked.
 */
const POINTING =
	/^(itu|ini|tsb|tersebut|dia|nya|yang itu|yang ini|yang pertama|yang teratas|yang nomor satu|nomor satu|that|this|it|that one|the first|the top one)?[\s,.!?~-]*$/i;

/** Politeness that can sit inside a follow-up without giving it a subject of its own. */
const ASIDE = /\b(sih|dong|ya|yah|kah|deh|nih|gitu|memangnya|emang|so|then|exactly|please)\b/gi;

/**
 * How strongly a sentence names one catchment: the length of its words found in it.
 *
 * Words of two letters or fewer are skipped, because "MRT" and "BCA" aside, the short
 * ones are prepositions that appear in every question ever asked.
 */
function nameHit(name: string, ql: string): number {
	return name
		.toLowerCase()
		.split(/\s+/)
		.filter((wd) => wd.length > 2)
		.reduce((acc, wd) => acc + (ql.includes(wd) ? wd.length : 0), 0);
}

/**
 * The one name in `names` a sentence names most strongly, or null if it names none.
 *
 * Whole words only, and only names distinctive enough to be worth looking for. This is
 * asked of the WHOLE GRID now, not just of the handful the conversation named, so the
 * bar earns its place: eighty-seven catchments are a single word and Damai, Duri, Karet,
 * Depok and Tebet are ordinary ones. Without it, "kawasannya damai" is a question about a
 * catchment in South Jakarta and the reader is answered about a place they never named.
 * The same test `domain/grounded` applies to a written reply, for the same reason.
 */
function distinctive(name: string): boolean {
	return name.includes(' ') || name.length >= 6;
}

/**
 * How much of a name a sentence actually contains, 0 to 1.
 *
 * A SHARE rather than a count, and that is what stops one word of a long name from
 * standing in for the whole thing. "Harga karet berapa sekarang" contains the first word
 * of "Karet Sudirman 3" and none of the rest, and read as a hit it turns a question about
 * the price of rubber into a question about a catchment in Setiabudi.
 *
 * Whole words only, so "duri" is not found inside "berduri" and "karet" not inside
 * "karetnya".
 */
function nameShare(name: string, ql: string): number {
	const words = name
		.toLowerCase()
		.split(/\s+/)
		.filter((wd) => wd.length > 2);
	if (!words.length) return 0;
	const total = words.reduce((acc, wd) => acc + wd.length, 0);
	const found = words.reduce(
		(acc, wd) =>
			acc +
			(new RegExp(`\\b${wd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(ql) ? wd.length : 0),
		0
	);
	return found / total;
}

/**
 * Most of a name, not a corner of one.
 *
 * Three fifths lets somebody shorten a catchment the way people do, saying Setiabudi for
 * Setiabudi Astra or Bendungan for Bendungan Hilir, while refusing a single common word
 * that happens to open a longer name.
 */
const NAME_SHARE = 0.6;

function bestName(q: string, names: readonly string[]): string | null {
	const ql = ` ${q.toLowerCase()} `;
	let best: string | null = null;
	let hit = 0;
	for (const name of names) {
		if (!distinctive(name)) continue;
		const share = nameShare(name, ql);
		if (share < NAME_SHARE) continue;
		// Longer names win ties, since a sentence containing all of "Blok M BCA" contains
		// all of "Blok M" too and the fuller reading is the one that was meant.
		const weight = share * name.length;
		if (weight > hit) {
			hit = weight;
			best = name;
		}
	}
	return best;
}

/**
 * Phrases that ask for a LIST rather than for one place.
 *
 * The line between "tell me about Tosari" and "where should I open near Tosari" is not
 * the presence of a name, because both carry one. It is whether the question is asking
 * the grid to be sorted. So a question that names a place is about that place UNLESS it
 * asks for a ranking, and this is what asking for a ranking looks like.
 */
const RANKING_ASK =
	/\b(di ?mana|mana yang|mana saja|kawasan mana|petak mana|tempat mana|urutkan|peringkat|daftar|rekomendasi|where|which|top \d|list|rank|recommend)\b/i;

/** Two named places held against each other, which is a comparison and not an explanation. */
const COMPARE_ASK = /\b(banding\w*|compare|vs|versus|lebih (?:bagus|baik|murah|mahal|ramai)\b)/i;

/**
 * The catchment a question is about, read against what is on screen and on the grid.
 *
 * TWO WAYS IN, AND THE SECOND ONE WAS MISSING.
 *
 * A follow-up can POINT ("kenapa yang itu"), which needs a why-word because there is
 * nothing else in the sentence to go on. Or it can NAME ("what is the rent at Pusdiklat
 * BPS"), which needs no why-word at all and used to get none of this: with no "kenapa" in
 * it the question fell through to a ranking, and a question about one place's price came
 * back as the grid's five best catchments by opportunity score.
 *
 * Naming a place is enough on its own, then, unless the question is asking for a list or
 * holding two places against each other. Those are the two shapes that name a place and
 * are not about it.
 */
function explainTarget(q: string, said: readonly string[]): string | null {
	if (!said.length) return null;
	const named = bestName(q, said);
	if (named && !RANKING_ASK.test(q) && !COMPARE_ASK.test(q)) return named;
	if (!WHY.test(q)) return null;
	if (named) return named;
	const rest = q
		.toLowerCase()
		.replace(WHY, ' ')
		.replace(ASIDE, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^[,.!?~-]+/, '')
		.trim();
	// "Kenapa?" on its own, or "kenapa yang itu": pointing at the last thing said.
	return POINTING.test(rest) ? said[0] : null;
}

/**
 * Translates a natural-language question into a structured query.
 *
 * The model does this job when a key is configured; this is what runs when it is not,
 * and the two produce the same object so everything downstream is identical either way.
 * Neither of them computes anything: they choose an operation, a measure and a
 * direction, and the scoring engine produces every number from the data.
 */
export function parseQuestion(
	q: string,
	w: Weights,
	fallback: CategoryKey | readonly CategoryKey[],
	/**
	 * The catchments the conversation has just named, newest answer first.
	 *
	 * The only thing this parser is told about the thread, and it is told it because a
	 * follow-up is by definition a sentence that does not carry its own subject. Empty
	 * on a first question, and on every caller that has no conversation to speak of, in
	 * which case nothing here behaves differently from before it existed.
	 */
	said: readonly string[] = []
): StructuredQuery {
	// Every type the question names, or the ones the reader already had if it names
	// none. Never a hard-coded default: a question that said nothing about the business
	// type is asking about the one on screen, not about coffee.
	const named = categoriesIn(q);
	const out: StructuredQuery = {
		intent: 'RANK',
		metrik: 'gap permintaan − penawaran',
		kategori: named.length ? named : orderCategories(typeof fallback === 'string' ? [fallback] : fallback),
		ukuran: DEFAULT_METRIC,
		radius_m: w.radius,
		filter: {},
		filters: [],
		urut: 'desc',
		limit: 5
	};

	// Unit before cell: "ruko mana di kawasan Blok M" names both, and the thing being
	// ranked is the one in the subject position.
	if (UNIT_PIVOT.test(q)) out.pivot = 'unit';
	else if (CELL_PIVOT.test(q)) out.pivot = 'cell';

	// A distance named in the question wins over the one the reader had set, and the
	// query is then RUN at it — see `runQuery`. Snapped, because the median asking price
	// only exists at the stops `join-property` computed.
	const askedRadius = q.match(RADIUS_WORDS);
	if (askedRadius) out.radius_m = snapRadius(Number(askedRadius[1]));

	// Which figure a list of UNITS is sorted by. Only read when the question is about
	// units at all: on a catchment ranking it is a field nothing downstream looks at,
	// and filling it in anyway would leave the unit list silently re-sorted the next
	// time the reader switched pivot by hand.
	if (out.pivot === 'unit') {
		for (const [re, key] of UNIT_METRIC_WORDS) {
			if (re.test(q)) {
				out.ukuran_unit = key;
				break;
			}
		}
	}

	// The measure the question is about. Read before the intent, because a question can
	// name a figure without naming a shape — "seberapa ramai di sini" is a ranking by
	// how busy it is, and nothing in it says the word "rank".
	for (const [re, key] of METRIC_WORDS) {
		if (re.test(q)) {
			out.ukuran = key;
			break;
		}
	}

	/* Read FIRST, because a why-question can carry any other word in the language and
	   still be a why-question. "Kenapa Blok M sudah jenuh" has `jenuh` in it and is not
	   a request for the five most crowded catchments, it is a request for one place's
	   reasons. It only fires when there is a name to point at, so a first question can
	   never land here. */
	const explains = explainTarget(q, said);
	if (explains) {
		out.intent = 'EXPLAIN';
		/* The measure read above is KEPT, and that is the whole difference between "why is
		   it on the list" and "what is the rent there". Both name one place, and a shape
		   that always explained the score answered the second with the first. */
		out.metrik =
			(out.ukuran ?? DEFAULT_METRIC) === DEFAULT_METRIC
				? 'rincian skor satu catchment'
				: `${out.ukuran} di satu catchment`;
		out.target = [explains];
		out.limit = 1;
		/* No filters on an explanation. One named place is not a pool to narrow, and a
		   chip row saying "cheap space" under a reply about one catchment would claim a
		   narrowing that never happened. Deleting them also skips the two blocks at the
		   foot of this function, which are guarded on `out.filter` for exactly this. */
		delete out.filter;
		delete out.filters;
	} else if (/belum terdata|belum ada data|tidak ada data|data\w*\s+kosong|cakupan data|cakupan/i.test(q)) {
		out.intent = 'COVERAGE';
		out.metrik = 'N titik data misi per catchment';
		out.ukuran = DEFAULT_METRIC;
		out.urut = 'asc';
		out.limit = 99;
		delete out.filter;
		delete out.filters;
	} else if (/jenuh|saturasi|penuh|hindari|jangan/i.test(q)) {
		out.intent = 'FLAG_SATURATED';
		out.metrik = 'penawaran efektif (pesaing × keramaian)';
	} else if (/banding|compare|\bvs\b|versus/i.test(q)) {
		out.intent = 'COMPARE';
		out.metrik = 'profil lengkap 2 catchment';
		out.limit = 2;
	}

	// The measure's own idea of "best" unless the question overrides it. Cheapest space
	// and most footfall are both "best", and they sit at opposite ends.
	const asked = MOST.test(q) ? 'desc' : LEAST.test(q) ? 'asc' : undefined;
	if (out.intent === 'RANK') {
		out.urut = resolveOrder(out.ukuran ?? DEFAULT_METRIC, asked);
		out.metrik = `peringkat menurut ${out.ukuran}`;
	}
	// Resolved against the UNIT measure, never against the catchment one above. The two
	// registries disagree about which end is "best" often enough for the reuse to be
	// wrong quietly — see `resolveUnitOrder`.
	if (out.ukuran_unit) out.urut_unit = resolveUnitOrder(out.ukuran_unit, asked);

	if (out.filter && /modal kecil|murah|terjangkau/i.test(q)) {
		out.filter.ruang_sewa_tersedia = true;
		out.filter.tier_harga = 'rendah';
		out.filters?.push({ ukuran: 'unit_dipasarkan', arah: 'ada' });
		// Only where the price is not itself what is being ranked — filtering a ranking
		// to its own bottom third and then ranking it says the same thing twice while
		// throwing away two thirds of the answer.
		if (out.ukuran !== 'harga_tempat') out.filters?.push({ ukuran: 'harga_tempat', arah: 'rendah' });
	}
	if (out.filter && /dekat|mrt|stasiun|transit/i.test(q)) {
		// The radius the query will RUN at, which is not necessarily the one the reader
		// had set — the question may have named its own.
		out.filter.dalam_catchment_transit = `${out.radius_m} m`;
		if (out.ukuran !== 'akses_transit' && out.ukuran !== 'simpul_transit') {
			out.filters?.push({ ukuran: 'akses_transit', arah: 'tinggi' });
		}
	}
	return out;
}

/**
 * A list of names as one Indonesian phrase: "A", "A dan B", "A, B, dan C".
 *
 * Indonesian on purpose, like every other sentence in this file: it is API output, and
 * the interface rebuilds what the reader sees from the structured fields beside it. See
 * the note at the top.
 */
function joinID(parts: string[]): string {
	if (parts.length < 2) return parts[0] ?? '';
	return `${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
}

/** Matches catchment names mentioned in the question (for the COMPARE intent). */
function matchNames(q: string, rows: ScoredHex[]): ScoredHex[] {
	const ql = q.toLowerCase();
	return rows
		.map((r) => ({ r, hit: nameHit(r.name, ql) }))
		.filter((m) => m.hit > 0)
		.sort((a, b) => b.hit - a.hit)
		.slice(0, 2)
		.map((m) => m.r);
}

/**
 * The catchments an answer about NAMED PLACES is about, in the order they were named.
 *
 * The names the query carries are tried first and the question's own words second, and
 * that order is the point rather than a preference. `target` is what the understanding
 * layer resolved against the conversation, and "bandingkan dua teratas" or "kenapa yang
 * itu" carry no name at all — read from the sentence alone, both come back empty and get
 * answered as though nobody had named anything, which is exactly what they used to do.
 * Falling through to the sentence is what keeps the rule parser and any older client
 * working, since neither fills `target` in.
 */
function namedRows(
	query: StructuredQuery,
	question: string,
	rows: ScoredHex[],
	want: number
): ScoredHex[] {
	const picked: ScoredHex[] = [];
	for (const target of query.target ?? []) {
		const hit = matchNames(target, rows)[0];
		if (hit && !picked.some((r) => r.id === hit.id)) picked.push(hit);
		if (picked.length === want) return picked;
	}
	for (const hit of matchNames(question, rows)) {
		if (!picked.some((r) => r.id === hit.id)) picked.push(hit);
		if (picked.length === want) break;
	}
	return picked;
}

/**
 * The label for whichever competitor source is in use.
 *
 * Every sentence used to say "OSM" whatever the source was, and that is no longer
 * merely untidy: since the default moved to MAPID, the default note on every answer
 * names the wrong source. In a product whose whole promise is figures you can
 * trace, misnaming where a figure came from is the most expensive mistake there is.
 */
const sourceLabel = (s: PoiSource | undefined) =>
	s === 'mapid' ? 'MAPID' : s === 'osm' ? 'OSM' : 'MAPID/OSM';

/* Every figure quoted here is a count somebody published. The line used to lead with
   a tally of mission points that were generated, which put an invented N in front of
   the evidence for every claim on screen. */
const evidence = (r: ScoredHex) =>
	`Usaha lain di sekitar (${sourceLabel(r.source)}) = ${r.density} · pesaing ${sourceLabel(r.source)} = ${r.osm} · unit dipasarkan (MAPID) = ${r.propCovered ? r.units : 'belum terdata'}`;

/**
 * Runs a structured query against the scoring engine and assembles the
 * justification. Every "Why here?" sentence only cites figures that also appear in
 * the panel, so the user can audit it.
 */
export function answer(
	question: string,
	catchments: Hex[],
	w: Weights,
	fallback: CategoryKey | readonly CategoryKey[],
	/** The catchments the conversation just named — see `parseQuestion`. */
	said: readonly string[] = []
): AiAnswer {
	/* The conversation's places first, then every name on the grid.
	   
	   A reader can name a catchment the conversation never mentioned: they clicked it on
	   the map, or they simply know it. Read against the thread alone, "what is the rent at
	   Pusdiklat BPS" names nothing this parser has heard of and is answered as a ranking.
	   Order matters, because the first strongest hit wins and a place just discussed is
	   the better reading of an ambiguous one. */
	const known = [...said, ...catchments.map((c) => c.name).filter((n): n is string => Boolean(n))];
	return runQuery(parseQuestion(question, w, fallback, known), question, catchments, w);
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
	weights: Weights
): AiAnswer {
	const cats = query.kategori;
	const defs = cats.map((k) => CATEGORY_MAP[k]);
	/* The names of the types this answer was computed over, written out.
	   Every sentence below used to take one definition and quote it; with a set, quoting
	   the first would name one business type in a reply whose figures counted several,
	   which is the one kind of mistake this file exists to avoid. */
	const def = {
		name: joinID(defs.map((d) => d.name)),
		/* The premises count is NOT per business type — it is every commercial listing in
		   range, which is why the same figure serves all thirteen. Naming one property
		   category beside it is a fair shorthand for a question about one type; joined
		   across several it reads as a split that was never made ("12 unit Coffee Shop
		   dan Retail F&B"), so the set drops the label and says what the figure is. */
		propertyCategory: defs.length === 1 ? defs[0].propertyCategory : 'komersial'
	};
	/* The query's radius, not the reader's, and this is the whole reason `radius_m`
	   stopped being a copy of the settings. A question that names a distance has to be
	   ANSWERED at that distance: computing at 800 m and then moving the map's slider to
	   500 would leave every figure in the reply describing a catchment the reader is no
	   longer looking at. Snapped, because a median asking price only exists at the stops
	   `join-property` computed. */
	const w: Weights = { ...weights, radius: snapRadius(query.radius_m) };
	query.radius_m = w.radius;
	/**
	 * NO BUSINESS TYPE NAMED, AND THIS QUESTION NEEDS ONE.
	 *
	 * Five of the nine measures are facts about the place and answer perfectly well
	 * without a trade behind them: how busy it is, what space costs, how much is on the
	 * market, and the two transit readings. Four are not — rivals of what, saturated
	 * with what, a good opportunity for what — and the two shaped intents below are in
	 * the same position.
	 *
	 * Asking back is the honest move and it is cheap. The alternative was what this used
	 * to do: fall back to coffee, and answer a question about coffee that nobody asked,
	 * with a map that recoloured itself to match.
	 */
	const wantsType =
		query.intent === 'FLAG_SATURATED' ||
		query.intent === 'COVERAGE' ||
		/* An explanation is an explanation OF a score, and a score is always a score for
		   a trade. Explaining one with no business type named would be reading out how
		   busy a street is and calling it the reason a shop nobody named belongs there. */
		query.intent === 'EXPLAIN' ||
		(query.intent === 'RANK' && needsBusinessType(query.ukuran ?? DEFAULT_METRIC));
	if (!cats.length && wantsType) {
		return {
			query,
			needsCategory: true,
			headline:
				'Pertanyaan ini perlu jenis usaha dulu, karena 83 untuk kedai kopi bukan 83 untuk laundry. Mau buka usaha apa?',
			items: [],
			highlight: [],
			provenance: [
				'Tidak ada operasi yang dijalankan: ukuran yang ditanyakan tidak bisa dibaca tanpa jenis usaha.',
				`Jenis usaha yang tersedia: ${CATEGORY_KEYS.join(', ')}.`
			]
		};
	}

	const rows = scoreAll(catchments, cats, w);
	const provenance = [
		`Alur: pertanyaan → parsing niat → function-calling ke daftar operasi spasial terbatas → PostGIS mengeksekusi → peta & panel diperbarui.`,
		`Angka tidak dikarang model. Model memilih operasinya, dan boleh menuliskan kalimat jawabannya, tapi seluruh nilai dihitung database lalu ditautkan ke titik sumbernya, dan angka di kalimat itu wajib berasal dari nilai-nilai ini.`,
		w.source === 'mapid'
			? `Sumber pesaing: MAPID Data Premium, ${defs.map((d) => d.mapidSet).join(' + ')}, around:${w.radius}.`
			: w.source === 'osm'
				? `Sumber pesaing: OpenStreetMap via Overpass API, ${defs.map((d) => d.osmTag ?? 'tidak ada tag OSM').join(' + ')}, around:${w.radius}.`
				: `Sumber pesaing: dua survei sekaligus. MAPID Data Premium (${defs.map((d) => d.mapidSet).join(' + ')}) dan OpenStreetMap via Overpass API (${defs.map((d) => d.osmTag ?? 'tidak ada tag OSM').join(' + ')}), around:${w.radius}.`,
		...(w.source === 'both'
			? [
					`Dua survei TIDAK dijumlahkan. Keduanya mensurvei kota yang sama, jadi cacahnya sebagian besar toko yang sama dihitung dua kali, dan tidak ada id bersama untuk menyandingkannya. Tiap petak dibaca dari survei yang memang menjangkaunya, dan dari yang mencatat lebih banyak kalau dua-duanya menjangkau. Angkanya jadi batas bawah: setidaknya sekian, karena ada yang benar-benar menghitungnya.`
				]
			: []),
		/* Said out loud whenever more than one type was asked about, because it is the
		   arithmetic the reader cannot see: the outlets of all of them are counted as one
		   pool of rivals, and all of them come back out of the trade around the cell. */
		cats.length > 1
			? `${cats.length} jenis usaha ditanyakan sekaligus: pesaingnya dijumlahkan jadi satu, dan semuanya sama-sama dikeluarkan dari hitungan usaha lain di sekitarnya. Satu petak yang salah satu jenisnya belum disurvei tidak diberi nilai sama sekali.`
			: cats.length === 1
				? `Satu jenis usaha yang ditanyakan: ${defs[0].name}.`
				: `Tidak ada jenis usaha yang disebut, jadi tidak ada pesaing yang dihitung dan tidak ada skor peluang yang diberikan. Keramaian di bawah ini adalah cacah semua usaha dalam radius, apa pun jenisnya.`,
		`Sisi permintaan: jumlah usaha lain dalam radius yang sama, sumber yang sama, dikurangi pesaing sejenis.`,
		`Harga dan unit yang dipasarkan: katalog properti komersial MAPID. Semuanya harga JUAL, bukan sewa.`
	];

	/* Coverage is now a fact about the survey, not about a flag that was rolled at build
	   time. A cell is uncovered when the ACTIVE source has never read its city, which is
	   exactly the condition that makes the engine refuse to score it. */
	if (query.intent === 'COVERAGE') {
		const nd = rows.filter((r) => !r.covered);
		return {
			query,
			headline: `${nd.length} petak belum disurvei ${sourceLabel(w.source)} untuk ${def.name}. Petak tersebut tidak diberi nilai, ditampilkan apa adanya, dan diusulkan sebagai prioritas survei berikutnya.`,
			items: nd.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: null,
				why: `Kotanya belum disurvei ${sourceLabel(w.source)} untuk ${def.name.toLowerCase()}, jadi pesaingnya tidak dihitung, bukan nol. Aksesnya sendiri terukur: ${stopTotal(r.transit)} simpul transit dalam radius ${w.radius} m.`,
				evidence: evidence(r)
			})),
			highlight: nd.map((r) => r.id),
			provenance
		};
	}

	if (query.intent === 'FLAG_SATURATED') {
		const sat = rows
			.filter((r) => r.covered)
			.sort((a, b) => (b.supply ?? 0) - (a.supply ?? 0))
			.slice(0, 5);
		return {
			query,
			headline: `Lima petak dengan pesaing terpadat untuk ${def.name} dibanding usaha lain di sekitarnya. Celah pasarnya paling sempit, jadi sebaiknya dihindari.`,
			items: sat.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: r.supply,
				why: `${r.osm} pesaing sejenis dalam radius ${w.radius} m, dari ${r.density} usaha lain di sekitarnya. Sepadat itu jarang menyisakan celah untuk pendatang baru.`,
				evidence: evidence(r)
			})),
			highlight: sat.map((r) => r.id),
			provenance
		};
	}

	/* ONE PLACE, TAKEN APART. Every other intent answers "which ones"; this one answers
	   the question a reader asks the moment they have been handed a list.

	   Nothing new is computed for it. The row was scored by the same engine on the same
	   grid as every ranking, and what this adds is only that its parts are handed over
	   separately, so the reply can say what the score is made of rather than quoting the
	   score back. */
	if (query.intent === 'EXPLAIN') {
		const row = namedRows(query, question, rows, 1)[0] ?? null;
		/* WHAT the question was about, which is chosen separately from the fact that it
		   was about one place. Read here rather than assumed, because this shape used to
		   assume the opportunity score and therefore answered "what is the rent at
		   Pusdiklat BPS" with a score breakdown. */
		const asked = query.ukuran ?? DEFAULT_METRIC;
		// Named, so the reader can see which place was read, and so a client repeating
		// the query gets the same answer rather than a fresh guess at the sentence.
		query.target = row ? [row.name] : [];
		if (!row) {
			return {
				query,
				headline:
					'Sebutkan kawasan mana yang mau dijelaskan, misalnya "kenapa Bendungan Hilir".',
				items: [],
				highlight: [],
				provenance
			};
		}
		/* Null on a question that really was about the score, where leading with it would
		   print one number twice, and null-VALUED where this catchment has no reading for
		   the measure at all. The second is said out loud rather than shown as a zero:
		   371 of these are streets nobody has walked. */
		const read = asked === DEFAULT_METRIC ? null : (METRIC_MAP[asked] ?? METRIC_MAP[DEFAULT_METRIC]).read(row);
		const measure =
			asked === DEFAULT_METRIC
				? null
				: { ukuran: asked, value: read, text: read === null ? 'belum terukur' : metricText(asked, read) };

		const explain: Explanation = {
			id: row.id,
			name: row.name,
			measure,
			radius: w.radius,
			// An unsurveyed cell is explained as unsurveyed. Every figure that depends on
			// counting competitors is null there, and reading a street nobody has read as
			// an empty one is the mistake this whole file is built to avoid.
			covered: row.covered !== false,
			score: row.score,
			demand: row.demand,
			supply: row.supply,
			density: row.density,
			rivals: row.osm,
			stops: stopTotal(row.transit),
			access: row.access,
			units: row.units,
			price: row.price,
			priceLevel: row.priceLevel,
			costFactor: row.costFactor
		};
		return {
			query,
			explain,
			headline: row.covered === false
				? `${row.name} belum disurvei ${sourceLabel(w.source)} untuk ${def.name}, jadi tidak diberi nilai. Yang terukur di sana: ${stopTotal(row.transit)} simpul transit dan ${row.units} unit komersial dipasarkan dalam radius ${w.radius} m.`
				: measure
					? `${asked} di ${row.name}: ${measure.text}. Skor peluangnya sendiri ${pct(row.score)} dari 100 untuk ${def.name}.`
					: `Rincian skor ${row.name} untuk ${def.name}: keramaian ${pct(row.demand)}%, penawaran ${pct(row.supply)}%, skor ${pct(row.score)}.`,
			items: [
				{
					id: row.id,
					name: row.name,
					value: row.score,
					// The figure the question asked about travels beside the score, exactly
					// as it does on a ranking row, so a list of one is read the same way a
					// list of five is.
					measure: measure && measure.value !== null ? { ...measure, value: measure.value } : null,
					why: whyLine(row, asked, read ?? row.score ?? 0, def, w),
					evidence: evidence(row)
				}
			],
			highlight: [row.id],
			provenance
		};
	}

	if (query.intent === 'COMPARE') {
		/* Read from the query's own names before the sentence, so "bandingkan dua teratas"
		   works at all. It used to read the sentence only, which meant the two names had
		   to be typed out in the very message asking for the comparison — and a reader who
		   has just been shown a ranking does not type them out, they point at it. */
		const picked = namedRows(query, question, rows, 2);
		query.target = picked.map((r) => r.name);
		if (picked.length < 2) {
			return {
				query,
				headline: 'Sebutkan dua nama catchment untuk dibandingkan, misalnya "Bandingkan Blok M BCA dan Bendungan Hilir".',
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
				? 'kawasannya lebih ramai'
				: 'pesaing sejenisnya lebih tipis';
		return {
			query,
			headline: `Untuk ${def.name}, ${win.name} unggul (${pct(win.score)} vs ${pct(lose.score)}), terutama karena ${reason}.`,
			items: picked.map<Recommendation>((r) => ({
				id: r.id,
				name: r.name,
				value: r.score,
				why: `${r.density} usaha lain di sekitarnya, jadi keramaian ${pct(r.demand)}% · ${r.osm} pesaing ${sourceLabel(r.source)}, jadi penawaran ${pct(r.supply)}% · ${r.units} unit ${def.propertyCategory} dipasarkan.`,
				evidence: evidence(r)
			})),
			highlight: picked.map((r) => r.id),
			provenance
		};
	}

	// RANK — by whichever figure the question was about.
	const key = query.ukuran ?? DEFAULT_METRIC;
	const metric = METRIC_MAP[key] ?? METRIC_MAP[DEFAULT_METRIC];
	const order = query.urut === 'asc' ? 'asc' : 'desc';

	let pool = rows.filter((r) => r.covered);
	// The old boolean filter still works, and the new ones run alongside it: a query
	// object built by an older client keeps behaving exactly as it did. What it reads is
	// now premises genuinely on the market, since the per-category rental column it used
	// to read was generated and the catalogue holds no rentals to replace it with.
	if (query.filter?.ruang_sewa_tersedia) pool = pool.filter((r) => r.units > 0);
	const beforeFilters = pool.length;
	pool = applyFilters(pool, (query.filters ?? []) as MetricFilter[]);

	const ranked = rankBy(pool, key, order).slice(0, query.limit);
	const skipped = rows.filter((r) => !r.covered).length;
	// Cells dropped for having no reading on the measure asked about. Counted and said
	// out loud, because a list of six where the reader expected the whole city is a
	// finding about the data, not a short answer.
	const unmeasured = pool.length - rankBy(pool, key, order).length;
	const filtered = beforeFilters - pool.length;

	return {
		query,
		headline:
			`${ranked.length} catchment teratas ${def.name ? `untuk ${def.name} ` : ''}menurut ${key} (${order === 'asc' ? 'terkecil' : 'terbesar'} dulu).` +
			(filtered ? ` ${filtered} catchment disaring keluar oleh filter.` : '') +
			(unmeasured ? ` ${unmeasured} catchment belum terukur untuk ${key} dan tidak diperingkat.` : '') +
			(skipped ? ` ${skipped} catchment dikecualikan karena kotanya belum disurvei ${sourceLabel(w.source)}.` : ''),
		items: ranked.map<Recommendation>(({ row: r, value }) => ({
			id: r.id,
			name: r.name,
			// The opportunity score stays the row's headline number whatever was asked,
			// so a list never loses the one figure the rest of the product is about.
			value: r.score,
			// …and the measure that was actually asked for travels beside it. Null when
			// they are the same figure, rather than printing one number twice.
			measure: key === 'skor' ? null : { ukuran: key, value, text: metricText(key, value) },
			why: whyLine(r, key, value, def, w),
			evidence: evidence(r)
		})),
		highlight: ranked.map(({ row }) => row.id),
		provenance
	};
}

/**
 * One row's value, written out.
 *
 * Indonesian, like the rest of this module's prose: it is API output, and the interface
 * rebuilds what the reader sees in their own language from the structured fields beside
 * it. See the note at the top of this file.
 */
function metricText(key: MetricKey, v: number): string {
	const kind = METRIC_MAP[key]?.kind;
	if (kind === 'pct') return `${pct(v)}%`;
	if (kind === 'rupiah') return `Rp ${Math.round(v).toLocaleString('id-ID')}/m²`;
	return String(Math.round(v));
}

/**
 * Why this catchment is on the list.
 *
 * Leads with the figure that was asked about and then gives the context that figure
 * needs to mean anything — a busy catchment with forty rivals and a busy one with two
 * are not the same finding. The opportunity score's own sentence is kept as it was,
 * because that question has a different shape: it is about a balance rather than a
 * quantity.
 */
function whyLine(
	r: ScoredHex,
	key: MetricKey,
	value: number,
	def: { name: string; propertyCategory: string },
	w: Weights
): string {
	if (key === 'skor') {
		return `${r.density} usaha lain dalam radius ${w.radius} m, jadi keramaian ${pct(r.demand)}%. ${r.osm} pesaing sejenis, ${supplyPhrase(r, ID)}, jadi penawaran ${pct(r.supply)}%. ${r.units} unit ${def.propertyCategory} dipasarkan di sekitarnya.`;
	}
	const lead = `${key} = ${metricText(key, value)}`;
	const context = `Skor peluang ${pct(r.score)} · ${r.density} usaha lain di sekitarnya · ${r.osm} pesaing dalam radius ${w.radius} m`;
	if (key === 'harga_tempat') {
		return `${lead}. Harga JUAL yang diminta penjual, bukan sewa, karena katalog MAPID tidak memuat listing sewa untuk Jakarta. ${r.units} unit komersial dipasarkan di sekitarnya. ${context}.`;
	}
	if (key === 'unit_dipasarkan') {
		return `${lead} unit komersial dipasarkan dalam radius ${w.radius} m${r.price !== null ? `, median ${metricText('harga_tempat', r.price)}` : ', tidak satu pun memasang harga'}. ${context}.`;
	}
	/* The two field measures say WHO counted and WHEN, because that is the whole
	   difference between them and everything else on this row. A competitor count is a
	   catalogue's claim about a street; these are what one person wrote down on one
	   visit, and a sentence that hid that would be quoting a sample as a census. */
	if (key === 'struk_dicatat') {
		const f = r.field;
		const cash =
			f?.nontunai === null || f?.nontunai === undefined
				? 'terlalu sedikit untuk membaca pangsa nontunai'
				: `${pct(f.nontunai)}% nontunai`;
		return `${lead} struk dicatat surveyor MAPID Apps di petak ini, ${cash}. Ini hitungan catatan lapangan, bukan jumlah transaksi yang terjadi. ${context}.`;
	}
	if (key === 'sewa_ditawarkan') {
		const total = r.field?.properti ?? 0;
		return `${lead} tempat tercatat sedang disewakan, dari ${total} catatan properti di petak ini. Surveyor mencatat penawarannya, bukan harganya. ${context}.`;
	}
	return `${lead}. ${context}.`;
}
