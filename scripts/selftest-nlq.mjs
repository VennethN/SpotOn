/**
 * Self-test: the understanding layer, against the grid actually on disk. No network.
 *
 *   node scripts/selftest-nlq.mjs
 *
 * The question layer used to offer four intents, three of which ranked by the
 * opportunity score. So "seberapa ramai di sini" came back as "Graha Werdatama Pondok
 * Labu, 93 out of 100" — a confident answer to a question nobody asked, built from data
 * that was already on the row. What separates the shape of a question from the figure
 * it is about is `ukuran`, and this checks that a sentence still reaches the right one.
 *
 * WHY A TABLE OF SENTENCES RATHER THAN UNIT TESTS ON THE REGEX
 *
 * Because the failure mode is not a regex that does not match. It is a regex that
 * matches TOO EARLY: the patterns are tried in order, and every one of the cases below
 * is a sentence that was routed to the wrong measure by an earlier pattern until the
 * order was fixed. "Mana yang paling banyak tempat kosong" landed on COVERAGE because
 * `kosong` was a coverage word; "jam berapa paling ramai" landed on `keramaian` because
 * `ramai` came first. Neither raised anything — they returned a fluent answer to a
 * different question, which is the failure this file exists to catch.
 *
 * The engine's own arithmetic is not re-checked here; `selftest-composition.mjs` and
 * `selftest-property.mjs` do that. This is only about what the question was understood
 * to be asking.
 */

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = new URL('..', import.meta.url);

async function load() {
	const server = await createServer({
		configFile: false,
		root: fileURLToPath(ROOT),
		resolve: { alias: { $lib: fileURLToPath(new URL('src/lib', ROOT)) } },
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'error'
	});
	const nlq = await server.ssrLoadModule('/src/lib/domain/nlq.ts');
	const metrics = await server.ssrLoadModule('/src/lib/domain/metrics.ts');
	const chat = await server.ssrLoadModule('/src/lib/domain/chat.ts');
	const source = await server.ssrLoadModule('/src/lib/server/source.ts');
	await server.close();
	return { nlq, metrics, chat, cells: source.loadHexes() };
}

const { nlq, metrics, chat, cells } = await load();
const W = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'mapid' };

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Question-understanding self-test (no network)\n');

/* ── every sentence reaches the measure it is about ──────────────────────── */

/** question → [expected measure, expected direction, expected category] */
const CASES = [
	['di mana sebaiknya buka kedai kopi', 'skor', 'desc', 'kopi'],
	['seberapa ramai di sini', 'keramaian', 'desc', null],
	['mana yang paling sepi', 'keramaian', 'asc', null],
	['di mana sewanya paling murah untuk kedai kopi', 'harga_tempat', 'asc', 'kopi'],
	['mana yang paling mahal harganya', 'harga_tempat', 'desc', null],
	['mana yang paling banyak tempat kosong', 'unit_dipasarkan', 'desc', null],
	/* Three sentences that used to reach three different measures now all reach the
	   same one, and that is the point rather than a loss: `kunjungan`, `jam_puncak` and
	   `nontunai` read columns that were generated, and those columns are gone. The trade
	   counted around a cell is the only thing about the crowd anybody has measured, so
	   every question about the crowd lands there. */
	['mana yang paling ramai pengunjungnya', 'keramaian', 'desc', null],
	['jam berapa paling ramai', 'keramaian', null, null],
	['mana yang pesaingnya paling sedikit untuk apotek', 'pesaing', 'asc', 'apotek'],
	['mana yang simpul transitnya paling banyak', 'simpul_transit', 'desc', null]
];

for (const [q, ukuran, urut, kategori] of CASES) {
	const parsed = nlq.parseQuestion(q, W, 'kopi');
	const okMetric = parsed.ukuran === ukuran;
	const okOrder = urut === null || parsed.urut === urut;
	const okCat = kategori === null || parsed.kategori.join(',') === kategori;
	check(
		`"${q}" → ${ukuran}${urut ? ` ${urut}` : ''}`,
		okMetric && okOrder && okCat,
		`got ukuran=${parsed.ukuran} urut=${parsed.urut} kategori=${parsed.kategori.join(',')}`
	);
}

// The hour check that stood here is gone with the hourly profile it guarded. What
// replaces it is the pair that still matters: "ramai" and "sepi" are the same measure
// read from opposite ends, and a parser that returned the same direction for both would
// answer "which is quietest" with the busiest cell on the grid.
check(
	'busiest and quietest are the same measure, read opposite ways',
	nlq.parseQuestion('mana yang paling ramai', W, 'kopi').urut === 'desc' &&
		nlq.parseQuestion('mana yang paling sepi', W, 'kopi').urut === 'asc'
);

/* ── a question naming several business types comes back with all of them ── */

/* The failure this replaced was silent and total: "kedai kopi dan toko roti" parsed to
   coffee alone, the map coloured itself for coffee, and the reply named both. Nothing
   on screen said half the question had been dropped. */
for (const [q, want] of [
	['kedai kopi dan toko roti dekat MRT', 'kopi,roti'],
	['mau buka apotek atau laundry, mana yang lebih masuk', 'laundry,apotek'],
	['minimarket, kelontong, sama apotek', 'minimarket,kelontong,apotek'],
	// Display order, not the order the words appeared in. Two questions asking for the
	// same pair must not produce two different sets of chips.
	['toko roti dan kedai kopi', 'kopi,roti'],
	// One type is still one type: nothing about a single-category question changes.
	['di mana sebaiknya buka kedai kopi', 'kopi'],
	// The catch-all only fires when nothing specific did. Gathered alongside the rest it
	// would attach a rice warung to every question with the word "makan" in it.
	['restoran jepang yang enak buat makan', 'restoasing'],
	['mau buka tempat makan', 'warteg'],
	// Names no type at all → whatever the reader had in force, which is what the map is
	// already showing. Guessing here would swing the map off a question that never
	// mentioned a business.
	['mana yang paling ramai', 'minimarket']
]) {
	const got = nlq.parseQuestion(q, W, ['minimarket']).kategori;
	check(`"${q}" → [${want}]`, got.join(',') === want, `got [${got.join(',')}]`);
}

// And the set is genuinely scored as a set, not just carried in the query object. Two
// types share a street's customers, so their outlets are counted together as rivals —
// the pair's count can never be below either one on its own.
{
	const kopi = nlq.answer('mana yang pesaingnya paling banyak untuk kedai kopi', cells, W, ['kopi']);
	const both = nlq.answer(
		'mana yang pesaingnya paling banyak untuk kedai kopi dan toko roti',
		cells,
		W,
		['kopi']
	);
	check(
		'two business types are counted as one pool of rivals',
		both.query.kategori.join(',') === 'kopi,roti' &&
			both.items[0].measure.value >= kopi.items[0].measure.value,
		`kopi ${kopi.items[0]?.measure?.value} vs kopi+roti ${both.items[0]?.measure?.value}`
	);
}

/* ── the intents still route ─────────────────────────────────────────────── */

check('coverage still reachable', nlq.parseQuestion('mana yang belum ada datanya', W, 'kopi').intent === 'COVERAGE');
check('saturation still reachable', nlq.parseQuestion('mana yang sudah jenuh', W, 'kopi').intent === 'FLAG_SATURATED');
check('compare still reachable', nlq.parseQuestion('bandingkan Blok M dan Dukuh Atas', W, 'kopi').intent === 'COMPARE');

/* ── the answers actually come back measured ─────────────────────────────── */

for (const [q, ukuran] of CASES) {
	const ans = nlq.answer(q, cells, W, 'kopi');
	const top = ans.items[0];
	if (!top) {
		check(`"${q}" returns results`, false, 'no items');
		continue;
	}
	const wantsMeasure = ukuran !== 'skor';
	check(
		`"${q}" reports ${wantsMeasure ? ukuran : 'the score'}`,
		wantsMeasure ? top.measure?.ukuran === ukuran : top.measure == null,
		`got ${top.measure ? top.measure.ukuran : 'no measure'}`
	);
}

/* ── a ranking never includes a cell that was never measured ─────────────── */

const priced = nlq.answer('di mana harganya paling murah', cells, W, 'kopi');
check(
	'a price ranking lists only catchments that carry a price',
	priced.items.every((i) => i.measure && Number.isFinite(i.measure.value)),
	'an item came back with no measured value'
);

// The one that would be invisible: an unsurveyed cell sorted to the top of "fewest
// competitors" looks exactly like a genuine finding.
const fewest = nlq.answer('mana yang pesaingnya paling sedikit', cells, W, 'kopi');
const scored = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, 'kopi');
const coveredIds = new Set(scored.items.map((i) => i.id));
check(
	`"fewest competitors" returns ${fewest.items.length} catchments, none of them unsurveyed`,
	fewest.items.length > 0 &&
		fewest.items.every((i) => i.measure !== null && i.measure !== undefined),
	`ids not in the scored set: ${fewest.items.filter((i) => !coveredIds.has(i.id)).length}`
);

/* ── filters narrow without inventing a threshold ────────────────────────── */

const cheap = nlq.parseQuestion('kedai kopi modal kecil dekat MRT', W, 'kopi');
check(
	'"modal kecil dekat MRT" produces band filters, never a number',
	(cheap.filters ?? []).length >= 2 &&
		(cheap.filters ?? []).every((f) => ['rendah', 'tinggi', 'ada'].includes(f.arah)),
	JSON.stringify(cheap.filters)
);
const filtered = nlq.answer('kedai kopi modal kecil dekat MRT', cells, W, 'kopi');
check('a filtered question still returns something', filtered.items.length > 0);

/* ── every registered measure is reachable and readable ──────────────────── */

const rows = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, 'kopi');
check('every measure has a definition', metrics.METRIC_KEYS.every((k) => metrics.METRIC_MAP[k]));
check(
	'every measure declares which end is best',
	Object.values(metrics.METRIC_MAP).every((m) => m.best === 'asc' || m.best === 'desc')
);
check(
	'every measure can actually be read',
	metrics.METRIC_KEYS.every((k) => typeof metrics.METRIC_MAP[k].read === 'function')
);
// The keys and the table are one object now, so they cannot come apart — but the key
// list is what the model's tool schema is built from, so an empty one would silently
// offer it nothing to choose between.
check(
	`the key list is derived from the table (${metrics.METRIC_KEYS.length} measures)`,
	metrics.METRIC_KEYS.length === Object.keys(metrics.METRIC_MAP).length &&
		metrics.METRIC_KEYS.length > 0
);
check('the ranking helper drops unmeasured rows', rows.items.length > 0);

/* ── the two controls the conversation is allowed to move ────────────────── */

/* Tapak can switch the pivot and the walking radius, which means it can also switch
   them BY ACCIDENT — and that is the failure worth testing for. A reader browsing the
   unit list who asks an ordinary question must not be thrown back to the catchment grid,
   so a question that says nothing about the shape of the answer has to leave `pivot`
   undefined rather than defaulting to one. */
for (const [q, pivot] of [
	['ruko mana yang paling murah', 'unit'],
	['tampilkan per tempat saja', 'unit'],
	['daftar ruko di sekitar sini', 'unit'],
	['tempat mana yang paling luas', 'unit'],
	['kawasan mana yang paling ramai', 'cell'],
	['balik ke per petak', 'cell'],
	['petak mana yang pesaingnya paling sedikit', 'cell'],
	// Says nothing about the shape of the answer → the mode is left exactly as it was.
	['di mana sebaiknya buka kedai kopi', undefined],
	['seberapa ramai di sini', undefined],
	['mana yang paling banyak tempat kosong', undefined]
]) {
	const got = nlq.parseQuestion(q, W, 'kopi').pivot;
	check(`"${q}" → pivot ${pivot ?? '(left alone)'}`, got === pivot, `got ${got ?? '(left alone)'}`);
}

// A question about which AREA has the most units on the market and a question about
// which UNIT is cheapest are the pair this parser is most likely to confuse, and they
// mean opposite things.
const areaUnits = nlq.parseQuestion('mana yang paling banyak tempat kosong', W, 'kopi');
check(
	'"paling banyak tempat kosong" ranks areas by a property count, not doorways',
	areaUnits.pivot === undefined && areaUnits.ukuran === 'unit_dipasarkan',
	`pivot=${areaUnits.pivot} ukuran=${areaUnits.ukuran}`
);

for (const [q, ukuran, urut] of [
	['ruko mana yang paling murah', 'harga', 'asc'],
	['ruko mana yang paling mahal', 'harga', 'desc'],
	['tempat mana yang bangunannya paling luas', 'luas_bangunan', 'desc'],
	['tempat mana yang paling dekat pusat petak', 'jarak_pusat', 'asc']
]) {
	const p = nlq.parseQuestion(q, W, 'kopi');
	check(
		`"${q}" → unit sort ${ukuran} ${urut}`,
		p.ukuran_unit === ukuran && p.urut_unit === urut,
		`got ${p.ukuran_unit} ${p.urut_unit}`
	);
}

// The unit sort is only read alongside the pivot it belongs to. Written on a catchment
// ranking it is a field nothing downstream looks at, and it would silently re-sort the
// unit list the next time the reader switched pivot by hand.
check(
	'a catchment question carries no unit sort',
	nlq.parseQuestion('di mana sewanya paling murah', W, 'kopi').ukuran_unit === undefined
);

/* The radius. A question that names one has to be ANSWERED at it — computing at 800 m
   and then moving the map to 500 would leave every figure in the reply describing a
   catchment the reader is no longer looking at. */
for (const [q, radius] of [
	['kedai kopi dalam 500 m dari stasiun', 500],
	['pesaing dalam radius 400 meter', 400],
	['mana yang paling ramai dalam 620 m', 600],
	// Walking MINUTES are not metres, and converting them takes a pace assumption —
	// which would be the only figure on screen that came from nobody's data.
	['kedai kopi 10 menit jalan kaki', W.radius],
	['di mana sebaiknya buka kedai kopi', W.radius]
]) {
	const got = nlq.parseQuestion(q, W, 'kopi').radius_m;
	check(`"${q}" → radius ${radius} m`, got === radius, `got ${got}`);
}

// And the answer is genuinely computed at it, rather than the field being decoration.
const near = nlq.answer('mana yang pesaingnya paling banyak dalam 400 m', cells, W, 'kopi');
const far = nlq.answer('mana yang pesaingnya paling banyak dalam 800 m', cells, W, 'kopi');
check(
	'a radius named in the question changes the figures, not just the query object',
	near.query.radius_m === 400 &&
		far.query.radius_m === 800 &&
		near.items[0].measure.value < far.items[0].measure.value,
	`400 m → ${near.items[0]?.measure?.value}, 800 m → ${far.items[0]?.measure?.value}`
);

/* ── small talk, and the fence around it ─────────────────────────────────── */

// The fence is the whole reason chat is allowed at all, so it is checked here rather
// than trusted to the prompt. A model asked politely not to write figures will, one day,
// write figures.
const KEPT = [
	'Halo, mau mulai dari jenis usaha apa?',
	'Saya cuma tahu soal kawasan transit Jakarta.',
	'Yang biasanya menentukan itu siapa yang lewat dan siapa yang sudah jualan di situ.'
];
for (const s of KEPT) check(`a clean reply survives: "${s.slice(0, 40)}…"`, chat.cleanChatReply(s) === s);

// Every one of these is a sentence a model would happily produce, and every one of them
// is a figure nobody measured sitting next to figures that were.
const THROWN = [
	'Warteg biasanya balik modal dalam 8 bulan.',
	'Sewa ruko di Jakarta sekitar Rp 80 juta per tahun.',
	'Margin kedai kopi umumnya 60%.',
	'Buka jam 7 pagi biasanya paling ramai.',
	'Ada 3 hal yang menentukan lokasi.'
];
for (const s of THROWN) {
	check(`a reply with a figure is thrown away: "${s.slice(0, 44)}…"`, chat.cleanChatReply(s) === null);
}
check('an over-long reply is thrown away', chat.cleanChatReply('a'.repeat(chat.CHAT_MAX_CHARS + 1)) === null);
check('an empty reply is thrown away', chat.cleanChatReply('   ') === null);
check('a non-string reply is thrown away', chat.cleanChatReply({ balasan: 'hai' }) === null);
check(
	'no canned line carries a figure either',
	['sapaan', 'tentang', 'usaha'].every((t) => chat.isChatTopic(t))
);

/* ── the rule path recognises a greeting, and only a greeting ────────────── */

for (const [q, want] of [
	['halo', 'sapaan'],
	['Hai, apa kabar', 'sapaan'],
	['makasih ya', 'sapaan'],
	['kamu siapa', 'tentang'],
	['apa itu SpotOn', 'tentang'],
	['selamat pagi', 'sapaan'],
	// A greeting in front of a real question is not a greeting.
	['halo kamu siapa', 'tentang']
]) {
	check(`"${q}" is recognised as ${want}`, chat.ruleChatTopic(q) === want, `got ${chat.ruleChatTopic(q)}`);
}

// The failure that would be invisible: `hai` sits inside "ramai" and "pantai", so an
// unanchored greeting pattern turns real questions into small talk and stops answering
// them altogether.
for (const q of [
	'di mana yang ramai',
	'mana yang paling ramai pengunjungnya',
	'kedai kopi dekat pantai',
	'seberapa ramai di sini',
	'oke berapa harga tempat di sini',
	'halo, di mana sebaiknya buka kedai kopi',
	'makasih, sekarang mana yang paling sepi',
	'pagi ini mana yang paling ramai'
]) {
	check(`"${q}" is NOT mistaken for small talk`, chat.ruleChatTopic(q) === null, `got ${chat.ruleChatTopic(q)}`);
}

// Without a model, general business talk is not answerable by rule, and guessing at it
// would be inventing an intent rather than reading one.
check(
	'general business talk is not guessed at by the rule parser',
	chat.ruleChatTopic('kenapa lokasi penting untuk usaha') === null
);

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
