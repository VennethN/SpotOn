/**
 * Self-test: the markdown reader.
 *
 *   node scripts/selftest-markdown.mjs
 *
 * The failure this catches is a silent one. A parser that mis-reads a marker does not
 * raise anything, it puts asterisks in front of a reader, or swallows half a sentence
 * into an italic that never closes.
 *
 * WHAT IS BEING GUARDED
 *
 * 1. Emphasis is read where it is meant and NOT read where it is not. `harga_tempat`
 *    is a measure key and turns up in replies about what can be asked; a parser that
 *    treats its underscores as emphasis prints `hargatempat` in italics.
 * 2. An unmatched marker stays a character. A lone asterisk that hunts across the rest
 *    of the sentence for a partner swallows the sentence.
 * 3. Nothing the model writes can become markup. That is the whole reason this parses
 *    to a tree of objects rather than to a string of HTML.
 * 4. Cutting the tree at N characters counts prose, never markers, and never leaves a
 *    marker showing. That is what the reveal does sixty times a second.
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
	await server.close();
	return { md };
}

const { md } = await load();

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

console.log('Markdown self-test (no network)\n');

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

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
