/**
 * Searches the MAPID catalogue for datasets that still need importing.
 *
 *   node scripts/search-mapid.mjs              # SpotOn's five categories
 *   node scripts/search-mapid.mjs LAUNDRY ATM  # free-form terms
 *
 * The output is a Markdown checklist: dataset names exactly as they appear in the
 * catalogue, each with a direct link to its page. Importing still happens through
 * the GEO MAPID interface — what this script removes is the guesswork about names.
 *
 * THE ENDPOINT USED, AND WHY THE EARLIER ONES FAILED
 *
 *   GET geoserver.mapid.io/layers_new/search_layers_public/<term>?skip=<n>&api_key=
 *
 * We once concluded the catalogue could not be searched from a script because its
 * listing endpoint always returned the same 20 rows no matter which parameters
 * were sent. What was actually happening: the parameter is not named `search`,
 * `q`, or `keyword` — it is `search_params`, and pages are advanced with `skip`,
 * not `page`. Unknown parameters are silently ignored, so every guess looked like
 * "search is unsupported" when what came back was simply the first unfiltered
 * page. The correct names were read out of the GEO MAPID interface's own source.
 *
 * The search returns ALL public layers, not just the premium catalogue — including
 * other people's coursework projects whose names happen to look similar. The
 * results are therefore filtered down to layers owned by the MAPID Database
 * account; without that filter this list would carry data of unclear provenance.
 *
 * AN IMPORTANT LIMIT: THIS INDEX IS NOT THE PREMIUM CATALOGUE
 *
 * `search_layers_public` only indexes published layers. The premium catalogue is
 * not in it. RESTORAN and MINIMARKET turn up purely because MAPID Database
 * happens to publish both publicly; the COFFEE SHOP hit is in fact another user's
 * "IMPORT" copy, not the original.
 *
 * So a category that comes up empty here must NOT be read as "not in the
 * catalogue" — the correct reading is "not visible along this path, check by hand
 * in the interface". The principle is the same one the whole project holds to:
 * absence of data is not evidence of absence. The tooling has to obey that rule
 * too, not just the final map.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEOSERVER = 'https://geoserver.mapid.io';
const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; contact via repo)';

/** The official owner of the premium catalogue. */
const PUBLISHER = /mapid\.database|MAPID Database/i;

/** The five DKI administrative cities. The catalogue ships one dataset per city. */
const CITIES = [
	'JAKARTA PUSAT',
	'JAKARTA BARAT',
	'JAKARTA SELATAN',
	'JAKARTA TIMUR',
	'JAKARTA UTARA'
];

/**
 * Two pages per search is enough, because each query is already narrowed to a
 * single city; the exact match always lands in the top ranks.
 */
const MAX_PAGES = 2;

/**
 * Search terms per SpotOn category, along with the keyword that MUST appear in the
 * dataset name.
 *
 * The `must` filter is not decoration. The search matches words loosely and ranks
 * them rather than filtering: the query "APOTEK JAKARTA BARAT" will happily return
 * "BATAS ADMINISTRASI KOTA ADMINISTRASI JAKARTA BARAT" because three of its four
 * words match. Without `must`, the import list would fill up with datasets that
 * are nothing like what was searched for.
 */
const TERMS = {
	kopi: { must: /COFFEE|KOPI/i, base: ['COFFEE SHOP'] },
	warung: { must: /RESTORAN|MAKANAN DAN MINUMAN/i, base: ['RESTORAN', 'MAKANAN DAN MINUMAN'] },
	minimarket: { must: /MINIMARKET|ALFAMART|INDOMARET|MART/i, base: ['MINIMARKET'] },
	apotek: { must: /APOTEK|APOTIK/i, base: ['APOTEK'] },
	laundry: { must: /LAUNDRY|BINATU/i, base: ['LAUNDRY'] }
};

function apiKey() {
	const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	const key = (raw.match(/^MAPID_API_KEY=(.*)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
	if (!key) throw new Error('MAPID_API_KEY is not set in .env');
	return key;
}

async function get(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': UA } });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
}

/** Every result for one term, page by page until exhausted. */
async function searchAll(term, key) {
	const out = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const rows = await get(
			`${GEOSERVER}/layers_new/search_layers_public/${encodeURIComponent(term)}?skip=${page * 20}&api_key=${key}`,
			`search "${term}"`
		);
		if (!Array.isArray(rows) || rows.length === 0) break;
		out.push(...rows);
		if (rows.length < 20) break;
	}
	return out;
}

async function main() {
	const key = apiKey();
	const argv = process.argv.slice(2);
	const groups = argv.length
		? { '(istilah bebas)': { must: new RegExp(argv.join('|'), 'i'), base: argv } }
		: TERMS;

	const seen = new Set();
	const found = {};
	let scanned = 0;

	for (const [cat, { must, base }] of Object.entries(groups)) {
		found[cat] = [];
		for (const b of base) {
			for (const city of CITIES) {
				const term = `${b} ${city}`;
				const rows = await searchAll(term, key);
				scanned += rows.length;
				let kept = 0;
				for (const r of rows) {
					const name = r.name ?? '';
					const owner = `${r.user?.name ?? ''} ${r.user?.full_name ?? ''}`;
					if (!PUBLISHER.test(owner)) continue;
					if (!must.test(name)) continue;
					// The name has to mention the city being searched for — a loose
					// search loves returning neighbouring cities in the lower ranks.
					if (!new RegExp(city, 'i').test(name)) continue;
					if (seen.has(r._id)) continue;
					seen.add(r._id);
					found[cat].push({ id: r._id, name });
					kept++;
				}
				console.error(
					`  ${term.padEnd(34)} ${String(rows.length).padStart(3)} results → ${kept} new`
				);
			}
		}
		found[cat].sort((a, b) => a.name.localeCompare(b.name));
	}

	console.error(
		`\n${scanned} rows scanned · ${seen.size} MAPID Database datasets in DKI Jakarta\n`
	);

	// The checklist itself stays in Indonesian: it is a document that lands in
	// docs/, read alongside the rest of the Indonesian project documentation.
	const lines = [
		'<!-- Dihasilkan `node scripts/search-mapid.mjs` — jangan disunting tangan. -->',
		'',
		'Buka tautannya, tekan **Impor**, lalu jalankan `node scripts/fetch-mapid.mjs && node scripts/join-mapid.mjs`.',
		'',
		'Daftar ini berasal dari indeks layer **publik**, yang tidak memuat katalog premium.',
		'Kategori kosong berarti _tidak terlihat dari jalur ini_ — bukan tidak ada. Periksa manual di GEO MAPID.',
		''
	];
	for (const [cat, list] of Object.entries(found)) {
		lines.push(`**${cat}** — ${list.length} dataset`);
		lines.push('');
		if (!list.length) {
			lines.push('- _tidak terlihat lewat pencarian publik; perlu dicek manual di antarmuka_');
		} else {
			for (const l of list) {
				lines.push(`- [ ] \`${l.name}\` — [buka](https://geo.mapid.io/layer/${l.id})`);
			}
		}
		lines.push('');
	}
	const md = lines.join('\n');

	writeFileSync(resolve(ROOT, 'docs/mapid-import-checklist.md'), md);
	console.log(md);
	console.error('→ docs/mapid-import-checklist.md');
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
