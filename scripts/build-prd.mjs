/**
 * Renders `docs/05-prd-spoton.md` into the A4 PDF the organisers take.
 *
 *   node scripts/build-prd.mjs
 *
 * NOT part of the app, and its dependencies are deliberately NOT in `package.json`:
 * nothing the site ships needs a browser, a Markdown parser, or a PDF library. Install
 * them when you need to rebuild the document, and let them go afterwards.
 *
 *   npm i --no-save markdown-it mermaid playwright pdf-lib && npx playwright install chromium
 *
 * THE PALETTE AND THE TYPE ARE THE ORGANISERS', NOT OURS. Every value in `C` below was
 * measured off `Template_PRD_MAPID_WebGIS_Competition_2026.pdf` rather than chosen: the
 * face from its embedded font list (Figtree), the colours by sampling its rendered
 * pages, the sizes from its glyph boxes. A document that arrives looking like the
 * template it was written into is one less thing between a juror and what it says.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERE = path.join(REPO, 'node_modules');
const CACHE = path.join(REPO, '.prd-cache');
const SRC = path.join(REPO, 'docs/05-prd-spoton.md');
const OUT = path.join(REPO, 'docs/assets/TripleT_SpotOn.pdf');

/**
 * Figtree, the template's own face, fetched once and cached.
 *
 * Inlined into the page as base64 rather than linked, because the renderer loads the
 * HTML over `file://` and a webfont request from there would simply not arrive.
 */
async function figtree() {
	const cached = path.join(CACHE, 'figtree.json');
	if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));
	const api = 'https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap';
	const ua = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
	const css = await (await fetch(api, { headers: ua })).text();
	const out = [];
	for (const block of css.match(/@font-face\s*\{[\s\S]*?\}/g) ?? []) {
		const pick = (re) => block.match(re)?.[1]?.trim() ?? null;
		const url = pick(/url\((https:\/\/[^)]+)\)/);
		const buf = Buffer.from(await (await fetch(url, { headers: ua })).arrayBuffer());
		out.push({
			style: pick(/font-style:\s*([^;]+);/),
			weight: pick(/font-weight:\s*([^;]+);/),
			range: pick(/unicode-range:\s*([^;]+);/),
			b64: buf.toString('base64')
		});
	}
	if (!out.length) throw new Error('Google Fonts returned no @font-face blocks for Figtree');
	fs.mkdirSync(CACHE, { recursive: true });
	fs.writeFileSync(cached, JSON.stringify(out));
	return out;
}

const C = {
	ink: '#121212', // body text
	blue: '#0070C0', // table headers, the one strong accent
	blueDark: '#1F4E78', // sub-headings
	rule: '#8DB4E2', // the light rule under a section heading
	callout: '#EAF1FA', // instruction-box fill
	zebra: '#F4F8FC', // alternating table rows, and the cover's value cells
	cell: '#BDD1E8', // table cell borders
	furniture: '#9F9F9F', // running head and folio
	furnitureRule: '#D9D9D9',
	quiet: '#595959' // the italic notes under a table
};

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
	const t = tokens[idx];
	if ((t.info || '').trim() === 'mermaid') {
		return `<pre class="mermaid">${md.utils.escapeHtml(t.content)}</pre>\n`;
	}
	return defaultFence(tokens, idx, opts, env, self);
};

/** markdown-it emits a header row even when the source has none, and an empty band of
    blue above a label/value table reads as a mistake. */
const dropEmptyHeaders = (html) =>
	html.replace(/<thead>\s*<tr>(?:\s*<th[^>]*>\s*<\/th>)+\s*<\/tr>\s*<\/thead>/g, '');

const source = fs.readFileSync(SRC, 'utf8');

const SPLIT = '\n## 1. Ringkasan Eksekutif';
const at = source.indexOf(SPLIT);
if (at < 0) throw new Error('could not find the first numbered section');
const front = source.slice(0, at);
const body = source.slice(at + 1);

const noteMatch = front.match(/^> [\s\S]*?(?=\n\n)/m);
if (!noteMatch) throw new Error('could not find the note on the cover');
const note = noteMatch[0].replace(/^> ?/gm, '');
const judulAt = front.indexOf('## Halaman Judul');
if (judulAt < 0) throw new Error('could not find the cover table');
const judul = front.slice(judulAt).replace(/\n---\s*$/, '');

const faces = (await figtree())
	.map(
		(f) => `@font-face {
	font-family: 'Figtree';
	font-style: ${f.style};
	font-weight: ${f.weight};
	font-display: block;
	src: url(data:font/woff2;base64,${f.b64}) format('woff2');
	${f.range ? `unicode-range: ${f.range};` : ''}
}`
	)
	.join('\n');

/* The SpotOn mark: a lot with its corner clipped, the same shape the app header draws.
   Monochrome on purpose — blue is the accent this product spends on one thing only. */
const LOGO = `<svg class="mark" viewBox="8.6 8.6 14.8 14.8" role="img" aria-label="SpotOn">
	<defs><clipPath id="lotclip"><polygon points="9,9 23,9 23,17.7 17.7,23 9,23"/></clipPath></defs>
	<rect x="10.2" y="10.2" width="11.6" height="11.6" rx="2.4" fill="none"
		stroke="${C.ink}" stroke-width="2.4" clip-path="url(#lotclip)"/>
</svg>`;

const css = `
${faces}

@page { size: A4; margin: 20mm 21mm 18mm 21mm; }

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
	font-family: 'Figtree', system-ui, sans-serif;
	font-size: 11pt; line-height: 1.45; color: ${C.ink}; margin: 0;
}

/* ---------- cover ---------- */
.cover { page-break-after: always; text-align: center; padding-top: 6mm; }
.cover .mark { width: 11mm; height: 11mm; display: block; margin: 0 auto 6mm; }
.cover .kicker { font-size: 11pt; font-weight: 700; letter-spacing: .01em; margin: 0 0 1mm; }
.cover .edition { font-size: 11pt; font-style: italic; margin: 0 0 7mm; }
.cover h1 {
	font-size: 27pt; line-height: 1.18; font-weight: 700; text-transform: uppercase;
	margin: 0 auto 4mm; max-width: 150mm; letter-spacing: -.005em;
}
.cover .sub { font-size: 12pt; margin: 0 0 5mm; }
.cover .titlerule { border: 0; border-top: 1.5px solid ${C.rule}; margin: 0 0 6mm; }
/* The template's cover carries no section heading of its own: the page IS the title
   page, so the words "Halaman Judul" would label it twice. */
.cover h2 { display: none; }
.judul { text-align: left; }
.judul p { margin: 0 0 1.5mm; }
.judul > p:has(strong) { margin: 5mm 0 1.5mm; }
.cover table { text-align: left; margin-top: 0; }
/* The label/value table on the template's cover: bold label on white, value tinted. */
.cover table.pairs td:first-child { font-weight: 700; width: 40%; background: #fff; }
.cover table.pairs td:last-child { background: ${C.zebra}; }
.cover .note {
	text-align: left; font-size: 9.5pt; font-style: italic; color: ${C.quiet};
	line-height: 1.4; margin-top: 5mm;
}
.cover .note p { margin: 0 0 1.5mm; }
.cover em { color: ${C.quiet}; }

/* ---------- headings ---------- */
h2 {
	font-size: 14.5pt; font-weight: 700; color: ${C.ink};
	/* The bottom margin lives here rather than on an adjacent-sibling rule, which the
	   later paragraph rule would override on equal specificity, leaving the first line
	   of every section sitting directly on the heading rule. */
	margin: 8mm 0 3.5mm; padding-bottom: 2mm; border-bottom: 1px solid ${C.rule};
	break-after: avoid; page-break-after: avoid;
}
h3 {
	font-size: 12pt; font-weight: 700; color: ${C.blueDark};
	margin: 6mm 0 2mm; break-after: avoid; page-break-after: avoid;
}

p { margin: 0 0 2.4mm; orphans: 2; widows: 2; }
strong { font-weight: 700; }

ul, ol { margin: 0 0 3mm; padding-left: 7mm; }
li { margin-bottom: 1mm; }
li > ul, li > ol { margin-top: 1mm; }

/* ---------- tables ---------- */
table {
	width: 100%; border-collapse: collapse; margin: 3mm 0 4mm;
	font-size: 10.5pt; line-height: 1.35;
}
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th {
	text-align: left; font-weight: 700; font-size: 10.5pt;
	background: ${C.blue}; color: #fff;
	border: 1px solid ${C.blue}; padding: 1.8mm 2.4mm; vertical-align: top;
}
td { border: 1px solid ${C.cell}; padding: 1.8mm 2.4mm; vertical-align: top; }
/* A long path or endpoint inside a cell sets that column's minimum width, and the auto
   layout then starves every other column. Letting it break where it must keeps the
   columns proportional to how much prose they actually carry. */
th, td { overflow-wrap: break-word; }
td code { overflow-wrap: anywhere; }
tbody tr:nth-child(even) td { background: ${C.zebra}; }

/* ---------- callout, code, diagrams ---------- */
blockquote {
	background: ${C.callout}; border-left: 3px solid ${C.rule};
	margin: 3mm 0 4mm; padding: 2.5mm 3.5mm; font-style: italic;
}
blockquote p:last-child { margin-bottom: 0; }

code {
	font-family: 'DejaVu Sans Mono', ui-monospace, monospace;
	font-size: 9.2pt; background: ${C.zebra}; border: 1px solid ${C.cell};
	padding: .2mm 1mm; border-radius: 2px;
}
pre {
	background: ${C.zebra}; border: 1px solid ${C.cell}; border-left: 3px solid ${C.rule};
	padding: 3mm 3.5mm; margin: 3mm 0 4mm;
	break-inside: avoid; page-break-inside: avoid;
}
pre code { background: none; border: 0; padding: 0; font-size: 9pt; line-height: 1.4; white-space: pre; }

pre.mermaid {
	background: none; border: 0; padding: 0; text-align: center;
	break-inside: avoid; page-break-inside: avoid; margin: 4mm 0 5mm;
}

hr { border: 0; border-top: 1px solid ${C.furnitureRule}; margin: 6mm 0; }
`;

const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>PRD SpotOn</title>
<style>${css}</style>
</head><body>
<div class="cover">
	${LOGO}
	<p class="kicker">MAPID WEBGIS COMPETITION #2 - 2026</p>
	<p class="edition">Maps That Think! - Mass Transportation Edition</p>
	<h1>Product Requirement Document (PRD)</h1>
	<p class="sub">WebGIS - Spatial Intelligence untuk Transportasi Massal</p>
	<hr class="titlerule">
	<div class="judul">${dropEmptyHeaders(md.render(judul)).replace('<table>', '<table class="pairs">')}</div>
	<div class="note">${md.render(note)}</div>
</div>
${dropEmptyHeaders(md.render(body))}
<script src="file://${HERE}/mermaid/dist/mermaid.min.js"></script>
<script>
	window.mermaid.initialize({
		startOnLoad: false,
		theme: 'base',
		fontFamily: "'Figtree', system-ui, sans-serif",
		themeVariables: {
			fontSize: '15px',
			primaryColor: '${C.zebra}', primaryTextColor: '${C.ink}', primaryBorderColor: '${C.blue}',
			lineColor: '${C.blueDark}', secondaryColor: '${C.callout}', tertiaryColor: '#ffffff',
			clusterBkg: '#ffffff', clusterBorder: '${C.rule}'
		},
		flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true, nodeSpacing: 34, rankSpacing: 38, padding: 8 }
	});
	// A diagram taller than the page is silently CLIPPED by Chromium when it may not
	// break, so each one is fitted to the text column and to the page height by hand.
	const MAX_W = 168, MAX_H = 196, MAX_UP = 1.25; // mm, and a cap on enlarging
	window.__ready = window.mermaid.run({ querySelector: 'pre.mermaid' }).then(() => {
		for (const svg of document.querySelectorAll('pre.mermaid svg')) {
			const vb = svg.viewBox.baseVal;
			const ratio = vb.width / vb.height;
			const w = Math.min(MAX_W, MAX_H * ratio, (vb.width * MAX_UP) / 3.7795);
			svg.removeAttribute('width');
			svg.removeAttribute('height');
			svg.style.maxWidth = 'none';
			svg.style.width = w + 'mm';
			svg.style.height = w / ratio + 'mm';
		}
		return true;
	});
</script>
</body></html>`;

fs.mkdirSync(CACHE, { recursive: true });
const htmlPath = path.join(CACHE, 'prd.html');
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto('file://' + htmlPath, { waitUntil: 'load' });
await page.waitForFunction('window.__ready !== undefined');
await page.evaluate('window.__ready');
await page.evaluate(() => document.fonts.ready);

/* The template's own running head and folio: grey, hairline-ruled, the folio centred
   and reading "Halaman N" with no total. */
const base = `font-family:'Figtree',sans-serif;font-size:8pt;color:${C.furniture};width:100%;padding:0 21mm;`;
const headerTemplate = `<div style="${base}display:flex;justify-content:space-between;border-bottom:1px solid ${C.furnitureRule};padding-bottom:2mm;"><span>PRD SpotOn</span><span>Maps That Think! - Mass Transportation Edition</span><span></span></div>`;
const footerTemplate = `<div style="${base}text-align:center;border-top:1px solid ${C.furnitureRule};padding-top:2mm;">Halaman <span class="pageNumber"></span></div>`;

const margin = { top: '20mm', bottom: '18mm', left: '21mm', right: '21mm' };
const withFurniture = path.join(CACHE, 'body.pdf');
const bare = path.join(CACHE, 'cover.pdf');

await page.pdf({
	path: withFurniture, format: 'A4', printBackground: true, margin,
	displayHeaderFooter: true, headerTemplate, footerTemplate
});
// The same render without running heads, so the cover can be swapped in clean. The body
// layout is identical either way, because the furniture lives in the margin.
await page.pdf({ path: bare, format: 'A4', printBackground: true, margin, displayHeaderFooter: false });
await browser.close();

/* Page 1 comes from the render with no running head, the rest from the one with it, so
   the cover carries no furniture while the folio still counts from it -- which is how
   the organisers' own template is paginated. */
const merged = await PDFDocument.create();
const [coverDoc, bodyDoc] = await Promise.all([
	PDFDocument.load(fs.readFileSync(bare)),
	PDFDocument.load(fs.readFileSync(withFurniture))
]);
const [cover] = await merged.copyPages(coverDoc, [0]);
merged.addPage(cover);
const rest = bodyDoc.getPageIndices().slice(1);
for (const pg of await merged.copyPages(bodyDoc, rest)) merged.addPage(pg);
fs.writeFileSync(OUT, await merged.save());
console.log(`wrote ${OUT} (${merged.getPageCount()} pages, ${fs.statSync(OUT).size} bytes)`);
