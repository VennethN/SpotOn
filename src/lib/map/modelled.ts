import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import {
	DEFAULT_HEIGHT,
	GREEN_COVER,
	GREEN_USE,
	ROAD_KINDS,
	ROAD_WIDTH,
	WATERWAY_WIDTH
} from '$lib/domain/basemap';
import type { BasemapSource, BasemapTiles } from '$lib/types';

/**
 * The basemap drawn as a model: the same tiles, in the area model's palette.
 *
 * The map has two ways of being looked at now, beside the flat-or-raised one. DRAWN is
 * the basemap as its publisher draws it, cartography, labels and all. MODELLED is the
 * same tiles drawn by MapLibre the way `scene/area` draws them: white masses raised to
 * the height the tile carries, streets at their real widths, water and green, and none
 * of the publisher's cartography. It is a view rather than a layer, for the reason the
 * raised view is: it changes how the same thing is looked at, not what is on the map.
 *
 * These layers are built off the very sources `readBasemapTiles` found, so the map's
 * model and the area's model come from one reading of one style, and a basemap the
 * area model can read is exactly the basemap this can draw. Every width and colour
 * here is the scene's own, read from the same tables, so the two cannot drift apart.
 */

export const MODELLED_PREFIX = 'modelled-';

interface Palette {
	ground: string;
	building: string;
	road: string;
	minor: string;
	path: string;
	busway: string;
	rail: string;
	water: string;
	green: string;
}

/**
 * The scene's greys in the light theme, and the same relationships taken down for the
 * dark one: the model on the card is lit by an hour and is the same in both themes, but
 * a white city under a dark interface would be the brightest thing on the screen.
 */
const PALETTE: Record<'light' | 'dark', Palette> = {
	light: {
		ground: '#d6d2cb',
		building: '#f1efea',
		road: '#b6b2ab',
		minor: '#c0bcb5',
		path: '#cfcbc4',
		busway: '#aca8a1',
		rail: '#8f8d88',
		water: '#b3c3cd',
		green: '#c4cfb7'
	},
	dark: {
		ground: '#1b1d21',
		building: '#3d4148',
		road: '#2a2d32',
		minor: '#30333a',
		path: '#373a41',
		busway: '#26292e',
		rail: '#4d5159',
		water: '#1f2b34',
		green: '#243029'
	}
};

/** Web Mercator metres per pixel at zoom 0 on the equator. Jakarta sits six degrees
    off it, which is a 0.6% difference not worth a latitude term. */
const MPP_Z0 = 156543.03;

/**
 * A width in metres as a pixel width that follows the zoom exactly.
 *
 * Base-2 exponential interpolation between zoom 0 and 24 is the projection's own
 * scaling, so a 15 m street is 15 m wide at every zoom rather than at two. The floor
 * keeps the lanes from vanishing zoomed out, where a whole kampung is one pixel.
 */
const metres = (m: ExpressionSpecification, floor = 0.5): ExpressionSpecification => [
	'interpolate',
	['exponential', 2],
	['zoom'],
	0,
	['max', floor, ['*', m, 1 / MPP_Z0]],
	24,
	['max', floor, ['*', m, 2 ** 24 / MPP_Z0]]
];

/* Filters written as expressions throughout, never in the legacy shape, so they can
   be composed: the two shapes cannot be mixed inside one `all`. */
const classIn = (values: Iterable<string>): ExpressionSpecification => [
	'in',
	['get', 'class'],
	['literal', [...values]]
];
const polygons: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'];
const lines: ExpressionSpecification = ['==', ['geometry-type'], 'LineString'];
const all = (...parts: ExpressionSpecification[]): ExpressionSpecification => ['all', ...parts];

/** A figure per class from a table, and nothing for a class not in it. The spread is
    what the style spec's tuple types cannot follow, hence the one cast in this file. */
const matchClass = (table: Iterable<readonly [string, number]>): ExpressionSpecification =>
	['match', ['get', 'class'], ...[...table].flat(), 0] as unknown as ExpressionSpecification;

/** The layers for one source, bottom to top, hidden until `applyRender` shows them. */
function layersFor(source: BasemapSource, index: number, p: Palette): LayerSpecification[] {
	const id = (name: string) => `${MODELLED_PREFIX}${index}-${name}`;
	const names = source.layers;
	const hidden = { visibility: 'none' as const };
	const out: LayerSpecification[] = [];

	if (names.park) {
		out.push({
			id: id('park'),
			type: 'fill',
			source: source.id,
			'source-layer': names.park,
			filter: polygons,
			layout: hidden,
			paint: { 'fill-color': p.green }
		});
	}
	if (names.landcover) {
		out.push({
			id: id('landcover'),
			type: 'fill',
			source: source.id,
			'source-layer': names.landcover,
			filter: all(polygons, classIn(GREEN_COVER)),
			layout: hidden,
			paint: { 'fill-color': p.green }
		});
	}
	if (names.landuse) {
		out.push({
			id: id('landuse'),
			type: 'fill',
			source: source.id,
			'source-layer': names.landuse,
			filter: all(polygons, classIn(GREEN_USE)),
			layout: hidden,
			paint: { 'fill-color': p.green }
		});
	}
	if (names.water) {
		out.push({
			id: id('water'),
			type: 'fill',
			source: source.id,
			'source-layer': names.water,
			filter: polygons,
			layout: hidden,
			paint: { 'fill-color': p.water }
		});
	}
	if (names.waterway) {
		const width = matchClass(Object.entries(WATERWAY_WIDTH));
		out.push({
			id: id('waterway'),
			type: 'line',
			source: source.id,
			'source-layer': names.waterway,
			filter: all(lines, classIn(Object.keys(WATERWAY_WIDTH))),
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': p.water, 'line-width': metres(width) }
		});
	}
	if (names.transportation) {
		// The width of each class, from the same table the scene lays its ribbons by.
		const width = matchClass(
			Object.entries(ROAD_KINDS).map(([cls, kind]) => [cls, ROAD_WIDTH[kind]] as const)
		);
		const colour: ExpressionSpecification = [
			'match',
			['get', 'class'],
			['rail', 'transit'],
			p.rail,
			['busway', 'bus_guideway'],
			p.busway,
			['path', 'track'],
			p.path,
			['service', 'minor'],
			p.minor,
			p.road
		];
		out.push({
			id: id('roads'),
			type: 'line',
			source: source.id,
			'source-layer': names.transportation,
			// A tunnel is under the street, and a street is what this shows.
			filter: all(lines, classIn(Object.keys(ROAD_KINDS)), ['!=', ['get', 'brunnel'], 'tunnel']),
			layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': colour, 'line-width': metres(width) }
		});
	}

	// The buildings, raised to the height the tile carries. Where it carries none, the
	// schema's own figure for an untagged building, the same one the area model stands
	// such a building at, so the two models agree about every roof.
	const height: ExpressionSpecification = [
		'to-number',
		['coalesce', ['get', 'render_height'], ['get', 'height'], 0]
	];
	out.push({
		id: id('buildings'),
		type: 'fill-extrusion',
		source: source.id,
		'source-layer': names.building,
		// An outline whose parts are drawn separately would stand as one block over them.
		filter: all(polygons, ['!=', ['get', 'hide_3d'], true]),
		layout: hidden,
		paint: {
			'fill-extrusion-color': p.building,
			'fill-extrusion-height': ['case', ['>', height, 0], height, DEFAULT_HEIGHT],
			'fill-extrusion-base': [
				'to-number',
				['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
			],
			'fill-extrusion-opacity': 1,
			'fill-extrusion-vertical-gradient': true
		}
	});
	return out;
}

/**
 * Every layer of the modelled rendition, bottom to top, for the basemap on screen.
 *
 * The ground comes first and is a whole-map fill: with the publisher's layers put
 * away, it is what stands where their land and sea were. The caller mounts the lot
 * under the app's own layers, so the catchments, the corridors and the marks stay
 * exactly where they are over either rendition.
 */
export function modelledLayers(basemap: BasemapTiles, theme: 'light' | 'dark'): LayerSpecification[] {
	const p = PALETTE[theme];
	const out: LayerSpecification[] = [
		{
			id: `${MODELLED_PREFIX}ground`,
			type: 'background',
			layout: { visibility: 'none' },
			paint: { 'background-color': p.ground }
		}
	];
	basemap.sources.forEach((source, i) => out.push(...layersFor(source, i, p)));
	return out;
}
