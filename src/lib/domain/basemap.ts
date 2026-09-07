import { VectorTile, classifyRings, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type {
	AreaGeometry,
	BasemapSource,
	BasemapTiles,
	LocalPoint,
	RoadKind,
	TransitCounts
} from '$lib/types';
import {
	clipPathToBox,
	clipPathToDisc,
	clipRingToBox,
	clipRingToDisc,
	fromLocalMetres,
	localMetres,
	type Box
} from '$lib/utils/geo';

/**
 * What the basemap holds around one point, read back off its own tiles.
 *
 * THE MODEL OF AN AREA IS THE MAP, CUT TO THE WALKING RANGE. The area card and the
 * full-screen model used to be one composed street standing for every cell, with only
 * the counts varying. What stands there now is the place itself: the building
 * footprints, streets, water and parks the basemap draws, at the heights it draws
 * them, cut to a disc of the walking radius around the point the range is measured
 * from. Whichever basemap the map is on is the one that is read, so the model is a
 * recreation of the map on screen and never of some other map.
 *
 * Everything in this file is a pure function over bytes and coordinates, which is why
 * it lives in the domain: `AppState` does the fetching and the caching, the way it
 * fetches the stops and the listings, and hands the bytes here. `map/basemap` is what
 * finds the source in the live style, and `scene/area` is what draws the result.
 *
 * Two rules hold, and they are the product's own rules applied to geometry:
 *
 * - **Nothing is invented.** A building stands at the height the tile carries. Where
 *   the tile carries none, the schema's own figure for an untagged building stands,
 *   which is the same one the map's 3D view would raise it to. A street the tile does
 *   not draw is not drawn.
 * - **Each tile is cut to its own square before the tiles are put together.** A tile
 *   carries a margin of its neighbours so a line can be drawn across the seam, and
 *   read whole that margin puts a second copy of every building along the seam on top
 *   of the first.
 */

/** A longitude and a latitude, in the point shape the clipping helpers take. */
type LonLat = LocalPoint;

/**
 * The zoom the tiles are read at. The open basemap's tiles stop at 14, where every
 * building is already present in full, so asking for more would only be answered by the
 * same tile again. A basemap that goes deeper is read at 15, where a tile is still a
 * little wider than a walking range, so an area is never more than four of them.
 */
const MODEL_ZOOM = 15;

/**
 * The height a building stands at when the tile carries none.
 *
 * OpenMapTiles writes 5 for an untagged building and the open basemap's tiles carry
 * that figure explicitly. MAPID's Indonesia tiles write 0 where nothing was tagged,
 * which is nearly everywhere, so on that basemap the whole city stands at this one
 * height: uniform, and therefore a decoration rather than a claim. A tagged tower
 * still stands at its own.
 */
const DEFAULT_HEIGHT = 5;

/** The road classes drawn, by the name the schema gives them. Anything else, a
    raceway, a ferry, an aerialway, is left off the model as it is left off a street. */
const ROAD_KINDS: Record<string, RoadKind> = {
	motorway: 'motorway',
	trunk: 'trunk',
	primary: 'primary',
	secondary: 'secondary',
	tertiary: 'tertiary',
	minor: 'minor',
	service: 'service',
	track: 'track',
	path: 'path',
	busway: 'busway',
	bus_guideway: 'busway',
	rail: 'rail',
	transit: 'transit'
};

/** How wide a waterway is drawn, by class, in metres. A stream the width of a river
    would put a river where the map shows a ditch. */
const WATERWAY_WIDTH: Record<string, number> = {
	river: 14,
	canal: 8,
	stream: 4,
	drain: 2,
	ditch: 2
};

/** Which land cover and land use reads as green on the model. */
const GREEN_COVER = new Set(['grass', 'wood', 'scrub', 'wetland', 'farmland']);
const GREEN_USE = new Set([
	'cemetery',
	'pitch',
	'playground',
	'garden',
	'stadium',
	'park',
	'recreation_ground',
	'golf_course',
	'zoo',
	'allotments'
]);

/** One tile, decoded and cut to its own square, in longitude and latitude. Kept per
    tile rather than per area so that neighbouring cells share the tiles they overlap. */
export interface DecodedTile {
	buildings: Array<{ rings: LonLat[][]; height: number; base: number }>;
	roads: Array<{ path: LonLat[]; kind: RoadKind; bridge: boolean }>;
	water: Array<{ rings: LonLat[][] }>;
	waterways: Array<{ path: LonLat[]; width: number }>;
	green: Array<{ rings: LonLat[][] }>;
}

export const EMPTY_TILE: DecodedTile = {
	buildings: [],
	roads: [],
	water: [],
	waterways: [],
	green: []
};

/** One of the transit corridors in `static/data/routes.json`, as the map draws it. */
export interface RouteLine {
	mode: keyof TransitCounts;
	lines: LonLat[][];
}

/* ── tile arithmetic ─────────────────────────────────────────────────────── */

const tile2lon = (x: number, z: number): number => (x / 2 ** z) * 360 - 180;
const tile2lat = (y: number, z: number): number => {
	const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
const lon2tile = (lon: number, z: number): number => ((lon + 180) / 360) * 2 ** z;
const lat2tile = (lat: number, z: number): number => {
	const r = (lat * Math.PI) / 180;
	return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

export interface TileAddress {
	z: number;
	x: number;
	y: number;
}

/** The zoom a source is read at: as deep as it goes, up to `MODEL_ZOOM`. */
export const modelZoom = (source: BasemapSource): number =>
	Math.max(source.minzoom, Math.min(source.maxzoom, MODEL_ZOOM));

/** The tiles that cover the disc of `radius` metres around `centre`. */
export function tilesCovering(
	centre: { lat: number; lon: number },
	radius: number,
	z: number
): TileAddress[] {
	const sw = fromLocalMetres({ x: -radius, y: -radius }, centre);
	const ne = fromLocalMetres({ x: radius, y: radius }, centre);
	const x0 = Math.floor(lon2tile(sw.lon, z));
	const x1 = Math.floor(lon2tile(ne.lon, z));
	const y0 = Math.floor(lat2tile(ne.lat, z));
	const y1 = Math.floor(lat2tile(sw.lat, z));
	const out: TileAddress[] = [];
	for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
	return out;
}

/** The URL one tile is fetched from, with the template's subdomains taken in turn. */
export function tileUrl(source: BasemapSource, at: TileAddress): string {
	const template = source.tiles[(at.x + at.y) % source.tiles.length];
	const y = source.scheme === 'tms' ? 2 ** at.z - 1 - at.y : at.y;
	return template
		.replace('{z}', String(at.z))
		.replace('{x}', String(at.x))
		.replace('{y}', String(y));
}

/** What one area's reading is keyed on: the point, the radius and the basemap. */
export const areaKeyOf = (
	centre: { lat: number; lon: number },
	radius: number,
	basemap: BasemapTiles
): string => `${centre.lat.toFixed(5)}|${centre.lon.toFixed(5)}|${radius}|${basemap.key}`;

/* ── decoding ────────────────────────────────────────────────────────────── */

const asNumber = (v: unknown, fallback: number): number =>
	typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;

/**
 * One tile's bytes into geometry, cut to the tile's own square and converted to
 * longitude and latitude.
 *
 * Only the layers the style names are read, by the names it gives them, so a style
 * that spells its road layer differently is read rather than ignored. A layer the
 * style does not draw is not looked for.
 */
export function decodeTile(bytes: ArrayBuffer, source: BasemapSource, at: TileAddress): DecodedTile {
	const tile = new VectorTile(new PbfReader(new Uint8Array(bytes)));
	const out: DecodedTile = { buildings: [], roads: [], water: [], waterways: [], green: [] };
	const names = source.layers;

	const layer = (name: string | undefined) => (name ? tile.layers[name] : undefined);
	const each = (name: string | undefined, take: (f: VectorTileFeature) => void) => {
		const l = layer(name);
		if (!l) return;
		for (let i = 0; i < l.length; i++) take(l.feature(i));
	};
	const box = (f: VectorTileFeature): Box => ({ minX: 0, minY: 0, maxX: f.extent, maxY: f.extent });
	const convert = (f: VectorTileFeature) => (p: LocalPoint): LonLat => ({
		x: tile2lon(at.x + p.x / f.extent, at.z),
		y: tile2lat(at.y + p.y / f.extent, at.z)
	});
	/** Every polygon of a feature, outer ring first, cut to the tile. Null where the
	    outer ring was cut away entirely. */
	const polygons = (f: VectorTileFeature): LonLat[][][] => {
		if (f.type !== 3) return [];
		const to = convert(f);
		const b = box(f);
		const result: LonLat[][][] = [];
		for (const poly of classifyRings(f.loadGeometry())) {
			const outer = clipRingToBox(poly[0], b);
			if (outer.length < 3) continue;
			const rings = [outer.map(to)];
			for (const hole of poly.slice(1)) {
				const cut = clipRingToBox(hole, b);
				if (cut.length >= 3) rings.push(cut.map(to));
			}
			result.push(rings);
		}
		return result;
	};
	const lines = (f: VectorTileFeature): LonLat[][] => {
		if (f.type !== 2) return [];
		const to = convert(f);
		const b = box(f);
		const result: LonLat[][] = [];
		for (const line of f.loadGeometry()) {
			for (const piece of clipPathToBox(line, b)) result.push(piece.map(to));
		}
		return result;
	};

	each(names.building, (f) => {
		const p = f.properties;
		// A building outline whose parts are drawn separately. Raised as well, it would
		// stand as one block over the very parts that describe it.
		if (p.hide_3d === true || p.hide_3d === 'true') return;
		const height = asNumber(p.render_height ?? p.height, DEFAULT_HEIGHT);
		const base = Math.min(height, asNumber(p.render_min_height ?? p.min_height, 0));
		for (const rings of polygons(f)) out.buildings.push({ rings, height, base });
	});

	each(names.transportation, (f) => {
		const p = f.properties;
		// A tunnel is under the street, and a street is what this model shows.
		if (p.brunnel === 'tunnel') return;
		const kind = ROAD_KINDS[String(p.class ?? '')];
		if (!kind) return;
		const bridge = p.brunnel === 'bridge';
		for (const path of lines(f)) out.roads.push({ path, kind, bridge });
	});

	each(names.water, (f) => {
		for (const rings of polygons(f)) out.water.push({ rings });
	});

	each(names.waterway, (f) => {
		const width = WATERWAY_WIDTH[String(f.properties.class ?? '')];
		if (!width) return;
		for (const path of lines(f)) out.waterways.push({ path, width });
	});

	each(names.park, (f) => {
		for (const rings of polygons(f)) out.green.push({ rings });
	});
	each(names.landcover, (f) => {
		if (!GREEN_COVER.has(String(f.properties.class ?? ''))) return;
		for (const rings of polygons(f)) out.green.push({ rings });
	});
	each(names.landuse, (f) => {
		if (!GREEN_USE.has(String(f.properties.class ?? ''))) return;
		for (const rings of polygons(f)) out.green.push({ rings });
	});

	return out;
}

/* ── the routes the map already draws ───────────────────────────────────── */

const MODES: ReadonlySet<string> = new Set(['mrt', 'krl', 'lrt', 'brt']);

/**
 * `static/data/routes.json`, as the model needs it.
 *
 * The map hands that file to MapLibre by URL and never reads it itself, so this is
 * the first time the app reads the corridors as coordinates. One feature per mode,
 * as `scripts/build-routes.mjs` writes them.
 */
export function parseRoutes(file: unknown): RouteLine[] {
	const fc = file as { features?: unknown[] } | null;
	const out: RouteLine[] = [];
	for (const raw of fc?.features ?? []) {
		const f = raw as {
			properties?: { mode?: unknown };
			geometry?: { type?: string; coordinates?: unknown };
		};
		const mode = String(f.properties?.mode ?? '');
		if (!MODES.has(mode)) continue;
		const g = f.geometry;
		const coords = g?.coordinates;
		const lines: LonLat[][] = [];
		const take = (line: unknown) => {
			if (!Array.isArray(line)) return;
			const path: LonLat[] = [];
			for (const pt of line) {
				if (!Array.isArray(pt) || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') continue;
				path.push({ x: pt[0], y: pt[1] });
			}
			if (path.length >= 2) lines.push(path);
		};
		if (g?.type === 'LineString') take(coords);
		else if (g?.type === 'MultiLineString' && Array.isArray(coords)) coords.forEach(take);
		out.push({ mode: mode as keyof TransitCounts, lines });
	}
	return out;
}

/* ── one area ────────────────────────────────────────────────────────────── */

/** A polygon's rings, cut to the disc. Null when its outer ring lies wholly outside.
    A hole that crosses the edge is dropped rather than cut, because cut along the
    same arc as the outer ring it would run along the outer's own edge. */
function cutRings(rings: LocalPoint[][], radius: number): LocalPoint[][] | null {
	const outer = clipRingToDisc(rings[0], radius);
	if (outer.length < 3) return null;
	const whole = outer === rings[0];
	const out = [outer];
	for (const hole of rings.slice(1)) {
		const cut = clipRingToDisc(hole, radius);
		if (cut.length >= 3 && (whole || cut === hole)) out.push(cut);
	}
	return out;
}

/** Whether a ring can possibly touch the disc: a cheap box test before the cut. */
function nearDisc(ring: LocalPoint[], radius: number): boolean {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of ring) {
		if (p.x < minX) minX = p.x;
		if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.y > maxY) maxY = p.y;
	}
	return maxX >= -radius && minX <= radius && maxY >= -radius && minY <= radius;
}

/**
 * The tiles around one point, put together and cut to the walking range.
 *
 * Everything comes out in metres from `centre`, x east and y north, which is the
 * shape the scene draws and the shape the marks the app already holds are converted
 * to beside it, through the very same `localMetres`.
 */
export function assembleArea(
	tiles: DecodedTile[],
	centre: { lat: number; lon: number },
	radius: number,
	routes: RouteLine[],
	key: string,
	zoom: number
): AreaGeometry {
	const to = (p: LonLat): LocalPoint => localMetres(p.y, p.x, centre);
	const geometry: AreaGeometry = {
		key,
		radius,
		centre,
		buildings: [],
		roads: [],
		water: [],
		waterways: [],
		green: [],
		routes: [],
		tiles: tiles.length,
		zoom
	};

	const polygon = (rings: LonLat[][]): LocalPoint[][] | null => {
		const local = rings.map((r) => r.map(to));
		if (!nearDisc(local[0], radius)) return null;
		return cutRings(local, radius);
	};

	for (const t of tiles) {
		for (const b of t.buildings) {
			const rings = polygon(b.rings);
			if (rings) geometry.buildings.push({ rings, height: b.height, base: b.base });
		}
		for (const r of t.roads) {
			for (const path of clipPathToDisc(r.path.map(to), radius)) {
				geometry.roads.push({ path, kind: r.kind, bridge: r.bridge });
			}
		}
		for (const w of t.water) {
			const rings = polygon(w.rings);
			if (rings) geometry.water.push({ rings });
		}
		for (const w of t.waterways) {
			for (const path of clipPathToDisc(w.path.map(to), radius)) {
				geometry.waterways.push({ path, width: w.width });
			}
		}
		for (const g of t.green) {
			const rings = polygon(g.rings);
			if (rings) geometry.green.push({ rings });
		}
	}

	for (const route of routes) {
		for (const line of route.lines) {
			for (const path of clipPathToDisc(line.map(to), radius)) {
				geometry.routes.push({ path, mode: route.mode });
			}
		}
	}

	return geometry;
}
