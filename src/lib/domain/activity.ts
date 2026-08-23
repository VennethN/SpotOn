import { haversine } from '$lib/utils/geo';
import type { HexBase, HoursAtRadius } from '$lib/types';

/**
 * When the businesses around a cell are open.
 *
 * WHAT THIS MEASURES, AND THE WORD IT WILL NOT USE
 *
 * It counts DOORS. For each hour of each day it is the number of businesses within
 * walking range whose published opening hours say they are open then, read from the
 * `opening_hours` tag in OpenStreetMap by `scripts/lib/hours.mjs`.
 *
 * It is not footfall, and nothing here is called popular, busy or crowded. The chart
 * this feeds looks like Google's popular times and is a different measurement:
 * Google counts phones moving through a place, and nobody has counted a phone in
 * Jakarta for this product. The MAPID Apps field surveys carry receipts, which is the
 * demand side of the very same hour, and not one of them carries a time of day, so
 * they cannot join this curve — see `domain/field`. This is the only half of the hour
 * anybody has counted, and it is a real half: a street where forty shutters go up at
 * seven and a street where four go up at eleven are different places to open a
 * business.
 *
 * The same rule as everywhere else in this engine holds. A cell where too few
 * businesses publish hours has NO curve, not a flat one, and the panel says how many
 * it found. An hour nobody is open in is a zero that was counted, which is a different
 * thing again and is drawn as the zero it is.
 *
 * WHY THE CURVE IS COMPUTED HERE AND NOT IN THE JOIN
 *
 * A week is 168 numbers. Precomputed per cell at five radii that is 470,000 figures
 * bolted onto a grid that carries the counts alone in 674 KB, for a panel that wants
 * one cell's worth. So the grid carries the COUNTS (`join-hours.mjs`) and the weeks
 * travel with the businesses
 * (`static/data/hours.json`), matched to a cell here with the same distance test the
 * join used — exactly the split `domain/premises` makes for the property listings, for
 * exactly the same reason.
 */

export const DAYS_IN_WEEK = 7;
export const HOURS_IN_DAY = 24;

/** One business, and the week it published. */
export interface OpenPlace {
	lat: number;
	lon: number;
	/**
	 * Seven bit fields, Monday first. Bit `h` is set when the door is open at some
	 * point during hour `h`, which is the bar `scripts/lib/hours.mjs` sets and the
	 * sentence the panel uses: a shop open 08:30 to 17:30 counts in hour 8 and hour 17.
	 */
	week: number[];
}

export interface HoursFile {
	meta: {
		source: string;
		counted: string;
		note: string;
		/** Businesses counted in the bounding box, whether or not they publish hours. */
		businesses: number;
		/** Of those, how many published an `opening_hours` tag. */
		published: number;
		/** Of those, how many could be read without guessing. */
		readable: number;
		/** Why the rest were refused, by reason. */
		unreadable: Record<string, number>;
		timetables: number;
		openHoursPerWeek: number;
	};
	/** The distinct timetables, as seven base-36 chunks joined by a dot. */
	weeks: string[];
	/** [lat, lon, which timetable] — see `scripts/build-hours.mjs`. */
	points: Array<[number, number, number]>;
}

/** Jakarta is UTC+7 all year, with no daylight saving to complicate it. */
export const JAKARTA_UTC_OFFSET = 7;

/** Every hour of a day set. Nothing may decode above this: a bit past the twenty-fourth
    is a chunk that means something other than a day. */
const ALL_DAY = (1 << HOURS_IN_DAY) - 1;
const CHUNK = /^[0-9a-z]+$/;

/**
 * One encoded timetable → seven bit fields.
 *
 * Anything malformed decodes to a CLOSED WEEK, all seven days, rather than to `NaN` or
 * to the readable part of it. A chunk that does not parse means the file was written by
 * a build this reader does not understand, and the honest reading of "I cannot tell
 * when this is open" is not "open around the clock" — nor is it "open on the days I
 * happened to manage".
 *
 * `parseInt` alone is not enough for that, and this is exactly where it bites:
 * `parseInt('not-a-week', 36)` reads the letters up to the dash and returns 30,701,
 * which is a perfectly plausible Tuesday.
 */
export function decodeWeek(encoded: string): number[] {
	const closed = new Array<number>(DAYS_IN_WEEK).fill(0);
	const parts = String(encoded ?? '').split('.');
	if (parts.length !== DAYS_IN_WEEK) return closed;
	const week: number[] = [];
	for (const part of parts) {
		if (!CHUNK.test(part)) return closed;
		const n = Number.parseInt(part, 36);
		if (!Number.isFinite(n) || n < 0 || n > ALL_DAY) return closed;
		week.push(n);
	}
	return week;
}

export function parseHours(file: HoursFile): OpenPlace[] {
	const weeks = (file.weeks ?? []).map(decodeWeek);
	const closed = new Array(DAYS_IN_WEEK).fill(0);
	return (file.points ?? []).map(([lat, lon, at]) => ({
		lat,
		lon,
		week: weeks[at] ?? closed
	}));
}

/**
 * The businesses one cell captures.
 *
 * The same test `join-hours.mjs` applied when it counted them: distance from the CELL
 * CENTRE, within the walking radius. Measured any other way the curve would be drawn
 * over a different set of shops from the count printed above it, and the two would
 * disagree by an amount nobody could account for.
 */
export function capturedOpen(
	cell: Pick<HexBase, 'lat' | 'lon'>,
	places: OpenPlace[],
	radiusM: number
): OpenPlace[] {
	const out: OpenPlace[] = [];
	// The cheap box test first, as in `capturedListings` and `capturedStops`: 0.012° is
	// ~1.3 km, comfortably wider than any radius offered, and it discards nearly every
	// business in the city before any trigonometry happens.
	const box = 0.012;
	for (const p of places) {
		if (Math.abs(p.lat - cell.lat) > box || Math.abs(p.lon - cell.lon) > box) continue;
		if (haversine(cell.lat, cell.lon, p.lat, p.lon) <= radiusM) out.push(p);
	}
	return out;
}

/** Seven days of twenty-four counts: how many of these businesses are open in each
    hour. Monday first, the order the OSM tag itself is written in. */
export function weekProfile(places: OpenPlace[]): number[][] {
	const week: number[][] = [];
	for (let d = 0; d < DAYS_IN_WEEK; d++) {
		const day = new Array<number>(HOURS_IN_DAY).fill(0);
		for (const p of places) {
			const bits = p.week[d] ?? 0;
			if (bits === 0) continue;
			for (let h = 0; h < HOURS_IN_DAY; h++) if (bits & (1 << h)) day[h]++;
		}
		week.push(day);
	}
	return week;
}

/**
 * The busiest hour of a day, and how many doors are open in it.
 *
 * The FIRST of the hours that tie, so a street where everything opens at eight and
 * shuts at ten reports eight rather than an arbitrary hour in the middle of the
 * plateau. `n` of zero means the day was counted and nothing opens on it, which is a
 * finding — a day with nothing to count never reaches here, because the panel refuses
 * to draw a curve below the threshold.
 */
export function peakOf(day: number[]): { hour: number; n: number } {
	let hour = 0;
	let n = -1;
	for (let h = 0; h < day.length; h++) {
		if (day[h] > n) {
			n = day[h];
			hour = h;
		}
	}
	return { hour, n: Math.max(n, 0) };
}

/**
 * The hour of the week it is in Jakarta right now.
 *
 * Jakarta's hour, not the reader's. The curve describes shutters on a street in
 * Jakarta, so the marker saying "now" has to mean now THERE — a reader in London
 * looking at their own four in the afternoon would be shown a mark against a Jakarta
 * evening and told it was the present.
 *
 * Monday is 0 here, as it is everywhere else in this module. `Date` counts Sunday as
 * 0, which is the one conversion in this file and the reason it is not repeated at
 * every call site.
 */
export function jakartaNow(now = new Date()): { day: number; hour: number } {
	const shifted = new Date(now.getTime() + JAKARTA_UTC_OFFSET * 3600_000);
	return { day: (shifted.getUTCDay() + 6) % DAYS_IN_WEEK, hour: shifted.getUTCHours() };
}

/**
 * One cell's counts at one radius, as the grid holds them.
 *
 * An unknown radius returns nothing rather than the nearest stop. A count labelled
 * 650 m that was taken at 800 m is a figure with the wrong number attached, and that
 * is worse than no figure — the same rule `domain/cost` follows for the price.
 */
export function readHours(
	cell: Pick<HexBase, 'hours'>,
	radius: number
): HoursAtRadius | null {
	return cell.hours?.r?.[String(radius)] ?? null;
}

/** Businesses in range whose hours could be read. This is what the threshold is
    tested against, and what the curve is drawn from. */
export const readableAt = (cell: Pick<HexBase, 'hours'>, radius: number): number =>
	readHours(cell, radius)?.h ?? 0;
