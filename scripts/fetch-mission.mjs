/**
 * Fetches the competition's mission datasets — Struk Go, Menu Go, Properti Go —
 * and normalises them into the columns SpotOn's scoring engine already expects.
 *
 *   node scripts/fetch-mission.mjs                       # probe: is anything reachable yet?
 *   MAPID_STRUK_LAYER=<id> node scripts/fetch-mission.mjs
 *   node scripts/fetch-mission.mjs --selftest            # exercise the normaliser
 *
 * Output:
 *   src/lib/data/mission-poi.json  — normalised points + what was actually read
 *
 * WHAT A LAYER ID IS ENOUGH FOR, AND WHAT IT IS NOT
 *
 * The mission datasets are not in the premium catalogue and are not in the public
 * layer index — that has been checked along every route the API key can reach, and
 * `probe()` below re-checks it on every run rather than letting the absence quietly
 * become an assumption.
 *
 * What the probing did establish is that the limit is DISCOVERY, not authorisation:
 *
 *   get_layer(foreign layer_id, OUR project_id)  → 200, full contents
 *   get_layer_list(project we do not own)        → 403 {"message":"Not owner"}
 *
 * The read ticket described in `lib/mapid.mjs` is not a premium-catalogue trick at
 * all: ANY layer can be read with a project we own as the `project_id`, whoever owns
 * the layer. So one layer id is all that is needed to read a mission dataset — no
 * import, no ownership, no membership of our project.
 *
 * What cannot be done is ENUMERATING someone else's project. That is why this script
 * takes layer ids rather than a project id, and why the procedure recorded in
 * docs/04-data-mapid.md — "put the shared project's id in MAPID_PROJECT_ID" — could
 * not have worked: that call is the one the server answers with "Not owner", and it
 * would take the premium reads down with it, because those need the `project_id` to
 * be ours.
 *
 * COLUMN NAMES ARE MATCHED LOOSELY AND REPORTED, NEVER GUESSED SILENTLY
 *
 * The schemas below are transcribed from the competition rules (docs/00, §A.4), but
 * the real column keys are whatever MAPID APPS' form fields ended up being called,
 * and a form field can be renamed without anyone telling us. So every column is
 * resolved by normalised match against a list of aliases, and the resolution is
 * written into the output — a column that did not resolve is named in the report
 * instead of quietly reading as zero. A cashless share of 0 because the payment
 * column was not found looks exactly like a catchment that pays in cash, and only
 * one of those is true.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapidKey, projectId, readLayer, searchPremium, listProjectLayers } from './lib/mapid.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEOSERVER = 'https://geoserver.mapid.io';

/* ────────────────────────────────────────────────────────────────────────────
   The three schemas, from docs/00-ketentuan-kompetisi.md §A.4
   ──────────────────────────────────────────────────────────────────────────── */

/** Normalises a column name so "Waktu Transaksi", "waktu_transaksi" and
    "WAKTU TRANSAKSI" all collapse to the same key. */
const normKey = (s) =>
	String(s ?? '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');

/**
 * Each mission dataset: which columns we need, and the aliases each may appear
 * under. First alias that resolves wins; the winner is recorded in the report.
 */
const SCHEMAS = {
	struk: {
		label: 'Struk Go',
		envs: ['MAPID_STRUK_LAYER', 'MAPID_STRUK_GO_LAYER'],
		namePattern: /STRUK\s*GO/i,
		columns: {
			merchant: ['Nama Tempat/Merchant', 'Nama Tempat', 'Merchant', 'Nama Merchant'],
			kategori: ['Kategori Tempat', 'Kategori'],
			tanggal: ['Tanggal Transaksi', 'Tanggal'],
			waktu: ['Waktu Transaksi', 'Waktu', 'Jam Transaksi'],
			bayar: ['Metode Pembayaran', 'Pembayaran', 'Metode Bayar']
		}
	},
	menu: {
		label: 'Menu Go',
		envs: ['MAPID_MENU_LAYER', 'MAPID_MENU_GO_LAYER'],
		namePattern: /MENU\s*GO/i,
		columns: {
			nama: ['Nama Tempat/Makan', 'Nama Tempat Makan', 'Nama Tempat'],
			jenis: ['Jenis Tempat Makan', 'Jenis Tempat', 'Jenis'],
			tanggal: ['Tanggal'],
			waktu: ['Waktu', 'Jam'],
			menuUtama: ['Apa Menu Utama/Andalan Yang Dijual?', 'Menu Utama', 'Menu Andalan'],
			harga: [
				'Berapa Harga Rata-rata Menu Tersebut (Per porsi)?',
				'Harga Rata-rata',
				'Harga Rata Rata Menu',
				'Harga'
			],
			kondisi: [
				'Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?',
				'Kondisi Pembeli',
				'Kondisi'
			],
			mobil: ['Apakah Berjualan Dengan Berkeliling (Mobilitas)?', 'Mobilitas', 'Berkeliling']
		}
	},
	prop: {
		label: 'Properti Go',
		envs: ['MAPID_PROP_LAYER', 'MAPID_PROPERTI_LAYER', 'MAPID_PROPERTI_GO_LAYER'],
		namePattern: /PROPERTI\s*GO/i,
		columns: {
			kategori: ['Kategori Properti', 'Kategori'],
			jenis: ['Jenis Properti', 'Jenis'],
			tanggal: ['Tanggal'],
			alamat: ['Alamat']
		}
	}
};

/** Latitude/longitude columns, used only when the feature carries no geometry. */
const LAT_ALIASES = ['Latitude', 'lat', 'Lintang'];
const LON_ALIASES = ['Longitude', 'lon', 'lng', 'Bujur'];

/**
 * The payment methods that are NOT cash. From the Struk Go dropdown: Tunai, QRIS,
 * Debit, Kartu Kredit, E-wallet. Anything unrecognised counts towards neither share
 * — an unknown method is not evidence of cash.
 */
const CASHLESS = /QRIS|DEBIT|KREDIT|CREDIT|E-?WALLET|EWALLET|GOPAY|OVO|DANA|SHOPEEPAY/i;
const CASH = /TUNAI|CASH/i;

/** Menu Go's `Kondisi Pembeli` dropdown: Sepi / Sedang / Ramai. */
const BUSY = /RAMAI/i;

/**
 * Recognises a dataset name as one of the mission sets.
 *
 * The word boundary and the mandatory `GO` are both load-bearing. A first attempt
 * matched a bare `STRUK`, and the catalogue answered with nineteen KONSTRUKSI
 * datasets — "STRUK" sits inside "KONSTRUKSI" — which the probe then reported as
 * mission data found. `HARGA PROPERTI DI KABUPATEN GOWA` is the same trap from the
 * other side: PROPERTI and GO are both there, just not next to each other.
 */
const MISSION_NAME = /\b(STRUK|MENU|PROPERTI)\s*GO\b|\bMAPID\s*CATALYST\b/i;

/* ────────────────────────────────────────────────────────────────────────────
   Column resolution
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Resolves each wanted column against the keys actually present on the features.
 * Returns { resolved: {want: actualKey}, missing: [want] } — the missing list is
 * what stops a silent zero from passing as a measurement.
 */
function resolveColumns(features, columns) {
	const present = new Map();
	for (const f of features.slice(0, 50)) {
		for (const k of Object.keys(f?.properties ?? {})) present.set(normKey(k), k);
	}
	const resolved = {};
	const missing = [];
	for (const [want, aliases] of Object.entries(columns)) {
		const hit = aliases.map((a) => present.get(normKey(a))).find(Boolean);
		if (hit) resolved[want] = hit;
		else missing.push(want);
	}
	return { resolved, missing, presentKeys: [...present.values()] };
}

/** Reads a resolved column off one feature. */
const col = (props, resolved, want) => (want in resolved ? props?.[resolved[want]] : undefined);

/**
 * Parses an hour out of whatever the `Waktu` column holds. The schema calls it Text,
 * so it may be "19:45", "19.45", "7 PM" or a full timestamp. Returns null rather
 * than 0 when nothing can be read — hour 0 is a real hour, and a parse failure
 * landing on midnight would invent a nightlife peak that is not there.
 */
export function parseHour(v) {
	const s = String(v ?? '').trim();
	if (!s) return null;
	const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]/);
	if (ampm) {
		let h = Number(ampm[1]) % 12;
		if (/[Pp]/.test(ampm[3])) h += 12;
		return h;
	}
	const m = s.match(/(?:^|[T\s])(\d{1,2})[:.](\d{2})/);
	if (!m) {
		const bare = s.match(/^(\d{1,2})$/);
		if (bare && Number(bare[1]) <= 23) return Number(bare[1]);
		return null;
	}
	const h = Number(m[1]);
	return h >= 0 && h <= 23 ? h : null;
}

/** Parses a rupiah figure: "Rp 25.000", "25000", "25.000,-" → 25000. */
export function parsePrice(v) {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	const s = String(v ?? '').replace(/[^\d]/g, '');
	if (!s) return null;
	const n = Number(s);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** [lon, lat] from the geometry, falling back to the Latitude/Longitude columns. */
function coordsOf(f, presentKeys) {
	const c = f?.geometry?.coordinates;
	if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
		return [c[0], c[1]];
	}
	const find = (aliases) => {
		const key = presentKeys.find((k) => aliases.some((a) => normKey(a) === normKey(k)));
		return key ? Number(f?.properties?.[key]) : NaN;
	};
	const lat = find(LAT_ALIASES);
	const lon = find(LON_ALIASES);
	return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Normalisation — exported so --selftest can exercise it without the network
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Turns one mission layer's raw features into SpotOn points.
 *
 * The output is deliberately flat and per-point: aggregation into hexagons is the
 * join step's business, and keeping the raw row here means a later change to the
 * scoring engine does not require re-fetching.
 */
export function normalise(kind, features) {
	const schema = SCHEMAS[kind];
	if (!schema) throw new Error(`unknown mission kind: ${kind}`);
	const { resolved, missing, presentKeys } = resolveColumns(features, schema.columns);

	const points = [];
	let noGeom = 0;
	for (const f of features) {
		const xy = coordsOf(f, presentKeys);
		if (!xy) {
			noGeom++;
			continue;
		}
		const p = f?.properties ?? {};
		const pt = {
			kind,
			lat: Math.round(xy[1] * 1e5) / 1e5,
			lon: Math.round(xy[0] * 1e5) / 1e5
		};

		if (kind === 'struk') {
			const bayar = String(col(p, resolved, 'bayar') ?? '');
			pt.merchant = col(p, resolved, 'merchant') ?? null;
			pt.kategori = col(p, resolved, 'kategori') ?? null;
			pt.hour = parseHour(col(p, resolved, 'waktu'));
			// Three states, not two: cashless, cash, and unreadable. Folding the third
			// into either one would move the cashless share by an amount nobody could
			// account for.
			pt.cashless = CASHLESS.test(bayar) ? true : CASH.test(bayar) ? false : null;
			pt.bayar = bayar || null;
		} else if (kind === 'menu') {
			pt.nama = col(p, resolved, 'nama') ?? null;
			pt.jenis = col(p, resolved, 'jenis') ?? null;
			pt.hour = parseHour(col(p, resolved, 'waktu'));
			pt.harga = parsePrice(col(p, resolved, 'harga'));
			const kondisi = String(col(p, resolved, 'kondisi') ?? '');
			pt.busy = kondisi ? BUSY.test(kondisi) : null;
			pt.kondisi = kondisi || null;
			pt.keliling = /^\s*YA/i.test(String(col(p, resolved, 'mobil') ?? '')) || null;
		} else {
			pt.kategori = col(p, resolved, 'kategori') ?? null;
			const jenis = String(col(p, resolved, 'jenis') ?? '');
			// The availability gate asks "is there space to RENT here", so a listing for
			// sale is not the same signal. Recorded, but distinguished.
			pt.sewa = /SEWA/i.test(jenis) ? true : /JUAL/i.test(jenis) ? false : null;
			pt.jenis = jenis || null;
			pt.alamat = col(p, resolved, 'alamat') ?? null;
		}
		points.push(pt);
	}

	return { points, resolved, missing, noGeom, presentKeys };
}

/* ────────────────────────────────────────────────────────────────────────────
   Discovery
   ──────────────────────────────────────────────────────────────────────────── */

/** Layer ids supplied by environment variable. */
function idsFromEnv() {
	const out = {};
	for (const [kind, s] of Object.entries(SCHEMAS)) {
		for (const e of s.envs) {
			const v = (process.env[e] ?? '').trim();
			if (v) {
				out[kind] = { id: v, via: `env ${e}` };
				break;
			}
		}
	}
	return out;
}

/** Mission layers that happen to sit in our own project (i.e. someone imported them). */
async function idsFromProject(key) {
	const out = {};
	let layers = [];
	try {
		layers = await listProjectLayers(key);
	} catch {
		return out;
	}
	for (const [kind, s] of Object.entries(SCHEMAS)) {
		const hit = layers.find((l) => s.namePattern.test(l.name ?? ''));
		if (hit) out[kind] = { id: hit._id, via: `project layer "${hit.name}"` };
	}
	return out;
}

/**
 * Re-tests every route the API key can reach, so "not available yet" stays a
 * measurement rather than becoming folklore. Prints what it finds and returns the
 * routes that produced anything.
 */
async function probe(key) {
	console.log('Probing the routes a MAPID API key can reach…\n');
	const found = [];

	// 1. premium catalogue
	for (const term of ['STRUK GO', 'MENU GO', 'PROPERTI GO', 'MISSION', 'CATALYST']) {
		let hits = [];
		try {
			hits = await searchPremium(term);
		} catch {
			/* the catalogue being down is not evidence about the mission data */
		}
		const real = hits.filter((l) => MISSION_NAME.test(l.name ?? ''));
		console.log(`  catalogue  ${term.padEnd(12)} ${hits.length} results, ${real.length} named like a mission set`);
		for (const l of real) found.push({ route: 'catalogue', name: l.name, id: l._id });
	}

	// 2. the public layer index — the mission sets would show up here if published
	for (const term of ['STRUK GO', 'MENU GO', 'PROPERTI GO']) {
		let names = [];
		try {
			const res = await fetch(
				`${GEOSERVER}/layers_new/search_layers_public/${encodeURIComponent(term)}?skip=0`,
				{ headers: { 'user-agent': 'SpotOn/0.1' } }
			);
			const body = await res.json();
			names = Array.isArray(body) ? body : [];
		} catch {
			/* ignore */
		}
		const real = names.filter((l) => MISSION_NAME.test(l.name ?? ''));
		console.log(`  public     ${term.padEnd(12)} ${names.length} results, ${real.length} named like a mission set`);
		for (const l of real) found.push({ route: 'public', name: l.name, id: l._id });
	}

	// 3. our own project
	const inProject = await idsFromProject(key);
	const n = Object.keys(inProject).length;
	console.log(`  project    ${projectId()} → ${n} mission layer(s)`);
	for (const [kind, v] of Object.entries(inProject)) found.push({ route: 'project', name: v.via, id: v.id, kind });

	return found;
}

/* ────────────────────────────────────────────────────────────────────────────
   Self-test — runs the normaliser against the documented schema, no network
   ──────────────────────────────────────────────────────────────────────────── */

function selftest() {
	const mk = (props, lon, lat) => ({ geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
	let failures = 0;
	const check = (label, got, want) => {
		const ok = JSON.stringify(got) === JSON.stringify(want);
		if (!ok) failures++;
		console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
	};

	const struk = normalise('struk', [
		mk({ 'Nama Tempat/Merchant': 'Warung A', 'Kategori Tempat': 'Warung/kaki lima', 'Tanggal Transaksi': '2026-08-01', 'Waktu Transaksi': '19:45', 'Metode Pembayaran': 'QRIS' }, 106.8, -6.2),
		mk({ 'Nama Tempat/Merchant': 'Minimarket B', 'Kategori Tempat': 'Minimarket/supermarket', 'Tanggal Transaksi': '2026-08-01', 'Waktu Transaksi': '7 PM', 'Metode Pembayaran': 'Tunai' }, 106.81, -6.21),
		mk({ 'Nama Tempat/Merchant': 'Apotek C', 'Kategori Tempat': 'Apotek', 'Tanggal Transaksi': '2026-08-01', 'Waktu Transaksi': '', 'Metode Pembayaran': '' }, 106.82, -6.22)
	]);
	check('struk: all rows kept', struk.points.length, 3);
	check('struk: no missing columns', struk.missing, []);
	check('struk: hours parsed (24h, am/pm, blank)', struk.points.map((p) => p.hour), [19, 19, null]);
	check('struk: cashless tri-state', struk.points.map((p) => p.cashless), [true, false, null]);

	const menu = normalise('menu', [
		mk({ 'Nama Tempat/Makan': 'Bakso D', 'Jenis Tempat Makan': 'Kaki Lima/Gerobak', Tanggal: '2026-08-01', Waktu: '12.30', 'Apa Menu Utama/Andalan Yang Dijual?': 'Bakso urat', 'Berapa Harga Rata-rata Menu Tersebut (Per porsi)?': 'Rp 25.000', 'Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?': 'Ramai: antrean lebih dari 3 orang', 'Apakah Berjualan Dengan Berkeliling (Mobilitas)?': 'Tidak (Menetap)' }, 106.8, -6.2),
		mk({ 'Nama Tempat/Makan': 'Kafe E', 'Jenis Tempat Makan': 'Kafe', Tanggal: '2026-08-01', Waktu: '09:00', 'Apa Menu Utama/Andalan Yang Dijual?': 'Kopi susu', 'Berapa Harga Rata-rata Menu Tersebut (Per porsi)?': 35000, 'Bagaimana Kondisi Pembeli Saat Kunjungan Dilakukan?': 'Sepi: hanya ada penjual', 'Apakah Berjualan Dengan Berkeliling (Mobilitas)?': 'Ya (Berkeliling)' }, 106.81, -6.21)
	]);
	check('menu: no missing columns', menu.missing, []);
	check('menu: prices parsed', menu.points.map((p) => p.harga), [25000, 35000]);
	check('menu: busy read from Kondisi Pembeli', menu.points.map((p) => p.busy), [true, false]);

	const prop = normalise('prop', [
		mk({ 'Kategori Properti': 'Coffee Shop', 'Jenis Properti': 'Sewa', Alamat: 'Jl. X' }, 106.8, -6.2),
		mk({ 'Kategori Properti': 'Ruko', 'Jenis Properti': 'Jual', Alamat: 'Jl. Y' }, 106.81, -6.21)
	]);
	check('prop: rent vs sale distinguished', prop.points.map((p) => p.sewa), [true, false]);

	// The failure mode this whole design exists to prevent.
	const renamed = normalise('struk', [mk({ Merchant: 'Warung A', 'Cara Bayar': 'QRIS' }, 106.8, -6.2)]);
	check('renamed payment column is REPORTED missing, not read as cash',
		renamed.missing.includes('bayar') && renamed.points[0].cashless === null, true);

	// The name filter, and the two false positives the catalogue really serves up.
	check('mission names recognised', ['STRUK GO', 'Menu Go', 'PROPERTI GO DKI JAKARTA'].map((n) => MISSION_NAME.test(n)), [true, true, true]);
	check('KONSTRUKSI / HARGA PROPERTI ... GOWA not mistaken for mission data',
		['KONSTRUKSI DI KABUPATEN BOGOR TAHUN 2025', 'HARGA PROPERTI DI KABUPATEN GOWA TAHUN 2024'].map((n) => MISSION_NAME.test(n)),
		[false, false]);

	// Latitude/Longitude columns as the fallback when a row carries no geometry.
	const noGeom = normalise('prop', [{ properties: { 'Kategori Properti': 'Ruko', 'Jenis Properti': 'Sewa', Latitude: '-6.25', Longitude: '106.83' } }]);
	check('lat/lon columns used when geometry is absent', [noGeom.points.length, noGeom.points[0]?.lat], [1, -6.25]);

	console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
	return failures;
}

/* ────────────────────────────────────────────────────────────────────────────
   main
   ──────────────────────────────────────────────────────────────────────────── */

async function main() {
	if (process.argv.includes('--selftest')) {
		console.log('Normaliser self-test (no network, schema from docs/00 §A.4)\n');
		process.exit(selftest() ? 1 : 0);
	}

	const key = mapidKey();
	console.log(`Project ${projectId()} (used as the read ticket)\n`);

	const ids = { ...(await idsFromProject(key)), ...idsFromEnv() };
	const kinds = Object.keys(SCHEMAS).filter((k) => ids[k]);

	if (!kinds.length) {
		const found = await probe(key);
		console.log('');
		if (found.length) {
			console.log('Something turned up — layer ids below. Re-run with them set:');
			for (const f of found) console.log(`  ${f.kind ?? ''} ${f.name} → ${f.id}`);
		} else {
			console.log('No mission dataset is reachable with this API key yet.');
			console.log('');
			console.log('That is expected: Struk/Menu/Properti Go are handed to curated teams, not');
			console.log('published to the catalogue. One layer id is all this script needs — ownership');
			console.log('is not required, only the id:');
			console.log('');
			console.log('  MAPID_STRUK_LAYER=<id> MAPID_MENU_LAYER=<id> MAPID_PROP_LAYER=<id> \\');
			console.log('    node scripts/fetch-mission.mjs');
			console.log('');
			console.log('A layer id is the last path segment of a GEO MAPID layer URL,');
			console.log('https://geo.mapid.io/layer/<LAYER_ID>. See docs/04-data-mapid.md §4.');
		}
		process.exit(0);
	}

	console.log(`Reading ${kinds.length} mission layer(s)…`);
	const out = { meta: { source: 'MAPID mission datasets via geoserver.mapid.io', project_id: projectId(), layers: [], regenerate: 'node scripts/fetch-mission.mjs' }, points: [] };

	for (const kind of kinds) {
		const { id, via } = ids[kind];
		const { name, features } = await readLayer(id, key, SCHEMAS[kind].label);
		const { points, resolved, missing, noGeom, presentKeys } = normalise(kind, features);
		out.points.push(...points);
		out.meta.layers.push({ kind, id, via, name, features: features.length, kept: points.length, noGeom, resolved, missing, columnsSeen: presentKeys });

		console.log(`  ${SCHEMAS[kind].label.padEnd(12)} ${String(features.length).padStart(5)} features → ${String(points.length).padStart(5)} points  (${via})`);
		if (missing.length) {
			console.log(`      ! columns not found: ${missing.join(', ')}`);
			console.log(`        columns present: ${presentKeys.join(', ')}`);
			console.log('        These read as null, never as zero — see the note at the top of this file.');
		}
		if (noGeom) console.log(`      ! ${noGeom} row(s) had neither geometry nor usable Latitude/Longitude`);
	}

	const dest = resolve(ROOT, 'src/lib/data/mission-poi.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));
	console.log(`\n${out.points.length} points → ${dest}`);
	console.log('Next: join onto the hexagon grid, the way join-mapid.mjs does for the catalogue POIs.');
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
