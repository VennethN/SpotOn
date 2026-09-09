/**
 * Self-test: the fence around a sentence the model wrote. No network.
 *
 *   node scripts/selftest-grounded.mjs
 *
 * Tapak now writes its own answer instead of filling in a template, and this is the rule
 * that makes that safe rather than merely nicer to read: a reply may carry a figure only
 * if that figure is one the scoring engine handed it. Everything below is a sentence a
 * free model would plausibly produce, sorted into the ones that are traceable and the
 * ones that are invented.
 *
 * THE LOAD-BEARING CHECK IS THE LAST ONE
 *
 * The interface composes its own sentence from the same figures, and that sentence has to
 * clear this fence too. It is built entirely from computed values, so if it cannot pass,
 * the fence is rejecting true figures — which is the failure that would be invisible,
 * because its symptom is the product quietly falling back to the plainer answer forever
 * while every test about invented figures still passes.
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
	const grounded = await server.ssrLoadModule('/src/lib/domain/grounded.ts');
	const nlq = await server.ssrLoadModule('/src/lib/domain/nlq.ts');
	const narrate = await server.ssrLoadModule('/src/lib/domain/narrate.ts');
	const i18n = await server.ssrLoadModule('/src/lib/i18n/index.ts');
	const source = await server.ssrLoadModule('/src/lib/server/source.ts');
	await server.close();
	return { grounded, nlq, narrate, i18n, cells: source.loadHexes() };
}

const { grounded, nlq, narrate, i18n, cells } = await load();
const W = { wd: 0.5, ws: 0.5, gate: true, radius: 800, source: 'mapid' };

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Grounded-reply self-test (no network)\n');

/* ── two renderings of one figure are one figure ─────────────────────────── */

/* The interface prints "Rp 59,8 jt" to an Indonesian reader and "Rp 59.8m" to an English
   one, and the model echoes whichever it was shown. Read naively, one of those is 59.8
   and the other is five hundred and ninety eight. */
for (const [written, want] of [
	['59,8', '59.8'],
	['59.8', '59.8'],
	['59.800.000', '59800000'],
	['59,800,000', '59800000'],
	['1.000', '1000'],
	['800', '800'],
	['68', '68']
]) {
	check(`"${written}" reads as ${want}`, grounded.normaliseFigure(written) === want, `got ${grounded.normaliseFigure(written)}`);
}

/* ── a figure nobody computed does not get through ───────────────────────── */

const FACTS = [
	'Rincian Tosari:',
	'- Skor peluang 68 dari 100.',
	'- Keramaian 98 dari 100, dari 289 usaha lain dalam radius 800 m.',
	'- Penawaran 13 dari 100, dari 12 pesaing sejenis dalam radius yang sama.',
	'- Akses transit 71 dari 100, dari 11 simpul transit dalam radius 800 m.',
	'- 7 unit komersial dipasarkan, median harga JUAL Rp 59.800.000 (Rp 59,8 juta) per m².',
	'- Harga itu lebih mahal dari 73% petak lain di kisi.'
].join('\n');

const NAMED = ['Tosari'];
const EVERY = cells.map((c) => c.name).filter(Boolean);
const ok = (s) => grounded.cleanGroundedReply(s, FACTS, NAMED, EVERY);

// Every figure traceable to the sheet, in either language's punctuation.
for (const s of [
	'Tosari scores 68 out of 100, with 289 other businesses and 12 laundries inside 800 m.',
	'Harga jualnya Rp 59,8 juta per m², lebih mahal dari 73% petak lain.',
	'The asking price is Rp 59.8 million per m², and that is a price to buy, not a rent.',
	'Tosari punya 11 simpul transit dalam radius 800 m, jadi aksesnya 71 dari 100.',
	// No figures at all is still an answer, and a legitimate one.
	'There is no rental data for Jakarta at all, so I cannot give you a rent for Tosari.',
	/* A count in words, where the figure it spells is on the sheet. These were refused
	   outright, and every one of them is a true sentence a model writes in English
	   without thinking: "the five" on a list of five, "a hundred" for the ruler every
	   score is read against. Thrown away, they cost the reader the model's reply and
	   left the template standing in, with no symptom but Tapak sounding plainer. */
	'Tosari is the strongest of the twelve laundries\' neighbours at 68 out of a hundred.',
	'Skornya 68 dari seratus, dan ada tujuh unit dipasarkan dalam radius 800 m.',
	'Seven units are on the market around it, at Rp 59.8 million per m².'
]) {
	check(`grounded reply survives: "${s.slice(0, 46)}…"`, ok(s) !== null, `rejected: ${grounded.groundingFault(s, FACTS, NAMED, EVERY)}`);
}

/* Every one of these is a sentence a model writes without blinking, and every one of them
   is a figure nobody measured standing next to figures that were. The reader has no way
   to tell which is which, which is the entire reason this fence exists. */
for (const [s, why] of [
	['Warteg biasanya balik modal dalam 8 bulan di kawasan seramai ini.', 'a figure from nowhere'],
	['Tosari scores 68, so expect around 40 customers an hour.', 'an invented rate'],
	['Sewanya kira-kira Rp 15 juta per tahun.', 'a rent, which this product has none of'],
	['Margin laundry biasanya 60%.', 'a claim about margins'],
	['Balik modal dalam delapan bulan.', 'the same fabrication, spelled out'],
	['Tempat di sana harganya beberapa juta per meter.', 'a scale word with no figure behind it'],
	['Ada belasan pesaing di sekitarnya.', 'a vague quantity'],
	['There are dozens of rivals and it costs about a million per m².', 'a vague count and a bare scale'],
	['Tosari has five rivals, which is few.', 'a count in words the sheet does not carry'],
	// A right figure said about a place this answer never named. The number checks out,
	// which is exactly why a reader cannot catch this one.
	['Bendungan Hilir scores 68 out of 100 for laundries.', 'a place the answer did not name']
]) {
	check(`thrown away, ${why}: "${s.slice(0, 40)}…"`, ok(s) === null, `survived: ${ok(s)}`);
}

/* A refusal says why. A reply dropped in silence has exactly one symptom, Tapak sounding
   plainer, and nobody reports that. So the reason travels into the log and the
   provenance, and it has to name the figure. */
check(
	'a refusal names the figure nobody computed',
	(grounded.groundingFault('Warteg balik modal dalam 8 bulan.', FACTS, NAMED, EVERY) ?? '').includes('8'),
	`got ${grounded.groundingFault('Warteg balik modal dalam 8 bulan.', FACTS, NAMED, EVERY)}`
);
check(
	'a refusal names the place the answer never named',
	(grounded.groundingFault('Bendungan Hilir scores 68 out of 100.', FACTS, NAMED, EVERY) ?? '').includes('Bendungan Hilir')
);
check('a reply that clears the fence has no fault', grounded.groundingFault('Tosari scores 68 out of 100.', FACTS, NAMED, EVERY) === null);

/* The other half of the name rule, and the one that would show up as the feature quietly
   not working. Eighty-seven catchments are named with a single word and some of those are
   ordinary words, so a reply that never mentions a place must not be thrown away for
   using one of them as a word. */
for (const s of [
	'Kawasannya damai dan pesaingnya cuma 12 dalam radius 800 m.',
	'Harga karet dan bahan lain tidak saya punya datanya.',
	'Di luar Jakarta, misalnya Depok, saya belum punya data sama sekali.'
]) {
	check(`an ordinary word is not read as a catchment: "${s.slice(0, 40)}…"`, ok(s) !== null, `rejected: ${s}`);
}

// And a name distinctive enough to be one is still caught, inside a sentence rather than
// standing alone.
check(
	'a distinctive name the answer never named is still caught',
	ok('Menurut saya Rawamangun lebih masuk daripada itu.') === null
);
// A name must not fire from inside a longer word.
check(
	'a name is not found inside another word',
	grounded.unnamedPlaces('Pesaingnya berduri di mana-mana.', [], ['Duri', 'Rawamangun']).length === 0
);

check('an over-long reply is thrown away', ok('a'.repeat(grounded.REPLY_MAX_CHARS + 1)) === null);
check('an empty reply is thrown away', ok('   ') === null);
check('a non-string reply is thrown away', grounded.cleanGroundedReply({ text: 'hai' }, FACTS, NAMED, EVERY) === null);

// The scale a proportion is read against belongs to the interface, not to the data, so it
// is never in the sheet and would otherwise fail every correctly quoted score.
check('"out of 100" is not an ungrounded figure', ok('Tosari scores 68 out of 100.') !== null);

// Names nest: "Blok M" sits inside "Blok M BCA", and an answer that named the longer one
// must not be caught mentioning the shorter.
{
	const nested = EVERY.find((n) => EVERY.some((m) => m !== n && m.startsWith(`${n} `)));
	const longer = nested && EVERY.find((m) => m !== nested && m.startsWith(`${nested} `));
	if (longer) {
		check(
			`naming "${longer}" is not read as naming "${nested}"`,
			grounded.cleanGroundedReply(`${longer} is the one I would pick.`, FACTS, [longer], EVERY) !== null
		);
	} else {
		check('no nested catchment names on this grid to check', true);
	}
}

/* ── the fence must not reject the truth ─────────────────────────────────── */

/* THE ONE THAT WOULD BE INVISIBLE. The interface composes its own sentence from the very
   figures the sheet is built from, so that sentence is grounded by construction. If it
   cannot clear the fence, the fence is rejecting computed figures — and the symptom is
   not an error, it is Tapak silently falling back to the plainer answer on every turn
   forever while every test above still passes. */
{
	const cases = [
		['di mana sebaiknya buka laundry', ['laundry']],
		['seberapa ramai di sini', []],
		['di mana sewanya paling murah untuk kedai kopi', ['kopi']],
		['mana yang pesaingnya paling sedikit untuk apotek', ['apotek']],
		['mana yang sudah jenuh untuk kedai kopi', ['kopi']],
		['mana yang belum ada datanya', ['kopi']]
	];
	for (const [q, cats] of cases) {
		const ans = nlq.answer(q, cells, W, cats);
		const facts = grounded.factSheet(ans);
		const named = ans.items.map((i) => i.name);
		for (const [lang, dict] of [['id', i18n.DICT.id], ['en', i18n.DICT.en]]) {
			const composed = narrate.narrate(ans, dict);
			const bad = grounded.ungroundedFigures(composed, grounded.allowedFigures(facts));
			check(
				`the composed ${lang} sentence for "${q}" is grounded in its own facts`,
				bad.length === 0,
				`ungrounded: ${bad.join(', ')} in "${composed}"`
			);
			check(
				`…and clears the whole fence`,
				grounded.cleanGroundedReply(composed, facts, named, EVERY) !== null ||
					composed.length > grounded.REPLY_MAX_CHARS,
				`rejected: "${composed}"`
			);
		}
	}
}

// And the explanation, which carries the most figures of any shape here.
{
	const top = nlq.answer('di mana sebaiknya buka laundry', cells, W, ['laundry']).items[0].name;
	const ans = nlq.answer(`kenapa ${top}`, cells, W, ['laundry'], [top]);
	const facts = grounded.factSheet(ans);
	check('an explanation produces a fact sheet with its own figures in it', ans.explain != null && facts.includes(top));
	for (const [lang, dict] of [['id', i18n.DICT.id], ['en', i18n.DICT.en]]) {
		const composed = narrate.narrate(ans, dict);
		const bad = grounded.ungroundedFigures(composed, grounded.allowedFigures(facts));
		check(
			`the composed ${lang} explanation of ${top} is grounded`,
			bad.length === 0,
			`ungrounded: ${bad.join(', ')} in "${composed}"`
		);
	}
}

/* ── the sheet has to be able to answer more than one question ───────────── */

/* THE REGRESSION THIS WHOLE CHANGE EXISTS FOR. "Why does it fit" and "do you think the
   rent there is any good" are two different questions about one catchment, and they used
   to come back as the same paragraph because a template keyed on the intent wrote both.
   The model can only do better if the facts it is handed carry more than the score, so
   what is checked here is the sheet rather than the sentence: a writing pass cannot be
   tested without a network, but a sheet that has quietly been trimmed back to the score
   can, and that trimming is what would bring the identical answers back. */
{
	const top = nlq.answer('di mana sebaiknya buka laundry', cells, W, ['laundry']).items[0].name;
	const ans = nlq.answer(`kenapa ${top}`, cells, W, ['laundry'], [top]);
	const facts = grounded.factSheet(ans);
	const e = ans.explain;
	for (const [what, present] of [
		['the score it is made of', facts.includes('Skor peluang')],
		['what space costs there', e.price === null || facts.includes('harga JUAL')],
		['where that price sits on the grid', e.priceLevel === null || facts.includes('lebih mahal dari')],
		['that the price is to buy and not a rent', facts.includes('tidak memuat satu pun listing SEWA')],
		['how much is on the market', facts.includes('unit komersial')],
		['the transit it captures', facts.includes('simpul transit')],
		['the trade around it', facts.includes('usaha lain')]
	]) {
		check(`the facts for one catchment carry ${what}`, present);
	}

	/* And the pair that is the whole point: an answer written about the price of space
	   goes through, and the guess a model reaches for when asked the same thing does not.
	   The first is built from the sheet's own figures the way a model would copy them. */
	const named = [top];
	const short = e.price === null ? null : Math.round((e.price / 1e6) * 10) / 10;
	const rank = e.priceLevel === null ? null : Math.round(e.priceLevel * 100);
	if (short !== null && rank !== null) {
		const answered =
			`Space at ${top} is not cheap. The median asking price is Rp ${String(short).replace('.', ',')} juta per m², ` +
			`dearer than ${rank}% of the grid. That is a price to buy, not a rent: there is no rental data for Jakarta at all.`;
		check('an answer about the price of space clears the fence', grounded.cleanGroundedReply(answered, facts, named, EVERY) !== null, answered);
	} else {
		check(
			'an answer that reports the absence of a price clears the fence',
			grounded.cleanGroundedReply(
				`Nothing around ${top} lists a price, so I have no figure for what space costs there.`,
				facts,
				named,
				EVERY
			) !== null
		);
	}
	check(
		'a rent figure guessed from the sale price does not',
		grounded.cleanGroundedReply(
			`Renting at ${top} would run you about Rp 25 juta a month.`,
			facts,
			named,
			EVERY
		) === null
	);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
