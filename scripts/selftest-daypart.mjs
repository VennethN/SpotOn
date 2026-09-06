/**
 * Self-test: the greeting, against the clock and against both dictionaries.
 *
 *   node scripts/selftest-daypart.mjs
 *
 * WHY THIS FILE EXISTS
 *
 * The greeting is the first sentence anybody reads, and every way it can break is a
 * quiet one. An hour that falls between two bands greets nobody. A wording the
 * rotation never reaches is written, reviewed and never seen. A dictionary a wording
 * short leaves half the readers looking at nothing where a sentence should be. None of
 * those raise anything at run time: they come back as a blank line or a stale
 * salutation that somebody has to happen to be awake at the right hour to notice.
 *
 * It also holds the copy to the rule the rest of the product is held to. This is the
 * one sentence on the opening card that is not computed from the grid, so the rule
 * that keeps invented figures off the screen applies to it with the number taken out:
 * a greeting knows the hour and knows nothing else. A digit in it would be a figure
 * nobody measured, and the writing rules put dashes and semicolons out of reach for
 * the same reason they are out of reach everywhere else.
 *
 * Nothing is written down twice here. The bands, the count of wordings and the strings
 * all come from the modules under test, so raising the number of wordings or moving a
 * boundary changes this test's expectations with it.
 *
 * No network and no data files.
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
	const daypart = await server.ssrLoadModule('/src/lib/domain/daypart.ts');
	const dict = await server.ssrLoadModule('/src/lib/i18n/index.ts');
	await server.close();
	return { daypart, dict };
}

const { daypart, dict } = await load();
const { DAY_PARTS, WORDINGS, dayPartAt, greetingAt, readingOn, readingIn } = daypart;
const { DICT, LANGS } = dict;

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

/* ── every hour of the day is greeted, and only once ─────────────────────── */

console.log('\nthe clock');

const hours = [];
for (let h = 0; h < 24; h++) hours.push(dayPartAt(h));
check(
	'every hour of the day falls in a known part',
	hours.every((p) => DAY_PARTS.includes(p)),
	hours.map((p, h) => `${h}:${p}`).join(' ')
);
// A part nobody can reach is a set of wordings nobody can read. This is what would
// break if two boundaries were ever given the same hour.
const reached = new Set(hours);
check(
	'every part of the day is reachable from some hour',
	DAY_PARTS.every((p) => reached.has(p)),
	DAY_PARTS.filter((p) => !reached.has(p)).join(', ')
);
// Each part is one unbroken stretch of the clock. A part that appeared, stopped and
// appeared again would mean the boundaries are out of order.
const runs = hours.filter((p, i) => i === 0 || p !== hours[i - 1]);
check(
	'each part is one unbroken stretch of hours',
	new Set(runs).size === runs.length,
	runs.join(' > ')
);
// Midnight has to belong to the first part, or the small hours would be greeted with
// whatever the last band of the previous evening was.
check('the day opens on the first part', hours[0] === DAY_PARTS[0], hours[0]);

/* ── the two clocks agree where it matters ───────────────────────────────── */

console.log('\nthe device and the server');

/* The opening card is rendered on the server before the browser has said which zone it
   is in, and the server reads Jakarta. For a reader who IS in Jakarta the two have to
   land on the same reading, or the greeting would change under them on the way in.
   Checked across a whole year at an odd interval so the sweep crosses every hour, both
   sides of midnight, and the end of every month. */
process.env.TZ = 'Asia/Jakarta';
const start = Date.UTC(2026, 0, 1, 0, 17);
const STEP = 37 * 60 * 1000 + 13_000;
let sampled = 0;
let apart = null;
for (let t = start; t < start + 365 * 86_400_000; t += STEP) {
	const now = new Date(t);
	const device = readingOn(now);
	const server = readingIn(now, 'Asia/Jakarta');
	sampled++;
	if (device.hour !== server.hour || device.day !== server.day) {
		apart ??= `${now.toISOString()} device ${JSON.stringify(device)} server ${JSON.stringify(server)}`;
	}
}
check(
	`a Jakarta device and a Jakarta server read the same clock (${sampled} readings)`,
	apart === null,
	apart ?? ''
);

/* Somewhere that does move its clocks, to prove the zone is being asked rather than an
   offset remembered. London is seven hours behind Jakarta in winter and six in summer,
   so a reading built by adding a fixed number of hours would drift in March. */
process.env.TZ = 'Europe/London';
const winter = new Date(Date.UTC(2026, 0, 15, 12, 0));
const summer = new Date(Date.UTC(2026, 6, 15, 12, 0));
check(
	'a London device and a Jakarta server read different clocks, in both halves of the year',
	readingOn(winter).hour !== readingIn(winter, 'Asia/Jakarta').hour &&
		readingOn(summer).hour !== readingIn(summer, 'Asia/Jakarta').hour,
	`winter ${readingOn(winter).hour} vs ${readingIn(winter, 'Asia/Jakarta').hour}, ` +
		`summer ${readingOn(summer).hour} vs ${readingIn(summer, 'Asia/Jakarta').hour}`
);
// The zone is read from `Intl`, not carried in this code's memory, so the shift London
// makes in March has to show up in the reading rather than being smoothed over.
check(
	'the summer shift is in the reading, not remembered as a fixed offset',
	readingIn(winter, 'Asia/Jakarta').hour - readingOn(winter).hour !==
		readingIn(summer, 'Asia/Jakarta').hour - readingOn(summer).hour,
	''
);
delete process.env.TZ;

/* ── the rotation reaches every wording ──────────────────────────────────── */

console.log('\nthe rotation');

const seen = new Map(DAY_PARTS.map((p) => [p, new Set()]));
for (let day = 0; day < 90; day++) {
	for (const part of DAY_PARTS) seen.get(part).add(greetingAt(day, part));
}
// A wording that no day can produce is copy written, reviewed and never read.
check(
	'every part reaches every one of its wordings',
	DAY_PARTS.every((p) => seen.get(p).size === WORDINGS),
	DAY_PARTS.map((p) => `${p}:${[...seen.get(p)].sort().join('')}`).join(' ')
);
// Every index has to be a position that exists in the tuple.
check(
	'no wording is picked outside the tuple',
	DAY_PARTS.every((p) => [...seen.get(p)].every((i) => Number.isInteger(i) && i >= 0 && i < WORDINGS)),
	''
);
// The same reader on the same day should not be greeted with one sentence all day.
check(
	'one day does not settle on a single wording',
	new Set(DAY_PARTS.map((p) => greetingAt(0, p))).size > 1,
	DAY_PARTS.map((p) => greetingAt(0, p)).join('')
);
// A clock set before 1970 makes the day count negative, which is where a remainder
// goes negative and indexes off the front of the tuple.
check(
	'a day count before the epoch still lands inside the tuple',
	DAY_PARTS.every((p) => {
		const i = greetingAt(-4001, p);
		return Number.isInteger(i) && i >= 0 && i < WORDINGS;
	}),
	DAY_PARTS.map((p) => greetingAt(-4001, p)).join(' ')
);

/* ── both languages, and what a greeting may not say ─────────────────────── */

console.log('\nthe copy');

for (const lang of LANGS) {
	const table = DICT[lang].greeting;
	const parts = Object.keys(table);

	check(
		`${lang}: every part of the day is worded`,
		DAY_PARTS.every((p) => Array.isArray(table[p])),
		DAY_PARTS.filter((p) => !Array.isArray(table[p])).join(', ')
	);
	check(
		`${lang}: no part carries a wording the rotation cannot reach`,
		parts.every((p) => table[p].length === WORDINGS),
		parts.map((p) => `${p}:${table[p].length}`).join(' ')
	);

	const all = parts.flatMap((p) => table[p]);
	check(
		`${lang}: no greeting is empty`,
		all.every((line) => line.trim().length > 0),
		''
	);
	// The clock is the only thing known here. A digit would be a figure that came from
	// nobody's data, which is the one thing this product does not put on a screen.
	const digits = all.filter((line) => /\d/.test(line));
	check(`${lang}: no greeting carries a figure`, digits.length === 0, digits.join(' | '));
	// The writing rules, applied where they are easiest to forget.
	const dashed = all.filter((line) => line.includes('—'));
	check(`${lang}: no em dashes`, dashed.length === 0, dashed.join(' | '));
	const semis = all.filter((line) => line.includes(';'));
	check(`${lang}: no semicolons`, semis.length === 0, semis.join(' | '));
	// Each wording stands alone on the card AND has "I'm Tapak" following it, so a
	// fragment left open would read as a sentence that lost its end.
	const unfinished = all.filter((line) => !/[.!?]$/.test(line.trim()));
	check(`${lang}: every wording is a finished sentence`, unfinished.length === 0, unfinished.join(' | '));
	// Two parts sharing a wording is allowed where the language genuinely has one word
	// for both, but one part repeating itself is three wordings that are two.
	const repeated = parts.filter((p) => new Set(table[p]).size !== table[p].length);
	check(`${lang}: no part repeats itself`, repeated.length === 0, repeated.join(', '));
}

/* Tapak opens with the same salutation the card greeted with, so the two surfaces
   cannot come to say different things about what time it is. */
for (const lang of LANGS) {
	const table = DICT[lang].greeting;
	const misplaced = [];
	for (const part of DAY_PARTS) {
		for (let w = 0; w < WORDINGS; w++) {
			if (!DICT[lang].tapak.greet(562, part, w).startsWith(table[part][w])) {
				misplaced.push(`${part}/${w}`);
			}
		}
	}
	check(`${lang}: Tapak opens with the greeting the card shows`, misplaced.length === 0, misplaced.join(' '));
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nall checks passed');
process.exit(failures ? 1 : 0);
