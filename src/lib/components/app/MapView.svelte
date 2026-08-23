<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		ExpressionSpecification,
		GeoJSONSource,
		Map as MapLibreMap,
		MapLayerMouseEvent,
		Marker,
		StyleSpecification
	} from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// The worker is bundled separately by Vite; left for maplibre to load on its own,
	// the dev server touches the file and the worker dies without a sound.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { env } from '$env/dynamic/public';
	import { boundsOf, emptyFC, ringCoords } from '$lib/utils/geo';
	import { railTotal, stopTotal } from '$lib/domain/transit';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import { basemapStyle } from '$lib/map/basemap';
	import { hatchImage, rivalImage, unitImage } from '$lib/map/icons';
	import {
		catchmentFC,
		labelText,
		poiFC,
		poiLinksFC,
		fieldFC,
		propertyFC,
		reachFC,
		stopLinksFC,
		stopsFC,
		unitsFC,
		type MapCtx
	} from '$lib/map/sources';
	import { pct, rampIndex, rampVar } from '$lib/utils/format';
	import { cellName } from '$lib/domain/scoring';
	import { base } from '$app/paths';
	import { getAppState } from '$lib/state/app.svelte';
	import type { ScoredUnit } from '$lib/domain/units';
	import { categoryNames } from '$lib/domain/narrate';
	import { copy } from '$lib/state/lang.svelte';
	import type { HexBase, ScoredHex } from '$lib/types';
	import type { FeatureCollection } from 'geojson';

	const app = getAppState();
	const c = $derived(copy());

	let container: HTMLDivElement;
	let map = $state<MapLibreMap | null>(null);
	let ready = $state(false);
	let gl: typeof import('maplibre-gl') | null = null;
	let markers = new Map<string, { marker: Marker; el: HTMLButtonElement; rank: number }>();
	/** Price tags on the units the selected cell captures. Kept apart from `markers`
	    because they come and go with the selection rather than with the ranking. */
	let unitTags = new Map<string, { marker: Marker; el: HTMLDivElement }>();
	let labelFrame = 0;

	/**
	 * Is the heatmap actually being drawn right now?
	 *
	 * Both halves are needed. `layers.score` is the user's intent; `app.ready` is
	 * whether the category's columns have arrived. Between the button press and the
	 * response there is nothing to colour with, and colouring from nothing would
	 * flash every cell through "no score" on its way to a real one.
	 */
	const heat = $derived(app.layers.score && app.ready);

	/** Transit lines, drawn densest to sparsest so the few rail lines are not buried
	    under the tightly packed bus corridors. */
	const ROUTE_MODES = [
		{ key: 'brt', varName: '--route-brt', thin: 0.8, thick: 2.4, opacity: 0.5 },
		{ key: 'krl', varName: '--route-krl', thin: 1.3, thick: 3.4, opacity: 0.8 },
		{ key: 'lrt', varName: '--route-lrt', thin: 1.6, thick: 4, opacity: 0.9 },
		{ key: 'mrt', varName: '--route-mrt', thin: 2, thick: 5, opacity: 0.95 }
	] as const;
	let appliedTheme: 'light' | 'dark' | null = null;

	/**
	 * The name labels, in priority order.
	 *
	 * Every node that has a name gets one. 1,104 of the grid's 1,105 transit nodes
	 * carry one, and a cell can capture 33 of them, so "label everything" and "label
	 * nothing" are both unreadable. What makes it work is that MapLibre's collision
	 * index is one shared, screen-space index across every symbol layer on the map:
	 * a label is drawn only where nothing has already taken the room. That is what
	 * holds at any zoom and any pixel ratio, because it is measured in the pixels the
	 * reader actually has rather than in map units.
	 *
	 * What the index cannot decide is which label should win when two want the same
	 * pixels, and that is a judgement about the product, not about geometry:
	 *
	 *   1. RAIL STATIONS. Twenty MRT and 76 KRL nodes in the whole city. A rail
	 *      station is a landmark the reader navigates by, and naming it orients them
	 *      on the whole map, not just inside the cell.
	 *   2. COMPETITORS. The reason the panel exists. "Three coffee shops nearby" and
	 *      "Kopi Kenangan, Fore, Janji Jiwa" are different facts, and the second is
	 *      the one somebody deciding where to open can argue with.
	 *   3. TRANSJAKARTA STOPS. 976 of them, and a name like "Pertigaan Sagu
	 *      Kebagusan" tells the reader far less than the fact that a stop is there at
	 *      all — which the dot already says.
	 *
	 * The array below IS that ranking, and it is listed WORST FIRST because MapLibre
	 * places symbol layers from the top of the style downwards: the layer added LAST
	 * claims its pixels first. Listed in the reading order instead, which is what this
	 * started as, the effect is precisely inverted — measured at zoom 13 on the
	 * densest cell in the grid, both MRT stations lost their names to coffee shops.
	 */
	const LABEL_LAYERS = [
		{
			id: 'stop-labels-bus',
			source: 'stops',
			filter: ['all', ['!', ['get', 'rail']], ['has', 'label']] as ExpressionSpecification,
			// Last to be named and last to appear. A cell can capture 33 halte, so this
			// waits until there is room to tell them apart rather than merely room to fit
			// them.
			minzoom: 15,
			size: 10,
			offset: 0.7,
			colour: '--label-2'
		},
		{
			id: 'poi-labels',
			source: 'poi',
			filter: ['has', 'label'] as ExpressionSpecification,
			// Not before the cell is big enough to read inside. An 800 m catchment is
			// 1.6 km across, which is 84 px at zoom 13 and 340 px at 15 — and the first
			// version of this named competitors from 13, where a dozen labels packed a
			// space the size of a postage stamp. Not overlapping and legible are not the
			// same test, and the collision index only enforces the first.
			//
			// So the reader gets the cluster at city scale and the names on the way in,
			// which is also the order the questions come in: where are they, then who.
			minzoom: 14.5,
			size: 10.5,
			// Clear of the square mark rather than of a round dot, so the gap looks the
			// same on both.
			offset: 0.8,
			colour: '--critical'
		},
		{
			id: 'stop-labels-rail',
			source: 'stops',
			filter: ['all', ['get', 'rail'], ['has', 'label']] as ExpressionSpecification,
			// Named from the moment the cell is worth looking at: there are never many,
			// and they are the labels that orient the reader.
			minzoom: 11,
			size: 11.5,
			offset: 0.9,
			colour: '--label-1'
		}
	] as const;

	/** The tooltip follows the pointer; its position is written straight to the DOM so no frame lags. */
	let tipEl: HTMLDivElement;
	/**
	 * What the pointer is over, in the terms the reader chose to read the map in.
	 *
	 * A union rather than one shape with optional halves, because the two pivots hover
	 * different KINDS of thing: a catchment is 800 m of city, a unit is one doorway on the
	 * market, and almost nothing worth printing about one is a fact about the other. This
	 * held a catchment and only a catchment for as long as the tooltip could describe only
	 * that, which is how "by place" came to answer every hover with the hexagon underneath.
	 *
	 * For a cell the name comes from the base grid and the figures from the scored row, so
	 * the tooltip still names one before any category has loaded, rather than the map going
	 * quiet under the pointer until the heatmap is switched on.
	 */
	type Hovered =
		| { kind: 'cell'; name: string; row: ScoredHex | null }
		| { kind: 'unit'; unit: ScoredUnit };
	let hovered = $state<Hovered | null>(null);

	/**
	 * The hovered place, as the tooltip has to read it: its rung on the list the reader is
	 * looking at, and the figure that put it there.
	 *
	 * The same ladder the dots are coloured from, so the figure printed beside a dot wears
	 * the dot's own shade. Absent means the sort could not rank this unit — the dot is grey
	 * for it, and the tooltip says so rather than printing a figure it does not have.
	 */
	const hoveredRank = $derived(
		hovered?.kind === 'unit' ? (app.unitRanks.get(hovered.unit.id) ?? null) : null
	);

	/**
	 * The rest of what the listing itself says, as one line.
	 *
	 * Built rather than written into the markup so an empty one can be left out whole. Half
	 * the catalogue publishes no floor count and a good many carry no land area, and the
	 * separators between three absent figures are still three separators: a blank rule
	 * across the tooltip, which reads as a line that failed to load.
	 *
	 * The asking price steps aside when the list is already sorted by it, exactly as the
	 * rows in the panel do. One figure twice makes the reader work out which is which.
	 */
	const hoveredTraits = $derived.by(() => {
		if (hovered?.kind !== 'unit') return '';
		const l = hovered.unit.listing;
		const out: string[] = [];
		if (l.price !== null && app.unitSort !== 'harga') out.push(c.units.value('harga', l.price));
		if (l.land !== null) out.push(c.property.unitLand(l.land));
		if (l.floors !== null) out.push(c.property.unitFloors(l.floors));
		return out.join(' · ');
	});

	const cssVar = (name: string) =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim();

	/**
	 * What the source builders need, gathered at call time.
	 *
	 * A function rather than a `$derived`: these run inside the effect that pushes new
	 * data to MapLibre, and `cssVar` reads the live document, so the context has to be
	 * the one that exists at the moment of the call rather than the one that existed
	 * when a derived last recomputed.
	 */
	const ctx = (): MapCtx => ({ app, c, heat, cssVar });

	function addLayers(m: MapLibreMap) {
		if (!m.hasImage('hatch')) m.addImage('hatch', hatchImage(cssVar));
		// Both of these bake a theme colour in, so a theme change has to redraw them.
		// `addLayers` re-runs on `setStyle`, which clears the style's images, and the
		// guard above is what makes the re-add happen exactly then.
		if (!m.hasImage('rival')) {
			const { data, pixelRatio } = rivalImage(cssVar);
			m.addImage('rival', data, { pixelRatio });
		}
		if (!m.hasImage('unit')) {
			const { data, pixelRatio } = unitImage(cssVar);
			m.addImage('unit', data, { pixelRatio });
		}

		m.addSource('catchments', { type: 'geojson', data: catchmentFC(ctx()) });
		m.addSource('poi', { type: 'geojson', data: poiFC(ctx()) });
		m.addSource('property', { type: 'geojson', data: propertyFC(ctx()) });
		m.addSource('field', { type: 'geojson', data: fieldFC(ctx()) });
		m.addSource('units', { type: 'geojson', data: unitsFC(ctx()) });
		m.addSource('poi-links', { type: 'geojson', data: poiLinksFC(ctx()) });
		m.addSource('stops', { type: 'geojson', data: stopsFC(ctx()) });
		m.addSource('stop-links', { type: 'geojson', data: stopLinksFC(ctx()) });
		m.addSource('reach', { type: 'geojson', data: reachFC(ctx()) });
		// Fetched by URL rather than imported: MapLibre fetches the GeoJSON itself, so
		// 441 KB of line geometry does not swell the JS bundle and can be cached by the
		// browser like any other asset.
		m.addSource('routes', { type: 'geojson', data: `${base}/data/routes.json` });

		m.addLayer({
			id: 'catchment-fill',
			type: 'fill',
			source: 'catchments',
			filter: ['!', ['get', 'uncovered']],
			paint: {
				'fill-color': ['get', 'color'],
				/**
				 * A scored cell is filled, because the fill IS the reading. An idle one is
				 * barely filled, because it has nothing to say and the reader is looking
				 * through it at the streets and place names to work out where they are.
				 *
				 * Filled at the same strength as a scored cell, the idle grid became a flat
				 * wash over the whole city — the basemap gone, every cell identical, and
				 * nothing to look at. What makes the idle grid legible is its EDGES, below,
				 * not its fill.
				 */
				'fill-opacity': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					['case', ['get', 'scored'], 0.68, 0.4],
					['get', 'scored'],
					0.5,
					0.16
				]
			}
		});
		/* Not surveyed: hatched, and outlined dashed below.
		   There used to be two blank states drawn two ways, a hatch for cells flagged
		   dataless at build time and a dashed edge for cells the source had never read.
		   The first flag was rolled by a random number generator and is gone, so one
		   blank state is left and it takes the stronger of the two marks. A hatch reads
		   as "nothing was measured here" at a glance, which a hairline does not. */
		m.addLayer({
			id: 'catchment-nodata',
			type: 'fill',
			source: 'catchments',
			filter: ['get', 'uncovered'],
			paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.6 }
		});
		m.addLayer({
			id: 'catchment-uncovered',
			type: 'line',
			source: 'catchments',
			filter: ['get', 'uncovered'],
			paint: {
				'line-color': cssVar('--nodata'),
				'line-width': 1,
				'line-dasharray': [2, 2],
				'line-opacity': 0.9
			}
		});
		m.addLayer({
			id: 'catchment-line',
			type: 'line',
			source: 'catchments',
			paint: {
				// With the heatmap off the edge is the only thing drawing the grid, so it
				// gets a colour of its own rather than the panel hairline — which is tuned
				// to separate list rows, not to hold a shape over a map.
				'line-color': [
					'case',
					['get', 'selected'],
					cssVar('--label-1'),
					['get', 'saturated'],
					cssVar('--critical'),
					['get', 'scored'],
					cssVar('--separator-strong'),
					cssVar('--cell-edge')
				],
				'line-width': [
					'case',
					['get', 'selected'],
					2.4,
					['get', 'saturated'],
					1.8,
					['get', 'scored'],
					1,
					1.1
				]
			}
		});
		// One layer per mode. The order decides what sits on top: TransJakarta is the
		// densest, so it is drawn first to keep the rail lines from being buried.
		for (const mode of ROUTE_MODES) {
			m.addLayer({
				id: `route-${mode.key}`,
				type: 'line',
				source: 'routes',
				filter: ['==', ['get', 'mode'], mode.key],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': cssVar(mode.varName),
					'line-width': ['interpolate', ['linear'], ['zoom'], 10, mode.thin, 15, mode.thick],
					'line-opacity': mode.opacity
				}
			});
		}

		// Above the route lines, so a station sits on its own corridor rather than
		// under it.
		const modeColour: ExpressionSpecification = [
			'match',
			['get', 'mode'],
			'mrt',
			cssVar('--route-mrt'),
			'krl',
			cssVar('--route-krl'),
			'lrt',
			cssVar('--route-lrt'),
			cssVar('--route-brt')
		];
		// COMPETITORS OF THE SELECTED CELL
		//
		// Below the transit marks on purpose. Both are drawn from the same cell centre
		// within the same ring, but the stations carry names and a cell captures far
		// more competitors than stops — put the rivals on top and they bury the labels
		// that make the transit fan readable.
		//
		// Red, the same red a saturated cell's outline is drawn in: a competitor is the
		// thing standing between this cell and the opportunity, and that is one meaning
		// wearing one colour. It is NOT the only red on the map though — KRL is
		// #e05a5a — which is why the mark itself is a square. See `rivalImage`.
		const rival = cssVar('--critical');
		m.addLayer({
			id: 'poi-links',
			type: 'line',
			source: 'poi-links',
			paint: {
				'line-color': rival,
				'line-width': 0.7,
				'line-opacity': 0.3
			}
		});
		m.addLayer({
			id: 'poi-dots',
			type: 'symbol',
			source: 'poi',
			layout: {
				'icon-image': 'rival',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 1.25],
				// Every competitor counted has to be drawn. Let MapLibre place these and
				// it drops the ones that collide, which on a dense cell means the map
				// showing fewer rivals than the badge counts — the map contradicting
				// itself, and in the direction that flatters the cell.
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		});
		// Every vacancy counted has to be drawn, for the same reason every competitor is:
		// the panel states a count, and a map quietly showing fewer of them than the
		// panel claims is the map contradicting the number beside it.
		// Unit mode: every unit on the market, coloured by the catchment it stands in.
		// Circles rather than the diamond, because these are the ROWS here rather than a
		// detail of a chosen cell, and because the colour is the reading — a shape with a
		// hole in it fights the fill it is carrying.
		m.addLayer({
			id: 'unit-pivot',
			type: 'circle',
			source: 'units',
			paint: {
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					10,
					['case', ['get', 'selected'], 6, 3.2],
					15,
					['case', ['get', 'selected'], 13, 7]
				],
				'circle-color': ['get', 'color'],
				// Three rings, in order of who asked for them: the unit the reader opened,
				// then the units standing in a catchment Tapak's last answer named, then
				// everything else with the plain knockout that keeps a dot legible on top
				// of whatever is under it.
				'circle-stroke-width': ['case', ['get', 'selected'], 2.4, ['get', 'named'], 2, 1],
				'circle-stroke-color': [
					'case',
					['get', 'selected'],
					cssVar('--label-1'),
					['get', 'named'],
					cssVar('--accent'),
					cssVar('--bg-elevated')
				],
				// A unit with no reading for the sorted measure is drawn back as well as grey,
				// so it reads as context rather than as a low-ranking result.
				'circle-opacity': ['case', ['get', 'ranked'], 0.95, 0.5]
			}
		});

		m.addLayer({
			id: 'property-units',
			type: 'symbol',
			source: 'property',
			layout: {
				'icon-image': 'unit',
				'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.15],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		});

		/**
		 * The field records: a hollow ring, and the one shape no other layer here uses.
		 *
		 * Hollow because it is the honest picture of what these are. Every other mark on
		 * this map is a catalogue's entry for a thing that is there; this one is a spot
		 * where a person stood, and an outline reads as a place marked rather than as an
		 * object counted.
		 *
		 * Filled in only for a place recorded as up for rent, which is the single fact
		 * this map has never been able to show. It gets the accent and nothing else does.
		 */
		m.addLayer({
			id: 'field-marks',
			type: 'circle',
			source: 'field',
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.6, 16, 5.5],
				'circle-color': ['case', ['get', 'rent'], cssVar('--accent'), cssVar('--bg-elevated')],
				'circle-stroke-width': 1.6,
				'circle-stroke-color': ['case', ['get', 'rent'], cssVar('--accent'), cssVar('--label-1')],
				'circle-opacity': 0.95
			}
		});

		// The walking range the nodes below were captured within — the rule, drawn.
		m.addLayer({
			id: 'reach-ring',
			type: 'line',
			source: 'reach',
			paint: {
				'line-color': cssVar('--label-2'),
				'line-width': 1,
				'line-dasharray': [3, 3],
				'line-opacity': 0.55
			}
		});
		// Centre to node, one line each. Bus links are thinner and fainter than rail:
		// a cell can capture twenty-odd halte, and at equal weight they would swallow
		// the two rail lines that usually matter more.
		m.addLayer({
			id: 'stop-links',
			type: 'line',
			source: 'stop-links',
			paint: {
				'line-color': modeColour,
				'line-width': ['case', ['get', 'rail'], 1.6, 0.9],
				'line-opacity': ['case', ['get', 'rail'], 0.65, 0.42]
			}
		});
		// A plate under each node, so the captured ones read as a set at a glance.
		//
		// Light rather than tinted, and this is the whole reason it works: these sit on
		// top of a heatmap fill whose colour changes from cell to cell, and a
		// translucent coloured halo simply dissolved into whatever was beneath it. A
		// knockout disc in the panel material holds the same weight over a pale cell,
		// a dark one, and a basemap with a station symbol of its own — and the ring
		// around it keeps the mode's colour, which is what the panel names them by.
		m.addLayer({
			id: 'stop-halo',
			type: 'circle',
			source: 'stops',
			paint: {
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					10,
					['case', ['get', 'rail'], 8, 4.5],
					15,
					['case', ['get', 'rail'], 16, 9.5]
				],
				'circle-color': cssVar('--bg-elevated'),
				'circle-opacity': 0.6,
				'circle-stroke-width': 1.2,
				'circle-stroke-color': modeColour,
				'circle-stroke-opacity': 0.85
			}
		});
		m.addLayer({
			id: 'stop-dots',
			type: 'circle',
			source: 'stops',
			paint: {
				'circle-radius': ['case', ['get', 'rail'], 6, 4],
				'circle-color': modeColour,
				'circle-stroke-width': ['case', ['get', 'rail'], 2, 1],
				'circle-stroke-color': cssVar('--bg-elevated'),
				'circle-opacity': 0.95
			}
		});
		for (const spec of LABEL_LAYERS) {
			m.addLayer({
				id: spec.id,
				type: 'symbol',
				source: spec.source,
				filter: spec.filter,
				// Only from the zoom at which the label has somewhere to go. Below it the
				// cell is a few pixels across, every label lands on top of the last, and
				// the collision engine spends its time rejecting them. The marks are
				// drawn at every zoom regardless — it is the naming that waits.
				minzoom: spec.minzoom,
				layout: {
					'text-field': ['get', 'label'],
					'text-size': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						spec.size - 1.5,
						16,
						spec.size
					],
					'text-font': ['Open Sans Regular'],
					// Long names wrap instead of forming a bar. These run to 57 characters
					// ("Direktorat Jenderal Energi Terbarukan dan Konversi Energi"), and on
					// one line such a label sweeps half the cell and evicts everything it
					// crosses — one name costing five.
					'text-max-width': 9,
					'text-line-height': 1.15,
					// Try the other three sides before giving up. This is what turns a
					// crowded cell from "three labels placed, thirty dropped" into most of
					// them finding a gap, and it is done in screen space so it holds at any
					// zoom and any pixel ratio.
					'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
					'text-radial-offset': spec.offset,
					'text-justify': 'auto',
					// Keep a gap between neighbouring labels rather than letting them touch.
					// In pixels, so it does not shrink as the map zooms out.
					'text-padding': 3,
					// Placement priority, and the whole reason the labels are split across
					// three layers rather than filtered inside one. MapLibre sorts by this
					// key WITHIN a layer only, so the ranking between classes has to be the
					// layer order itself: rail, then competitors, then halte.
					'symbol-sort-key': ['get', 'sort'],
					// A node whose label will not fit is still worth drawing, so the label
					// is allowed to drop rather than the whole symbol.
					'text-optional': true,
					'text-allow-overlap': false,
					'icon-allow-overlap': true
				},
				paint: {
					'text-color': cssVar(spec.colour),
					'text-halo-color': cssVar('--bg-elevated'),
					'text-halo-width': 1.6
				}
			});
		}

		m.on('click', 'unit-pivot', (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.selectUnit(id);
		});
		m.on('mouseenter', 'unit-pivot', () => (m.getCanvas().style.cursor = 'pointer'));
		/* A dot is a ROW here, so hovering one has to read like hovering a hexagon does in
		   the other mode: the thing under the pointer, described in the figures the reader
		   is ranking by. A lookup rather than a scan, for the reason the catchment handler
		   below spells out — this runs on every pointer move. */
		m.on('mousemove', 'unit-pivot', (e) => {
			const id = e.features?.[0]?.properties?.id;
			const unit = typeof id === 'string' ? app.unitById.get(id) : undefined;
			hovered = unit ? { kind: 'unit', unit } : null;
			positionTip(e.point.x, e.point.y);
		});
		m.on('mouseleave', 'unit-pivot', () => {
			m.getCanvas().style.cursor = '';
			hovered = null;
		});

		let hoverId: number | null = null;
		m.on('mousemove', 'catchment-fill', (e) => {
			m.getCanvas().style.cursor = 'pointer';
			const f = e.features?.[0];
			if (!f) return;
			if (hoverId !== null && hoverId !== f.id)
				m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: false });
			hoverId = f.id as number;
			m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: true });
			/* The READOUT follows the pivot, the way the ranking and the dot colours already
			   do. In unit mode a hexagon is the context an open place stands in rather than a
			   row, and answering a hover with its opportunity score hands the reader the
			   other mode's figures: they asked to read by place and got 800 m of city.

			   The highlight above is kept. It orients, it is the cheapest way to show which
			   catchment a doorway belongs to, and it claims nothing.

			   Returning rather than clearing is load bearing. A unit dot is drawn ON a
			   hexagon, so both layers answer the same pointer move, and whichever handler
			   ran last would win: clearing here would wipe the place the dot just reported. */
			if (app.pivot !== 'cell') return;
			// A map lookup, not a scan. This runs on every pointer move, and reading
			// `app.rows` here used to rescore all 562 cells each time — the single
			// biggest reason moving the pointer over the map felt heavy.
			const id = f.properties?.id as string | undefined;
			hovered = id
				? { kind: 'cell', name: (f.properties?.name as string) ?? '', row: app.rowById.get(id) ?? null }
				: null;
			positionTip(e.point.x, e.point.y);
		});
		m.on('mouseleave', 'catchment-fill', () => {
			m.getCanvas().style.cursor = '';
			if (hoverId !== null) m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: false });
			hoverId = null;
			hovered = null;
		});
		/* A catchment is only selectable while catchments are what the map is a list of.
		   In unit mode the selected cell is not something the reader picks: it is wherever
		   the open unit stands, set by `selectUnit` and described by the card's lower half.
		   Letting a click on the grid underneath move it would put the card's figures onto
		   a catchment the unit above them is not in. */
		const pickCell = (e: MapLayerMouseEvent) => {
			if (app.pivot !== 'cell') return;
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.select(id);
		};
		m.on('click', 'catchment-fill', pickCell);
		m.on('click', 'catchment-nodata', pickCell);
	}

	function positionTip(x: number, y: number) {
		if (!tipEl) return;
		const w = tipEl.offsetWidth;
		const box = container.getBoundingClientRect();
		const left = Math.min(box.width - w - 12, x + 16);
		tipEl.style.transform = `translate3d(${Math.max(12, left)}px, ${y - 14}px, 0)`;
	}

	/** How many cells get a marker. The grid has 558 cells — marking all of them
	    produces an unreadable pile of labels and hundreds of DOM nodes at once. Only
	    the ones that currently mean something to the user are marked. */
	const MAX_MARKERS = 14;

	/**
	 * Order matters: whichever comes first wins when two labels compete for space.
	 *
	 * With the heatmap on, the ranking is the opportunity score. With it off there are
	 * no scores, so the cells are ranked by TRANSIT ACCESS — real OSM data that ships
	 * with the base grid. The map therefore opens already naming its best-connected
	 * stations instead of going blank until a category is picked, and it never invents
	 * a ranking out of a score it does not have.
	 */
	function markerSet(): Set<string> {
		const keep = new Set<string>();
		if (app.selectedId) keep.add(app.selectedId);
		for (const id of app.highlight) keep.add(id);

		const rows = heat ? app.rowById : null;
		const top = app.base
			.slice()
			.sort((a, b) =>
				rows
					? (rows.get(b.id)?.score ?? 0) - (rows.get(a.id)?.score ?? 0)
					: b.access - a.access
			);
		for (const h of top) {
			if (keep.size >= MAX_MARKERS) break;
			keep.add(h.id);
		}
		return keep;
	}

	/** Cell markers as HTML elements: the same typography & material as the panels. */
	function syncMarkers(cells: HexBase[]) {
		if (!map || !gl) return;

		const keep = markerSet();

		// Markers that are no longer relevant are removed, not hidden — with display:none
		// alone the nodes keep piling up as the user moves between selections.
		for (const [id, entry] of markers) {
			if (!keep.has(id)) {
				entry.marker.remove();
				markers.delete(id);
			}
		}

		const order = [...keep];
		for (const h of cells) {
			if (!keep.has(h.id)) continue;
			const name = cellName(h);
			let entry = markers.get(h.id);
			if (!entry) {
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'stn';
				el.addEventListener('click', (ev) => {
					ev.stopPropagation();
					app.select(h.id);
				});
				// Read at hover time rather than captured when the marker was made: a
				// marker outlives many rescorings, and a captured row would keep showing
				// the figures from whichever category was active when it was created.
				el.addEventListener('pointerenter', (ev) => {
					// Gated for the same reason the grid underneath is: these sit above the
					// canvas, so no layer handler ever sees them, and left ungated they were the
					// one surface still answering "by place" with the area's figures.
					if (app.pivot !== 'cell') return;
					hovered = { kind: 'cell', name, row: app.rowById.get(h.id) ?? null };
					// Placed as well as filled. Only the map's own `mousemove` moved this
					// thing, so hovering a marker showed its figures in the top-left corner
					// of the screen, nowhere near the marker and often over another panel.
					const box = container.getBoundingClientRect();
					positionTip(ev.clientX - box.left, ev.clientY - box.top);
				});
				el.addEventListener('pointerleave', () => (hovered = null));
				const marker = new gl.Marker({ element: el, anchor: 'center' })
					.setLngLat([h.lon, h.lat])
					.addTo(map);
				entry = { marker, el, rank: 0 };
				markers.set(h.id, entry);
			}
			entry.rank = order.indexOf(h.id);
			const rank = app.highlight.indexOf(h.id);
			const selected = app.selectedId === h.id;
			entry.el.className = `stn${selected ? ' is-selected' : ''}`;
			entry.el.setAttribute(
				'aria-label',
				name +
					(selected ? `, ${c.app.mapStopsAria(stopTotal(h.transit), app.weights.radius)}` : '') +
					(selected && app.layers.poi && app.selectedPois.length
						? `, ${c.app.mapRivalsAria(app.selectedPois.length, app.weights.radius)}`
						: '')
			);
			entry.el.innerHTML =
				`<span class="stn-dot"></span>` +
				(rank > -1 ? `<span class="stn-rank">${rank + 1}</span>` : '') +
				(app.layers.label || selected ? `<span class="stn-label">${shortName(name)}</span>` : '') +
				// Only the selected cell carries them. On fourteen markers at once a count
				// on each is a wall of chips, and the question they answer is one the
				// reader asks about the cell they have chosen.
				(selected ? badges(h) : '');
		}

		layoutLabels();
	}

	/**
	 * How many units get a price tag.
	 *
	 * A dense cell captures thirty-odd premises, and thirty price tags is not a map. The
	 * nearest eight are tagged and the rest keep their diamond, which is the same
	 * bargain the cell labels strike: every unit is still drawn, only the naming is
	 * rationed. Nearest first, because the panel's list is ordered that way too and the
	 * two have to agree about which units are "the near ones".
	 */
	const MAX_UNIT_TAGS = 8;

	/**
	 * Price tags on the units the selected cell captures.
	 *
	 * DOM markers rather than a symbol layer, and that is not a style preference. A
	 * `text-field` needs a `glyphs` source, and the open raster basemap this falls back
	 * to when `PUBLIC_MAPID_STYLE_URL` is unset has none — so every symbol label on this
	 * map renders nothing today, silently, and the names the reader does see are these
	 * markers. A price drawn the other way would be a feature that works on one
	 * developer's machine and nowhere else.
	 *
	 * The type leads and the price sits under it, because they answer two questions in
	 * that order: what is it, then what are they asking. A unit with no published price
	 * gets the type alone rather than a tag reading "Ruko ·" — the panel already counts
	 * those separately.
	 */
	function syncUnitTags() {
		if (!map || !gl) return;
		const wanted = app.layers.property
			? app.selectedListings.filter((l) => l.premises).slice(0, MAX_UNIT_TAGS)
			: [];

		// Keyed by position in the captured list, not by coordinate: 1,915 of the 3,547
		// listings share a coordinate with another, so a coordinate key would collapse
		// four real units in one building into one tag.
		const keep = new Set(wanted.map((_, i) => String(i)));
		for (const [id, entry] of unitTags) {
			if (!keep.has(id)) {
				entry.marker.remove();
				unitTags.delete(id);
			}
		}

		for (const [i, l] of wanted.entries()) {
			const id = String(i);
			let entry = unitTags.get(id);
			if (!entry) {
				const el = document.createElement('div');
				el.className = 'unit-pin';
				const marker = new gl.Marker({ element: el, anchor: 'center' }).setLngLat([l.lon, l.lat]);
				marker.addTo(map);
				entry = { marker, el };
				unitTags.set(id, entry);
			}
			entry.marker.setLngLat([l.lon, l.lat]);
			const type = c.property.types[l.type] ?? l.type;
			const price = l.price !== null ? c.property.unitPrice(l.price) : '';
			entry.el.setAttribute(
				'aria-label',
				c.property.mapUnitAria(type, price, Math.round(l.distance))
			);
			entry.el.innerHTML =
				`<span class="unit-mark"></span>` +
				`<span class="unit-tag"><span class="unit-type">${escapeText(type)}</span>` +
				(price ? `<span class="unit-price">${escapeText(price)}</span>` : '') +
				`</span>`;
		}
	}

	/** Text going into `innerHTML` above. Every value it is handed comes from the
	    locale files or the property file, but the rule that it is escaped before it is
	    interpolated should not depend on where the string came from today. */
	const escapeText = (s: string) =>
		s.replace(/[&<>"]/g, (ch) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[ch]};`);

	/**
	 * Colliding labels are hidden rather than drawn on top of each other.
	 *
	 * The top fourteen cells often cluster along one corridor, and their names then
	 * overlap until not one of them reads. The more important ones — the selected
	 * cell, then the ranked results — get their space first; the rest fall back to a
	 * dot. The dot is still there, so no cell disappears.
	 *
	 * The price tags go through the SAME pass rather than one of their own. Two
	 * independent collision layouts do not collide with each other, which is exactly how
	 * a price tag ends up sitting on top of a cell name — each one having correctly
	 * concluded it had the space to itself. Cell names are laid first because they orient
	 * the reader on the whole map; a tag that cannot fit falls back to its diamond, which
	 * the symbol layer draws for every unit regardless.
	 */
	function layoutLabels() {
		if (!map) return;
		const entries = [...markers.values()].sort((a, b) => a.rank - b.rank);
		const placed: DOMRect[] = [];

		const labels: HTMLElement[] = [];
		for (const e of entries) {
			const label = e.el.querySelector<HTMLElement>('.stn-label');
			if (label && e.el.style.display !== 'none') labels.push(label);
			if (label) label.style.visibility = '';
		}
		for (const e of unitTags.values()) {
			const tag = e.el.querySelector<HTMLElement>('.unit-tag');
			if (!tag) continue;
			tag.style.visibility = '';
			labels.push(tag);
		}

		for (const label of labels) {
			const box = label.getBoundingClientRect();
			const clash = placed.some(
				(q) =>
					box.left < q.right + 4 &&
					q.left < box.right + 4 &&
					box.top < q.bottom + 2 &&
					q.top < box.bottom + 2
			);
			if (clash) label.style.visibility = 'hidden';
			else placed.push(box);
		}
	}

	/** Panned/zoomed → re-lay out, once per frame. */
	function scheduleLabels() {
		if (labelFrame) return;
		labelFrame = requestAnimationFrame(() => {
			labelFrame = 0;
			layoutLabels();
		});
	}

	const shortName = (n: string) =>
		n.replace(
			/ (Bank Syariah Indonesia|Bank Jakarta|Mastercard|Indomaret|BCA|BNI|VISA|TUKU|Astra|Headquarters)$/,
			''
		);


	/**
	 * The selected cell's transit count, pinned to the cell itself.
	 *
	 * The halos show WHICH nodes; this says HOW MANY, at the one place on the map the
	 * reader is already looking. Only the count — the split, the names and what it is
	 * worth to the score all live in the panel, and a map chip that tries to carry them
	 * stops being readable at a glance, which is the only thing it is for.
	 *
	 * Read from the grid's own counts, so it is right before `stops.json` has arrived,
	 * and it is the same figure the score was computed from.
	 */
	function transitBadge(h: HexBase): string {
		const n = stopTotal(h.transit);
		if (!n || !app.layers.stops) return '';
		// A cell reaching rail gets the accent: one fixed doorway with all-day footfall
		// is a different proposition from the same count made up of bus stops.
		const rail = railTotal(h.transit) > 0 ? ' has-rail' : '';
		return `<span class="stn-chip${rail}">${c.app.mapStops(n)}</span>`;
	}

	/**
	 * The competitor count for the selected cell.
	 *
	 * Counted off `selectedPois` — the dots on screen — and not off the scored row's
	 * `osm` figure, so this badge and the map it sits on can never disagree with each
	 * other. Where the panel's figure differs it is because the grid's counts and the
	 * point file were built at different times, and a badge that quietly restated the
	 * panel's number over a different number of dots would hide exactly that.
	 */
	function rivalBadge(): string {
		const n = app.selectedPois.length;
		if (!n || !app.layers.poi) return '';
		return `<span class="stn-chip is-rival">${c.app.mapRivals(n)}</span>`;
	}

	/** The selected cell's chips, stacked. Either can be absent, so they are laid out
	    by the container rather than each pinned to a fixed offset of its own. */
	function badges(h: HexBase): string {
		const inner = transitBadge(h) + rivalBadge();
		return inner ? `<span class="stn-badges">${inner}</span>` : '';
	}

	function fitAll(animate = true) {
		if (!map) return;
		map.fitBounds(boundsOf(app.base), {
			padding: { top: 90, bottom: 120, left: 60, right: 60 },
			animate: animate && !prefersReducedMotion(),
			duration: 700
		});
	}

	onMount(() => {
		let disposed = false;
		(async () => {
			gl = await import('maplibre-gl');
			if (disposed) return;
			gl.setWorkerUrl(maplibreWorkerUrl);
			appliedTheme = app.resolvedTheme;
			const m = new gl.Map({
				container,
				style: basemapStyle(appliedTheme),
				bounds: boundsOf(app.base),
				fitBoundsOptions: { padding: { top: 90, bottom: 120, left: 60, right: 60 } },
				attributionControl: false,
				// Gestures must feel direct; rotation adds no meaning to this map.
				dragRotate: false,
				pitchWithRotate: false,
				touchZoomRotate: true
			});
			m.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
			m.addControl(new gl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-left');
			m.touchZoomRotate.disableRotation();
			// `load` waits for the first frame to be genuinely drawn — basemap tiles
			// included. If the basemap is slow, blocked, or down, that event never
			// arrives and none of the recommendation layers ever get mounted — even
			// though their geometry and scores are local and need no network at all.
			// `styledata` fires as soon as the style spec is parsed, so the computed
			// results still show even when the map itself is blank.
			m.once('styledata', () => {
				addLayers(m);
				ready = true;
			});
			m.on('move', scheduleLabels);
			m.on('zoom', scheduleLabels);
			map = m;
			if (import.meta.env.DEV) (window as unknown as { __map: MapLibreMap }).__map = m;
		})();
		return () => {
			disposed = true;
			if (labelFrame) cancelAnimationFrame(labelFrame);
			map?.remove();
			markers.clear();
			unitTags.clear();
		};
	});

	// Theme changes → the basemap and every layer colour change with it. The currently
	// applied theme is kept outside a rune: otherwise `ready` changing inside the effect
	// would retrigger the effect itself and reload the map style without end.
	$effect(() => {
		const theme = app.resolvedTheme;
		const m = map;
		if (!m || appliedTheme === null || appliedTheme === theme) return;
		appliedTheme = theme;
		ready = false;
		m.setStyle(basemapStyle(theme));
		m.once('styledata', () => {
			addLayers(m);
			ready = true;
		});
	});

	// Sources & colours are refreshed whenever the scores, layers, or selection change.
	$effect(() => {
		// Named so the effect tracks them: the builders read `app.base` and `app.rowById`
		// through helper functions, and an effect only re-runs for state it touched
		// while it ran.
		void app.base;
		void app.rowById;
		void heat;
		void app.layers.poi;
		void app.layers.label;
		void app.selectedId;
		void app.highlight;
		void app.selectedStops;
		void app.selectedPois;
		void app.layers.stops;
		void app.layers.property;
		void app.selectedListings;
		void app.layers.field;
		void app.selectedField;
		void app.pivot;
		void app.unitRows;
		void app.unitFiltered;
		void app.unitSort;
		void app.unitOrder;
		void app.selectedUnitId;
		void app.weights.radius;
		const m = map;
		if (!m || !ready) return;
		(m.getSource('catchments') as GeoJSONSource | undefined)?.setData(catchmentFC(ctx()));
		(m.getSource('poi') as GeoJSONSource | undefined)?.setData(poiFC(ctx()));
		(m.getSource('property') as GeoJSONSource | undefined)?.setData(propertyFC(ctx()));
		(m.getSource('field') as GeoJSONSource | undefined)?.setData(fieldFC(ctx()));
		(m.getSource('units') as GeoJSONSource | undefined)?.setData(unitsFC(ctx()));
		(m.getSource('poi-links') as GeoJSONSource | undefined)?.setData(poiLinksFC(ctx()));
		(m.getSource('stops') as GeoJSONSource | undefined)?.setData(stopsFC(ctx()));
		(m.getSource('stop-links') as GeoJSONSource | undefined)?.setData(stopLinksFC(ctx()));
		(m.getSource('reach') as GeoJSONSource | undefined)?.setData(reachFC(ctx()));
		for (const mode of ROUTE_MODES) {
			m.setLayoutProperty(`route-${mode.key}`, 'visibility', app.layers.routes ? 'visible' : 'none');
		}
		m.setPaintProperty('catchment-line', 'line-color', [
			'case',
			['get', 'selected'],
			cssVar('--label-1'),
			['get', 'saturated'],
			cssVar('--critical'),
			['get', 'scored'],
			cssVar('--separator-strong'),
			cssVar('--cell-edge')
		]);
		// The tags before the layout pass inside `syncMarkers`, so the two sets of labels
		// are laid out together against one set of occupied rectangles.
		syncUnitTags();
		syncMarkers(app.base);
	});

	// Selecting a catchment pans the map to it — the spatial link between panel and map has to hold.
	$effect(() => {
		const sel = app.selected;
		const m = map;
		if (!m || !ready || !sel) return;
		m.easeTo({
			center: [sel.lon, sel.lat],
			duration: prefersReducedMotion() ? 0 : 520,
			essential: true
		});
	});

	/**
	 * Padding that keeps the answer clear of the floating panels.
	 *
	 * `fitBounds` fits to the CANVAS, and the canvas runs edge to edge underneath
	 * Tapak and the legend. Fitting without allowing for them lands half the named
	 * cells behind the panel that just named them.
	 *
	 * Each side is clamped below 40% of the canvas: MapLibre throws outright when
	 * padding exceeds the map's own dimensions, and on a small window the reserved
	 * strips are wider than the map is.
	 */
	function answerPadding() {
		const el = map?.getContainer();
		const w = el?.clientWidth ?? window.innerWidth;
		const h = el?.clientHeight ?? window.innerHeight;
		const cap = (v: number, of: number) => Math.max(24, Math.min(v, of * 0.4));
		const wide = window.matchMedia('(min-width: 1024px)').matches;
		return wide
			? {
					top: cap(80, h),
					bottom: cap(80, h),
					// The legend, or the area card that replaces it, on the left; Tapak on the right.
					left: cap(360, w),
					right: cap(390, w)
				}
			: // Compact: the sheet owns the bottom half, and nothing floats at the sides.
				{ top: cap(80, h), bottom: cap(h * 0.5, h), left: cap(32, w), right: cap(32, w) };
	}

	/**
	 * The answer's cells, flown to once per answer.
	 *
	 * Tapak names five places and the map is showing all of Jabodetabek: the reader
	 * is left to hunt for them by hand, which is work the map should have done. So
	 * when an answer arrives the view moves to what was named.
	 *
	 * Keyed on the id list rather than on a boolean, so re-running for any other
	 * reason does not re-fly, and asking the same question twice does not either.
	 * The cells are read from `base`, which is always loaded, rather than from the
	 * scored rows — the flight must not wait on the category's columns landing.
	 */
	let flownTo: string | null = null;
	$effect(() => {
		const ids = app.highlight;
		const m = map;
		if (!m || !ready) return;

		const key = ids.join(',');
		if (!key) {
			// Cleared highlight (a new question is on its way): the next answer, even an
			// identical one, is allowed to fly again.
			flownTo = null;
			return;
		}
		if (key === flownTo) return;

		const wanted = new Set(ids);
		const cells = app.base.filter((h) => wanted.has(h.id));
		if (!cells.length) return;
		flownTo = key;

		m.fitBounds(boundsOf(cells, 0.004), {
			padding: answerPadding(),
			// Five adjacent hexes make very tight bounds. Without a ceiling the map
			// drops to street level, where the ranking loses the context that makes it
			// mean anything.
			maxZoom: 13.5,
			animate: !prefersReducedMotion(),
			duration: 900,
			essential: true
		});
	});
</script>

<div class="map-root" bind:this={container}>
	{#if !ready}
		<div class="loading eyebrow">{c.app.loadingMap}</div>
	{/if}
</div>

<div class="zoom material">
	<button type="button" onclick={() => map?.zoomIn()} aria-label={c.app.zoomIn}>+</button>
	<button type="button" onclick={() => map?.zoomOut()} aria-label={c.app.zoomOut}>−</button>
	<button type="button" onclick={() => fitAll()} aria-label={c.app.reset}>⤢</button>
</div>

<div class="tip material" bind:this={tipEl} class:show={!!hovered} aria-hidden="true">
	{#if hovered?.kind === 'unit'}
		<!-- READ BY PLACE. The listing's own columns lead and the catchment closes, which is
		     the order the unit card puts them in: the reader picked the pivot where a doorway
		     is the row, so the doorway is what a hover answers with. -->
		{@const unit = hovered.unit}
		{@const type = unit.listing.type}
		<strong>{c.property.types[type] ?? type}</strong>
		{#if hoveredRank}
			<span class="tip-score" style:color={rampVar(hoveredRank.fraction)}>
				{c.units.value(app.unitSort, hoveredRank.value)}
				<span class="tip-unit">{c.units.metrics[app.unitSort]}</span>
			</span>
		{:else}
			<!-- Nothing measured for the figure the list is sorted by. The dot is drawn in
			     the no-data grey for exactly this, and a place with no reading is said to
			     have none rather than shown a zero it never carried. -->
			<span class="tip-sub">{c.units.rampNodata}</span>
		{/if}
		<span class="tip-sub">
			{#if hoveredTraits}{hoveredTraits}<br />{/if}
			{c.units.cardIn(unit.cellName)} · {c.units.cardWalk(unit.distance)}
		</span>
	{:else if hovered}
		<strong>{hovered.name}</strong>
		{#if hovered.row && !hovered.row.covered}
			<span class="tip-sub">{c.app.tipNodata}</span>
		{:else if hovered.row && hovered.row.score === null}
			<!-- Counted, but no business type has been named, so the reading is the trade
			     standing here rather than an opportunity. Not the "no data" line above:
			     this cell was surveyed perfectly well, and what is missing is the
			     question, not the survey. -->
			{@const row = hovered.row}
			<span class="tip-score" style:color={`var(--ramp-${rampIndex(row.demand ?? 0)})`}>
				{row.density}
				<span class="tip-unit">{c.app.tipDensity}</span>
			</span>
			<span class="tip-sub">
				{row.source === 'mapid' ? 'MAPID' : row.source === 'osm' ? 'OSM' : 'MAPID + OSM'}, r={app.weights.radius} m ·
				{c.app.tipUnits(row.units)}
			</span>
		{:else if hovered.row}
			{@const row = hovered.row}
			<span class="tip-score" style:color={`var(--ramp-${rampIndex(row.score ?? 0)})`}>
				{pct(row.score)}
				<span class="tip-unit">{c.app.tipScore(categoryNames(app.categories, c, 'many'))}</span>
			</span>
			<span class="tip-sub">
				{c.app.tipBusy(row.density)} · {c.app.tipRivals(row.osm)}<br />
				{row.source === 'mapid' ? 'MAPID' : row.source === 'osm' ? 'OSM' : 'MAPID + OSM'}, r={app.weights.radius} m ·
				{c.app.tipUnits(row.units)}
			</span>
		{:else}
			<!-- No category loaded yet: the cell is named and nothing more is claimed. -->
			<span class="tip-sub">{c.app.tipNoCategory}</span>
		{/if}
	{/if}
</div>

<style>
	.map-root {
		position: absolute;
		inset: 0;
		background: var(--bg-base);
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}

	.zoom {
		position: absolute;
		right: 0.75rem;
		top: 4.5rem;
		z-index: 4;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.zoom button {
		width: 2rem;
		height: 2rem;
		border: 0;
		border-bottom: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		font-size: 0.9375rem;
		line-height: 1;
		cursor: pointer;
		transition: transform 100ms ease-out;
	}
	.zoom button:last-child {
		border-bottom: 0;
		font-size: 0.75rem;
	}
	.zoom button:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
	.zoom button:active {
		transform: scale(0.9);
		background: var(--fill-2);
	}

	.tip {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 6;
		pointer-events: none;
		max-width: 15rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--r-sm);
		opacity: 0;
		transition: opacity 120ms ease-out;
		will-change: transform;
	}
	.tip.show {
		opacity: 1;
	}
	.tip strong {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.tip-score {
		display: block;
		font-size: 1.375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
		margin-top: 0.125rem;
	}
	.tip-unit {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--label-3);
	}
	.tip-sub {
		display: block;
		margin-top: 0.1875rem;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--label-2);
	}

	/* station markers (elements created imperatively by syncMarkers) */
	:global(.stn) {
		position: relative;
		display: block;
		width: 0;
		height: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	:global(.stn-dot) {
		position: absolute;
		left: -5px;
		top: -5px;
		width: 10px;
		height: 10px;
		border-radius: 99px;
		background: var(--bg-elevated);
		border: 2px solid var(--label-2);
		box-shadow: var(--shadow-chip);
		transition: transform 140ms ease-out;
	}
	:global(.stn:hover .stn-dot) {
		transform: scale(1.25);
	}
	:global(.stn.is-selected .stn-dot) {
		background: var(--accent);
		border-color: var(--bg-elevated);
		transform: scale(1.35);
	}
	:global(.stn-label) {
		position: absolute;
		left: 0.625rem;
		top: -0.6875rem;
		white-space: nowrap;
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.005em;
		color: var(--label-1);
		background: var(--mat-thin);
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.0625rem 0.4375rem;
		box-shadow: var(--shadow-chip);
	}
	:global(.stn.is-selected .stn-label) {
		font-weight: 600;
		color: var(--label-1);
		background: var(--mat-thick);
	}
	/* ── Units on the market ─────────────────────────────────────────────────
	   A price tag on a doorway the reader could actually take. The type leads and
	   the asking price sits under it, in that order because that is the order the
	   questions come in: what is it, then what are they asking for it.

	   Deliberately quieter than a cell name. A cell name is a place on the map; this
	   is one listing among a dozen, and at equal weight eight of them bury the map
	   they are drawn on. The diamond stays put when the tag is hidden by the layout
	   pass, so no unit ever disappears. */
	/* `unit-pin`, not `unit`. These are `:global` because MapLibre owns the elements, and
	   a bare `.unit` collapsed the panel's own `<span class="unit">` — the caption beside
	   the median price — to 0×0 across the whole app. A global class needs a name nothing
	   else would reach for, which a word as ordinary as "unit" is not. */
	:global(.unit-pin) {
		position: relative;
		display: block;
		width: 0;
		height: 0;
		/* Purely informative, and the panel lists the same units with more about each.
		   Nothing here is clickable, so nothing here should look it or catch a pointer
		   travelling to the cell underneath. */
		pointer-events: none;
	}
	/* The diamond, matching the symbol layer's mark so the tag reads as belonging to
	   it rather than floating beside it. A rotated square: one shape the map does not
	   already spend on competitors (square) or transit nodes (circles). */
	:global(.unit-mark) {
		position: absolute;
		left: -4px;
		top: -4px;
		width: 8px;
		height: 8px;
		transform: rotate(45deg);
		background: var(--bg-elevated);
		border: 1.5px solid var(--warn);
		box-shadow: var(--shadow-chip);
	}
	:global(.unit-tag) {
		position: absolute;
		left: 0.5625rem;
		top: -0.75rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.0625rem;
		white-space: nowrap;
		background: var(--mat-thin);
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		border: 1px solid var(--separator);
		border-left: 2px solid var(--warn);
		border-radius: 0 var(--r-sm, 6px) var(--r-sm, 6px) 0;
		padding: 0.0625rem 0.375rem 0.125rem;
		box-shadow: var(--shadow-chip);
	}
	:global(.unit-type) {
		font-size: 0.625rem;
		font-weight: 500;
		line-height: 1.2;
		color: var(--label-2);
	}
	/* The figure the reader came for, so it is the one set in the strong colour and
	   the tabular numerals. The type above it is the caption, not the other way round. */
	:global(.unit-price) {
		font-size: 0.6875rem;
		font-weight: 650;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}

	/* What the selected cell captures. Sits under the dot, opposite the name above it,
	   so the two never fight for the same space. A column, because either chip can be
	   absent and neither may be left holding a gap where the other would have been. */
	:global(.stn-badges) {
		position: absolute;
		left: 0.625rem;
		top: 0.3125rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
	}
	:global(.stn-chip) {
		white-space: nowrap;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.005em;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		padding: 0.0625rem 0.4375rem;
		box-shadow: var(--shadow-chip);
	}
	:global(.stn-chip.has-rail) {
		border-color: var(--accent);
		color: var(--accent);
	}
	/* The same red as the dots it counts, so which chip goes with which fan needs no
	   explaining. */
	:global(.stn-chip.is-rival) {
		border-color: var(--critical);
		color: var(--critical);
	}

	:global(.stn-rank) {
		position: absolute;
		left: -1.5rem;
		top: -1.5rem;
		display: grid;
		place-items: center;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.625rem;
		font-weight: 700;
		box-shadow: var(--shadow-chip);
	}

	/* MapLibre's built-in controls are restyled to match the panel material */
	:global(.maplibregl-ctrl-attrib),
	:global(.maplibregl-ctrl-scale) {
		background: var(--mat-thin) !important;
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		color: var(--label-3) !important;
		font-size: 0.625rem !important;
		border-radius: var(--r-xs) !important;
	}
	:global(.maplibregl-ctrl-scale) {
		border: 1px solid var(--separator) !important;
		border-top: 0 !important;
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: var(--label-2) !important;
	}
	:global(.maplibregl-ctrl-bottom-left),
	:global(.maplibregl-ctrl-bottom-right) {
		z-index: 3;
	}
</style>
