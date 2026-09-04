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

/** 0..1 → "0".."100". Null/undefined becomes "—", not "0" — unknown is not zero. */
export const pct = (v: number | null | undefined): string =>
	v === null || v === undefined ? '—' : String(Math.round(v * 100));

/**
 * Indonesian-style hours: 12 → "12.00", 20.35 → "20.21", negative → "—".
 *
 * Accepts fractional hours so the diorama clock (which moves smoothly with the
 * scroll) and whole hours (from the 24-hour profile) share one formatter.
 */
export function formatHour(hour: number): string {
	if (hour < 0) return '—';
	const h = Math.floor(hour) % 24;
	const m = Math.floor((hour - Math.floor(hour)) * 60);
	return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
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
