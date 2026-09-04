/**
 * Self-test: the opening-hours layer, against the grid actually on disk. No network.
 *
 *   node scripts/selftest-hours.mjs
 *
 * Four things are checked, and they are the four a rebuild cannot check for itself.
 *
 * THE READER. `opening_hours` is a small language and this project reads a deliberately
 * narrow part of it. Every shape it accepts is asserted here with the answer written
 * out, because a reader that silently starts reading `Mo-Fr 08:00-17:00` as a closed
 * week would empty every curve in the app and nothing else would notice. So is every
 * shape it REFUSES, by name: the refusals are the whole reason the numbers can be
 * trusted, and a refusal quietly turning into a guess is the failure this file exists
 * to catch.
 *
 * THE ON-DISK CONTRACT. `scripts/lib/hours.mjs` writes the weeks and
 * `src/lib/domain/activity.ts` reads them, in different languages, in different halves
 * of the repository. A round trip is asserted so the two cannot drift apart into a
 * chart that draws confident nonsense.
 *
 * THE COUNT AND THE CURVE ARE THE SAME BUSINESSES. The grid says how many businesses
 * around a cell have readable hours and the browser draws the curve from the point
 * file. Those are two passes over two files, and if they ever disagree the panel prints
 * a number above a chart taken over a different set of shops. Every cell on the real
 * grid is checked, at every radius.
 *
 * THE SILENCE IS STILL SILENT. A cell below the threshold gets no curve, and an hour
 * nobody is open in is a counted zero rather than a gap. Those are different facts and
 * the interface says different things about them.
 *
 * The modules under test are partly TypeScript and import each other without
 * extensions, so those are loaded through Vite — already a dependency — exactly as
 * `selftest-property.mjs` does.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { DAYS, encodeWeek, openHours, readWeek } from './lib/hours.mjs';
import { buildHours } from './build-hours.mjs';
import { MIN_READABLE, RADII as JOIN_RADII } from './join-hours.mjs';
import { gridExtent, haversine } from './lib/geo.mjs';

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
	const activity = await server.ssrLoadModule('/src/lib/domain/activity.ts');
	const weights = await server.ssrLoadModule('/src/lib/domain/weights.ts');
	await server.close();
	return { ...activity, RADII: weights.RADII };
}

const { capturedOpen, decodeWeek, jakartaNow, parseHours, peakOf, readHours, weekProfile, RADII } =
	await load();

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Opening-hours self-test (no network)\n');

/* ── the reader: what it accepts ──────────────────────────────────────────── */

console.log('What the reader accepts');

/** Which hours of one day a week holds open, as plain numbers, for readable asserts. */
const hoursOn = (week, day) => {
	const out = [];
	for (let h = 0; h < 24; h++) if (week[day] & (1 << h)) out.push(h);
	return out;
};
const week = (value) => {
	const r = readWeek(value);
	if (!r.ok) throw new Error(`expected ${JSON.stringify(value)} to be readable, got ${r.reason}`);
	return r.week;
};

const allDay = week('24/7');
check('24/7 is every hour of every day', openHours(allDay) === 168, `got ${openHours(allDay)}`);

const office = week('Mo-Fr 08:00-17:00');
check(
	'a weekday range covers nine hours, Monday to Friday',
	openHours(office) === 45 && hoursOn(office, 0).length === 9 && hoursOn(office, 5).length === 0,
	`got ${openHours(office)} over the week, ${hoursOn(office, 0).length} on Monday, ${hoursOn(office, 5).length} on Saturday`
);
check(
	'an hour is open when the door is open at any point in it',
	// 08:30 to 17:30 touches hour 8 and hour 17, which is nine hours plus one.
	hoursOn(week('Mo 08:30-17:30'), 0).join() === '8,9,10,11,12,13,14,15,16,17',
	hoursOn(week('Mo 08:30-17:30'), 0).join()
);

check(
	'two ranges in one rule are a lunch break, not two rules',
	hoursOn(week('Mo 08:00-12:00,13:00-17:00'), 0).join() === '8,9,10,11,13,14,15,16',
	hoursOn(week('Mo 08:00-12:00,13:00-17:00'), 0).join()
);
check(
	'a comma before a weekday starts a new rule instead',
	hoursOn(week('Mo-Fr 10:00-19:00, Sa 08:00-14:00'), 5).join() === '8,9,10,11,12,13',
	hoursOn(week('Mo-Fr 10:00-19:00, Sa 08:00-14:00'), 5).join()
);
check(
	'a comma inside a day list is still a day list',
	openHours(week('Sa,Su 10:00-22:00')) === 24,
	`got ${openHours(week('Sa,Su 10:00-22:00'))}`
);
check(
	'hours written with a dot are read the same way',
	openHours(week('08.00-15.00')) === openHours(week('08:00-15:00')),
	`${openHours(week('08.00-15.00'))} vs ${openHours(week('08:00-15:00'))}`
);

// A later rule replaces the days it names, which is how "Mo-Sa …; Su …" says what it
// means. Sunday must be the second rule's hours and nothing else.
const overridden = week('Mo-Su 09:00-21:00; Su 12:00-15:00');
check(
	'a later rule replaces the days it names',
	hoursOn(overridden, 6).join() === '12,13,14' && hoursOn(overridden, 0).length === 12,
	`Sunday ${hoursOn(overridden, 6).join()}, Monday ${hoursOn(overridden, 0).length} hours`
);
check('`off` closes a day outright', hoursOn(week('Mo-Sa 07:00-21:00; Su off'), 6).length === 0);

/* ── the reader: past midnight, the case that was got wrong twice ─────────── */

const late = week('Tu-Su 18:00-02:00');
check(
	'a span past midnight lands on the following day',
	hoursOn(late, 1).join() === '18,19,20,21,22,23' &&
		hoursOn(late, 2).join() === '0,1,18,19,20,21,22,23',
	`Tuesday ${hoursOn(late, 1).join()}, Wednesday ${hoursOn(late, 2).join()}`
);
check(
	'Monday gets Sunday night and nothing else',
	hoursOn(late, 0).join() === '0,1',
	hoursOn(late, 0).join()
);
// The reason the spill is held back until every rule has been read: applied in place,
// Saturday night's hours would be wiped by a rule about Sunday lunchtime.
const spilled = week('Mo-Su 18:00-02:00; Su 10:00-14:00');
check(
	'a later rule does not wipe the night before it',
	hoursOn(spilled, 6).join() === '0,1,10,11,12,13',
	hoursOn(spilled, 6).join()
);

/* ── the reader: what it refuses, and by which name ───────────────────────── */

console.log('\nWhat the reader refuses');

const refusals = [
	['a public holiday clause', 'Mo-Fr 09:00-17:00; PH off', 'holiday'],
	['a holiday inside the day list', 'Mo-Su,PH 10:00-22:00', 'holiday'],
	['an hour that moves with the sun', 'sunrise-sunset', 'variable-time'],
	['a rule that only holds in some months', 'Jul-Aug 10:00-14:00', 'seasonal'],
	['a rule for the second Sunday', 'Mo-Su 09:00-17:00; Su[2] off', 'nth-weekday'],
	['a comment standing in for a time', '"by appointment"', 'comment'],
	['an opening time with no closing time', 'Mo-Sa 09:00-18:00+', 'open-ended'],
	['a state with no hours behind it', 'open', 'state-only'],
	['days named with nothing said about them', 'Mo-Fr', 'no-times'],
	['a shop that has closed down', 'closed', 'never-open'],
	['an empty tag', '', 'empty'],
	['something that is not a timetable at all', 'kapan saja', 'unreadable-times']
];
for (const [label, value, reason] of refusals) {
	const r = readWeek(value);
	check(`${label} is refused as "${reason}"`, !r.ok && r.reason === reason, `got ${r.ok ? 'readable' : r.reason}`);
}
// The point of refusing whole rather than in part. Reading the readable half of
// `Mo-Fr 09:00-17:00; PH off` happens to be harmless, and the same leniency applied to
// a seasonal rule would report the winter timetable all year.
check(
	'a refusal is whole, not the readable half of the value',
	readWeek('Mo-Fr 09:00-17:00; Jul-Aug 10:00-14:00').ok === false
);

/* ── the on-disk contract, in both directions ─────────────────────────────── */

console.log('\nThe contract between the build and the app');

const samples = ['24/7', 'Mo-Fr 08:00-17:00', 'Tu-Su 18:00-02:00', 'Mo-Sa 07:00-21:00; Su off'];
for (const value of samples) {
	const original = week(value);
	const round = decodeWeek(encodeWeek(original));
	check(`"${value}" survives a round trip`, round.join() === original.join(), `${round.join()} vs ${original.join()}`);
}
check(
	'an encoded week is one chunk per day',
	encodeWeek(week('24/7')).split('.').length === DAYS.length
);
// `parseInt('not-a-week', 36)` is 30,701, which is a perfectly plausible Tuesday. A
// half-parsed chunk has to close the whole week rather than become one.
for (const broken of ['not-a-week', 'ff.ff', '', 'zzzzzzz.0.0.0.0.0.0']) {
	check(
		`"${broken}" decodes to a closed week, never an open one`,
		decodeWeek(broken).every((d) => d === 0),
		decodeWeek(broken).join()
	);
}

/* ── the file the app fetches ─────────────────────────────────────────────── */

console.log('\nThe point file');

const fixture = {
	meta: { source: 'test', counted: '', note: '', businesses: 4, published: 3, unreadable: { holiday: 1 } },
	points: [
		{ lat: -6.2, lon: 106.8, week: week('Mo-Su 10:00-22:00'), published: true },
		{ lat: -6.21, lon: 106.81, week: week('Mo-Su 10:00-22:00'), published: true },
		{ lat: -6.22, lon: 106.82, week: week('24/7'), published: true },
		// Publishes hours this reader refused, so it is counted by the grid and drawn by
		// nothing. The branch the real data no longer exercises, which is why it is here.
		{ lat: -6.23, lon: 106.83, published: true },
		// Publishes nothing at all. The denominator's own reason for existing.
		{ lat: -6.24, lon: 106.84 }
	]
};
const built = buildHours(fixture);
check('two businesses keeping the same hours share one timetable', built.meta.timetables === 2, `got ${built.meta.timetables}`);
check('a business with no readable week is left out of the points', built.points.length === 3, `got ${built.points.length}`);
check('the readable count is the number of points', built.meta.readable === built.points.length);
check(
	'the denominator survives into the file',
	built.meta.businesses === 4 && built.meta.published === 3,
	`${built.meta.businesses} businesses, ${built.meta.published} publishing`
);
const rebuilt = parseHours(built);
check(
	'every point comes back with the week it was written with',
	rebuilt[0].week.join() === fixture.points[0].week.join()
);

/* ── the profile ──────────────────────────────────────────────────────────── */

console.log('\nThe profile');

const profile = weekProfile(rebuilt);
check('a profile is seven days of twenty-four hours', profile.length === 7 && profile.every((d) => d.length === 24));
check(
	'an hour nobody is open in is a counted zero, not a gap',
	weekProfile([]).every((d) => d.every((n) => n === 0)) &&
		weekProfile([]).every((d) => d.length === 24)
);
check(
	'no hour counts more businesses than there are',
	profile.every((d) => d.every((n) => n <= rebuilt.length))
);
check(
	'the round-the-clock business is the only one open at five in the morning',
	profile[0][5] === 1,
	`got ${profile[0][5]}`
);
check(
	'and all three of them are open at midday',
	profile[0][12] === 3,
	`got ${profile[0][12]}`
);
// A plateau reports its first hour rather than an arbitrary hour in the middle of it.
check('a tie takes the earliest hour', peakOf([0, 3, 3, 3, 1]).hour === 1, `got ${peakOf([0, 3, 3, 3, 1]).hour}`);
check('a day with nothing open peaks at zero', peakOf(new Array(24).fill(0)).n === 0);

const nowAt = jakartaNow(new Date('2026-08-22T02:30:00Z'));
check(
	'the clock is Jakarta`s, and Monday is day zero',
	// 02:30 UTC on Saturday is 09:30 in Jakarta, still Saturday, which is day 5.
	nowAt.day === 5 && nowAt.hour === 9,
	`got day ${nowAt.day}, hour ${nowAt.hour}`
);

/* ── the two lists of radii ───────────────────────────────────────────────── */

console.log('\nThe pipeline and the interface agree');

check(
	'the join computes a stop for every radius the interface offers',
	JOIN_RADII.join() === [...RADII].join(),
	`join ${JOIN_RADII.join()} vs interface ${[...RADII].join()}`
);

/* ── the real data, if it has been built ──────────────────────────────────── */

const gridPath = fileURLToPath(new URL('src/lib/data/hexes.json', ROOT));
const filePath = fileURLToPath(new URL('static/data/hours.json', ROOT));
const grid = JSON.parse(readFileSync(gridPath, 'utf8'));

/* ── the fetched box actually covers every catchment ─────────────────────── */

console.log('\nThe box that was fetched');

/*
 * The fetch is bounded by the grid's extent PADDED by one walking radius, because a
 * cell's catchment reaches a full radius past its own centre. Three cells sit closer to
 * the edge than that — all at Soekarno-Hatta, the nearest 32 m — so an unpadded fetch
 * left up to 768 m of their catchment unread.
 *
 * The first pad was still five metres short, because it divided by 111,320 m per degree
 * of latitude when the shortest a degree gets is 110,574. A pad short by any amount is
 * not a guarantee, so the margin is asserted rather than assumed.
 */
{
	const { box } = gridExtent(grid);
	const [w, s, e, n] = box;
	let closest = Infinity;
	let who = null;
	for (const h of grid.hexes) {
		const d = Math.min(
			haversine(h.lat, h.lon, s, h.lon),
			haversine(h.lat, h.lon, n, h.lon),
			haversine(h.lat, h.lon, h.lat, w),
			haversine(h.lat, h.lon, h.lat, e)
		);
		if (d < closest) {
			closest = d;
			who = h.name;
		}
	}
	const widest = RADII[RADII.length - 1];
	check(
		`no catchment reaches past the box that was fetched (nearest ${Math.round(closest)} m, ${who})`,
		closest >= widest,
		`${Math.round(closest)} m of pad against a ${widest} m radius`
	);
}

const hasFile = existsSync(filePath);
const joined = grid.hexes.filter((h) => h.hours).length;

console.log('\nThe grid on disk');

if (!hasFile || joined === 0) {
	// Said out loud rather than passed over in silence. A pipeline that has not been run
	// is a fair state for a checkout to be in, and a self-test that reports "ok" for
	// checks it never made is not.
	console.log(
		`  skipped: ${hasFile ? 'the grid has not been through join-hours.mjs' : 'static/data/hours.json is not built'}.` +
			'\n           Run: node scripts/fetch-hours.mjs && node scripts/join-hours.mjs && node scripts/build-hours.mjs'
	);
} else {
	check('every cell carries an hours reading', joined === grid.hexes.length, `${joined}/${grid.hexes.length}`);
	const places = parseHours(JSON.parse(readFileSync(filePath, 'utf8')));

	// The check this file exists for. The grid counted the readable businesses in one
	// pass over one file, the browser captures them in another pass over another, and
	// the panel prints the first above a chart drawn from the second.
	let mismatched = 0;
	let worst = '';
	for (const cell of grid.hexes) {
		for (const r of RADII) {
			const stored = readHours(cell, r)?.h ?? -1;
			const found = capturedOpen(cell, places, r).length;
			if (stored !== found) {
				mismatched++;
				if (!worst) worst = `${cell.id} at ${r} m: grid says ${stored}, the app finds ${found}`;
			}
		}
	}
	check('the count above the curve is the businesses the curve is drawn from', mismatched === 0, worst);

	// A cell may hold fewer readable businesses than published ones, never more: `h` is
	// a subset of `p`, which is a subset of `n`. A join that lost track of that would
	// have the panel reporting more readable timetables than there are businesses.
	const nested = grid.hexes.every((h) =>
		RADII.every((r) => {
			const at = h.hours.r[String(r)];
			return at.h <= at.p && at.p <= at.n;
		})
	);
	check('readable is a subset of published, and published of counted', nested);

	const meta = grid.meta.hours;
	check('the grid records the threshold the panel reads', meta?.minReadable === MIN_READABLE, `got ${meta?.minReadable}`);
	check(
		'the cells are accounted for, curve or no curve',
		meta.cellsReadable + meta.cellsThin + meta.cellsEmpty === grid.hexes.length,
		`${meta.cellsReadable} + ${meta.cellsThin} + ${meta.cellsEmpty} vs ${grid.hexes.length}`
	);
	console.log(
		`  · ${meta.readable} of ${meta.businesses} businesses publish readable hours` +
			`\n  · ${meta.cellsReadable} cells get a curve, ${meta.cellsThin} are too thin, ${meta.cellsEmpty} have none`
	);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
