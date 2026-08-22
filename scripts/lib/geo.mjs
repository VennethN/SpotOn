/**
 * The one earth the whole project measures on.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * Every join script had its own copy of `haversine`, and three of them opened with
 * `const R = 6371008.8` — the mean earth radius — while `src/lib/utils/geo.ts`, which
 * the browser measures with, uses 6378137, the WGS84 equatorial radius. The two differ
 * by 0.11%.
 *
 * That gap is invisible while only one side of a comparison ever measures anything. It
 * stops being invisible the moment BOTH do, and in this app both do all the time: a
 * join counts what is within 800 m of a cell and writes the number, then the browser
 * recounts the same points from the same coordinates to draw them, with the other
 * radius. At 800 m the radii disagree by 0.9 m, which sounds like nothing and is not:
 *
 *   - 21 cell-and-radius pairs disagreed on how many property listings are in range,
 *     by as many as 7 listings, because the catalogue geocodes to the street and one
 *     coordinate sitting on the line carries several units.
 *   - 93 cells disagreed on their MAPID competitor count, by as many as 3.
 *   - The opening-hours layer disagreed on one cell, which is how this was found:
 *     `selftest-hours.mjs` compares the two passes on every cell at every radius and
 *     said so.
 *
 * A panel printing one number above a list built from the other is the failure. So
 * there is one constant now, it is the browser's, and the scripts import it rather
 * than declaring their own.
 *
 * `build-hexes.mjs` is the one script whose output nothing recounts — there are no OSM
 * competitor coordinates on disk at all, and the transit counts were measured to be
 * identical under both radii — so its numbers do not move when it is next rebuilt. It
 * uses this anyway, because the next thing added to it will not be so lucky.
 */

/** WGS84 equatorial radius, in metres. Must equal `EARTH_R` in `src/lib/utils/geo.ts`,
    and `selftest-property.mjs` asserts that it does. */
export const EARTH_R = 6378137;

const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. The same arithmetic as `utils/geo.ts`, character
    for character, so the two cannot round differently. */
export function haversine(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const x =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_R * Math.asin(Math.sqrt(x));
}

/**
 * The cheap box test every caller does before the trigonometry.
 *
 * 0.012° is about 1.3 km, comfortably wider than any radius the interface offers, and
 * it discards nearly every point in the city before a cosine is computed. Here so the
 * scripts and `domain/premises`, `domain/activity` and the rest agree on the prefilter
 * as well as on the distance.
 */
export const BOX_DEG = 0.012;

export const nearBox = (aLat, aLon, bLat, bLon) =>
	Math.abs(aLat - bLat) <= BOX_DEG && Math.abs(aLon - bLon) <= BOX_DEG;
