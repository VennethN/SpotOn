<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		ExpressionSpecification,
		GeoJSONSource,
		Map as MapLibreMap,
		Marker,
		StyleSpecification
	} from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// The worker is bundled separately by Vite; left for maplibre to load on its own,
	// the dev server touches the file and the worker dies without a sound.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { env } from '$env/dynamic/public';
	import { boundsOf, emptyFC, ringCoords, scatterPoints } from '$lib/utils/geo';
	import { railTotal, stopTotal } from '$lib/domain/transit';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import { pct, rampIndex } from '$lib/utils/format';
	import { cellName } from '$lib/domain/scoring';
	import { base } from '$app/paths';
	import { getAppState } from '$lib/state/app.svelte';
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

	/** The tooltip follows the pointer; its position is written straight to the DOM so no frame lags. */
	let tipEl: HTMLDivElement;
	/* The name comes from the base grid and the figures from the scored row, so the
	   tooltip still names a cell before any category has been loaded — rather than the
	   map going quiet under the pointer until the heatmap is switched on. */
	let hovered = $state<{ name: string; nodata: boolean; row: ScoredHex | null } | null>(null);

	const cssVar = (name: string) =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim();

	function basemapStyle(theme: 'light' | 'dark'): string | StyleSpecification {
		// MAPID MAPS is the mandatory basemap for the finished product; until the style
		// key is available, an open raster with equally valid attribution is used.
		//
		// The value has to be a URL, and it is checked rather than trusted. A bare
		// style id pasted in here (they look like `f3b5f5f0…`) is not rejected by
		// MapLibre — it is resolved as a path relative to the page, 404s, and leaves a
		// blank canvas with no basemap and no error anywhere the user can see. Falling
		// back to the open raster and saying so in the console turns a map that is
		// silently broken into a map that works plus one line explaining what to fix.
		const configured = env.PUBLIC_MAPID_STYLE_URL?.trim();
		if (configured) {
			if (/^(https?:)?\/\//.test(configured) || configured.startsWith('/')) return configured;
			console.warn(
				`[SpotOn] PUBLIC_MAPID_STYLE_URL is not a URL ("${configured}"), so the open raster basemap is being used instead. ` +
					'MapLibre needs the full MAPID MAPS style URL, not the style id on its own.'
			);
		}
		const variant = theme === 'dark' ? 'dark_all' : 'light_all';
		return {
			version: 8,
			sources: {
				base: {
					type: 'raster',
					tiles: [
						`https://a.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`,
						`https://b.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`,
						`https://c.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`
					],
					tileSize: 256,
					attribution:
						'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a> · basemap final: MAPID MAPS'
				}
			},
			layers: [{ id: 'base', type: 'raster', source: 'base' }]
		} satisfies StyleSpecification;
	}

	/** Hatching for catchments with no data — absent data must never look like a low score. */
	function hatchImage(): ImageData {
		const size = 10;
		const c = document.createElement('canvas');
		c.width = c.height = size;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = cssVar('--fill-1') || 'rgba(120,128,140,0.1)';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = cssVar('--nodata');
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-size, size);
		ctx.lineTo(size, -size);
		ctx.moveTo(0, size * 2);
		ctx.lineTo(size * 2, 0);
		ctx.stroke();
		return ctx.getImageData(0, 0, size, size);
	}

	/**
	 * The cell polygons.
	 *
	 * Built from the BASE grid, not from scored rows, so the map draws the moment the
	 * page has its geometry — before any category has been chosen, and whether or not
	 * the heatmap is on. Scores, when there are any, only decide the fill colour.
	 *
	 * Every colour is read once here rather than inside the loop. `cssVar` calls
	 * `getComputedStyle(document.documentElement)`, and doing that per feature meant
	 * 562 forced style recalculations for a palette of nine colours that is identical
	 * on every one of them — on every weight change, every hover, every selection.
	 */
	function catchmentFC(): FeatureCollection {
		const rows = heat ? app.rowById : null;
		const colNodata = cssVar('--nodata');
		const colIdle = cssVar('--cell-idle');
		const ramp = Array.from({ length: 7 }, (_, i) => cssVar(`--ramp-${i}`));
		const selectedId = app.selectedId;
		const showNodata = app.layers.nodata;

		return {
			type: 'FeatureCollection',
			features: app.base
				.filter((h) => !h.nodata || showNodata)
				.map((h, i) => {
					const row = rows?.get(h.id) ?? null;
					const nodata = Boolean(h.nodata);
					return {
						type: 'Feature' as const,
						// MapLibre's feature-state needs a numeric id; the row index is used because an
						// H3 id is a hexadecimal string that cannot be turned into a number.
						id: i,
						geometry: {
							type: 'Polygon' as const,
							// Cell boundaries are computed once at build time, so the client never
							// has to load the H3 library at all.
							coordinates: [[...h.boundary, h.boundary[0]]]
						},
						properties: {
							id: h.id,
							name: cellName(h),
							nodata,
							// A real cell left unscored because the active source does not
							// cover its city. Kept distinct from `nodata` so it does not look
							// like an empty cell — and given no colour at all, because any
							// colour would read as a score.
							//
							// Only ever claimed while the heatmap is on: with no category
							// loaded nothing has been checked yet, and dashing every cell
							// would report a coverage gap that has not been looked for.
							uncovered: Boolean(row) && !nodata && row!.score === null,
							color: nodata ? colNodata : row ? ramp[rampIndex(row.score ?? 0)] : colIdle,
							// Carries a score right now, so the fill means something. An idle cell
							// is drawn as structure instead: faint fill, crisper edge.
							scored: Boolean(row) && !nodata && row!.score !== null,
							saturated: row?.typology === 'saturated',
							selected: h.id === selectedId
						}
					};
				})
		};
	}

	/**
	 * The transit nodes the SELECTED cell captures — never the whole city's 1,105.
	 *
	 * This is the picture of the sentence the area panel just wrote. Drawing every
	 * stop in Jakarta would answer a question nobody asked and bury the cell's own
	 * under it; drawing only the captured ones makes "what this area reaches" a thing
	 * you can see rather than a number you have to trust.
	 */
	function stopsFC(): FeatureCollection {
		if (!app.layers.stops) return emptyFC();
		return {
			type: 'FeatureCollection',
			features: app.selectedStops.map((s) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
				properties: {
					mode: s.mode,
					name: s.name ?? '',
					// Rail gets a bigger mark and its name on the map. A cell can capture
					// twenty-odd bus stops, and twenty labels is not a map.
					rail: s.mode !== 'brt'
				}
			}))
		};
	}

	/**
	 * A line from the selected cell's centre to every node it captures.
	 *
	 * The dots alone say "there are stations here". The fan says "these belong to the
	 * cell you picked" — and because every line starts at the same point, the number of
	 * them is legible at a glance instead of having to be counted off the basemap. It
	 * is also literally the measurement the grid made: centre to node, under the
	 * walking range.
	 */
	function stopLinksFC(): FeatureCollection {
		const cell = app.selectedCell;
		if (!app.layers.stops || !cell) return emptyFC();
		return {
			type: 'FeatureCollection',
			features: app.selectedStops.map((s) => ({
				type: 'Feature' as const,
				geometry: {
					type: 'LineString' as const,
					coordinates: [
						[cell.lon, cell.lat],
						[s.lon, s.lat]
					]
				},
				properties: { mode: s.mode, rail: s.mode !== 'brt' }
			}))
		};
	}

	/** The walking range those nodes were captured within, drawn as it was measured. */
	function reachFC(): FeatureCollection {
		const cell = app.selectedCell;
		if (!app.layers.stops || !cell) return emptyFC();
		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature' as const,
					geometry: {
						type: 'LineString' as const,
						coordinates: ringCoords(cell.lon, cell.lat, app.weights.radius)
					},
					properties: {}
				}
			]
		};
	}

	/** Competitor dots — real counts, so they need the active category's columns. */
	function poiFC(): FeatureCollection {
		if (!app.layers.poi || !app.ready) return emptyFC();
		return {
			type: 'FeatureCollection',
			features: app.rows
				.filter((r) => !r.nodata)
				.flatMap((r) => scatterPoints(r.lon, r.lat, 430, r.osm, { id: r.id }))
		};
	}

	function addLayers(m: MapLibreMap) {
		if (!m.hasImage('hatch')) m.addImage('hatch', hatchImage());

		m.addSource('catchments', { type: 'geojson', data: catchmentFC() });
		m.addSource('poi', { type: 'geojson', data: poiFC() });
		m.addSource('stops', { type: 'geojson', data: stopsFC() });
		m.addSource('stop-links', { type: 'geojson', data: stopLinksFC() });
		m.addSource('reach', { type: 'geojson', data: reachFC() });
		// Fetched by URL rather than imported: MapLibre fetches the GeoJSON itself, so
		// 441 KB of line geometry does not swell the JS bundle and can be cached by the
		// browser like any other asset.
		m.addSource('routes', { type: 'geojson', data: `${base}/data/routes.json` });

		m.addLayer({
			id: 'catchment-fill',
			type: 'fill',
			source: 'catchments',
			filter: ['all', ['!', ['get', 'nodata']], ['!', ['get', 'uncovered']]],
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
		m.addLayer({
			id: 'catchment-nodata',
			type: 'fill',
			source: 'catchments',
			filter: ['get', 'nodata'],
			paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.85 }
		});
		// Not covered: a dashed outline only, no fill. Deliberately different from the
		// `nodata` hatching — both are valueless, but for different reasons and calling
		// for different user action (import a dataset vs there is nothing there).
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
		m.addLayer({
			id: 'poi-dots',
			type: 'circle',
			source: 'poi',
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 15, 3.2],
				'circle-color': cssVar('--good'),
				'circle-opacity': 0.85
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
		m.addLayer({
			id: 'stop-labels',
			type: 'symbol',
			source: 'stops',
			// Rail only: a cell can capture twenty-odd bus stops, and twenty labels is
			// not a map. The bus stops keep their dots.
			filter: ['get', 'rail'],
			layout: {
				'text-field': ['get', 'name'],
				'text-size': 11,
				'text-offset': [0, 1.1],
				'text-anchor': 'top',
				'text-font': ['Open Sans Regular'],
				// A station whose label will not fit is still worth drawing as a dot, so
				// the label is allowed to drop rather than the whole symbol.
				'text-optional': true,
				'text-allow-overlap': false
			},
			paint: {
				'text-color': cssVar('--label-1'),
				'text-halo-color': cssVar('--bg-elevated'),
				'text-halo-width': 1.6
			}
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
			// A map lookup, not a scan. This runs on every pointer move, and reading
			// `app.rows` here used to rescore all 562 cells each time — the single
			// biggest reason moving the pointer over the map felt heavy.
			const id = f.properties?.id as string | undefined;
			hovered = id
				? {
						name: (f.properties?.name as string) ?? '',
						nodata: Boolean(f.properties?.nodata),
						row: app.rowById.get(id) ?? null
					}
				: null;
			positionTip(e.point.x, e.point.y);
		});
		m.on('mouseleave', 'catchment-fill', () => {
			m.getCanvas().style.cursor = '';
			if (hoverId !== null) m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: false });
			hoverId = null;
			hovered = null;
		});
		m.on('click', 'catchment-fill', (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.select(id);
		});
		m.on('click', 'catchment-nodata', (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.select(id);
		});
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
			.filter((h) => !h.nodata)
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
			const nodata = Boolean(h.nodata);
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
					hovered = { name, nodata, row: app.rowById.get(h.id) ?? null };
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
			entry.el.className = `stn${selected ? ' is-selected' : ''}${nodata ? ' is-nodata' : ''}`;
			entry.el.setAttribute(
				'aria-label',
				`${name}${nodata ? ', belum terdata' : ''}` +
					(selected ? `, ${c.app.mapStopsAria(stopTotal(h.transit), app.weights.radius)}` : '')
			);
			entry.el.innerHTML =
				`<span class="stn-dot"></span>` +
				(rank > -1 ? `<span class="stn-rank">${rank + 1}</span>` : '') +
				(app.layers.label || selected ? `<span class="stn-label">${shortName(name)}</span>` : '') +
				// Only the selected cell carries it. On fourteen markers at once a count
				// on each is a wall of chips, and the question it answers is one the
				// reader asks about the cell they have chosen.
				(selected ? transitBadge(h) : '');
			entry.el.style.display = nodata && !app.layers.nodata ? 'none' : '';
		}

		layoutLabels();
	}

	/**
	 * Colliding labels are hidden rather than drawn on top of each other.
	 *
	 * The top fourteen cells often cluster along one corridor, and their names then
	 * overlap until not one of them reads. The more important ones — the selected
	 * cell, then the ranked results — get their space first; the rest fall back to a
	 * dot. The dot is still there, so no cell disappears.
	 */
	function layoutLabels() {
		if (!map) return;
		const entries = [...markers.values()].sort((a, b) => a.rank - b.rank);
		const placed: DOMRect[] = [];

		for (const e of entries) {
			const label = e.el.querySelector<HTMLElement>('.stn-label');
			if (!label) continue;
			label.style.visibility = '';
		}
		for (const e of entries) {
			const label = e.el.querySelector<HTMLElement>('.stn-label');
			if (!label || e.el.style.display === 'none') continue;
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
		return `<span class="stn-transit${rail}">${c.app.mapStops(n)}</span>`;
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
		void app.layers.nodata;
		void app.layers.poi;
		void app.layers.label;
		void app.selectedId;
		void app.highlight;
		void app.selectedStops;
		void app.layers.stops;
		void app.weights.radius;
		const m = map;
		if (!m || !ready) return;
		(m.getSource('catchments') as GeoJSONSource | undefined)?.setData(catchmentFC());
		(m.getSource('poi') as GeoJSONSource | undefined)?.setData(poiFC());
		(m.getSource('stops') as GeoJSONSource | undefined)?.setData(stopsFC());
		(m.getSource('stop-links') as GeoJSONSource | undefined)?.setData(stopLinksFC());
		(m.getSource('reach') as GeoJSONSource | undefined)?.setData(reachFC());
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
	{#if hovered}
		<strong>{hovered.name}</strong>
		{#if hovered.nodata}
			<span class="tip-sub">{c.app.tipNodata}</span>
		{:else if hovered.row}
			{@const row = hovered.row}
			<span class="tip-score" style:color={`var(--ramp-${rampIndex(row.score ?? 0)})`}>
				{pct(row.score)}
				<span class="tip-unit">{c.app.tipScore(c.category[app.category].name.toLowerCase())}</span>
			</span>
			<span class="tip-sub">
				Permintaan {pct(row.demand)} · penawaran {pct(row.supply)}<br />
				{row.osm} pesaing ({row.source === 'mapid' ? 'MAPID' : 'OSM'}, r={app.weights.radius} m) ·
				{row.listings} listing<br />
				N misi = {row.nTot} titik
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
	:global(.stn.is-nodata .stn-dot) {
		border-style: dashed;
		border-color: var(--nodata);
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
	/* The transit count for the selected cell. Sits under the dot, opposite the name
	   above it, so the two never fight for the same space. */
	:global(.stn-transit) {
		position: absolute;
		left: 0.625rem;
		top: 0.3125rem;
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
	:global(.stn-transit.has-rail) {
		border-color: var(--accent);
		color: var(--accent);
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
