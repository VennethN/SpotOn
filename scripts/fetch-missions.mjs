/**
 * Reads the MAPID Apps field surveys — Struk Go, Menu Go, Properti Go — and the
 * community notes filed alongside them, and normalises both into one file.
 *
 *   node scripts/fetch-missions.mjs
 *   node scripts/fetch-missions.mjs --selftest    # exercise the normaliser only
 *
 * Output:
 *   src/lib/data/mission.json  — every record, plus what was actually read
 *
 * WHY THIS REPLACES THE OLD PROBE
 *
 * `fetch-mission.mjs` went looking for these three datasets as layers on
 * geoserver.mapid.io, because that is where every other MAPID dataset this project
 * reads lives, and it never found them. The conclusion recorded in that script was
 * that the limit is discovery rather than authorisation: a layer id would have been
 * enough, and nobody had one to give.
 *
 * That was the wrong door. The missions are not published as layers at all. They are
 * served by MAPID Apps itself, from the same public endpoints its own map calls, and
 * those need no key and no layer id:
 *
 *   POST https://server.mapid.io/web/survei/public/{propertigo|menugo|struckgo}
 *   GET  https://server.mapid.io/web/survei/public/{mission}?_id=<id>
 *   POST https://server.mapid.io/mobile/v2/communities/activities/public
 *
 * The documented competition endpoints (`/web/competition/<mission>`, x-api-key) carry
 * the same records with their properties already attached. They are not used here
 * because the key they want is a Map Service key this project does not hold, and the
 * public route reaches the identical data without one. If a key ever arrives, the only
 * thing that changes is that the second request per record below stops being needed.
 *
 * THE LIST GIVES GEOMETRY, THE DETAIL GIVES THE ANSWERS
 *
 * The public list endpoint returns `properties: {}` for every feature — the shape is
 * there and the contents are not. What a surveyor actually wrote comes back only from
 * the per-record detail call, so this script pages the list and then fetches each
 * record once. There are a few hundred of them in Greater Jakarta, which is why that
 * is affordable and why it is done at build time rather than in the app.
 *
 * COLUMN NAMES ARE MATCHED LOOSELY AND REPORTED, NEVER GUESSED SILENTLY
 *
 * Kept from the script this replaces, because it was the right rule there too. The
 * real keys are whatever MAPID Apps' form fields ended up being called, and a form
 * field can be renamed without anyone telling us. Every column is resolved by
 * normalised match against a list of aliases, and the resolution is written into the
 * output — a column that did not resolve is named in the report instead of quietly
 * reading as empty. A cashless share of nothing because the payment column moved looks
 * exactly like a catchment that pays in cash, and only one of those is true.
 *
 * AND THE VALUES ARE COUNTED, NOT ASSUMED
 *
 * Every closed vocabulary the records use — how it was paid for, how busy the place
 * looked, sale or rent — is tallied on each run and written into the report. That is
 * how "59 of the 163 property records are for rent" gets to be a figure this project
 * quotes rather than a thing it remembers, and it is how the day a new payment method
 * appears becomes visible instead of silently falling into "other".
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/lib/data/mission.json');
const GRID = resolve(ROOT, 'src/lib/data/hexes.json');

const SURVEY = 'https://server.mapid.io/web/survei/public';
const NOTES = 'https://server.mapid.io/mobile/v2/communities/activities/public';

/** The list endpoint's page size is fixed server side. Stated here so the paging
    loop reads as what it is rather than as a number somebody chose. */
const PAGE = 100;

/* ────────────────────────────────────────────────────────────────────────────
   The three surveys, and what this project needs off each record
   ──────────────────────────────────────────────────────────────────────────── */

/** Collapses a column name so "Nama Tempat", "nama_tempat" and "NAMA TEMPAT" all
    reach the same key. */
const normKey = (s) =>
	String(s ?? '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');

/**
 * Each survey: the endpoint segment, and the columns to carry across.
 *
 * `to` is the name this project uses, `from` the aliases it may arrive under. First
 * alias that resolves wins, and the winner is written into the report.
 */
const SURVEYS = {
	struk: {
		path: 'struckgo',
		label: 'Struk Go',
		columns: [
			{ to: 'place', from: ['nama_tempat', 'Nama Tempat/Merchant', 'merchant'] },
			{ to: 'kind', from: ['kategori_tempat', 'Kategori Tempat', 'kategori'] },
			{ to: 'date', from: ['tanggal', 'Tanggal Transaksi'] },
			{ to: 'pay', from: ['metode_pembayaran', 'Metode Pembayaran', 'pembayaran'] },
			{ to: 'photo', from: ['foto_struk', 'Foto Struk'] },
			{ to: 'note', from: ['catatan'] }
		]
	},
	menu: {
		path: 'menugo',
		label: 'Menu Go',
		columns: [
			{ to: 'place', from: ['nama_tempat', 'Nama Tempat/Makan'] },
			{ to: 'kind', from: ['jenis_tempat', 'Jenis Tempat Makan', 'jenis'] },
			{ to: 'date', from: ['tanggal'] },
			{ to: 'dish', from: ['menu_utama', 'Menu Utama'] },
			{ to: 'price', from: ['harga_rata_rata', 'Harga Rata-Rata', 'harga'] },
			{ to: 'crowd', from: ['kondisi_tempat', 'Kondisi Tempat'] },
			{ to: 'roving', from: ['mobilitas', 'Mobilitas'] },
			{ to: 'photo', from: ['foto_tempat', 'Foto Tempat'] },
			{ to: 'note', from: ['catatan'] }
		]
	},
	properti: {
		path: 'propertigo',
		label: 'Properti Go',
		columns: [
			{ to: 'kind', from: ['kategori_properti', 'Kategori Properti'] },
			{ to: 'offer', from: ['jenis_properti', 'Jenis Properti'] },
			{ to: 'date', from: ['tanggal'] },
			{ to: 'address', from: ['alamat', 'Alamat'] },
			{ to: 'photo', from: ['foto_tampak_depan', 'Foto Tampak Depan'] },
			{ to: 'photo2', from: ['foto_spanduk', 'Foto Spanduk'] },
			{ to: 'note', from: ['catatan'] }
		]
	}
};

/* ────────────────────────────────────────────────────────────────────────────
   Reading a value out of one record
   ──────────────────────────────────────────────────────────────────────────── */

/** Finds a column by any of its aliases, and says which one answered. */
function pick(props, aliases) {
	const index = new Map(Object.keys(props ?? {}).map((k) => [normKey(k), k]));
	for (const alias of aliases) {
		const key = index.get(normKey(alias));
		if (key === undefined) continue;
		const value = props[key];
		if (value === null || value === undefined || value === '') continue;
		return { key, value };
	}
	return null;
}

/** Trims a string and returns null rather than an empty one, so an absence stays an
    absence all the way to the interface. */
const text = (v) => {
	const s = String(v ?? '').trim();
	return s === '' ? null : s;
};

/** A date as the day it happened, with no time on it. The records carry midnight UTC
    already, so nothing here is a conversion. */
const day = (v) => {
	const s = text(v);
	if (!s) return null;
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : null;
};

/**
 * Was this paid for without cash.
 *
 * True, false, or null for a method nobody here has seen before, and the third one is
 * the reason this is a table rather than a "not cash" test. A payment method that
 * arrives after this was written must not be silently counted as cashless just for
 * failing to spell "Tunai" — it should show up in the vocabulary report as an unknown
 * and be added here on purpose.
 */
const CASHLESS = {
	QRIS: true,
	'E-WALLET': true,
	EWALLET: true,
	DEBIT: true,
	'KARTU DEBIT': true,
	'KARTU KREDIT': true,
	KREDIT: true,
	'CREDIT CARD': true,
	TRANSFER: true,
	TUNAI: false,
	CASH: false
};

const cashless = (pay) => {
	const s = text(pay);
	if (!s) return null;
	const hit = CASHLESS[s.toUpperCase()];
	return hit === undefined ? null : hit;
};

/**
 * How busy the surveyor found the place, from the sentence they picked.
 *
 * The options are written out in full in the form ("Ramai (Terdapat antrean lebih dari
 * 3 orang ...)"), so the first word is the answer and the parenthesis is its
 * definition. Anything that does not begin with one of the three is left null rather
 * than guessed at, and lands in the vocabulary report.
 */
const crowd = (v) => {
	const s = text(v)?.toLowerCase() ?? '';
	if (s.startsWith('sepi')) return 'sepi';
	if (s.startsWith('sedang')) return 'sedang';
	if (s.startsWith('ramai')) return 'ramai';
	return null;
};

/** Sale or rent, from `jenis_properti`. Null for anything else, which is what keeps a
    third option nobody has seen from being filed as one of these two. */
const offer = (v) => {
	const s = text(v)?.toLowerCase() ?? '';
	if (s.startsWith('dijual')) return 'jual';
	if (s.startsWith('disewa')) return 'sewa';
	return null;
};

/** "Ya (Berkeliling)" or "Tidak (Menetap...)", and the field arrives with a leading
    space often enough to be worth trimming before the test. */
const roving = (v) => {
	const s = text(v)?.toLowerCase() ?? '';
	if (s.startsWith('ya')) return true;
	if (s.startsWith('tidak')) return false;
	return null;
};

/**
 * A price as it was written down, or null.
 *
 * NOT cleaned, NOT clamped, NOT dropped for being implausible. The readings run from
 * Rp 20 to Rp 180.000 and the low end is plainly somebody's slip, but which slip is a
 * judgement this file is not allowed to make: a threshold here would be the one figure
 * in the product that came from nobody's data. What the interface does about thin and
 * noisy readings is decided where they are shown, and stated there.
 */
const money = (v) => {
	const n = typeof v === 'number' ? v : Number(text(v));
	return Number.isFinite(n) && n > 0 ? n : null;
};

/** Which normaliser each carried column goes through. Anything not named here is
    carried across as trimmed text. */
const SHAPE = {
	date: day,
	price: money,
	crowd,
	offer,
	roving
};

/* ────────────────────────────────────────────────────────────────────────────
   The network
   ──────────────────────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, init) {
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const res = await fetch(url, init);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw err;
			await sleep(400 * attempt);
		}
	}
	return null;
}

const post = (url, body) =>
	json(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

/** Pages one survey's list endpoint until the server says there is no more. */
async function listAll(path, feature) {
	const out = [];
	let offset = 0;
	let total = Infinity;
	while (offset < total) {
		const page = await post(`${SURVEY}/${path}`, { feature, offset, limit: PAGE });
		const features = Array.isArray(page?.features) ? page.features : [];
		out.push(...features);
		total = page?.pagination?.total ?? out.length;
		offset += PAGE;
		if (offset < total) await sleep(250);
	}
	return out;
}

/** Runs `fn` over `items` a few at a time, in order. */
async function pool(items, width, fn) {
	const out = new Array(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(width, items.length) }, async () => {
			while (next < items.length) {
				const i = next++;
				out[i] = await fn(items[i], i);
			}
		})
	);
	return out;
}

/* ────────────────────────────────────────────────────────────────────────────
   Normalising
   ──────────────────────────────────────────────────────────────────────────── */

/** A tally that keeps its keys in first-seen order, for the vocabulary report. */
const tally = (into, value) => {
	const k = value === null || value === undefined || value === '' ? '(kosong)' : String(value);
	into[k] = (into[k] ?? 0) + 1;
};

/**
 * One survey record, reduced to the columns this project uses.
 *
 * `resolved` accumulates which alias answered for each column, across every record
 * rather than off the first one: a column can be present on some records and absent on
 * others, and the report should say how many it was found on.
 */
export function normalizeRecord(mission, feature, resolved = {}, vocab = {}) {
	const def = SURVEYS[mission];
	if (!def) throw new Error(`unknown survey: ${mission}`);
	const coords = feature?.geometry?.coordinates;
	if (!Array.isArray(coords) || coords.length < 2) return null;
	const [lon, lat] = coords;
	if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

	const props = feature?.properties ?? {};
	const rec = { id: String(feature?._id ?? ''), mission, lat, lon };

	for (const col of def.columns) {
		const hit = pick(props, col.from);
		const shape = SHAPE[col.to] ?? text;
		const value = hit ? shape(hit.value) : null;
		if (value !== null) rec[col.to] = value;

		const seen = (resolved[`${mission}.${col.to}`] ??= { as: null, found: 0, missing: 0 });
		if (hit) {
			seen.as ??= hit.key;
			seen.found++;
		} else {
			seen.missing++;
		}
	}

	// The closed vocabularies, tallied as they are read rather than as they are
	// remembered. `pay` is tallied raw so an unrecognised method shows up by name.
	if (mission === 'struk') {
		tally((vocab.pay ??= {}), props.metode_pembayaran ?? rec.pay);
		rec.cashless = cashless(rec.pay);
	}
	if (mission === 'menu') {
		tally((vocab.crowd ??= {}), rec.crowd);
		tally((vocab.kind_menu ??= {}), rec.kind);
	}
	if (mission === 'properti') {
		tally((vocab.offer ??= {}), rec.offer);
		tally((vocab.kind_properti ??= {}), rec.kind);
	}

	return rec;
}

/**
 * One community note.
 *
 * A different kind of thing from the three surveys and kept as one: a survey record is
 * a form somebody filled in about a place, and this is somebody's account of a street,
 * with photographs. It is carried because the accounts are about exactly what this
 * product is about — what the pavement outside a shopfront is actually like — and it is
 * never counted into anything, for exactly the same reason.
 */
export function normalizeNote(item) {
	const coords = item?.geometry?.coordinates;
	if (!Array.isArray(coords) || coords.length < 2) return null;
	const [lon, lat] = coords;
	if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
	const media = Array.isArray(item?.medias) ? item.medias.filter((m) => typeof m === 'string') : [];
	const rec = {
		id: String(item?._id ?? ''),
		mission: 'catatan',
		lat,
		lon,
		title: text(item?.title),
		body: text(item?.description),
		by: text(item?.user_full_name) ?? text(item?.user_name),
		community: text(item?.community_name),
		date: day(item?.created_at)
	};
	if (media.length) rec.photo = media[0];
	return rec;
}

/* ────────────────────────────────────────────────────────────────────────────
   Run
   ──────────────────────────────────────────────────────────────────────────── */

/** The grid's own extent, padded by one walking radius, as a closed ring.
    Read from the grid rather than typed in, so it follows the grid if that moves. */
function gridBox() {
	const file = JSON.parse(readFileSync(GRID, 'utf8'));
	const cells = file.hexes ?? [];
	if (!cells.length) throw new Error('hexes.json holds no cells');
	const radius = file.meta?.walkRadius ?? 800;
	// A degree of latitude is ~111 km everywhere; a degree of longitude shrinks with
	// the cosine of it. Jakarta sits close enough to the equator that the difference is
	// small, and it is applied anyway because getting it wrong is free to avoid.
	const lats = cells.map((c) => c.lat);
	const lons = cells.map((c) => c.lon);
	const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
	const padLat = radius / 111_320;
	const padLon = radius / (111_320 * Math.cos((mid * Math.PI) / 180));
	const box = [
		Math.min(...lons) - padLon,
		Math.min(...lats) - padLat,
		Math.max(...lons) + padLon,
		Math.max(...lats) + padLat
	];
	return { box, radius, cells: cells.length };
}

async function run() {
	const { box, cells } = gridBox();
	const [w, s, e, n] = box;
	const feature = {
		type: 'Polygon',
		coordinates: [
			[
				[w, s],
				[e, s],
				[e, n],
				[w, n],
				[w, s]
			]
		]
	};

	const records = [];
	const resolved = {};
	const vocab = {};
	const counts = {};

	for (const [mission, def] of Object.entries(SURVEYS)) {
		process.stdout.write(`${def.label}: listing… `);
		const list = await listAll(def.path, feature);
		process.stdout.write(`${list.length} records, reading each… `);
		const full = await pool(list, 6, async (f) => {
			const one = await json(`${SURVEY}/${def.path}?_id=${encodeURIComponent(f._id)}`);
			return one?.features?.[0] ?? f;
		});
		let kept = 0;
		for (const f of full) {
			const rec = normalizeRecord(mission, f, resolved, vocab);
			if (rec) {
				records.push(rec);
				kept++;
			}
		}
		counts[mission] = kept;
		console.log(`${kept} kept`);
	}

	/* The notes endpoint takes a count rather than an offset, so "all of them" is asked
	   for by asking for more than there can be and checking that fewer came back. If it
	   ever answers with exactly what was asked for, the set is truncated and the report
	   says so instead of letting a ceiling pass as a total. */
	const ASKED = 5000;
	process.stdout.write('Catatan warga: reading… ');
	const notes = await post(NOTES, {
		bbox: { min_lng: w, min_lat: s, max_lng: e, max_lat: n },
		limit: ASKED
	});
	const items = notes?.data?.activities ?? [];
	for (const item of items) {
		const rec = normalizeNote(item);
		if (rec) records.push(rec);
	}
	counts.catatan = items.length;
	const truncated = items.length >= ASKED;
	console.log(`${items.length} kept${truncated ? ' (TRUNCATED)' : ''}`);

	const out = {
		meta: {
			source:
				'Misi lapangan MAPID Apps (Struk Go, Menu Go, Properti Go) dan catatan komunitas, dibaca dari endpoint publik MAPID Apps.',
			endpoints: {
				survey: `${SURVEY}/{struckgo|menugo|propertigo}`,
				detail: `${SURVEY}/{mission}?_id=<id>`,
				notes: NOTES
			},
			bbox: box,
			gridCells: cells,
			counts,
			notesTruncated: truncated,
			columns: resolved,
			vocab,
			regenerate: 'node scripts/fetch-missions.mjs'
		},
		records
	};

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, JSON.stringify(out));
	console.log(`\nWrote ${records.length} records to ${OUT.replace(ROOT + '/', '')}`);

	// Columns that resolved on nothing are the failure this whole alias dance exists to
	// make visible, so they are said out loud rather than left in the file to be found.
	const dead = Object.entries(resolved).filter(([, v]) => v.found === 0);
	if (dead.length) {
		console.log('\nColumns that resolved on NO record:');
		for (const [name] of dead) console.log(`  ${name}`);
	}
	for (const [name, counted] of Object.entries(vocab)) {
		console.log(`\n${name}: ${JSON.stringify(counted)}`);
	}
}

/* ────────────────────────────────────────────────────────────────────────────
   Self-test
   ──────────────────────────────────────────────────────────────────────────── */

function selftest() {
	let failed = 0;
	const ok = (name, cond) => {
		console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
		if (!cond) failed++;
	};

	const feat = (props, coords = [106.8, -6.2]) => ({
		_id: 'x',
		geometry: { type: 'Point', coordinates: coords },
		properties: props
	});

	const struk = normalizeRecord(
		'struk',
		feat({
			nama_tempat: 'Nasi Uduk Bu May',
			kategori_tempat: 'Warung/kaki lima',
			tanggal: '2026-08-20T00:00:00.000Z',
			metode_pembayaran: 'QRIS'
		})
	);
	ok('struk keeps the place name', struk.place === 'Nasi Uduk Bu May');
	ok('a timestamp becomes a day', struk.date === '2026-08-20');
	ok('QRIS is cashless', struk.cashless === true);
	ok('cash is not', normalizeRecord('struk', feat({ metode_pembayaran: 'Tunai' })).cashless === false);
	ok(
		'a payment method nobody has seen is neither',
		normalizeRecord('struk', feat({ metode_pembayaran: 'Barter' })).cashless === null
	);

	const alias = normalizeRecord('struk', feat({ 'Nama Tempat/Merchant': 'Alfamart' }));
	ok('a renamed column still resolves', alias.place === 'Alfamart');

	const menu = normalizeRecord(
		'menu',
		feat({
			nama_tempat: 'Kedai Rasa Ibu',
			harga_rata_rata: 25000,
			kondisi_tempat: 'Ramai (Terdapat antrean lebih dari 3 orang)',
			mobilitas: ' Tidak (Menetap/Mangkal di satu titik)'
		})
	);
	ok('a price is carried as a number', menu.price === 25000);
	ok('the crowd sentence reduces to its first word', menu.crowd === 'ramai');
	ok('a leading space does not break the mobility test', menu.roving === false);
	ok(
		'an implausible price is kept, not cleaned',
		normalizeRecord('menu', feat({ harga_rata_rata: 20 })).price === 20
	);
	ok(
		'a crowd wording nobody has seen is left off the record entirely',
		!('crowd' in normalizeRecord('menu', feat({ kondisi_tempat: 'Penuh sesak' })))
	);

	const jual = normalizeRecord('properti', feat({ jenis_properti: 'Dijual', kategori_properti: 'Ruko' }));
	const sewa = normalizeRecord('properti', feat({ jenis_properti: 'Disewa' }));
	ok('a sale reads as a sale', jual.offer === 'jual');
	ok('a rental reads as a rental', sewa.offer === 'sewa');
	ok('the property kind is carried', jual.kind === 'Ruko');

	ok(
		'a record with no coordinates is dropped',
		normalizeRecord('struk', { _id: 'y', properties: {} }) === null
	);
	ok(
		'a note keeps its author and its first photograph',
		(() => {
			const note = normalizeNote({
				_id: 'n',
				geometry: { type: 'Point', coordinates: [106.8, -6.2] },
				title: 'Trotoar sempit',
				description: 'Sempit dan kotor',
				user_full_name: 'Maya Lusiana',
				medias: ['a.jpg', 'b.jpg'],
				created_at: '2026-08-22T12:46:39.988Z'
			});
			return note.by === 'Maya Lusiana' && note.photo === 'a.jpg' && note.date === '2026-08-22';
		})()
	);

	const missing = {};
	normalizeRecord('struk', feat({ nama_tempat: 'A' }), missing);
	ok('a column found on no record is reported', missing['struk.pay'].found === 0);

	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();
else await run();
