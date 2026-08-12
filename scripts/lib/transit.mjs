/**
 * The transit nodes, defined once.
 *
 * `build-hexes.mjs` counts these per cell to work out transit access; `build-stops.mjs`
 * writes them out so the app can name and draw the stations a cell captures. Those two
 * MUST agree. If the app drew stops from its own query, a cell could report "2 MRT" in
 * the panel while the map showed three markers next to it — and the figure and the
 * picture would each be defensible on their own, which is the worst kind of wrong.
 *
 * Sharing the QUERY STRING matters as much as sharing the classifier: `overpass()`
 * caches by the exact text of the query, so an identical string is answered from the
 * same cached response rather than re-asked, and the two scripts cannot end up built
 * from OSM as it stood at two different moments.
 */

export const BBOX = '-6.42,106.65,-6.05,107.05';

export const TRANSIT_QUERY = `[out:json][timeout:180];(
node["station"="subway"](${BBOX});
node["railway"="station"](${BBOX});
node["railway"="halt"](${BBOX});
node["station"="light_rail"](${BBOX});
node["highway"="bus_stop"]["operator"~"TransJakarta",i](${BBOX});
node["public_transport"="platform"]["operator"~"TransJakarta",i](${BBOX});
);out body;`;

/** Which mode a node belongs to, or null if it is not one of the four. */
export function transitMode(tags = {}) {
	const op = (tags.operator ?? '') + ' ' + (tags.network ?? '');
	if (tags.station === 'subway' || tags.subway === 'yes') return 'mrt';
	if (tags.station === 'light_rail' || tags.light_rail === 'yes') return 'lrt';
	if (tags.railway === 'station' || tags.railway === 'halt') return 'krl';
	if (/transjakarta/i.test(op)) return 'brt';
	return null;
}

/**
 * An Overpass answer → the stop list both scripts work from.
 *
 * Opposite-direction stops are often two separate nodes ±30 m apart; a coarse dedup
 * keeps one stopping place from being counted twice.
 */
export function readStops(raw) {
	const stops = [];
	const seen = new Set();
	for (const el of raw.elements) {
		if (el.type !== 'node' || el.lat == null) continue;
		const mode = transitMode(el.tags);
		if (!mode) continue;
		const key = `${mode}|${el.lat.toFixed(4)}|${el.lon.toFixed(4)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		stops.push({ lat: el.lat, lon: el.lon, mode, name: el.tags?.name ?? null });
	}
	return stops;
}
