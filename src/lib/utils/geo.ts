import type { Feature, FeatureCollection, Point } from 'geojson';

const EARTH_R = 6378137;

/**
 * Scatters competitor points inside a catchment using a Fibonacci spiral.
 *
 * The count is real (computed from OSM), the individual positions are
 * illustrative — an even spread was chosen so no pattern looks meaningful when it
 * is not.
 */
export function scatterPoints(
	lon: number,
	lat: number,
	radiusMeters: number,
	count: number,
	seedProps: Record<string, unknown> = {}
): Feature<Point>[] {
	const out: Feature<Point>[] = [];
	const n = Math.min(60, count);
	if (n <= 0) return out;
	const latRad = (lat * Math.PI) / 180;
	for (let i = 0; i < n; i++) {
		const angle = i * 2.399963; // the golden angle
		const r = radiusMeters * Math.sqrt((i + 0.5) / n) * 0.92;
		const dLat = ((r * Math.sin(angle)) / EARTH_R) * (180 / Math.PI);
		const dLon = ((r * Math.cos(angle)) / (EARTH_R * Math.cos(latRad))) * (180 / Math.PI);
		out.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [lon + dLon, lat + dLat] },
			properties: { ...seedProps }
		});
	}
	return out;
}

export const emptyFC = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Great-circle distance in metres. */
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
	const rad = (d: number) => (d * Math.PI) / 180;
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const x =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_R * Math.asin(Math.sqrt(x));
}

/** Bounding box of all the points, with a little breathing room. */
export function boundsOf(points: Array<{ lon: number; lat: number }>, padDeg = 0.012) {
	const lons = points.map((p) => p.lon);
	const lats = points.map((p) => p.lat);
	return [
		[Math.min(...lons) - padDeg, Math.min(...lats) - padDeg],
		[Math.max(...lons) + padDeg, Math.max(...lats) + padDeg]
	] as [[number, number], [number, number]];
}
