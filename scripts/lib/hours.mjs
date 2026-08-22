/**
 * Reads OpenStreetMap's `opening_hours` tag into a week of open hours.
 *
 * WHY THIS IS DELIBERATELY NARROW
 *
 * `opening_hours` is a small language, and most of it describes things this product
 * has no use for: public holidays, school terms, "sunset to dawn", the second Tuesday
 * of every month, seasons. A lenient reader that guessed at those would put an hour on
 * screen that nobody wrote down, which is the one thing SpotOn does not do.
 *
 * So this reader handles the shapes that actually carry a weekly rhythm — `24/7`, a
 * weekday selector, a list of clock ranges, `off` — and REFUSES everything else by
 * name. A refusal is not a silent zero: `readWeek` hands back the reason, the fetch
 * tallies the reasons, and the count of shops whose hours could not be read travels
 * with the data all the way to the panel. "Nobody published hours here" and "hours
 * were published in a form this reader will not guess at" are different facts, and a
 * reader deserves to be told which one they are looking at.
 *
 * WHAT AN OPEN HOUR MEANS HERE
 *
 * Bit `h` of a day is set when the place is open at some point during that hour. A
 * shop open 08:30 to 17:30 is counted as open in hour 8 and in hour 17. The bar for
 * an hour is therefore "a door was open during it", not "open for the whole of it",
 * and that is the sentence the panel uses.
 */

/** The week, in the order `opening_hours` writes it and this file indexes it. */
export const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const HOURS = 24;

/** Every hour of a day, as a bit field. */
const ALL_DAY = (1 << HOURS) - 1;

const DAY_INDEX = new Map(DAYS.map((d, i) => [d.toLowerCase(), i]));

/**
 * Shapes this reader refuses, and the name each refusal is counted under.
 *
 * Tested before anything is parsed, so a rule list that is half readable is refused
 * whole rather than read down to the half that fitted. `Mo-Fr 09:00-17:00; PH off`
 * is a fair example: dropping the holiday clause happens to be harmless, and the same
 * leniency applied to `Mo-Fr 09:00-17:00; Jul-Aug 10:00-14:00` would silently report
 * the winter timetable all year.
 */
const REFUSALS = [
	['holiday', /\b(PH|SH)\b/],
	['variable-time', /\b(sunrise|sunset|dawn|dusk)\b/i],
	['seasonal', /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|easter|week)[a-z]*\b|\b(19|20)\d{2}\b/i],
	['nth-weekday', /\[|\]/],
	['comment', /"/],
	['fallback-rule', /\|\|/],
	['open-ended', /\d\s*\+/],
	['state-only', /\b(open|unknown)\b/i]
];

/** `Mo`, `Mo-Fr`, `Mo,We,Fr`, `Mo-We,Sa` — the whole weekday selector of one rule. */
const DAY_TOKEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const DAY_SELECTOR = new RegExp(
	`^(${DAY_TOKEN}(?:-${DAY_TOKEN})?(?:\\s*,\\s*${DAY_TOKEN}(?:-${DAY_TOKEN})?)*)\\s*`,
	'i'
);
/** `08:00-17:00`, and the `08.00-17.00` Jakarta writes by hand often enough to be worth
    reading. A dot between two clock figures cannot mean anything else. */
const TIME_RANGE = /^(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})$/;
const STARTS_WITH_DAY = new RegExp(`^${DAY_TOKEN}\\b`, 'i');
const HAS_TIME = /\d{1,2}[.:]\d{2}\s*-/;

/**
 * One chunk between semicolons → the rules inside it.
 *
 * A comma does two jobs in this language. In `Sa,Su 10:00-22:00` it joins two days
 * into one selector, and in `Mo-Fr 10:00-19:00, Sa 08:00-14:00` it separates two whole
 * rules — a form 42 Jakarta shops use and the first version of this reader refused.
 *
 * What tells them apart is whether the rule so far has said a time yet. Until it has,
 * a comma is still building the day list. Once it has, a part that opens with a
 * weekday is a new rule.
 */
function splitRules(chunk) {
	const rules = [];
	let current = '';
	for (const part of chunk.split(',')) {
		const piece = part.trim();
		if (current && HAS_TIME.test(current) && STARTS_WITH_DAY.test(piece)) {
			rules.push(current);
			current = piece;
		} else {
			current = current ? `${current},${piece}` : piece;
		}
	}
	if (current) rules.push(current);
	return rules;
}

/** The days one selector names, in week order. A range wraps, so `Sa-Su` and `Fr-Mo`
    both mean what they say. */
function selectedDays(selector) {
	const out = new Set();
	for (const part of selector.split(',')) {
		const [from, to] = part.trim().split('-');
		const a = DAY_INDEX.get(from.trim().toLowerCase());
		if (a === undefined) return null;
		if (to === undefined) {
			out.add(a);
			continue;
		}
		const b = DAY_INDEX.get(to.trim().toLowerCase());
		if (b === undefined) return null;
		for (let i = a; ; i = (i + 1) % DAYS.length) {
			out.add(i);
			if (i === b) break;
		}
	}
	return [...out];
}

/** The hours a span of minutes touches, as a bit field. `24:00` is midnight at the
    END of a day, which is why the end is exclusive and an empty span sets nothing. */
function bits(fromMin, toMin) {
	let mask = 0;
	if (toMin <= fromMin) return mask;
	const first = Math.floor(fromMin / 60);
	const last = Math.ceil(toMin / 60) - 1;
	for (let h = first; h <= last && h < HOURS; h++) mask |= 1 << h;
	return mask;
}

/**
 * One rule's clock ranges → the hours it opens on its own day, and the hours it
 * spills into the following one.
 *
 * A span whose end is at or before its start runs past midnight: `18:00-02:00` is
 * eight hours of trade, not a mistake, and half of it belongs to tomorrow.
 */
function readTimes(text) {
	let day = 0;
	let spill = 0;
	for (const range of text.split(',')) {
		const m = TIME_RANGE.exec(range.trim());
		if (!m) return null;
		const from = Number(m[1]) * 60 + Number(m[2]);
		const to = Number(m[3]) * 60 + Number(m[4]);
		if (from > 24 * 60 || to > 24 * 60) return null;
		if (to > from) {
			day |= bits(from, to);
		} else {
			day |= bits(from, 24 * 60);
			spill |= bits(0, to);
		}
	}
	return { day, spill };
}

/**
 * One `opening_hours` value → the week it describes.
 *
 * @returns {{ ok: true, week: number[] } | { ok: false, reason: string }}
 *   `week` holds seven bit fields, Monday first, bit `h` set when the place is open
 *   during hour `h`. A value this reader will not guess at comes back with the reason
 *   it refused, which is what the fetch tallies and reports.
 */
export function readWeek(raw) {
	const text = String(raw ?? '').trim();
	if (!text) return { ok: false, reason: 'empty' };
	for (const [reason, pattern] of REFUSALS) {
		if (pattern.test(text)) return { ok: false, reason };
	}
	if (/^24\s*\/\s*7$/.test(text)) return { ok: true, week: DAYS.map(() => ALL_DAY) };

	const week = DAYS.map(() => 0);
	/**
	 * Hours that ran past midnight, held back until every rule has been read.
	 *
	 * A rule REPLACES the days it names, which is how `Mo-Su 10:00-22:00; Su 12:00-18:00`
	 * says what it means. Applied straight away, last night's spill into Sunday morning
	 * would be wiped by the Sunday rule that follows it, and a bar open until 2am on
	 * Saturday night would close at midnight because of a sentence about Sunday
	 * lunchtime.
	 */
	const spill = DAYS.map(() => 0);
	let read = 0;

	for (const chunk of text.split(';').flatMap(splitRules)) {
		const rule = chunk.trim();
		if (!rule) continue;

		const found = DAY_SELECTOR.exec(rule);
		const days = found ? selectedDays(found[1]) : DAYS.map((_, i) => i);
		if (days === null) return { ok: false, reason: 'unreadable-days' };
		const rest = (found ? rule.slice(found[0].length) : rule).trim();

		if (/^(off|closed)$/i.test(rest)) {
			for (const d of days) week[d] = 0;
			read++;
			continue;
		}
		// A weekday selector with nothing after it names days without saying anything
		// about them. There is no hour in that, so there is no hour to report.
		if (!rest) return { ok: false, reason: 'no-times' };

		const times = readTimes(rest);
		if (times === null) return { ok: false, reason: 'unreadable-times' };
		for (const d of days) week[d] = times.day;
		if (times.spill) {
			for (const d of days) spill[(d + 1) % DAYS.length] |= times.spill;
		}
		read++;
	}

	if (read === 0) return { ok: false, reason: 'no-rules' };
	for (let d = 0; d < DAYS.length; d++) week[d] |= spill[d];
	// Every rule read, and not one open hour between them. `Mo-Su off` is a shop that
	// has closed down, not a weekly rhythm, and counting it would put a business with
	// no hours into the tally of businesses whose hours are known.
	if (week.every((m) => m === 0)) return { ok: false, reason: 'never-open' };
	return { ok: true, week };
}

/** How many hours of the week a mask holds open. Used to sanity-check a fetch: a city
    whose average business is open 168 hours a week has been read wrong. */
export function openHours(week) {
	let n = 0;
	for (const day of week) {
		for (let h = 0; h < HOURS; h++) if (day & (1 << h)) n++;
	}
	return n;
}

/** The week as a compact string, one base-36 chunk per day. This is the on-disk shape
    that `build-hours.mjs` writes and `domain/activity` reads, and the two are one
    contract: seven chunks, Monday first, joined by a dot. */
export const encodeWeek = (week) => week.map((m) => m.toString(36)).join('.');
