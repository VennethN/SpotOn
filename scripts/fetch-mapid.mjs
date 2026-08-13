/**
 * Fetches MAPID premium POIs straight from the catalogue and stores them as a single
 * point file, ready to be joined onto the hexagon grid.
 *
 *   node scripts/fetch-mapid.mjs
 *
 * Output:
 *   src/lib/data/mapid-poi.json  — points + a coverage declaration
 *   docs/mapid-layers.md         — the list of datasets read, for syncing by hand
 *
 * THERE IS NO MANUAL IMPORT STEP ANY MORE
 *
 * The previous version could only read layers already imported by hand into the GEO
 * MAPID project, so adding one city meant opening the interface and pressing Import.
 * It turned out the limiting factor was not layer ownership but the `project_id`
 * being sent — the full explanation lives in `scripts/lib/mapid.mjs`. With our own
 * project as the read ticket, the whole premium catalogue can be read directly and
 * this script finds the datasets it needs by itself.
 *
 * The GEO MAPID project is still read, because the competition's mission datasets
 * will arrive as a separate shared project — never as a catalogue entry.
 *
 * COVERAGE IS DECLARED, NOT INFERRED FROM POINTS
 *
 * The list of "which cities are covered" used to be worked backwards from the KABKOT
 * of whichever points survived classification. That conflated two things which are
 * the very heart of this project's promise: a dataset that DOES NOT EXIST, and a
 * dataset that exists but happens to yield zero rows after filtering. Both produce
 * "no points", yet the first means "not checked" and the second "checked, genuinely
 * empty".
 *
 * Coverage is now written from the MANIFEST: once a city's dataset has been read
 * successfully, that city is covered for the categories that dataset promises — no
 * matter how many points ultimately survive.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	mapidKey,
	matchesDataset,
	normCity,
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
	'warteg',
	'cepatsaji',
	'mie',
	'seafood',
	'restoasing',
	'minimarket',
	'kelontong',
	'laundry',
	'bengkel',
	'apotek'
];

/** The five DKI administrative cities. The catalogue ships one dataset per city. */
const CITIES = ['JAKARTA PUSAT', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR', 'JAKARTA UTARA'];

/**
 * The datasets to look for, and which SpotOn categories each one guarantees coverage
 * for.
 *
 * `covers` is not the same as the classification result. The MAKANAN DAN MINUMAN
 * dataset holds coffee shops AND eating places, so its existence covers two
 * categories at once — even if for a particular city its contents happen not to hold
 * a single coffee shop. That is the difference between "has been checked" and "has
 * something in it".
 *
 * `force` pins an entire dataset's contents to one category, bypassing RULES. Used
 * only for datasets that genuinely hold a single business type and whose taxonomy
 * cannot be read. BRAND COFFEE SHOP is the case: its TIPE_3 holds brand names, and
 * "STARBUCKS" contains neither the word coffee nor kopi. Without `force` it falls
 * through to TIPE_2 "MINUMAN" and every Starbucks counts as a drinks stall rather
 * than a coffee shop. Do not use `force` on umbrella datasets like MAKANAN DAN
 * MINUMAN or LAYANAN ATAU JASA — their contents are mixed, and pinning them throws
 * away the very distinction we want to see.
 *
 * WHY LAUNDRY HAS NO ROW OF ITS OWN
 *
 * It was once concluded that "laundry is not in the premium catalogue" because no
 * dataset is named LAUNDRY. What was searched at the time was only the DATASET NAME,
 * when laundry exists as a subtype inside another dataset: LAYANAN ATAU JASA →
 * TIPE_3 "BINATU (LAUNDRY)", 3,723 points across all five cities. The same mistake
 * once hid petrol stations, which the catalogue calls PENGISIAN BAHAN BAKAR. The
 * lesson: not found by name is not the same as absent — check the TIPE taxonomy
 * inside the umbrella datasets before concluding anything.
 */
const MANIFEST = [
	{ term: 'COFFEE SHOP', covers: ['kopi'] },
	{ term: 'BRAND COFFEE SHOP', covers: ['kopi'], force: 'kopi' },
	{ term: 'MINUMAN', covers: ['kopi', 'minuman'] },
	{ term: 'ROTI DAN KUE', covers: ['roti'] },
	{ term: 'RESTORAN', covers: ['warteg', 'cepatsaji', 'mie', 'seafood', 'restoasing'] },
	{
		term: 'MAKANAN DAN MINUMAN',
		covers: ['kopi', 'minuman', 'roti', 'warteg', 'cepatsaji', 'mie', 'seafood', 'restoasing']
	},
	{ term: 'MINIMARKET', covers: ['minimarket'] },
	{ term: 'TOKO KELONTONG', covers: ['kelontong'] },
	{ term: 'LAYANAN ATAU JASA', covers: ['laundry', 'bengkel'] },
	{ term: 'PERAWATAN DAN PERBAIKAN OTOMOTIF', covers: ['bengkel'] },
	{ term: 'APOTEK', covers: ['apotek'] }
];

/**
 * The MAPID taxonomy (TIPE_1 → TIPE_2 → TIPE_3) mapped onto SpotOn's thirteen
 * categories. Matched from most specific to most general: an outlet can be typed
 * "MAKANAN DAN MINUMAN / MINUMAN / COFFEESHOP", and what decides its category is
 * TIPE_3, not TIPE_1.
 */
const RULES = [
	{ cat: 'kopi', re: /COFFEE|KOPI|KEDAI KOPI|CAFE|KAFE/i },
	{ cat: 'apotek', re: /APOTEK|APOTIK|FARMASI|PHARMAC/i },
	// This used to include `CUCI` as well. Dropped because "CUCI MOBIL" (car wash) is
	// a garage, not a laundry — and this rule is checked first, so one over-loose word
	// would steal it. It went unnoticed at the time because the laundry category did
	// not have a single point yet.
	{ cat: 'laundry', re: /LAUNDRY|BINATU/i },
	{ cat: 'bengkel', re: /BENGKEL|PERBAIKAN OTOMOTIF|SERVIS (MOTOR|MOBIL)/i },
	{ cat: 'roti', re: /ROTI|KUE|BAKERY|PASTRI|DONAT/i },
	// `^MINUMAN$` is anchored to the whole value, not a fragment. TIPE_1 for EVERY
	// food outlet reads "MAKANAN DAN MINUMAN", so a loose pattern would sweep every
	// restaurant into the drinks category the moment its TIPE_2 and TIPE_3 are empty.
	{ cat: 'minuman', re: /^MINUMAN$|BOBA|MILK ?TEA|THAI TEA|JUS$|JUICE|ES KRIM|DESSERT/i },
	{ cat: 'kelontong', re: /KELONTONG|SEMBAKO/i },
	// `KELONTONG` has already moved to its own category above.
	{ cat: 'minimarket', re: /MINIMARKET|MART|SWALAYAN|SUPERMARKET|INDOMARET|ALFAMART/i },

	// ── the `warung` splits ───────────────────────────────────────────────
	// Matched against TIPE_3, which in the RESTORAN dataset does hold the type.
	// Ordered most specific first: `RESTORAN PADANG` has to be caught by warteg
	// before the general `RESTORAN` rule sweeps it up.
	{ cat: 'cepatsaji', re: /CEPAT SAJI|FAST ?FOOD/i },
	{ cat: 'mie', re: /\bMIE\b|BAKSO|RAMEN|BAKMI/i },
	{ cat: 'seafood', re: /SEAFOOD|IKAN BAKAR/i },
	{
		cat: 'restoasing',
		re: /KOREA|JEPANG|JAPAN|SUSHI|THAI|VIETNAM|CINA|CHINA|TIONGHOA|EROPA|MEKSIKO|AFRIKA|TIMUR TENGAH|PIZZA|STEAK|BBQ|BARAT|WESTERN|ITALIA/i
	},
	{ cat: 'warteg', re: /WARUNG TEGAL|WARTEG|NASI GORENG|PADANG|MELAYU|NUSANTARA|JAJANAN|AYAM|WARUNG|RUMAH MAKAN/i },
	// The final catch-all. An outlet with an empty TIPE_3 is known only as an "eating
	// place" and nothing more — warteg is the most sensible guess for that in Jakarta,
	// and the only alternative is to throw it away.
	{ cat: 'warteg', re: /RESTORAN|RESTAURANT|MAKANAN|KULINER/i }
];

/**
 * An outlet name fit to print, or null.
 *
 * The catalogue writes an absent name several ways: missing, empty, and the literal
 * "-" that also stands in for an empty TIPE column. All three mean the same thing
 * and none of them is a name, so they collapse to null and the map draws that outlet
 * as a mark with no label. An unnamed competitor is still a competitor.
 */
function cleanName(v) {
	const s = String(v ?? '').trim().replace(/\s+/g, ' ');
	if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
	return s;
}

function classify(props = {}) {
	// Deliberately reads ONLY the TIPE columns, never NAMA. Guessing from the name
	// once counted a TransJakarta stop as a minimarket purely because its name
	// contained "MART" — and a phantom competitor drags down the score of a cell
	// that is in fact empty. Non-business layers (stops) carry no TIPE column at
	// all, so this rule filters them out at the same time.
	for (const src of [props.TIPE_3, props.TIPE_2, props.TIPE_1]) {
		const s = String(src ?? '').trim();
		if (!s || s === '-') continue;
		for (const r of RULES) if (r.re.test(s)) return r.cat;
	}
	return null;
}

/** The naming pattern of the MAPID catalogue's official publications. */
const CANONICAL = /\bDI\s+(CITIES|KABUPATEN)\b.*\bTAHUN\s+\d{4}/i;

/** A dataset name with the import trace stripped, so a copy inside the project can
    be recognised as the same catalogue dataset and not pulled in twice. */
function canonicalName(name) {
	return String(name ?? '')
		.replace(/\s+IMPORTED AT.*$/i, '')
		.trim()
		.toUpperCase();
}

/**
 * Rewrites `docs/mapid-layers.md` from the `mapid-poi.json` already on disk.
 *
 * Everything the report needs is stored in that file's `meta`, so the document can be
 * regenerated without touching the network. That matters because the report is the
 * only generated Markdown in the repository: editing it by hand is silently undone by
 * the next real run, and a full run costs 55 catalogue fetches. This is the way to
 * reword the report — change the wording in `report()`, then run this.
 */
async function reportOnly() {
	const src = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	const { readFileSync } = await import('node:fs');
	const data = JSON.parse(readFileSync(src, 'utf8'));
	const m = data.meta;
	// `coverage` is stored as arrays; report() expects something iterable per category,
	// which an array already is.
	const md = report(m.layers, m.missing ?? [], m.coverage, m);
	writeFileSync(resolve(ROOT, 'docs/mapid-layers.md'), md);
	console.log(`Rebuilt docs/mapid-layers.md from ${src}`);
	console.log(`${m.layers.length} layers · ${m.total} points · no network used`);
}

async function main() {
	if (process.argv.includes('--report-only')) return reportOnly();

	const key = mapidKey();
	console.log(`Project ${projectId()} (used as the read ticket)\n`);

	// ── 1. Find the datasets we need in the premium catalogue ──────────────
	console.log('[1/3] Searching the premium catalogue for datasets…');
	const wanted = [];
	const missing = [];

	for (const { term, covers, force } of MANIFEST) {
		for (const city of CITIES) {
			const hits = await searchPremium(`${term} ${city}`);
			// AND-per-word matching makes this narrow query almost always exact, but it
			// is verified anyway: the name must start with the term AND contain the
			// city, so "MAKANAN DAN MINUMAN" does not swallow another dataset that
			// happens to contain the word "MAKANAN".
			const matched = hits.filter((l) => matchesDataset(l.name, term, city));
			// Sometimes more than one matches — Jakarta Selatan has both "APOTEK DI CITIES
			// ADMINISTRASI …" and "Apotek - Jakarta Selatan". Taking the first would hand
			// the choice to search ranking, which can shift at any time and swap a
			// complete dataset for a smaller one without anyone noticing. The catalogue's
			// official publications are always named to the pattern
			// "<TERM> DI CITIES/KABUPATEN <AREA> TAHUN <YEAR>", so those come first.
			const hit = matched.find((l) => CANONICAL.test(l.name ?? '')) ?? matched[0];
			if (hit) {
				wanted.push({
					id: hit._id,
					name: hit.name,
					term,
					city,
					covers,
					force: force ?? null,
					origin: 'catalogue'
				});
			} else {
				missing.push({ term, city });
			}
		}
		const got = wanted.filter((w) => w.term === term).length;
		console.log(`      ${term.padEnd(21)} ${got}/${CITIES.length} cities`);
	}

	// ── 2. Add layers that live in the project and are not catalogue copies ─
	// This is the way in for the competition's mission datasets: they arrive as a
	// separate shared project, never as a catalogue entry.
	console.log('\n[2/3] Reading the layer list in the project…');
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
			city: null,
			covers: [],
			force: null,
			origin: 'project'
		});
	}
	console.log(
		`      ${projectLayers.length} layers · ${skipped} catalogue copies skipped · ` +
			`${projectLayers.length - skipped} project-specific`
	);

	// ── 3. Fetch the contents ──────────────────────────────────────────────
	console.log(`\n[3/3] Fetching the contents of ${wanted.length} layers…`);
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
				city: f.properties?.KABKOT ?? null,
				// The outlet's own name, kept so the map can label a competitor the way
				// it labels a station. "3 coffee shops nearby" and "Kopi Kenangan,
				// Fore, Janji Jiwa" are different facts, and the second is the one
				// somebody deciding where to open actually argues with.
				//
				// Kept only for DISPLAY. `classify` above still refuses to look at it,
				// for the reason written there: a name that happens to contain "MART"
				// once invented a competitor out of a bus stop. Reading it here cannot
				// bring that back, because the category has already been decided by the
				// TIPE columns before this line runs.
				name: cleanName(f.properties?.NAMA)
			});
			kept++;
		}

		// Coverage from the manifest: dataset read successfully ⇒ its city is covered
		// for the categories promised, however many points survive.
		for (const cat of w.covers) coverage[cat]?.add(normCity(w.city));

		// Project-specific layers promise nothing, so their coverage can only be read
		// from their contents — back to inference, but confined to here and good
		// enough: nothing the manifest promised is affected.
		if (w.origin === 'project') {
			for (const f of features) {
				const cat = classify(f.properties);
				const kab = f.properties?.KABKOT;
				if (cat && kab) coverage[cat]?.add(normCity(kab));
			}
		}

		perLayer.push({
			id: w.id,
			name: w.name,
			origin: w.origin,
			term: w.term,
			city: w.city,
			covers: w.covers,
			force: w.force,
			features: features.length,
			kept
		});
		console.log(
			`  [${String(i + 1).padStart(2)}/${wanted.length}] ${String(features.length).padStart(5)} features → ` +
				`${String(kept).padStart(5)} kept · ${w.name.slice(0, 58)}`
		);
	}

	// Dedup: one outlet can appear in two datasets (e.g. COFFEE SHOP and MAKANAN DAN
	// MINUMAN for the same city). Without this, competitors get double-counted and a
	// busy cell looks twice as busy as it is.
	//
	// The key is the outlet, not the record, so it deliberately ignores the name: two
	// datasets spelling the same shop differently are still one shop, and keying on
	// the name would let it through twice. But when the copy already kept has no name
	// and the duplicate does, the name is taken — the same outlet, described better by
	// the second dataset, and dropping that would leave a mark on the map with no
	// label for no reason other than the order the layers happened to be read in.
	const byKey = new Map();
	for (const p of points) {
		const k = `${p.cat}|${p.lat}|${p.lon}`;
		const kept = byKey.get(k);
		if (!kept) byKey.set(k, p);
		else if (!kept.name && p.name) kept.name = p.name;
	}
	const unique = [...byKey.values()];

	const byCat = unique.reduce((a, p) => ((a[p.cat] = (a[p.cat] ?? 0) + 1), a), {});
	const byCity = unique.reduce((a, p) => ((a[p.city ?? '?'] = (a[p.city ?? '?'] ?? 0) + 1), a), {});

	const out = {
		meta: {
			source: 'MAPID premium data (Data Premium) via geoserver.mapid.io',
			project_id: projectId(),
			read: 'Straight from the premium catalogue — a catalogue layer_id + our own project_id. No manual import step.',
			layers: perLayer,
			missing,
			total: unique.length,
			duplicatesDropped: points.length - unique.length,
			byCategory: byCat,
			byCity: byCity,
			coverage: Object.fromEntries(CATEGORIES.map((c) => [c, [...coverage[c]].sort()])),
			coverageRule:
				'Written from the datasets that were read successfully, not inferred from the points that survived classification. A city not listed means NOT CHECKED — not zero competitors.',
			regenerate: 'node scripts/fetch-mapid.mjs'
		},
		points: unique
	};

	const dest = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));

	writeFileSync(resolve(ROOT, 'docs/mapid-layers.md'), report(perLayer, missing, coverage, out.meta));

	console.log(`\n${unique.length} unique points (${points.length - unique.length} duplicates dropped)`);
	console.log('by category:', byCat);
	console.log('by city    :', byCity);
	console.log('coverage   :');
	for (const c of CATEGORIES) {
		const k = [...coverage[c]].sort();
		console.log(`  ${c.padEnd(11)} ${k.length ? `${k.length}/5 · ${k.join(', ')}` : '(no dataset)'}`);
	}
	if (unmatched.size) {
		const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
		console.log('unmapped types:', Object.fromEntries(top));
	}
	console.log(`\n→ ${dest}`);
	console.log('→ docs/mapid-layers.md');
}

/** Markdown report: what was read, and what needs syncing by hand. */
function report(perLayer, missing, coverage, meta) {
	const catalogue = perLayer.filter((l) => l.origin === 'catalogue');
	const project = perLayer.filter((l) => l.origin === 'project');
	const fmt = (n) => n.toLocaleString('en-US');

	const L = [
		'<!-- Generated by `node scripts/fetch-mapid.mjs` — do not edit by hand. -->',
		'',
		'# The MAPID datasets SpotOn reads',
		'',
		`${catalogue.length} premium catalogue datasets + ${project.length} project-specific layers · ` +
			`${fmt(meta.total)} unique points after ${fmt(meta.duplicatesDropped)} duplicates were dropped.`,
		'',
		'All of them are read **straight from the catalogue**, with no import step. What is sent',
		'to `get_layer` is a catalogue `layer_id` together with our own project\'s `project_id` —',
		'the server checks ownership of the project, not the layer\'s membership of it.',
		'',
		'## Does anything need syncing by hand?',
		'',
		'**Not in order to run SpotOn.** The script finds and reads every dataset below by',
		'itself on each run; the `mapid-poi.json` it produces is already complete.',
		'',
		'Importing through the GEO MAPID interface is only needed if these datasets should also',
		'be visible inside the project — to be arranged, styled, or used by someone else on the',
		'team. The full list with links is below; press **Import** on each.',
		'',
		'## Premium catalogue',
		''
	];

	const byTerm = new Map();
	for (const l of catalogue) {
		if (!byTerm.has(l.term)) byTerm.set(l.term, []);
		byTerm.get(l.term).push(l);
	}
	for (const [term, list] of byTerm) {
		L.push(`### ${term} — covers \`${list[0].covers.join('`, `')}\``, '');
		L.push('| City | Dataset | Features | Kept | Open |');
		L.push('|---|---|--:|--:|---|');
		for (const l of list) {
			L.push(
				`| ${l.city} | \`${l.name}\` | ${fmt(l.features)} | ${fmt(l.kept)} | ` +
					`[layer](https://geo.mapid.io/layer/${l.id}) |`
			);
		}
		L.push('');
	}

	if (project.length) {
		L.push('## Project-specific', '');
		L.push('Present in the GEO MAPID project but not a copy of any catalogue dataset above.');
		L.push('This is the way in for the competition\'s mission datasets, which arrive as a');
		L.push('separate shared project.');
		L.push('');
		L.push('| Dataset | Features | Kept |');
		L.push('|---|--:|--:|');
		for (const l of project) L.push(`| \`${l.name}\` | ${fmt(l.features)} | ${fmt(l.kept)} |`);
		L.push('');
	}

	L.push('## Resulting coverage', '');
	L.push('| Category | Cities covered | Which |');
	L.push('|---|--:|---|');
	for (const [cat, set] of Object.entries(coverage)) {
		const k = [...set].sort();
		L.push(
			`| ${cat} | ${k.length}/5 | ${k.length ? k.join(', ') : '**no dataset in the catalogue**'} |`
		);
	}
	L.push('');
	L.push('Coverage is written from the datasets that were read successfully, **not** inferred');
	L.push('from the points that survived classification. A dataset that exists but happens to be');
	L.push('empty still counts as "checked"; a city with no dataset at all remains **unchecked**');
	L.push('and must not be given a competitor count of zero.');
	L.push('');

	if (missing.length) {
		const byT = new Map();
		for (const m of missing) {
			if (!byT.has(m.term)) byT.set(m.term, []);
			byT.get(m.term).push(m.city);
		}
		L.push('## Searched for, not found', '');
		for (const [term, cities] of byT) {
			L.push(`- **${term}** — ${cities.length === 5 ? 'all five cities' : cities.join(', ')}`);
		}
		L.push('');
		L.push('Searched for again on every run. They are left in the manifest so that their');
		L.push('absence keeps being tested rather than slowly turning into an assumption — and so');
		L.push('that they are picked up automatically if MAPID ever publishes them.');
		L.push('');
	}

	return L.join('\n');
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
