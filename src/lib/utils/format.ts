/**
 * One place to turn numbers into text.
 *
 * Every component used to write its own formatter, and the result was two
 * conventions colliding on screen: the same peak hour written "12:00" in the detail
 * panel but "12.00" in the diorama and the chart. That kind of thing never gets
 * noticed until the two happen to appear side by side.
 *
 * Used by the domain layer (building the "why here?" sentences) as well as by the
 * components, so this module deliberately depends on nothing.
 */

/** Indonesian-style thousands: 7577 → "7.577". */
export const num = (v: number): string => v.toLocaleString('id-ID');

/**
 * The marker for a missing value. A middot rather than a rule: a dash sitting where
 * a number should be reads as a minus sign.
 */
const MISSING = '·';

/** 0..1 → "0".."100". Null/undefined becomes the missing marker, not "0": unknown is not zero. */
export const pct = (v: number | null | undefined): string =>
	v === null || v === undefined ? MISSING : String(Math.round(v * 100));

/**
 * Indonesian-style hours: 12 → "12.00", 20.35 → "20.21", negative → the missing marker.
 *
 * Accepts fractional hours so the diorama clock (which moves smoothly with the
 * scroll) and whole hours (from the 24-hour profile) share one formatter.
 */
export function formatHour(hour: number): string {
	if (hour < 0) return MISSING;
	const h = Math.floor(hour) % 24;
	const m = Math.floor((hour - Math.floor(hour)) * 60);
	return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

/**
 * The scales a rupiah figure gets written on. Property asking prices run from six
 * digits to twelve, and printed in full they stop being read as quantities at all.
 */
export type MoneyScale = 'unit' | 'thousand' | 'million' | 'billion';

/**
 * A rupiah figure split into a small number and the scale it sits on.
 *
 * The WORDS belong to the locale files — "jt" and "million" are not the same string —
 * but the thresholds belong here, because the two languages have to break at the same
 * place. Written out twice they would sooner or later disagree, and the same price
 * would read "Rp 950 jt" on one side and "Rp 1.0 billion" on the other.
 */
export function moneyScale(v: number): { value: number; scale: MoneyScale } {
	const abs = Math.abs(v);
	if (abs >= 1e9) return { value: v / 1e9, scale: 'billion' };
	if (abs >= 1e6) return { value: v / 1e6, scale: 'million' };
	if (abs >= 1e3) return { value: v / 1e3, scale: 'thousand' };
	return { value: v, scale: 'unit' };
}

/** Position 0..6 on the opportunity colour ramp. */
export function rampIndex(score: number): number {
	return Math.max(0, Math.min(6, Math.round(score * 6)));
}

/** The CSS colour variable for one score — the "no data" grey when null. */
export function rampVar(score: number | null): string {
	if (score === null) return 'var(--nodata)';
	return `var(--ramp-${rampIndex(score)})`;
}
