/**
 * Self-test: the markdown reader, and the fence around a reply arriving in pieces.
 *
 *   node scripts/selftest-markdown.mjs
 *
 * WHY THESE TWO TOGETHER
 *
 * They are the two halves of the same change. The model now writes its casual reply
 * straight onto the reader's screen, a word at a time, and markdown is how it stresses
 * words when it does. Both failures are silent ones: a parser that mis-reads a marker
 * puts asterisks in front of a reader, and a fence that only checks the finished
 * sentence puts an invented figure in front of them for two seconds, which is long
 * enough to read.
 *
 * WHAT IS BEING GUARDED
 *
 * 1. Emphasis is read where it is meant and NOT read where it is not. `harga_tempat`
 *    is a measure key and turns up in replies about what can be asked; a parser that
 *    treats its underscores as emphasis prints `hargatempat` in italics.
 * 2. An unmatched marker stays a character. A lone asterisk that hunts across the rest
 *    of the sentence for a partner swallows the sentence.
 * 3. Cutting the tree at N characters counts prose, never markers, and never leaves a
 *    marker showing. That is what the reveal does sixty times a second.
 * 4. Every prefix of a rejected reply is rejected. This is the one that matters: the
 *    fence in `domain/chat` used to run once, at the end.
 *
 * No network and no data files. This is all pure functions over strings.
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
	const md = await server.ssrLoadModule('/src/lib/domain/markdown.ts');
	const chat = await server.ssrLoadModule('/src/lib/domain/chat.ts');
	const stream = await server.ssrLoadModule('/src/lib/server/stream.ts');
	await server.close();
	return { md, chat, stream };
}

const { md, chat, stream } = await load();

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

/** A parsed tree flattened back to a string, with the markers put back where they were read. */
function shape(blocks) {
	const inline = (parts) =>
		parts
			.map((p) => {
				if (p.kind === 'text') return p.text;
				if (p.kind === 'code') return `<code>${p.text}</code>`;
				if (p.kind === 'strong') return `<b>${inline(p.children)}</b>`;
				return `<i>${inline(p.children)}</i>`;
			})
			.join('');
	return blocks
		.map((b) => {
			if (b.kind === 'p') return `<p>${inline(b.children)}</p>`;
			const tag = b.ordered ? 'ol' : 'ul';
			return `<${tag}>${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`;
		})
		.join('');
}

const reads = (src, want) =>
	check(`${JSON.stringify(src)} reads as ${want}`, shape(md.parseMarkdown(src)) === want, `got ${shape(md.parseMarkdown(src))}`);

console.log('Markdown and streamed-reply self-test (no network)\n');

/* ── emphasis is read where it is meant ──────────────────────────────────── */

reads('**Blok M** teratas', '<p><b>Blok M</b> teratas</p>');
reads('agak *ramai* di sana', '<p>agak <i>ramai</i> di sana</p>');
reads('coba `harga_tempat`', '<p>coba <code>harga_tempat</code></p>');
reads('_pelan_ saja', '<p><i>pelan</i> saja</p>');
reads('**tebal dengan *miring* di dalam**', '<p><b>tebal dengan <i>miring</i> di dalam</b></p>');

/* ── and NOT read where it is not ────────────────────────────────────────── */

// The measure keys. Both of these turn up in a reply about what can be asked, and a
// parser that reads their underscores as emphasis prints the key wrong.
reads('ukurannya harga_tempat', '<p>ukurannya harga_tempat</p>');
reads('unit_dipasarkan juga ada', '<p>unit_dipasarkan juga ada</p>');
// A lone marker is a character somebody typed. Hunting for a partner across the rest
// of the sentence is how one asterisk swallows a paragraph.
reads('lebar * tinggi', '<p>lebar * tinggi</p>');
reads('kira-kira **segini', '<p>kira-kira **segini</p>');
// An empty span is not emphasis.
reads('**', '<p>**</p>');
// Escaped, so it is meant literally.
reads('harga \\*naik\\*', '<p>harga *naik*</p>');

/* ── blocks ──────────────────────────────────────────────────────────────── */

reads('- kopi\n- roti', '<ul><li>kopi</li><li>roti</li></ul>');
reads('1. kopi\n2. roti', '<ol><li>kopi</li><li>roti</li></ol>');
reads('satu\n\ndua', '<p>satu</p><p>dua</p>');
// A soft break inside a paragraph is a space, not a new paragraph.
reads('satu\ndua', '<p>satu dua</p>');
// A heading is flattened to a bold line: a chat bubble two sentences tall has no
// document structure for a heading to be a heading of.
reads('## Kawasan', '<p><b>Kawasan</b></p>');
// A rule is dropped rather than drawn across a bubble.
reads('satu\n\n---\n\ndua', '<p>satu</p><p>dua</p>');

/* ── a link is text, deliberately ────────────────────────────────────────── */

// The one markdown construct that carries a destination, and the destination would be
// a URL a remote model chose. There is nothing on this map worth linking to.
reads('[klik](https://contoh.id)', '<p>[klik](https://contoh.id)</p>');

/* ── nothing the model can write becomes markup ──────────────────────────── */

// The whole reason this is a tree and not a string of HTML. Nothing on this path can
// put a tag into the page, so there is nothing to sanitise.
const injected = md.parseMarkdown('<img src=x onerror=alert(1)> halo');
check(
	'a tag written by the model stays text',
	injected.length === 1 &&
		injected[0].children.every((p) => p.kind === 'text') &&
		injected[0].children[0].text.startsWith('<img'),
	JSON.stringify(injected)
);

/* ── the reveal cuts prose, never markers ────────────────────────────────── */

const bold = md.parseMarkdown('**Blok M** teratas');
check('markers are not counted as prose', md.textLength(bold) === 'Blok M teratas'.length);
check(
	'a cut inside a bold word keeps it bold',
	shape(md.truncate(bold, 3)) === '<p><b>Blo</b></p>',
	shape(md.truncate(bold, 3))
);
check(
	'a cut at the full length is the whole thing',
	shape(md.truncate(bold, md.textLength(bold))) === shape(bold)
);
check('a cut at nothing shows nothing', shape(md.truncate(bold, 0)) === '');
// Every prefix of the reveal has to be renderable, because every one of them is
// rendered. A budget that ever left a marker on screen would flicker on every reply.
let clean = true;
for (let n = 0; n <= md.textLength(bold); n++) {
	if (/\*/.test(shape(md.truncate(bold, n)))) clean = false;
}
check('no prefix of a reveal ever shows a marker', clean);

/* ── the fence holds on every prefix, not only at the end ────────────────── */

// The sentence the fence exists for: fluent, plausible, entirely invented, and it would
// sit in the same thread as figures that are traceable to a source.
const invented = 'Warteg biasanya balik modal dalam 8 bulan.';
check('the invented figure is rejected whole', chat.cleanChatReply(invented) === null);
const firstBad = [...invented].findIndex((ch) => /[0-9]/.test(ch));
check(
	'and rejected the moment the digit is written, not at the end',
	chat.withinFence(invented.slice(0, firstBad)) && !chat.withinFence(invented.slice(0, firstBad + 1)),
	`digit at ${firstBad}`
);
// Once it fails it stays failed, so nothing more is ever sent for that reply.
check(
	'a rejected reply has no later prefix that passes',
	[...invented].every((_, i) => (i > firstBad ? !chat.withinFence(invented.slice(0, i + 1)) : true))
);
// A good reply passes at every length, so it streams without stopping.
const fine = 'Halo, saya Tapak. Mau lihat kawasan mana dulu?';
check(
	'a clean reply passes at every length',
	[...fine].every((_, i) => chat.withinFence(fine.slice(0, i + 1)))
);
// The leash, applied to a prefix too: a model that keeps going gets cut off at the same
// place the finished reply would have been.
const long = 'a'.repeat(chat.CHAT_MAX_CHARS + 1);
check('the length leash holds on a prefix', !chat.withinFence(long));
check('and lets the last allowed character through', chat.withinFence(long.slice(0, -1)));

/* ── a tool call read while it is still being written ────────────────────── */

// The model streams its arguments as fragments of JSON, so there is no object to parse
// until the very end, which is the moment streaming exists to avoid waiting for.
const arg = (buf) => stream.partialArg(buf, 'balasan');

check('nothing to read before the key appears', arg('{"topik":"sapaan"') === null);
check('nothing to read before the quote opens', arg('{"balasan":') === null);
check('an opened but empty string is not nothing', arg('{"balasan":"') === '');
check('a half-written value reads as far as it got', arg('{"balasan":"Halo, saya Ta') === 'Halo, saya Ta');
check('a finished value stops at its quote', arg('{"balasan":"Halo","topik":"sapaan"}') === 'Halo');
check('whitespace around the colon is allowed', arg('{ "balasan" : "Halo') === 'Halo');
// The escapes. A reply carrying a quotation mark or an accent is not unusual, and each
// of these arrives split across two fragments as often as not.
check('an escaped quote is a quote', arg('{"balasan":"kata \\"buka\\" itu') === 'kata "buka" itu');
check('an escaped newline is a newline', arg('{"balasan":"satu\\ndua') === 'satu\ndua');
check('a unicode escape is decoded', arg('{"balasan":"caf\\u00e9 dekat') === 'café dekat');
// Stopping cleanly in the middle of an escape is the whole point: the next fragment
// finishes it, and a reader that guessed would print a backslash at the reader.
check('half an escape stops rather than guesses', arg('{"balasan":"caf\\u00') === 'caf');
check('a lone trailing backslash stops too', arg('{"balasan":"halo\\') === 'halo');

/* ── the preview only ever shows what survived the fence ─────────────────── */

/** Feeds a reply through the preview one character at a time, as the network would. */
function preview(reply) {
	let shown = '';
	const seen = [];
	const p = new stream.Preview({
		delta: (t) => {
			shown += t;
			seen.push(shown);
		},
		reset: () => {
			shown = '';
			seen.push(null);
		},
		chose: () => {},
		retrying: () => {}
	});
	for (let i = 1; i <= reply.length; i++) p.offer(reply.slice(0, i));
	return { shown, seen, live: p.live };
}

const good = preview('Halo, saya Tapak. Mau lihat kawasan mana dulu?');
check('a clean reply arrives whole', good.shown === 'Halo, saya Tapak. Mau lihat kawasan mana dulu?');
check('and only ever grew', good.seen.every((s) => s !== null));

const bad = preview('Warteg biasanya balik modal dalam 8 bulan.');
check('a reply that breaks the fence ends up showing nothing', bad.shown === '');
check('it was pulled rather than left up', bad.seen.includes(null));
check(
	'and nothing at all was shown after the digit',
	bad.seen.slice(bad.seen.indexOf(null) + 1).length === 0,
	JSON.stringify(bad.seen.slice(bad.seen.indexOf(null) + 1))
);
check('so no prefix on screen ever carried a digit', bad.seen.every((s) => s === null || !/[0-9]/.test(s)));

// A model that broke the fence and then gave up hands the turn to the next model in the
// chain, and that one gets to say its own sentence. The fence belonged to the reply, not
// to the reader.
const shared = [];
const reusable = new stream.Preview({
	delta: (t) => shared.push(t),
	reset: () => shared.push(null),
	chose: () => {},
	retrying: () => {}
});
for (const s of ['Balik modal 8 bulan.']) for (let i = 1; i <= s.length; i++) reusable.offer(s.slice(0, i));
reusable.clear();
for (const s of ['Halo, saya Tapak.']) for (let i = 1; i <= s.length; i++) reusable.offer(s.slice(0, i));
check(
	'the fence lifts when the attempt it belonged to is abandoned',
	shared.filter((t) => t !== null).join('').endsWith('Halo, saya Tapak.'),
	JSON.stringify(shared)
);

// Whitespace is collapsed the same way `cleanChatReply` collapses it, so the preview
// and the sentence that replaces it are the same string and the bubble does not reflow.
const spaced = preview('  Halo,   saya Tapak. ');
check(
	'the preview is the same string the finished reply will be',
	spaced.shown === chat.cleanChatReply('  Halo,   saya Tapak. '),
	JSON.stringify(spaced.shown)
);

/* ── the same, over the wire ─────────────────────────────────────────────── */

/**
 * A completion split into byte chunks that do NOT line up with its lines.
 *
 * That is the case worth testing and the one nobody hits by hand: a chunk off the
 * network stops wherever it stops, regularly halfway through a `data:` line, and a
 * reader that treats each chunk as whole turns a perfectly good answer into a parse
 * error the first time the connection is slow.
 */
function sse(events, chunkSize) {
	const body = `${events.map((e) => `data: ${JSON.stringify(e)}`).join('\n\n')}\n\ndata: [DONE]\n\n`;
	const bytes = new TextEncoder().encode(body);
	return new Response(
		new ReadableStream({
			start(controller) {
				for (let i = 0; i < bytes.length; i += chunkSize) {
					controller.enqueue(bytes.slice(i, i + chunkSize));
				}
				controller.close();
			}
		})
	);
}

/** One argument fragment, in the shape OpenRouter sends it. */
const frag = (name, args) => ({
	choices: [{ delta: { tool_calls: [{ index: 0, function: { name, arguments: args } }] } }]
});

/** A preview writing into `shown`, recording every tool it is told about. */
function watcher(shown, tools = []) {
	return {
		preview: new stream.Preview({
			delta: (t) => shown.push(t),
			reset: () => shown.push(null),
			chose: (tool) => tools.push(tool),
			retrying: () => tools.push('(retrying)')
		}),
		tools
	};
}

const events = [
	frag('ngobrol', '{"topik":'),
	frag(undefined, '"sapaan","balasan":"Halo, '),
	frag(undefined, 'saya Tapak. Mau '),
	frag(undefined, 'lihat kawasan mana dulu?"}')
];

for (const size of [1, 7, 64, 4096]) {
	const shown = [];
	const { call } = await stream.readStream(sse(events, size), watcher(shown).preview);
	const args = JSON.parse(call.function.arguments);
	check(
		`a call split into ${size}-byte chunks is stitched back together`,
		call.function.name === 'ngobrol' && args.balasan === 'Halo, saya Tapak. Mau lihat kawasan mana dulu?',
		JSON.stringify(call)
	);
	check(
		`  and was previewed in pieces rather than in one go (${size})`,
		shown.length > 1 && shown.join('') === args.balasan,
		JSON.stringify(shown)
	);
}

// Only the operation this layer asked for. A second call has nothing sensible to do.
const second = await stream.readStream(
	sse([frag('ngobrol', '{"balasan":"Halo"}'), { choices: [{ delta: { tool_calls: [{ index: 1, function: { name: 'lain', arguments: '{}' } }] } }] }], 16),
	null
);
check(
	'a second tool call is ignored',
	second.call.function.name === 'ngobrol' && second.call.function.arguments === '{"balasan":"Halo"}'
);

/* ── a model that answers casually without reaching for a tool ───────────── */

// The tools are offered, not forced. Free models vary in how well they honour a
// required tool choice, and a plain "halo" answered in plain prose used to be read as a
// failure and fall through the whole chain to the rule parser.
const proseEvents = ['Halo, ', 'saya Tapak. ', 'Mau lihat kawasan mana dulu?'].map((t) => ({
	choices: [{ delta: { content: t } }]
}));
const proseShown = [];
const proseWatch = watcher(proseShown);
const prose = await stream.readStream(sse(proseEvents, 9), proseWatch.preview);
check(
	'prose with no tool call is carried back rather than dropped',
	prose.call === undefined && prose.content === 'Halo, saya Tapak. Mau lihat kawasan mana dulu?',
	JSON.stringify(prose)
);
check(
	'and it streams to the reader like any other casual reply',
	proseShown.length > 1 && proseShown.join('') === chat.cleanChatReply(prose.content),
	JSON.stringify(proseShown)
);
// The fence does not care which route the sentence took. This is what stops a model
// that skips the tools and answers a data question in fluent invented prose.
check(
	'prose carrying a figure fails the same fence ngobrol does',
	chat.cleanChatReply('Warteg biasanya balik modal dalam 8 bulan.') === null
);

// A model that narrates before calling a tool must not put its throat clearing on the
// reader's screen. The preview stops the moment a tool is named, and the caller takes
// down whatever went up.
const preambleShown = [];
const preambleWatch = watcher(preambleShown);
const preamble = await stream.readStream(
	sse([{ choices: [{ delta: { content: 'Sebentar ya' } }] }, frag('jalankan_query', '{"intent":"RANK"}')], 6),
	preambleWatch.preview
);
check(
	'a preamble does not stop the tool call being read',
	preamble.call.function.name === 'jalankan_query',
	JSON.stringify(preamble)
);
check(
	'and the preamble is taken back down when the tool is named',
	preambleShown[preambleShown.length - 1] === null,
	JSON.stringify(preambleShown)
);

/* ── the reader is told the operation was named ──────────────────────────── */

// The whole point of this signal: it is the first proof the model woke up. Without it
// the line reads `reading` from the moment the question goes out until the answer
// lands, which on a busy free model is a minute and a half of nothing moving.
check(
	'naming the operation is reported once, with the name',
	preambleWatch.tools.length === 1 && preambleWatch.tools[0] === 'jalankan_query',
	JSON.stringify(preambleWatch.tools)
);
// A model repeating the name across fragments has not changed its mind, and the
// reader's line must not move twice for one decision.
const repeatTools = [];
await stream.readStream(
	sse([frag('ngobrol', '{"bal'), frag('ngobrol', 'asan":"Halo"}')], 8),
	watcher([], repeatTools).preview
);
check('a repeated name is reported once, not twice', repeatTools.length === 1, JSON.stringify(repeatTools));
// Prose is not an operation. Nothing to report, and nothing to move the line for: the
// reply itself is already filling the bubble.
check('prose names no operation', proseWatch.tools.length === 0, JSON.stringify(proseWatch.tools));

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
