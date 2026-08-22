/**
 * Fetches every business in Jakarta and the opening hours the ones that publish them
 * have published.
 *
 *   node scripts/fetch-hours.mjs
 *   OVERPASS_ATTEMPTS=40 node scripts/fetch-hours.mjs   # on a bad day for the mirrors
 *
 * Output: `src/lib/data/osm-hours.json`.
 *
 * WHAT THIS IS, AND THE THING IT IS NOT
 *
 * The picture this feeds is the one Google draws as "popular times", and it is drawn
 * from a different measurement. Google counts phones. This counts DOORS: how many
 * businesses within walking range say they are open at each hour of each day, read
 * from the `opening_hours` tag in OpenStreetMap.
 *
 * The two are not interchangeable and the interface never calls this footfall. When
 * Struk Go and Mission Go arrive they carry receipts, which is the demand side of the
 * same hour, and the two will sit beside each other. Until then this is the half that
 * can be counted, and it is worth counting: a street where forty shutters go up at
 * seven in the morning and a street where four do at eleven are different places to
 * open a business, whatever the crowds do afterwards.
 *
 * WHAT COUNTS AS A BUSINESS, AND WHY IT IS A LIST OF EXCLUSIONS
 *
 * Every `shop`, `craft`, `office` and `amenity` in the bounding box, MINUS the values
 * named in `NOT_A_BUSINESS`. An inclusion list was the first attempt and it was the
 * wrong shape: a list of the amenity values somebody thought of quietly discards the
 * ones they did not, and in a dataset where fewer than one business in ten publishes
 * hours at all, silently dropping real ones is the expensive mistake. Naming the
 * exclusions puts the judgement in one readable place, and the tally of what each one
 * removed is written into the output so the call can be argued with.
 *
 * The cull is real: 410 of the 2,335 amenities in Jakarta that publish opening hours
 * are cash machines. A hole in the wall has an opening time and is not a business a
 * reader is comparing themselves against.
 *
 * BOTH HALVES ARE FETCHED, NOT ONE
 *
 * The businesses that publish hours are a SAMPLE, not a census, and a curve drawn from
 * a sample with no denominator beside it reads as the whole street. So the businesses
 * without hours are counted too, in the same bounding box under the same rules, and
 * the two numbers travel together from here to the panel.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, sleep } from './lib/overpass.mjs';
import { BBOX } from './lib/transit.mjs';
import { readWeek, openHours } from './lib/hours.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Overpass here is a shared service having a hard time as often as not, and this
    script asks it five questions. Raise it from the environment rather than editing
    the file when the mirrors are busy. */
const ATTEMPTS = Number(process.env.OVERPASS_ATTEMPTS ?? 12);

/**
 * Tag values that carry an opening time without being a business.
 *
 * Three kinds, and each is here for its own reason:
 *
 *   unattended fixtures — a cash machine, a parcel locker, a car park. They have
 *   opening times and no shutter, no staff and no counter.
 *
 *   institutions — schools, hospitals, places of worship, the police. They make a
 *   street busy and they are not trade, and a reader working out when to open a
 *   coffee shop is comparing themselves against trade.
 *
 *   public offices — an `office` is a business unless it is a government department,
 *   an embassy or a political party.
 *
 * Kept as one exported table because both halves of the fetch have to apply exactly
 * the same rule. The moment the denominator counts something the numerator does not,
 * the share on screen is measuring the difference between two tag lists.
 */
export const NOT_A_BUSINESS = {
	shop: ['vacant', 'no'],
	office: ['government', 'diplomatic', 'political_party', 'ngo', 'administrative'],
	amenity: [
		// unattended
		'atm',
		'parcel_locker',
		'vending_machine',
		'charging_station',
		'toilets',
		'shower',
		'drinking_water',
		'bench',
		'shelter',
		'waste_disposal',
		'recycling',
		'post_box',
		'parking',
		'parking_space',
		'parking_entrance',
		'motorcycle_parking',
		'bicycle_parking',
		'bicycle_rental',
		'fountain',
		'clock',
		// institutions
		'place_of_worship',
		'school',
		'kindergarten',
		'childcare',
		'college',
		'university',
		'prep_school',
		'library',
		'archive',
		'police',
		'fire_station',
		'courthouse',
		'townhall',
		'public_building',
		'community_centre',
		'social_facility',
		'hospital',
		'nursing_home',
		'mortuary',
		'grave_yard',
		'playground',
		'bus_station',
		'ferry_terminal'
	]
};

/** The keys a business is recognised by, in the order the report lists them. */
export const KEYS = ['shop', 'amenity', 'office', 'craft'];

/** `["amenity"]["amenity"!~"^(atm|parking|…)$"]` — the exclusions, as Overpass reads
    them. A key with nothing excluded gets the bare filter. */
function filterFor(key) {
	const drop = NOT_A_BUSINESS[key];
	if (!drop?.length) return `["${key}"]`;
	return `["${key}"]["${key}"!~"^(${drop.join('|')})$"]`;
}

/**
 * One query per key rather than one query for all four.
 *
 * The same lesson `build-hexes.mjs` records: a single query for every business in
 * Jakarta is 44,000 elements and comes back `504 Gateway Timeout` far more often than
 * it comes back. Split by key each one is light, and a group that fails does not take
 * the three that succeeded down with it — `lib/overpass.mjs` caches the ones that
 * landed, so the retry starts where the failure was.
 */
export const query = (key, withHours) =>
	`[out:json][timeout:180];nwr${filterFor(key)}${withHours ? '["opening_hours"]' : ''}(${BBOX});out ${withHours ? 'tags ' : ''}center;`;

/** An element's position — a node has its own, a way or a relation has a centre. */
const positionOf = (el) => {
	const lat = el.lat ?? el.center?.lat;
	const lon = el.lon ?? el.center?.lon;
	return lat == null || lon == null ? null : { lat, lon };
};

/** Coordinates to five decimals, ±1 m — the economy `build-pois.mjs` and
    `build-stops.mjs` already apply, and far finer than an 800 m catchment needs. */
const round5 = (v) => Math.round(v * 1e5) / 1e5;

async function main() {
	console.log(`Businesses and opening hours in ${BBOX}\n`);

	/* ── every business, whether or not it says when it opens ──────────────── */

	console.log('[1/2] Counting businesses…');
	/** Keyed by `type/id` so an element carrying two of the four keys — a shop that is
	    also tagged as an amenity — is one business, not two. */
	const seen = new Map();
	const byKey = {};
	for (const [i, key] of KEYS.entries()) {
		const raw = await overpass(query(key, false), `business ${key}`, { attempts: ATTEMPTS });
		let n = 0;
		for (const el of raw.elements) {
			const at = positionOf(el);
			if (!at) continue;
			n++;
			const id = `${el.type}/${el.id}`;
			if (!seen.has(id)) seen.set(id, { lat: round5(at.lat), lon: round5(at.lon) });
		}
		byKey[key] = n;
		console.log(`      ${String(n).padStart(6)} · ${key}`);
		if (i < KEYS.length - 1) await sleep(4000);
	}
	console.log(`      ${seen.size} businesses once the overlaps are merged`);

	await sleep(4000);

	/* ── the ones that publish hours ───────────────────────────────────────── */

	console.log('[2/2] Reading opening hours…');
	/** Why each unreadable value was refused, and one example of each so the reasons
	    can be checked rather than believed. See `lib/hours.mjs`. */
	const refused = {};
	const examples = {};
	let published = 0;
	let readable = 0;
	let openTotal = 0;

	for (const [i, key] of KEYS.entries()) {
		const raw = await overpass(query(key, true), `hours ${key}`, { attempts: ATTEMPTS });
		for (const el of raw.elements) {
			const at = positionOf(el);
			if (!at) continue;
			const id = `${el.type}/${el.id}`;
			// A business the first pass never saw would be one this pass counted under a
			// rule the other did not, which is the drift the shared filter exists to
			// prevent. Recorded rather than skipped, so it cannot go unnoticed.
			let point = seen.get(id);
			if (!point) {
				point = { lat: round5(at.lat), lon: round5(at.lon) };
				seen.set(id, point);
				console.log(`      NOTE: ${id} carries hours and was not counted as a business`);
			}
			// Two keys, one business, one set of hours: already read on the first pass.
			if (point.published) continue;
			// Marked whether or not the value turns out to be readable. This is what lets
			// the panel keep "nobody here publishes hours" apart from "they publish them
			// in a form this project will not guess at", which are different failures and
			// only one of them is anybody's fault.
			point.published = true;
			published++;
			const week = readWeek(el.tags?.opening_hours);
			if (!week.ok) {
				refused[week.reason] = (refused[week.reason] ?? 0) + 1;
				if (!examples[week.reason]) examples[week.reason] = el.tags?.opening_hours ?? '';
				continue;
			}
			point.week = week.week;
			readable++;
			openTotal += openHours(week.week);
		}
		if (i < KEYS.length - 1) await sleep(4000);
	}

	const points = [...seen.values()];
	const share = (a, b) => (b === 0 ? '0.0' : ((100 * a) / b).toFixed(1));

	console.log(`      ${published} publish opening hours (${share(published, points.length)}% of businesses)`);
	console.log(`      ${readable} of those could be read (${share(readable, published)}%)`);
	for (const [reason, n] of Object.entries(refused).sort((a, b) => b[1] - a[1])) {
		console.log(`        ${String(n).padStart(4)} · ${reason.padEnd(17)} e.g. ${JSON.stringify(examples[reason])}`);
	}
	console.log(`      the average readable business is open ${(openTotal / Math.max(readable, 1)).toFixed(1)} hours a week`);

	const out = {
		meta: {
			source: 'OpenStreetMap via Overpass API',
			bbox: BBOX,
			counted:
				'Setiap shop, craft, office dan amenity di dalam bbox, dikurangi nilai yang terdaftar di `excluded`. Jam bukanya dibaca dari tag `opening_hours`.',
			note: 'Ini menghitung PINTU yang buka, bukan orang yang lewat. Bukan popular times.',
			keys: KEYS,
			excluded: NOT_A_BUSINESS,
			hits: byKey,
			businesses: points.length,
			published,
			readable,
			unreadable: refused,
			unreadableExamples: examples,
			openHoursPerWeek: Number((openTotal / Math.max(readable, 1)).toFixed(1)),
			regenerate: 'node scripts/fetch-hours.mjs'
		},
		points
	};

	const dest = resolve(ROOT, 'src/lib/data/osm-hours.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(out));
	console.log(`\n→ ${dest}`);

	if (readable === 0) {
		console.log(
			'\nNOTE: not one business came back with hours this reader could use. Nothing\n' +
				'downstream will draw a curve, which is the honest outcome, but it is far more\n' +
				'likely that a query failed than that Jakarta stopped publishing hours. Check\n' +
				'the counts above before running the join.'
		);
	}
}

// Only when run as a script. Imported — which is how `selftest-hours.mjs` reaches the
// tag rules and the queries built from them — this must not touch the network or write
// anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		await main();
	} catch (err) {
		console.error('Failed:', err.message);
		process.exit(1);
	}
}
