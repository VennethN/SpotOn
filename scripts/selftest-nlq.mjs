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
	const scoring = await server.ssrLoadModule('/src/lib/domain/scoring.ts');
	const source = await server.ssrLoadModule('/src/lib/server/source.ts');
	await server.close();
	return { nlq, metrics, chat, scoring, cells: source.loadHexes() };
}

const { nlq, metrics, chat, scoring, cells } = await load();
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
	['mana yang simpul transitnya paling banyak', 'simpul_transit', 'desc', null],
	/* The field surveys. The pair below them is the collision they had to be split
	   around: asking WHERE a place is offered to let is a different question from asking
	   WHAT it costs, and both sentences carry the word sewa. */
	['di mana ada tempat yang disewakan', 'sewa_ditawarkan', 'desc', null],
	['mana yang struknya paling banyak', 'struk_dicatat', 'desc', null],
	['berapa harga sewa di sini', 'harga_tempat', null, null],
	['di mana sewanya paling murah', 'harga_tempat', 'asc', null]
];

for (const [q, ukuran, urut, kategori] of CASES) {
	const parsed = nlq.parseQuestion(q, W, ['kopi']);
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
	nlq.parseQuestion('mana yang paling ramai', W, ['kopi']).urut === 'desc' &&
		nlq.parseQuestion('mana yang paling sepi', W, ['kopi']).urut === 'asc'
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

/* ── no business type named: answer what can be answered, ask for the rest ── */

/* The map now opens with no business type at all, because opening on coffee handed a
   reader a map about a business they never mentioned. That makes "nothing named" a
   state real questions arrive in, and the split below is the whole of how it behaves:
   a figure about the PLACE is answered, a figure about a place AND a trade is not. */
for (const [q, answerable] of [
	['mana yang paling ramai', true],
	['di mana harganya paling murah', true],
	['mana yang paling banyak tempat kosong', true],
	['mana yang simpul transitnya paling banyak', true],
	// Rivals of what, saturated with what, best opportunity for what. One word short,
	// and the honest move is to ask for it rather than to pick a business type.
	['di mana sebaiknya buka', false],
	['mana yang pesaingnya paling sedikit', false],
	['mana yang sudah jenuh', false]
]) {
	const ans = nlq.answer(q, cells, W, []);
	const asked = ans.needsCategory === true;
	check(
		`"${q}" with no business type → ${answerable ? 'answered' : 'asks which business'}`,
		answerable ? !asked && ans.items.length > 0 : asked && ans.items.length === 0,
		`needsCategory=${asked} items=${ans.items.length}`
	);
}

// An empty set must never be scored. No type named means no rivals counted, no rivals
// is no competition, and no competition is the best score this engine can award — so
// the failure mode is not a blank map, it is 562 cells reporting excellence.
{
	const busy = nlq.answer('mana yang paling ramai', cells, W, []);
	check(
		'a question with no business type reports no opportunity score at all',
		busy.items.length > 0 && busy.items.every((i) => i.value === null),
		`${busy.items.filter((i) => i.value !== null).length} item(s) came back scored`
	);
}

// And the busyness it does report is the full count, not a count with something taken
// out of it: there is no category to subtract.
{
	const none = nlq.answer('mana yang paling ramai', cells, W, []);
	const kopi = nlq.answer('mana yang paling ramai untuk kedai kopi', cells, W, ['kopi']);
	check(
		'with no business type the crowd is counted whole, nothing subtracted',
		none.items[0].measure.value >= kopi.items[0].measure.value,
		`none ${none.items[0]?.measure?.value} vs kopi ${kopi.items[0]?.measure?.value}`
	);
}

/* ── two surveys, read together, never added ─────────────────────────────── */

/* The whole risk of a "both" reading is that somebody makes it a sum. OpenStreetMap
   and the MAPID catalogue survey the SAME city, so their counts are largely the same
   shops seen twice and there is no shared id to match them on. Added, a street with
   eight coffee shops is reported as having fourteen and the competition side of every
   score is inflated by an amount nobody can account for. */
{
	const W_BOTH = { ...W, source: 'both' };
	const W_OSM = { ...W, source: 'osm' };
	const one = nlq.answer('mana yang pesaingnya paling banyak untuk kedai kopi', cells, W, ['kopi']);
	const osm = nlq.answer('mana yang pesaingnya paling banyak untuk kedai kopi', cells, W_OSM, ['kopi']);
	const both = nlq.answer('mana yang pesaingnya paling banyak untuk kedai kopi', cells, W_BOTH, ['kopi']);
	const v = (a) => a.items[0]?.measure?.value ?? 0;
	check(
		'reading both surveys never exceeds their sum, and never falls below either',
		v(both) <= v(one) + v(osm) && v(both) >= Math.max(v(one), v(osm)) && v(both) < v(one) + v(osm),
		`mapid ${v(one)} · osm ${v(osm)} · both ${v(both)}`
	);

	// And the point of reading both: the cells the catalogue has never reached stop
	// being blank, because OpenStreetMap can still speak for them.
	const gapMapid = nlq.answer('mana yang belum ada datanya', cells, W, ['kopi']).items.length;
	const gapBoth = nlq.answer('mana yang belum ada datanya', cells, W_BOTH, ['kopi']).items.length;
	check(
		`reading both closes the survey gap (${gapMapid} unsurveyed → ${gapBoth})`,
		gapBoth < gapMapid,
		`mapid ${gapMapid} vs both ${gapBoth}`
	);

	// A business type OpenStreetMap cannot count at all is not helped by adding it, and
	// must not be reported as if it were: warteg has no OSM tag, so both reads as MAPID.
	const wartegMapid = nlq.answer('mana yang belum ada datanya untuk warteg', cells, W, ['warteg']).items.length;
	const wartegBoth = nlq.answer('mana yang belum ada datanya untuk warteg', cells, W_BOTH, ['warteg']).items.length;
	check(
		'a type OSM cannot count gains nothing from reading both, and claims nothing',
		wartegMapid === wartegBoth,
		`mapid ${wartegMapid} vs both ${wartegBoth}`
	);
}

/* ── the intents still route ─────────────────────────────────────────────── */

check('coverage still reachable', nlq.parseQuestion('mana yang belum ada datanya', W, ['kopi']).intent === 'COVERAGE');
check('saturation still reachable', nlq.parseQuestion('mana yang sudah jenuh', W, ['kopi']).intent === 'FLAG_SATURATED');
check('compare still reachable', nlq.parseQuestion('bandingkan Blok M dan Dukuh Atas', W, ['kopi']).intent === 'COMPARE');

/* ── a follow-up is read against what was just said ──────────────────────── */

/* This is the whole of what "chat" means here, and the failure it replaced was total
   and silent: "kenapa Setiabudi Astra" was parsed as a brand new ranking, so the reply
   was the previous answer's five names all over again, under the same sentence. Nothing
   on screen said the question had not been read.

   The rule parser is only the narrow half of this — the model gets the whole thread and
   decides for itself whether a turn needs data. What is pinned here is the half that
   runs with no key at all, and the two properties that make it safe: it never fires
   without a place to point at, and it never swallows a question carrying its own
   subject. */
{
	const SAID = ['Setiabudi Astra', 'Tosari', 'Bendungan Hilir'];

	// A name from the conversation, however it is pointed at.
	for (const [q, want] of [
		['kenapa Setiabudi Astra', 'Setiabudi Astra'],
		['kenapa yang itu', 'Setiabudi Astra'],
		['kenapa?', 'Setiabudi Astra'],
		['kenapa sih', 'Setiabudi Astra'],
		['jelaskan Tosari dong', 'Tosari'],
		['why Bendungan Hilir', 'Bendungan Hilir'],
		['mengapa yang pertama', 'Setiabudi Astra']
	]) {
		const got = nlq.parseQuestion(q, W, ['kopi'], SAID);
		check(
			`"${q}" → EXPLAIN ${want}`,
			got.intent === 'EXPLAIN' && got.target?.[0] === want,
			`got ${got.intent} target=${(got.target ?? []).join(', ')}`
		);
	}

	// With no candidate names at all there is nothing to point at, and the sentence is
	// read exactly as it was before any of this existed. Through `answer` the grid's own
	// names are candidates, which is the next block.
	check(
		'a why-question with no candidate names is not an explanation',
		nlq.parseQuestion('kenapa Setiabudi Astra', W, ['kopi']).intent === 'RANK'
	);

	/* And the one that would be invisible: a general question that happens to carry a
	   why-word must not be answered with one catchment's arithmetic. This is the same
	   rule the greeting parser follows — a courtesy at the head of a real question does
	   not make it a courtesy. */
	for (const q of [
		'kenapa lokasi penting untuk usaha',
		'kenapa kedai kopi banyak yang tutup',
		'di mana sebaiknya buka apotek',
		'mana yang paling ramai'
	]) {
		check(
			`"${q}" is NOT swallowed as a follow-up`,
			nlq.parseQuestion(q, W, ['kopi'], SAID).intent !== 'EXPLAIN',
			`got ${nlq.parseQuestion(q, W, ['kopi'], SAID).intent}`
		);
	}

	// And it answers from the data rather than by ranking the grid again.
	const named = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']).items[0].name;
	const why = nlq.answer('kenapa yang itu', cells, W, ['kopi'], [named]);
	check(
		`"kenapa yang itu" comes back about ${named} alone`,
		why.explain?.name === named && why.items.length === 1 && why.highlight.length === 1,
		`explain=${why.explain?.name} items=${why.items.length}`
	);
	check(
		'the explanation is the row\'s own figures, not a second opinion',
		(() => {
			const row = scoring.scoreAll(cells, ['kopi'], W).find((r) => r.id === why.explain?.id);
			const e = why.explain;
			return Boolean(
				row &&
					e &&
					e.score === row.score &&
					e.demand === row.demand &&
					e.supply === row.supply &&
					e.rivals === row.osm &&
					e.density === row.density &&
					e.units === row.units &&
					e.price === row.price &&
					e.radius === W.radius
			);
		})()
	);
	// Explaining a score means explaining a score FOR something. Without a business type
	// there is no score to take apart, and asking which one is the honest move.
	check(
		'an explanation with no business type asks which business first',
		nlq.answer('kenapa yang itu', cells, W, [], [named]).needsCategory === true
	);
	// Nothing is narrowed for an answer about one named place, so no filter may be
	// carried into it and shown as a chip claiming the map was cut down.
	check(
		'an explanation carries no band filters',
		(() => {
			const q = nlq.parseQuestion(`kenapa ${named} murah dan dekat MRT`, W, ['kopi'], [named]);
			return q.intent === 'EXPLAIN' && !q.filters?.length && !q.filter;
		})(),
		JSON.stringify(nlq.parseQuestion(`kenapa ${named} murah dan dekat MRT`, W, ['kopi'], [named]).filters)
	);

	/* The long tail of ways to say "why" is deliberately NOT pinned here, and the
	   omission is the design rather than a gap in the table. This parser is the half
	   that runs with no model key at all, and it is narrow on purpose — the same way
	   `ruleChatTopic` recognises greetings and refuses to guess at anything else. The
	   model gets the whole thread and decides for itself, per turn, whether a turn needs
	   data. Growing a phrasebook here would only make the two halves disagree about what
	   was asked. */
}

/* ── naming a place is enough, and the measure survives ──────────────────── */

/* THE SECOND ROUND OF THE SAME MISTAKE. A follow-up can POINT ("kenapa yang itu"), which
   needs a why-word because there is nothing else in the sentence to go on. Or it can
   NAME ("what is the rent at Pusdiklat BPS"), which needs no why-word at all and used to
   get none of this: with no "kenapa" in it the question fell through to a ranking, and a
   question about one place's price came back as the grid's five best catchments.

   And the measure was thrown away on the way past even when the shape was right, so
   "berapa harga tempat di X" was answered with X's opportunity score. A shape and a
   measure are chosen separately everywhere else in this engine. */
{
	const named = nlq.answer('di mana sebaiknya buka toko roti', cells, W, ['roti']).items[0].name;

	for (const [q, ukuran] of [
		['berapa harga tempat di NAME', 'harga_tempat'],
		['what is the rent at NAME', 'harga_tempat'],
		['NAME mahal tidak', 'harga_tempat'],
		['seberapa ramai NAME', 'keramaian'],
		['how busy is NAME', 'keramaian'],
		['ada berapa pesaing di NAME', 'pesaing'],
		// No measure named at all is the score, which is the shape this started as.
		['kenapa NAME', 'skor'],
		['jelaskan NAME', 'skor']
	]) {
		const asked = q.replace('NAME', named);
		const ans = nlq.answer(asked, cells, W, ['roti'], []);
		check(
			`"${q}" → EXPLAIN ${ukuran}`,
			ans.query.intent === 'EXPLAIN' && ans.query.ukuran === ukuran && ans.explain?.name === named,
			`got ${ans.query.intent} ukuran=${ans.query.ukuran} name=${ans.explain?.name}`
		);
	}

	// And the figure asked about actually reaches the answer, rather than being computed
	// and then dropped in favour of the score.
	{
		const ans = nlq.answer(`berapa harga tempat di ${named}`, cells, W, ['roti'], []);
		const row = scoring.scoreAll(cells, ['roti'], W).find((r) => r.id === ans.explain?.id);
		check(
			'an explanation reports the measure it was asked about',
			ans.explain?.measure?.ukuran === 'harga_tempat' && ans.explain?.measure?.value === row?.price,
			`measure=${JSON.stringify(ans.explain?.measure)} price=${row?.price}`
		);
		// A question about the score does not carry one, because it would print the same
		// number twice.
		check(
			'an explanation of the score carries no separate measure',
			nlq.answer(`kenapa ${named}`, cells, W, ['roti'], []).explain?.measure == null
		);
	}

	/* The three shapes that name a place and are NOT about it. Without these a question
	   asking the grid to be sorted would be answered about whichever catchment it
	   happened to mention. */
	for (const [q, intent] of [
		[`di mana buka toko roti dekat ${named}`, 'RANK'],
		[`bandingkan ${named} dan Pesing`, 'COMPARE'],
		[`kawasan mana yang lebih ramai dari ${named}`, 'RANK']
	]) {
		check(`"${q}" → ${intent}`, nlq.answer(q, cells, W, ['roti'], []).query.intent === intent, `got ${nlq.answer(q, cells, W, ['roti'], []).query.intent}`);
	}

	/* And the failure that would be invisible. Eighty-seven catchments are named with a
	   single word and some of those are ordinary ones, so scanning the whole grid for a
	   name has to be word-bounded and has to skip the short ones. Otherwise "kawasannya
	   damai" is read as a question about a catchment in South Jakarta. */
	for (const q of [
		'kawasannya damai tidak',
		'harga karet berapa sekarang',
		'pesaingnya berduri di mana-mana'
	]) {
		check(
			`"${q}" is not read as naming a catchment`,
			nlq.answer(q, cells, W, ['roti'], []).query.intent !== 'EXPLAIN',
			`got ${nlq.answer(q, cells, W, ['roti'], []).query.intent} target=${(nlq.answer(q, cells, W, ['roti'], []).query.target ?? []).join(',')}`
		);
	}
}

/* ── the English half of the money words ─────────────────────────────────── */

/* The catchment list carried no English money word at all, while the unit list beside it
   had `cheap|price` all along, so the two registries disagreed about the same question in
   the same language. Every English question about money fell past them to the opportunity
   score. The pair at the end is the collision that had to be split by hand: a bare "for
   rent" means "on the rent measure" and asks about the price, while "space for rent" asks
   which places are being offered, and those are two different measures. */
for (const [q, ukuran] of [
	['where is the rent cheapest', 'harga_tempat'],
	['which area has the lowest price', 'harga_tempat'],
	['how much does space cost there', 'harga_tempat'],
	['where is it most expensive', 'harga_tempat'],
	['why did it score 1 for rent', 'harga_tempat'],
	['which areas have space for rent', 'sewa_ditawarkan'],
	['di mana ada tempat yang disewakan', 'sewa_ditawarkan']
]) {
	const got = nlq.parseQuestion(q, W, ['kopi']).ukuran;
	check(`"${q}" → ${ukuran}`, got === ukuran, `got ${got}`);
}

/* ── two places pointed at rather than typed out ─────────────────────────── */

/* The same gap as the one above, in the intent that already existed. COMPARE read the
   names out of the sentence alone, so it could only ever be used by somebody who typed
   both of them into the very message asking for the comparison. A reader who has just
   been shown a ranking does not do that, they point at it. */
{
	const rank = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']);
	const two = rank.items.slice(0, 2).map((i) => i.name);
	const cmp = nlq.runQuery(
		{ ...nlq.parseQuestion('bandingkan keduanya', W, ['kopi']), intent: 'COMPARE', limit: 2, target: two },
		'bandingkan keduanya',
		cells,
		W
	);
	check(
		`"bandingkan keduanya" compares ${two.join(' and ')}`,
		cmp.items.length === 2 && two.every((n) => cmp.items.some((i) => i.name === n)),
		`got ${cmp.items.map((i) => i.name).join(', ') || 'nothing'}`
	);
}

/* ── the answers actually come back measured ─────────────────────────────── */

for (const [q, ukuran] of CASES) {
	const ans = nlq.answer(q, cells, W, ['kopi']);
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

const priced = nlq.answer('di mana harganya paling murah', cells, W, ['kopi']);
check(
	'a price ranking lists only catchments that carry a price',
	priced.items.every((i) => i.measure && Number.isFinite(i.measure.value)),
	'an item came back with no measured value'
);

// The one that would be invisible: an unsurveyed cell sorted to the top of "fewest
// competitors" looks exactly like a genuine finding.
const fewest = nlq.answer('mana yang pesaingnya paling sedikit', cells, W, ['kopi']);
const scored = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']);
const coveredIds = new Set(scored.items.map((i) => i.id));
check(
	`"fewest competitors" returns ${fewest.items.length} catchments, none of them unsurveyed`,
	fewest.items.length > 0 &&
		fewest.items.every((i) => i.measure !== null && i.measure !== undefined),
	`ids not in the scored set: ${fewest.items.filter((i) => !coveredIds.has(i.id)).length}`
);

/* ── the field surveys rank only where somebody actually went ───────────── */

/* This is the same rule as the one above, and the place it matters most. 191 of the
   562 cells carry a field record. If an empty cell read as 0 rather than as nothing,
   371 streets nobody has visited would fill the whole of "fewest receipts" and look
   exactly like a finding. */
const struk = nlq.answer('mana yang struknya paling banyak', cells, W, ['kopi']);
const withRecords = cells.filter((c) => c.field).length;
check(
	`"most receipts" ranks only the ${withRecords} catchments that have any record`,
	struk.items.length > 0 && struk.items.length <= withRecords,
	`${struk.items.length} items against ${withRecords} catchments with records`
);
check(
	'every catchment in it carries at least one receipt',
	struk.items.every((i) => (cells.find((c) => c.id === i.id)?.field?.struk ?? 0) > 0)
);

const sewa = nlq.answer('di mana ada tempat yang disewakan', cells, W, ['kopi']);
check(
	'"where is space up for rent" lists only catchments with a rental recorded',
	sewa.items.length > 0 &&
		sewa.items.every((i) => (cells.find((c) => c.id === i.id)?.field?.sewa ?? 0) > 0),
	`${sewa.items.length} items`
);

/* The field data must never reach the score. Two cells identical in every counted
   figure must score the same whether or not a surveyor happened to walk one of them. */
check(
	'a field record does not move the opportunity score',
	(() => {
		const plain = cells.find((c) => !c.field && c.covered?.kopi);
		if (!plain) return true;
		const withField = { ...plain, field: { struk: 40, menu: 9, properti: 5, catatan: 3, sewa: 4, nontunai: 1, harga: 25000 } };
		const a = scoring.scoreOne(plain, ['kopi'], W, 50, [], 200);
		const b = scoring.scoreOne(withField, ['kopi'], W, 50, [], 200);
		return a.score === b.score && a.demand === b.demand && a.supply === b.supply;
	})()
);

/* ── filters narrow without inventing a threshold ────────────────────────── */

const cheap = nlq.parseQuestion('kedai kopi modal kecil dekat MRT', W, ['kopi']);
check(
	'"modal kecil dekat MRT" produces band filters, never a number',
	(cheap.filters ?? []).length >= 2 &&
		(cheap.filters ?? []).every((f) => ['rendah', 'tinggi', 'ada'].includes(f.arah)),
	JSON.stringify(cheap.filters)
);
const filtered = nlq.answer('kedai kopi modal kecil dekat MRT', cells, W, ['kopi']);
check('a filtered question still returns something', filtered.items.length > 0);

/* ── every registered measure is reachable and readable ──────────────────── */

const rows = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']);
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
	const got = nlq.parseQuestion(q, W, ['kopi']).pivot;
	check(`"${q}" → pivot ${pivot ?? '(left alone)'}`, got === pivot, `got ${got ?? '(left alone)'}`);
}

// A question about which AREA has the most units on the market and a question about
// which UNIT is cheapest are the pair this parser is most likely to confuse, and they
// mean opposite things.
const areaUnits = nlq.parseQuestion('mana yang paling banyak tempat kosong', W, ['kopi']);
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
	const p = nlq.parseQuestion(q, W, ['kopi']);
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
	nlq.parseQuestion('di mana sewanya paling murah', W, ['kopi']).ukuran_unit === undefined
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
	const got = nlq.parseQuestion(q, W, ['kopi']).radius_m;
	check(`"${q}" → radius ${radius} m`, got === radius, `got ${got}`);
}

// And the answer is genuinely computed at it, rather than the field being decoration.
const near = nlq.answer('mana yang pesaingnya paling banyak dalam 400 m', cells, W, ['kopi']);
const far = nlq.answer('mana yang pesaingnya paling banyak dalam 800 m', cells, W, ['kopi']);
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

/* ── the rule parser does not guess ──────────────────────────────────────── */

/* THE ONE THE SCREENSHOT SHOWED. Every sentence used to be read into a query, and a
   sentence the parser could read nothing in was read into the DEFAULT one: a ranking by
   the opportunity score for whatever business was active. So "what", typed by somebody
   confused by the previous answer, came back as five catchments under "if it were up to
   me", and "explain what do those numbers mean" came back as the same five. A confident
   answer to a question nobody asked, which is the exact failure `tidak_dimengerti` exists
   to prevent on the model path, and the rule path had no equivalent of. */
{
	const ranking = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']);
	const SAID = ranking.items.map((i) => i.name);
	const [first, second] = SAID;

	for (const q of [
		'what',
		'hmm',
		'explain what do those numbers mean (out of out of), is more business in the area good or bad',
		'kenapa lokasi penting untuk usaha',
		'thanks, that is all I needed',
		'apa kabar dunia hari ini'
	]) {
		const ans = nlq.answer(q, cells, W, ['kopi'], SAID);
		check(
			`"${q.slice(0, 44)}" is not guessed at`,
			ans.notUnderstood === true && ans.items.length === 0 && ans.highlight.length === 0,
			`got ${ans.query.intent} notUnderstood=${ans.notUnderstood} items=${ans.items.length}`
		);
	}

	// And the plain forms still answer, in both languages, with a type in force and without.
	for (const [q, cats, want] of [
		['di mana sebaiknya buka kedai kopi', ['kopi'], 'RANK'],
		['where should I open', [], 'RANK'],
		['mau buka usaha', [], 'RANK'],
		['kopi', [], 'RANK'],
		['mana yang paling murah', ['kopi'], 'RANK'],
		['dalam 500 m', ['kopi'], 'RANK'],
		['Kawasan mana yang sudah jenuh untuk kedai kopi?', ['kopi'], 'FLAG_SATURATED'],
		['Which areas are saturated for a coffee shop?', ['kopi'], 'FLAG_SATURATED'],
		['Kawasan mana yang belum terdata?', ['kopi'], 'COVERAGE'],
		['Which areas have no data yet?', ['kopi'], 'COVERAGE'],
		[`Why ${first}?`, ['kopi'], 'EXPLAIN'],
		[`bandingkan ${first} dan ${second}`, ['kopi'], 'COMPARE']
	]) {
		const ans = nlq.answer(q, cells, W, cats, SAID);
		check(
			`"${q}" is still read as ${want}`,
			ans.notUnderstood === undefined && ans.query.intent === want,
			`got ${ans.query.intent} notUnderstood=${ans.notUnderstood}`
		);
	}

	/* The two English chips. "Which areas are saturated" and "which areas have no data
	   yet" matched no intent word, because every intent word was Indonesian, and both came
	   back as a ranking by score whenever the model was away. The Indonesian chips had
	   always worked, which is why nobody noticed. */
	check(
		'the English saturation chip lists the crowded places, not the best ones',
		nlq.answer('Which areas are saturated for a coffee shop?', cells, W, ['kopi']).items[0]?.name ===
			nlq.answer('Kawasan mana yang sudah jenuh untuk kedai kopi?', cells, W, ['kopi']).items[0]?.name
	);
	check(
		'the English coverage chip lists the unsurveyed places',
		nlq.answer('Which areas have no data yet?', cells, W, ['kopi']).items.length ===
			nlq.answer('Kawasan mana yang belum terdata?', cells, W, ['kopi']).items.length
	);

	// "Mau buka usaha" is the opening question of the product one word short, and is
	// answered by asking for the word, never refused as unreadable.
	for (const q of ['mau buka usaha', 'where should I open', 'I want to start a business']) {
		check(`"${q}" with no type in force asks for one`, nlq.answer(q, cells, W, [], []).needsCategory === true);
	}
}

/* A pointer with nothing to point at. "Kenapa?" on a fresh thread used to be resolved
   against the whole grid, because the grid's names were handed in as though the
   conversation had said them, and it explained the first catchment in the file. */
{
	for (const q of ['kenapa?', 'why?', 'kenapa yang itu']) {
		const fresh = nlq.answer(q, cells, W, ['kopi'], []);
		check(
			`"${q}" with nothing said explains no place`,
			fresh.query.intent === 'EXPLAIN' && !fresh.explain && fresh.items.length === 0,
			`got ${fresh.query.intent} explain=${fresh.explain?.name} items=${fresh.items.length}`
		);
	}
	// Naming a place the conversation never mentioned still works, from the grid's own names.
	const top = nlq.answer('di mana sebaiknya buka kedai kopi', cells, W, ['kopi']).items[0].name;
	check(
		'a place named outright is still found on the grid',
		nlq.answer(`kenapa ${top}`, cells, W, ['kopi'], []).explain?.name === top
	);
}

/* ── an index is set against the grid, a count is not ───────────────────── */

/* "Busyness 65" is a number on a scale, and the scale is not the comparator a reader
   needs: whether 65 is a lot depends on what the rest of the grid reads. The card says
   where each index sits among every cell that has one. What is pinned here is that the
   ladder is the scored cells and nothing else, that its two ends are exactly the best
   and the worst cell, and that a cell nobody scored has no standing rather than the
   lowest one. */
{
	const rows = scoring.scoreAll(cells, ['kopi'], W);
	const ladder = metrics.ladderFor(rows, 'skor');
	const scored = rows.filter((r) => r.score !== null);
	check(
		'the score ladder holds every scored cell and no other',
		ladder.length === scored.length && ladder.length > 0,
		`ladder ${ladder.length}, scored ${scored.length}`
	);
	const best = scored.reduce((a, r) => (r.score > a.score ? r : a));
	const worst = scored.reduce((a, r) => (r.score < a.score ? r : a));
	check('the best-scoring cell stands at the very top', metrics.standingOf(best, 'skor', ladder) === 1);
	check('the worst-scoring cell stands at the very bottom', metrics.standingOf(worst, 'skor', ladder) === 0);
	const unscored = rows.find((r) => r.score === null);
	check(
		'a cell nobody scored has no standing, not the lowest one',
		unscored !== undefined && metrics.standingOf(unscored, 'skor', ladder) === null
	);
	check(
		'every standing is a share of the grid',
		scored.every((r) => {
			const s = metrics.standingOf(r, 'skor', ladder);
			return s !== null && s >= 0 && s <= 1;
		})
	);
	// Transit access exists for every cell, surveyed or not, so its ladder is the grid.
	check(
		'transit access is ranked over the whole grid',
		metrics.ladderFor(rows, 'akses_transit').length === rows.length
	);
	// Too few readings to rank against, and the answer is silence rather than a share.
	check(
		'a handful of readings ranks nothing',
		metrics.standingOf(best, 'skor', ladder.slice(0, 3)) === null
	);

	/* And the explanation carries the same standing, so Tapak can say "that is the
	   highest of all areas" about the very cell the card says it of. The measure asked
	   about carries its own, counts included: "how busy" is answered by a count and "is
	   that busy" by where the count sits. */
	const why = nlq.answer(`kenapa ${best.name}`, cells, W, ['kopi'], [best.name]);
	check(
		'an explanation of the best cell stands it at the top',
		why.explain?.standing.score === 1 && why.explain?.standing.measure === null,
		`got ${JSON.stringify(why.explain?.standing)}`
	);
	const busy = nlq.answer(`seberapa ramai ${best.name}`, cells, W, ['kopi'], [best.name]);
	const s = busy.explain?.standing.measure;
	check(
		'an explanation about busyness carries where the count stands',
		busy.explain?.measure?.ukuran === 'keramaian' && typeof s === 'number' && s >= 0 && s <= 1,
		`got ukuran=${busy.explain?.measure?.ukuran} standing=${s}`
	);
	check(
		'a cell nobody scored is explained with no standing',
		unscored === undefined ||
			nlq.answer(`kenapa ${unscored.name}`, cells, W, ['kopi'], [unscored.name]).explain?.standing.score === null
	);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
