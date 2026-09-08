import type { Hex } from '$lib/types';

/**
 * Where each cell IS, and how to take a sample that keeps the grid's shape.
 *
 * Both were private to the landing page's load until the account page needed the same
 * picture. Two copies of a projection is two pages drawing Jakarta slightly differently,
 * and the one thing a reader would notice is the one thing neither page could explain.
 */

export interface GridPoint {
	x: number;
	y: number;
}

export interface GridPlan {
	pts: GridPoint[];
	/** The tallest y in the field, so a caller can size its viewBox from the data. */
	height: number;
	/** Centre to vertex. A pointy-top hexagon's width is `sqrt(3)` times this. */
	radius: number;
}

/**
 * Every cell WHERE IT ACTUALLY IS, in the order it was handed over.
 *
 * What this replaced on the landing page was one hexagon per cell laid out in grid
 * order, 31 to a row. Grid order is by transit access, so the picture had the shape of a
 * rectangle and its holes fell wherever the sort happened to put them. It looked exactly
 * like a map of Jakarta and was a map of nothing.
 *
 * These are the real centres, in a plain equirectangular projection with the longitudes
 * scaled by the cosine of the middle latitude so the city is not stretched sideways. The
 * radius is derived from the closest pair of cells rather than typed in, so the hexagons
 * tile at whatever resolution the grid is rebuilt at.
 *
 * The order is preserved on purpose: a caller attaches its own value per cell by index,
 * so what is drawn can differ between pages while WHERE it is drawn cannot.
 */
export function projectGrid(hexes: Hex[]): GridPlan {
	const lats = hexes.map((h) => h.lat);
	const lons = hexes.map((h) => h.lon);
	const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
	const kx = Math.cos((latMid * Math.PI) / 180);
	const x0 = Math.min(...lons) * kx;
	const y0 = Math.max(...lats);
	const raw = hexes.map((h) => ({ x: h.lon * kx - x0, y: y0 - h.lat }));

	// Scaled so the field is 1000 units wide, whatever the city's extent.
	const w = Math.max(...raw.map((p) => p.x)) || 1;
	const k = 1000 / w;
	const pts = raw.map((p) => ({
		x: Math.round(p.x * k * 10) / 10,
		y: Math.round(p.y * k * 10) / 10
	}));

	// The nearest neighbour of a handful of cells, which is one cell pitch. Sampled
	// rather than computed for all 562, because this is a drawing size and not a figure
	// anybody reads.
	let pitch = Infinity;
	for (let i = 0; i < pts.length; i += 17) {
		for (const q of pts) {
			if (q === pts[i]) continue;
			const d = Math.hypot(q.x - pts[i].x, q.y - pts[i].y);
			if (d > 0.01 && d < pitch) pitch = d;
		}
	}

	return {
		pts,
		height: Math.round(Math.max(...pts.map((p) => p.y)) * 10) / 10,
		radius: Math.round((pitch / Math.sqrt(3)) * 100) / 100
	};
}

/**
 * `n` values taken evenly across a ranking, best first.
 *
 * Evenly rather than the top `n`: the point of a sampled field is the SPREAD of the
 * grid, and a sample of its best cells would show a plateau and call it Jakarta.
 */
export function sampleEven(values: Array<number | null>, n: number): Array<number | null> {
	const sorted = [...values].sort((a, b) => (b ?? -1) - (a ?? -1));
	if (sorted.length <= n) return sorted;
	return Array.from(
		{ length: n },
		(_, i) => sorted[Math.round((i * (sorted.length - 1)) / (n - 1))]
	);
}

/**
 * The trade standing around each cell, as a fraction of the busiest cell on the grid.
 *
 * The one measure this product can paint WITHOUT a business type having been named,
 * which is why the map opens on it and why the account page draws it: nobody choosing a
 * plan has said a word about coffee, and colouring a field for one would be a claim
 * nobody asked for.
 *
 * Read from the catalogue's column, and null where the catalogue has never reached that
 * cell. A null is not a zero, and it is drawn as an absence rather than as a quiet
 * street.
 */
export function tradeShare(hexes: Hex[]): Array<number | null> {
	const counted = hexes.map((h) => h.dens.mapid);
	const top = Math.max(...counted.map((v) => v ?? 0));
	if (top <= 0) return counted.map(() => null);
	return counted.map((v) => (v === null ? null : Math.min(1, v / top)));
}
