import type { FeatureCollection } from 'geojson';

const EARTH_R = 6378137;

/*
 * There used to be a `scatterPoints` here, which spread a cell's competitor COUNT
 * around its centre on a Fibonacci spiral: the right number of dots in invented
 * places. It is gone, and deliberately not replaced. The competitors are drawn from
 * their real MAPID coordinates now (`domain/competitors`), and a helper whose whole
 * job is to make up positions is not something to leave lying about in a codebase
 * that promises never to invent a figure.
 */

export const emptyFC = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/**
 * A closed ring at `radiusMeters` around a point, as [lon, lat] pairs.
 *
 * Drawn on the map to show the walking range a cell's transit nodes were captured
 * within — the same test `capturedStops` applies, made visible, so the answer to
 * "why those stations and not that one" is on screen rather than in a footnote.
 *
 * Flat-earth offsets: at 800 m the error is far under a pixel at any zoom this map
 * reaches.
 */
export function ringCoords(
	lon: number,
	lat: number,
	radiusMeters: number,
	steps = 96
): [number, number][] {
	const latRad = (lat * Math.PI) / 180;
	const dLat = ((radiusMeters / EARTH_R) * 180) / Math.PI;
	const dLon = ((radiusMeters / (EARTH_R * Math.cos(latRad))) * 180) / Math.PI;
	const out: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		out.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
	}
	return out;
}

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
