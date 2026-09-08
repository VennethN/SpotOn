import type { FeatureCollection } from 'geojson';
import type { LocalPoint } from '$lib/types';

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

/* ── metres about a point ────────────────────────────────────────────────────
   The model of an area is drawn in metres from the point its walking range is
   measured from, so the scene never handles a longitude and one shape serves every
   radius. Equirectangular about that point: at 800 m the error against the sphere is
   well under a metre, which is the same approximation `ringCoords` draws the range
   with, so the disc on the map and the disc under the model are one figure. */

/** A point as metres east (`x`) and north (`y`) of `centre`. */
export function localMetres(
	lat: number,
	lon: number,
	centre: { lat: number; lon: number }
): LocalPoint {
	const k = Math.PI / 180;
	return {
		x: (lon - centre.lon) * k * EARTH_R * Math.cos(centre.lat * k),
		y: (lat - centre.lat) * k * EARTH_R
	};
}

/** The inverse of `localMetres`: which longitude and latitude a point in metres is. */
export function fromLocalMetres(
	p: LocalPoint,
	centre: { lat: number; lon: number }
): { lat: number; lon: number } {
	const k = Math.PI / 180;
	return {
		lon: centre.lon + p.x / (k * EARTH_R * Math.cos(centre.lat * k)),
		lat: centre.lat + p.y / (k * EARTH_R)
	};
}

/** Twice the signed area of a ring: positive when it runs counter-clockwise with x
    east and y north, which is the orientation the sides of a building are built from. */
export function ringArea(ring: LocalPoint[]): number {
	let a = 0;
	for (let i = 0, n = ring.length; i < n; i++) {
		const p = ring[i];
		const q = ring[(i + 1) % n];
		a += p.x * q.y - q.x * p.y;
	}
	return a;
}

/** Even-odd point-in-ring, for the one case a clip has nothing to cut and has to
    decide whether the whole disc lies inside the shape or outside it. */
export function pointInRing(p: LocalPoint, ring: LocalPoint[]): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i];
		const b = ring[j];
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/* ── cutting to the walking range ────────────────────────────────────────────
   Everything read off the basemap is cut to the disc of the walking radius, so the
   model is the map inside the ring and nothing past it. A polygon is cut with
   Sutherland–Hodgman against the disc, which works because a disc is convex: where
   the shape leaves the disc and comes back, the boundary follows the ARC of the
   circle between the two points rather than a chord across the middle. A chord was
   the first attempt, and on a river covering half the disc it cut the river in half.

   WHICH WAY ROUND THE ARC GOES is the whole difficulty, and the ring's own
   orientation does not settle it. A small building bulging out over the edge sweeps
   around the centre one way or the other depending on where it stands, whatever way
   its own ring turns, and taking the direction from the ring sent one house in
   Menteng the long way round the circle: a disc-sized roof at five metres, with the
   whole street network hidden underneath it. So the direction is read from the path
   itself: the signed angle the shape swept around the centre while it was outside,
   which the arc then repeats. */

/** How finely an arc of the disc's edge is drawn when a cut shape has to follow it. */
const ARC_STEPS = 64;

/**
 * Where a segment crosses the circle of radius `r`, as parameters along it.
 *
 * Both roots, ascending, or nothing when the line misses. The caller decides which
 * of them fall inside the segment.
 */
function circleRoots(p: LocalPoint, q: LocalPoint, r: number): [number, number] | null {
	const dx = q.x - p.x;
	const dy = q.y - p.y;
	const a = dx * dx + dy * dy;
	if (a === 0) return null;
	const b = 2 * (p.x * dx + p.y * dy);
	const c = p.x * p.x + p.y * p.y - r * r;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

const along = (p: LocalPoint, q: LocalPoint, t: number): LocalPoint => ({
	x: p.x + (q.x - p.x) * t,
	y: p.y + (q.y - p.y) * t
});

const angleOf = (p: LocalPoint): number => Math.atan2(p.y, p.x);

/** The signed turn from one bearing to another, in (-π, π]. */
function turn(from: number, to: number): number {
	let d = to - from;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d <= -Math.PI) d += Math.PI * 2;
	return d;
}

/** The disc itself as a ring, in the direction asked for. */
export function discRing(r: number, counterClockwise = true, steps = ARC_STEPS): LocalPoint[] {
	const out: LocalPoint[] = [];
	for (let i = 0; i < steps; i++) {
		const a = ((counterClockwise ? i : -i) / steps) * Math.PI * 2;
		out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
	}
	return out;
}

/** Consecutive repeats and a closing repeat of the first point, dropped. */
function tidyRing(ring: LocalPoint[]): LocalPoint[] {
	const out: LocalPoint[] = [];
	for (const p of ring) {
		const last = out[out.length - 1];
		if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
		out.push(p);
	}
	while (out.length > 1) {
		const a = out[0];
		const b = out[out.length - 1];
		if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) out.pop();
		else break;
	}
	return out.length >= 3 ? out : [];
}

/**
 * A ring cut to the disc of radius `r` about the origin.
 *
 * Empty when the ring lies wholly outside the disc. The whole disc when the ring
 * surrounds it, which is what a lake or a park larger than the walking range does.
 */
export function clipRingToDisc(ring: LocalPoint[], r: number): LocalPoint[] {
	const n = ring.length;
	if (n < 3) return [];
	const r2 = r * r * (1 + 1e-9);
	const inside = (p: LocalPoint) => p.x * p.x + p.y * p.y <= r2;
	if (ring.every(inside)) return ring;

	const out: LocalPoint[] = [];
	/* The last point at which the ring left the disc, and how far round the centre
	   it has swept since, so the arc back in can follow the same way round. */
	let pendingExit: LocalPoint | null = null;
	let sweep = 0;
	let lastBearing: number | null = inside(ring[0]) ? null : angleOf(ring[0]);
	/* A ring that starts outside has its first entry before any exit: that arc is
	   drawn last, once the sweep from the final exit round to the start is known. */
	let firstEntry: LocalPoint | null = null;
	let firstSweep = 0;

	/** The path went on to `p`, outside the disc. */
	const outsideTo = (p: LocalPoint) => {
		const bearing = angleOf(p);
		if (lastBearing !== null) sweep += turn(lastBearing, bearing);
		lastBearing = bearing;
	};
	/** The points of the disc's edge from one to the other, the way the path swept. */
	const arc = (from: LocalPoint, to: LocalPoint, swept: number) => {
		const a0 = angleOf(from);
		let a1 = angleOf(to);
		const step = (Math.PI * 2) / ARC_STEPS;
		if (swept >= 0) {
			while (a1 <= a0) a1 += Math.PI * 2;
			for (let a = a0 + step; a < a1 - 1e-9; a += step) out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
		} else {
			while (a1 >= a0) a1 -= Math.PI * 2;
			for (let a = a0 - step; a > a1 + 1e-9; a -= step) out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
		}
	};
	const leave = (at: LocalPoint) => {
		out.push(at);
		pendingExit = at;
		sweep = 0;
		lastBearing = angleOf(at);
	};
	const enter = (at: LocalPoint) => {
		outsideTo(at);
		if (pendingExit) arc(pendingExit, at, sweep);
		else {
			firstEntry = at;
			firstSweep = sweep;
		}
		pendingExit = null;
		lastBearing = null;
		out.push(at);
	};

	for (let i = 0; i < n; i++) {
		const p = ring[i];
		const q = ring[(i + 1) % n];
		const pin = inside(p);
		const qin = inside(q);
		if (pin && qin) {
			out.push(q);
			continue;
		}
		const roots = circleRoots(p, q, r);
		if (pin) {
			// Leaving: the far root is where the segment crosses out.
			leave(along(p, q, roots ? Math.max(0, Math.min(1, roots[1])) : 1));
			outsideTo(q);
		} else if (qin) {
			// Arriving: the near root is where it crosses in.
			enter(along(p, q, roots ? Math.max(0, Math.min(1, roots[0])) : 0));
			out.push(q);
		} else if (roots && roots[0] > 0 && roots[0] < 1 && roots[1] > 0 && roots[1] < 1) {
			// Through and out again without a vertex inside: a chord of the disc.
			enter(along(p, q, roots[0]));
			leave(along(p, q, roots[1]));
			outsideTo(q);
		} else {
			outsideTo(q);
		}
	}
	if (pendingExit && firstEntry) arc(pendingExit, firstEntry, sweep + firstSweep);

	if (!out.length) {
		return pointInRing({ x: 0, y: 0 }, ring) ? discRing(r, ringArea(ring) >= 0) : [];
	}
	return tidyRing(out);
}

/** A path cut to the disc: the pieces of it that lie inside, in order. */
export function clipPathToDisc(path: LocalPoint[], r: number): LocalPoint[][] {
	const r2 = r * r * (1 + 1e-9);
	const inside = (p: LocalPoint) => p.x * p.x + p.y * p.y <= r2;
	const pieces: LocalPoint[][] = [];
	let piece: LocalPoint[] = [];
	const close = () => {
		if (piece.length >= 2) pieces.push(piece);
		piece = [];
	};
	for (let i = 0; i + 1 < path.length; i++) {
		const p = path[i];
		const q = path[i + 1];
		const pin = inside(p);
		const qin = inside(q);
		if (pin && qin) {
			if (!piece.length) piece.push(p);
			piece.push(q);
			continue;
		}
		const roots = circleRoots(p, q, r);
		if (pin) {
			if (!piece.length) piece.push(p);
			piece.push(along(p, q, roots ? Math.max(0, Math.min(1, roots[1])) : 1));
			close();
		} else if (qin) {
			close();
			piece.push(along(p, q, roots ? Math.max(0, Math.min(1, roots[0])) : 0), q);
		} else if (roots && roots[0] > 0 && roots[0] < 1 && roots[1] > 0 && roots[1] < 1) {
			close();
			piece.push(along(p, q, roots[0]), along(p, q, roots[1]));
			close();
		} else {
			close();
		}
	}
	close();
	return pieces;
}

/* ── cutting to a tile ───────────────────────────────────────────────────────
   A vector tile carries a margin of the next tile's geometry so that a line can be
   drawn across the seam. Read whole, that margin would put a second copy of every
   building along the seam on top of the first, so each tile's features are cut back
   to the tile's own square before the tiles are put together. */

export interface Box {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** A ring cut to an axis-aligned box, one edge at a time. */
export function clipRingToBox(ring: LocalPoint[], box: Box): LocalPoint[] {
	type Edge = { inside: (p: LocalPoint) => boolean; cross: (p: LocalPoint, q: LocalPoint) => LocalPoint };
	const edges: Edge[] = [
		{ inside: (p) => p.x >= box.minX, cross: (p, q) => along(p, q, (box.minX - p.x) / (q.x - p.x)) },
		{ inside: (p) => p.x <= box.maxX, cross: (p, q) => along(p, q, (box.maxX - p.x) / (q.x - p.x)) },
		{ inside: (p) => p.y >= box.minY, cross: (p, q) => along(p, q, (box.minY - p.y) / (q.y - p.y)) },
		{ inside: (p) => p.y <= box.maxY, cross: (p, q) => along(p, q, (box.maxY - p.y) / (q.y - p.y)) }
	];
	let out = ring;
	for (const e of edges) {
		if (out.length < 3) return [];
		if (out.every(e.inside)) continue;
		const next: LocalPoint[] = [];
		for (let i = 0, n = out.length; i < n; i++) {
			const p = out[i];
			const q = out[(i + 1) % n];
			const pin = e.inside(p);
			const qin = e.inside(q);
			if (pin && qin) next.push(q);
			else if (pin) next.push(e.cross(p, q));
			else if (qin) next.push(e.cross(p, q), q);
		}
		out = next;
	}
	return tidyRing(out);
}

/** A path cut to an axis-aligned box: the pieces inside, in order. */
export function clipPathToBox(path: LocalPoint[], box: Box): LocalPoint[][] {
	const pieces: LocalPoint[][] = [];
	let piece: LocalPoint[] = [];
	const close = () => {
		if (piece.length >= 2) pieces.push(piece);
		piece = [];
	};
	for (let i = 0; i + 1 < path.length; i++) {
		const p = path[i];
		const q = path[i + 1];
		// Liang–Barsky: the parameter interval of the segment that lies inside.
		let t0 = 0;
		let t1 = 1;
		const dx = q.x - p.x;
		const dy = q.y - p.y;
		let ok = true;
		for (const [num, den] of [
			[p.x - box.minX, -dx],
			[box.maxX - p.x, dx],
			[p.y - box.minY, -dy],
			[box.maxY - p.y, dy]
		]) {
			if (den === 0) {
				if (num < 0) ok = false;
				continue;
			}
			const t = num / den;
			if (den < 0) t0 = Math.max(t0, t);
			else t1 = Math.min(t1, t);
		}
		if (!ok || t0 > t1) {
			close();
			continue;
		}
		const a = t0 > 0 ? along(p, q, t0) : p;
		const b = t1 < 1 ? along(p, q, t1) : q;
		if (t0 > 0 || !piece.length) {
			close();
			piece.push(a);
		}
		piece.push(b);
		if (t1 < 1) close();
	}
	close();
	return pieces;
}
