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

/**
 * The grid's own extent, padded by one walking radius.
 *
 * WHY THE PAD IS NOT OPTIONAL
 *
 * A fetch bounded by the grid's raw extent under-counts the cells on its edge, because
 * a cell's catchment reaches a full walking radius past its own centre. Three cells sit
 * closer to the edge than that — all three at Soekarno-Hatta, the nearest 32 m from it
 * — so their 800 m catchments ran up to 768 m into ground nobody had fetched.
 *
 * Read from the grid rather than typed in, so it follows the grid if that moves, and
 * shared so the two fetches cannot pad differently and then disagree about which
 * records exist. `fetch-missions.mjs` had this rule first and it was right; this is the
 * same function, in the one place both callers can reach.
 *
 * Returned as `[w, s, e, n]`. Overpass wants `s,w,n,e`, which is what `overpassBox`
 * below is for — getting that order wrong silently queries the wrong rectangle.
 */
/** How much more than one radius to pad by, so the guarantee survives the flat-earth
    arithmetic above. `selftest-hours.mjs` checks no cell reaches past the result. */
const PAD_MARGIN = 1.01;

export function gridExtent(grid) {
	const cells = grid?.hexes ?? [];
	if (!cells.length) throw new Error('the grid holds no cells');
	const radius = grid.meta?.walkRadius ?? 800;
	const lats = cells.map((c) => c.lat);
	const lons = cells.map((c) => c.lon);
	// A degree of latitude is ~111 km everywhere; a degree of longitude shrinks with the
	// cosine of it. Jakarta is close enough to the equator that the difference is small,
	// and it is applied anyway because getting it wrong is free to avoid.
	const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
	// 110_574 m is the SHORTEST a degree of latitude gets (at the equator); a degree of
	// longitude is that equatorial figure times the cosine. Using the larger 111_320 for
	// latitude, as the first version did, makes the pad about 0.7% SHORT — five metres
	// out of eight hundred — and a pad that is short by any amount is not a guarantee.
	// The extra 1% on top is the margin that turns "about a radius" into "at least one".
	const padLat = (radius * PAD_MARGIN) / 110_574;
	const padLon = (radius * PAD_MARGIN) / (111_320 * Math.cos((mid * Math.PI) / 180));
	return {
		box: [
			Math.min(...lons) - padLon,
			Math.min(...lats) - padLat,
			Math.max(...lons) + padLon,
			Math.max(...lats) + padLat
		],
		radius,
		cells: cells.length
	};
}

/** `[w, s, e, n]` → the `s,w,n,e` string Overpass wants. */
export const overpassBox = ([w, s, e, n]) => `${s},${w},${n},${e}`;
