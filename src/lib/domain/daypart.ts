import type { DayPart } from '$lib/types';

/**
 * What part of the day it is, and which wording of the greeting belongs to it.
 *
 * Two pure functions over a clock reading. Who does the reading, and whose clock it
 * is, is decided in `state/clock` — the domain never calls `new Date()`, the same way
 * it never calls `fetch`.
 *
 * WHY THE DAY IS CUT WHERE IT IS
 *
 * The bands are the ones Indonesian greetings already use, because this product is
 * written in Indonesian first and a greeting is the one string where the language and
 * the clock are the same decision. `pagi` runs to noon rather than to eleven, which is
 * the only place the convention was bent: "selamat pagi" at half past eleven is
 * ordinary, and "good afternoon" before twelve is wrong, so the later boundary is
 * right in one language and harmless in the other.
 *
 * `dini_hari` is kept apart from `malam` even though Indonesian would call three in
 * the morning malam too. Somebody at their screen at three is not having the evening
 * they were having at eight, and that is the whole point of greeting by the clock.
 *
 * WHAT A GREETING MAY NOT SAY
 *
 * The clock is the only thing known here. Not the weather, not whether the street
 * outside is busy, not whether the reader has had a long day. This product refuses to
 * put a figure on screen that came from nobody's data, and a greeting claiming the
 * shops are just opening is that same invention with the number taken out. The
 * wordings in `i18n` say what time it is and nothing else, and `selftest-daypart.mjs`
 * holds them to it.
 */

/** The parts in the order a day passes through them. */
export const DAY_PARTS: DayPart[] = ['dini_hari', 'pagi', 'siang', 'sore', 'malam'];

/**
 * Where each part begins, on a 24-hour clock. Ascending, and `dini_hari` starts at
 * midnight, so between them they cover every hour with no gap to fall through.
 */
const STARTS: Record<DayPart, number> = {
	dini_hari: 0,
	pagi: 4,
	siang: 12,
	sore: 15,
	malam: 18
};

/**
 * How many wordings each part has.
 *
 * `Greetings` in `types.ts` is the tuple this counts. The two are written down in
 * different files because one is the pick and the other is the words, and they are
 * checked against each other in `selftest-daypart.mjs` rather than trusted.
 */
export const WORDINGS = 3;

/**
 * One reading of a clock: enough to greet by, and nothing else.
 *
 * `day` only ever has other readings subtracted from it, so where it counts from does
 * not matter. What matters is that it advances by exactly one at the reader's own
 * midnight, so the wording turns over with the date they are living in.
 */
export interface Reading {
	/** Hour of the day, 0 to 23. */
	hour: number;
	/** A count of days that advances at local midnight. */
	day: number;
}

const MS_PER_DAY = 86_400_000;

/** The clock this code is running on, already in whatever zone that machine is set to. */
export function readingOn(now: Date): Reading {
	return {
		hour: now.getHours(),
		// Shifted by the zone offset before dividing, so the day turns over at local
		// midnight rather than at midnight UTC.
		day: Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / MS_PER_DAY)
	};
}

/**
 * The same reading taken in a named zone, whatever zone this machine is set to.
 *
 * Through `Intl` rather than by adding seven hours: the offset belongs to the zone and
 * not to this code's memory of it, and this is the one place the two could quietly
 * disagree. `selftest-daypart.mjs` checks that a machine set to Jakarta and this
 * function asked for Jakarta come back with the same reading, because that agreement
 * is what stops the greeting changing under a Jakarta reader on the way in.
 */
export function readingIn(now: Date, timeZone: string): Reading {
	const parts: Record<string, string> = {};
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23'
	});
	for (const { type, value } of fmt.formatToParts(now)) parts[type] = value;
	const midnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
	return { hour: Number(parts.hour), day: Math.floor(midnight / MS_PER_DAY) };
}

/** Which part of the day an hour falls in. */
export function dayPartAt(hour: number): DayPart {
	let part: DayPart = DAY_PARTS[0];
	for (const p of DAY_PARTS) {
		if (hour >= STARTS[p]) part = p;
	}
	return part;
}

/**
 * Which wording of the greeting today gets.
 *
 * Rotated by the day and by the part, NOT drawn at random. Two things follow from
 * that and both are the reason for it. A reader who reloads to check something reads
 * the same sentence rather than watching the page change its mind, and the server can
 * render the greeting before the browser has said which clock it is on, because a
 * rotation is something both sides can work out and a coin toss is not.
 *
 * `day` is a count of days, from anywhere, as long as it advances by one at the
 * reader's own midnight. Five parts against three wordings means the pair does not
 * repeat within a day and does not settle into one column across days.
 */
export function greetingAt(day: number, part: DayPart): number {
	const step = day + DAY_PARTS.indexOf(part);
	// A clock set before 1970 makes `day` negative, and a negative remainder would
	// index off the front of the tuple.
	return ((step % WORDINGS) + WORDINGS) % WORDINGS;
}
