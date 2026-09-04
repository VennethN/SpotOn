/**
 * Fetches MAPID premium POIs from a GEO MAPID project and stores them as a single
 * point file, ready to be joined onto the hexagon grid.
 *
 *   node scripts/fetch-mapid.mjs
 *
 * Output: `src/lib/data/mapid-poi.json`
 *
 * WHY VIA A PROJECT, NOT THE CATALOGUE
 *
 * The premium data catalogue can be read without logging in, but its listing
 * endpoint ignores `page`, `limit`, and every form of search parameter — it always
 * returns the same 20 entries. Finding the Jakarta datasets among ~20,000 entries
 * is therefore impossible from a script.
 *
 * What does work: reading any layer once its id is known. So the work splits like
 * this — the datasets are searched for and Imported once through the GEO MAPID
 * interface (its search box does work), and this script discovers every layer in
 * that project on its own, contents included. No id has to be copied by hand.
 *
 * The `MAPID_API_KEY` key is read-only. Importing is a write operation on a MAPID
 * account and needs a logged-in user session — which is why the import step stays
 * in the interface rather than living here.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEOSERVER = 'https://geoserver.mapid.io';

/**
 * `get_layer` truncates at 200 features without saying so — there is no
 * "there is more" marker anywhere in the response. The RESTORAN Jakarta Pusat
 * layer actually holds 1,160 points, so without an explicit `limit` 83% of the
 * data silently disappears and the competitor counts come out too low. This value
 * sits far above the largest layer there is; raise it if one ever reaches it.
 */
const FEATURE_LIMIT = 100000;

/** The GEO MAPID project the datasets were imported into. From the editor URL: /editor/<id>. */
const PROJECT_ID = process.env.MAPID_PROJECT_ID || '6a7c1672fb8d434002151fa7';

function apiKey() {
	const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	const m = raw.match(/^MAPID_API_KEY=(.*)$/m);
	const key = (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
	if (!key) throw new Error('MAPID_API_KEY is not set in .env');
	return key;
}

/**
 * The MAPID taxonomy (TIPE_1 → TIPE_2 → TIPE_3) mapped onto SpotOn's five
 * categories. Matched from most specific to most general: an outlet can be typed
 * "MAKANAN DAN MINUMAN / MINUMAN / COFFEESHOP", and what decides its category is
 * TIPE_3, not TIPE_1.
 */
const RULES = [
	{ cat: 'kopi', re: /COFFEE|KOPI|KEDAI KOPI|CAFE|KAFE/i },
	{ cat: 'apotek', re: /APOTEK|APOTIK|FARMASI|PHARMAC/i },
	{ cat: 'laundry', re: /LAUNDRY|BINATU|CUCI/i },
	{ cat: 'minimarket', re: /MINIMARKET|MART|SWALAYAN|SUPERMARKET|KELONTONG|INDOMARET|ALFAMART/i },
	{ cat: 'warung', re: /RESTORAN|RESTAURANT|WARUNG|RUMAH MAKAN|MAKANAN|FAST ?FOOD|KULINER/i }
];

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

async function get(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
		}
	}
}

async function main() {
	const key = apiKey();
	console.log(`Project ${PROJECT_ID}\n`);

	console.log('[1/2] Reading the layer list…');
	const listed = await get(
		`${GEOSERVER}/layers_new/get_layer_list?api_key=${key}&project_id=${PROJECT_ID}`,
		'get_layer_list'
	);
	const layers = Object.values(listed).filter((l) => l && typeof l === 'object' && l._id);
	console.log(`      ${layers.length} layers\n`);

	console.log('[2/2] Fetching the contents of each layer…');
	const points = [];
	const perLayer = [];
	const unmatched = new Map();

	for (const [i, l] of layers.entries()) {
		const data = await get(
			`${GEOSERVER}/layers_new/get_layer?api_key=${key}&layer_id=${l._id}&project_id=${PROJECT_ID}&limit=${FEATURE_LIMIT}`,
			l.name
		);
		const feats = data.features ?? [];
		let kept = 0;

		for (const f of feats) {
			const c = f.geometry?.coordinates;
			if (!Array.isArray(c) || c.length < 2) continue;
			const cat = classify(f.properties);
			if (!cat) {
				const t = f.properties?.TIPE_3 || f.properties?.TIPE_2 || f.properties?.TIPE_1 || '?';
				unmatched.set(t, (unmatched.get(t) ?? 0) + 1);
				continue;
			}
			points.push({
				lat: Math.round(c[1] * 1e5) / 1e5,
				lon: Math.round(c[0] * 1e5) / 1e5,
				cat,
				// from MAPID's KABKOT column (kabupaten/kota = regency/city)
				city: f.properties?.KABKOT ?? null
			});
			kept++;
		}

		perLayer.push({ name: l.name, features: feats.length, kept });
		console.log(
			`  [${String(i + 1).padStart(2)}/${layers.length}] ${String(feats.length).padStart(5)} features → ${String(kept).padStart(5)} kept · ${l.name.slice(0, 52)}`
		);
	}

	// Dedup: one outlet can show up in two layers (e.g. COFFEE SHOP and MAKANAN
	// DAN MINUMAN for the same city). Without this, competitors get double-counted.
	const seen = new Set();
	const unique = points.filter((p) => {
		const k = `${p.cat}|${p.lat}|${p.lon}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});

	const byCat = unique.reduce((a, p) => ((a[p.cat] = (a[p.cat] ?? 0) + 1), a), {});
	const byCity = unique.reduce((a, p) => ((a[p.city ?? '?'] = (a[p.city ?? '?'] ?? 0) + 1), a), {});

	const out = {
		meta: {
			source: 'MAPID premium data (Data Premium) via geoserver.mapid.io',
			project_id: PROJECT_ID,
			layers: perLayer,
			total: unique.length,
			duplicatesDropped: points.length - unique.length,
			byCategory: byCat,
			byCity,
			note: 'Coverage follows whichever datasets have been imported into the project. A city that has not been imported does NOT mean it has no competitors — the join onto the grid must treat it as "not yet covered", not as zero.',
			regenerate: 'node scripts/fetch-mapid.mjs'
		},
		points: unique
	};

	const dest = resolve(ROOT, 'src/lib/data/mapid-poi.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));

	console.log(`\n${unique.length} unique points (${points.length - unique.length} duplicates dropped)`);
	console.log('by category:', byCat);
	console.log('by city    :', byCity);
	if (unmatched.size) {
		const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
		console.log('unmapped types:', Object.fromEntries(top));
	}
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
