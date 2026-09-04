import { cellName } from '$lib/domain/scoring';
import type { AppState } from '$lib/state/app.svelte';
import type { Copy } from '$lib/i18n';
import { rampIndex } from '$lib/utils/format';
import { emptyFC, ringCoords } from '$lib/utils/geo';
import type { FeatureCollection } from 'geojson';

/**
 * What the map is given to draw, as GeoJSON.
 *
 * These were methods on `MapView`, closing over the component's `app`, `c`, `heat` and
 * `cssVar`. That is why they lived in a 1,855-line file: each one is a small, pure
 * transform, and every one of them was welded to a Svelte component and to a live
 * MapLibre instance, so none could be read or checked on its own.
 *
 * They take that context explicitly now. The map is still the only caller, and the point
 * is not to gain a second one — it is that WHAT GOES ON THE MAP is the thing feature work
 * changes, and it should be possible to look at it without the 900 lines of layer
 * definitions, event wiring and marker bookkeeping around it.
 *
 * Every rule they encode is a rule this product cares about, and they are all here:
 * unsurveyed is drawn as unsurveyed rather than as a low score, a count on screen never
 * disagrees with a count in a panel, and a mode draws its own marks rather than both.
 */
export interface MapCtx {
	app: AppState;
	c: Copy;
	/** The heatmap is on AND the active category has arrived. */
	heat: boolean;
	cssVar: (name: string) => string;
}

/**
 * A name cut down to what a map label can carry.
 *
 * Names run long: the median stop is 16 characters but the tail reaches 57. Wrapped
 * rather than cut, one such name becomes a five-line block roughly the height of a
 * thumbnail, and because the collision index works on the whole block it evicts every
 * neighbour it touches. The full name stays on the feature and is what the panel lists;
 * the ellipsis is there so a cut name reads AS cut rather than as a shorter name that
 * does not exist.
 */
const LABEL_CHARS = 30;
export const labelText = (n: string): string =>
	n.length <= LABEL_CHARS ? n : `${n.slice(0, LABEL_CHARS - 1).trimEnd()}…`;

/**
 * How tall a catchment stands in the raised view, in metres.
 *
 * Metres because that is the unit `fill-extrusion` takes, and the number only means
 * anything against the cell it is drawn on: at H3 resolution 8 a catchment is about
 * 900 m across, so a full reading stands a little over one cell-width tall. Enough
 * that the ranking is a skyline at the zoom the whole grid fits in, and not so much
 * that the front row buries the city behind it.
 *
 * The floor is what keeps a measured nothing apart from an absence. A cell that scored
 * zero was measured, so it gets a slab. A cell nobody surveyed gets no height at all
 * and stays flat on the ground under its hatch, which is the same rule the colour
 * already follows.
 */
const RELIEF_FLOOR = 120;
const RELIEF_TOP = 1400;

/** The metres one reading stands, or nothing at all where there is no reading. */
const reliefHeight = (v: number | null): number =>
	v === null ? 0 : RELIEF_FLOOR + v * (RELIEF_TOP - RELIEF_FLOOR);

export function catchmentFC(ctx: MapCtx): FeatureCollection {
	// In unit mode the cells stop being the reading and go back to being structure.
	//
	// Leaving the fill on meant the map carried the heatmap twice — a hexagon shaded
	// by its score with a dot on top shaded by the same score — and the louder of the
	// two was the one the reader was no longer looking at. The grid stays drawn,
	// faintly, because it is what tells you which units share a catchment.
	const on = ctx.heat && ctx.app.pivot === 'cell';
	const rows = on ? ctx.app.rowById : null;
	/* WHAT THE FILL MEANS, decided in one place upstream rather than read off `score`
	   here. It was read off `score`, which was safe while a score was the only thing
	   this layer could be drawing and became a quiet falsehood the moment it was not:
	   with no business type named every score is null, and this would have dashed all
	   562 cells as unsurveyed. `heatById` hands over the number that is genuinely on
	   screen, whichever basis produced it. */
	const heat = on ? ctx.app.heatById : null;
	const colIdle = ctx.cssVar('--cell-idle');
	const ramp = Array.from({ length: 7 }, (_, i) => ctx.cssVar(`--ramp-${i}`));
	const selectedId = ctx.app.selectedId;

	return {
		type: 'FeatureCollection',
		features: ctx.app.base
			.map((h, i) => {
				const row = rows?.get(h.id) ?? null;
				const v = heat?.get(h.id) ?? null;
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
						// A cell left unscored because the active source has not surveyed
						// its city. Given no colour at all, because any colour would read
						// as a score. This is the only kind of blank the map has left: the
						// flag that used to grey out one cell in six was rolled by a
						// random number generator at build time.
						//
						// Only ever claimed while the heatmap is on: with no category
						// loaded nothing has been checked yet, and dashing every cell
						// would report a coverage gap that has not been looked for.
						uncovered: Boolean(row) && v === null,
						color: v === null ? colIdle : ramp[rampIndex(v)],
						// Carries a reading right now, so the fill means something. An idle cell
						// is drawn as structure instead: faint fill, crisper edge.
						scored: v !== null,
						/* The SAME number the colour is, in the other channel. Height and
						   colour are two readings of one figure rather than two figures, so
						   they cannot come to disagree, and the raised view says nothing the
						   flat one was not already saying. */
						height: reliefHeight(v),
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
export function stopsFC(ctx: MapCtx): FeatureCollection {
	if (!ctx.app.layers.stops) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedStops.map((s) => ({
			type: 'Feature' as const,
			geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
			properties: {
				mode: s.mode,
				name: s.name,
				// Written only when there IS a name, so `['has', 'label']` can filter on
				// it. An empty string is a label as far as MapLibre is concerned, and it
				// reserves collision space for a label nobody can read.
				...(s.name ? { label: labelText(s.name) } : {}),
				// Rail gets a bigger mark. It is a single fixed doorway, and there are
				// twenty of them against nine hundred and seventy-six halte.
				rail: s.mode !== 'brt',
				// Placement priority within its own label layer, lowest first. Nearest
				// wins, because the stop on the cell's own doorstep is the one its
				// score leans on hardest. Ranking BETWEEN the classes is the layer
				// order, not this — see `LABEL_LAYERS`.
				sort: Math.round(s.distance)
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
export function stopLinksFC(ctx: MapCtx): FeatureCollection {
	const cell = ctx.app.selectedCell;
	if (!ctx.app.layers.stops || !cell) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedStops.map((s) => ({
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

/**
 * The walking range, drawn as it was measured.
 *
 * One ring for both fans, because it is one rule: the transit nodes and the
 * competitors are captured by the same test at the same radius from the same
 * centre. So it is drawn whenever either of them is on screen, and drawing it
 * twice would only put two identical circles on top of each other.
 */
export function reachFC(ctx: MapCtx): FeatureCollection {
	const cell = ctx.app.selectedCell;
	if (!cell) return emptyFC();
	if (!ctx.app.layers.stops && !ctx.app.layers.poi) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature' as const,
				geometry: {
					type: 'LineString' as const,
					coordinates: ringCoords(cell.lon, cell.lat, ctx.app.weights.radius)
				},
				properties: {}
			}
		]
	};
}

/**
 * The competitor mark: a square, not a dot.
 *
 * Colour alone cannot carry this. `--route-krl` is #e05a5a and `--critical` is
 * #d1352b, and in dark mode they are #ff7b74 against #ff6257 — so a red circle for
 * a competitor and a red circle for a KRL station are the same mark to anyone not
 * holding a swatch, and closer still to a reader with a colour vision deficiency.
 * The two mean opposite things: one is why a cell is worth having, the other is
 * what stands in the way.
 *
 * A square separates them by shape, which survives both. Drawn at 2× and handed to
 * MapLibre with `pixelRatio: 2` so the edges stay crisp on a retina screen, and
 * carrying its own knockout border for the same reason the transit nodes have a
 * plate: this sits on a heatmap fill whose colour changes cell to cell.
 */

export function propertyFC(ctx: MapCtx): FeatureCollection {
	// Unit mode has its own layer, drawing the whole market rather than one cell's
	// share of it. Drawing both would put two marks on every doorway.
	if (ctx.app.pivot === 'unit') return emptyFC();
	if (!ctx.app.layers.property) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedListings
			.filter((l) => l.premises)
			.map((l) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [l.lon, l.lat] },
				properties: {
					label: ctx.c.property.types[l.type] ?? l.type,
					// Only where the listing published one. A unit with no price is still a
					// vacancy and is still drawn, with its type alone under it — the same
					// rule the competitors follow for a missing name.
					...(l.price !== null ? { price: ctx.c.property.unitPrice(l.price) } : {}),
					sort: Math.round(l.distance)
				}
			}))
	};
}

/**
 * The field records the selected cell holds, at the spots they were filed from.
 *
 * ONE MARK FOR ALL FOUR SURVEYS, and that is deliberate. This map already carries red
 * squares for competitors, amber pins for units on the market and mode-coloured discs
 * for transit nodes, and four more colours would turn a legend into a colour test.
 * What these have in common is the thing worth showing: somebody stood here. So they
 * are drawn as one hollow ring, which no other layer uses.
 *
 * The single exception is a place recorded as being up for rent. That is the one fact
 * this product could never show before, so it is the one mark that gets filled in.
 *
 * Nothing is drawn in unit mode. There the map is a list of doorways across the whole
 * city rather than one catchment's surroundings, and these belong to a catchment.
 */
export function fieldFC(ctx: MapCtx): FeatureCollection {
	if (ctx.app.pivot === 'unit') return emptyFC();
	if (!ctx.app.layers.field) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedField.map((r) => ({
			type: 'Feature' as const,
			geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
			properties: {
				kind: r.kind,
				rent: r.offer === 'sewa',
				label: ctx.c.field.kinds[r.kind],
				name: r.place ?? r.title ?? '',
				sort: r.distance
			}
		}))
	};
}

/**
 * Every unit on the market, in unit mode — the whole set at once, not one cell's.
 *
 * Coloured by the opportunity score of the catchment each one stands in, so the map
 * answers the two halves of the question in one look: where the units ARE, and which
 * of them sit somewhere worth being. A unit whose category has not been surveyed
 * carries no colour and is drawn in the no-data grey, never at the bottom of the
 * ramp — an unsurveyed catchment is not a bad one.
 *
 * Only the ranked, filtered list is drawn. That is the point of the mode: the marks
 * on screen and the rows in the panel are the same set, so narrowing one narrows the
 * other and the reader can see what a filter actually did.
 */
export function unitsFC(ctx: MapCtx): FeatureCollection {
	if (ctx.app.pivot !== 'unit') return emptyFC();
	// Resolved to real colours here rather than handed over as `var(--ramp-3)`:
	// MapLibre paints on a canvas and cannot read a CSS custom property. This is the
	// same resolution `catchmentFC` does, and it is why a theme change re-runs both.
	const colNodata = ctx.cssVar('--nodata');
	const ramp = Array.from({ length: 7 }, (_, i) => ctx.cssVar(`--ramp-${i}`));

	/**
	 * The ramp follows THE SORT, not the opportunity score.
	 *
	 * It was the score, and that made the map disagree with the panel beside it: sort
	 * the list by price and you got rows ordered by price over a map coloured by
	 * something else, with nothing saying so. Here the darkest dots are the top of
	 * the list the reader is actually looking at, whichever measure and direction
	 * that is — flip to "most expensive first" and the dark dots are where the money
	 * is. One rule, and it holds for every measure without needing to know which end
	 * of each one counts as good.
	 *
	 * The positions come from `domain/units` rather than being worked out here, because
	 * the hover readout paints its figure from the same ladder. Two copies of it would
	 * eventually put a tooltip in one shade beside the dot it describes in another.
	 */
	const rank = ctx.app.unitRanks;

	/**
	 * The catchments Tapak's last answer named, carried over to this mode.
	 *
	 * The answer engine ranks CATCHMENTS whichever pivot the map is in — it runs on the
	 * grid, and the individual units are a browser-side file it never sees. So in unit
	 * mode a highlight would otherwise land on cells nobody can see and the reply would
	 * name five places the map did not mark. Ringing every unit standing in one keeps the
	 * sentence and the map talking about the same places.
	 */
	const named = new Set(ctx.app.highlight);

	// Every unit the filters left, not just the ranked ones. A sort by price per m²
	// can rank only half of them, and dropping the rest would take a thousand marks
	// off the map on a change the reader will read as a filter. They are drawn in the
	// no-data grey instead, which is the same thing the panel counts out loud.
	return {
		type: 'FeatureCollection',
		features: ctx.app.unitFiltered.map((unit) => {
			const r = rank.get(unit.id);
			return {
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [unit.listing.lon, unit.listing.lat] },
				properties: {
					id: unit.id,
					color: r === undefined ? colNodata : ramp[rampIndex(r.fraction)],
					ranked: r !== undefined,
					selected: unit.id === ctx.app.selectedUnitId,
					named: named.has(unit.cellId)
				}
			};
		})
	};
}

/**
 * The competitors the SELECTED cell captures — real positions, never the whole
 * city's.
 *
 * This used to scatter every cell's competitor COUNT on a Fibonacci spiral around
 * its centre: the right number of dots in invented places, on all 562 cells at
 * once. It answered "how many", which the panel already answers better, and
 * quietly implied a distribution nobody had measured.
 *
 * These are the MAPID points themselves, captured by the same distance test the
 * grid counted them with. So the dots are not an illustration of the count, they
 * ARE the count — and where they cluster is a real fact about the cell.
 */
export function poiFC(ctx: MapCtx): FeatureCollection {
	if (!ctx.app.layers.poi) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedPois.map((p) => ({
			type: 'Feature' as const,
			geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
			properties: {
				// Only when the dataset has one. An unnamed outlet is still drawn: it
				// is a competitor whose name was never recorded, not a missing point.
				...(p.name ? { label: labelText(p.name) } : {}),
				sort: Math.round(p.distance)
			}
		}))
	};
}

/**
 * A line from the selected cell's centre to every competitor it captures.
 *
 * The same device as the transit fan, doing the same job: the dots say "there are
 * rivals here", the fan says "these are the ones counted against this cell". It is
 * also literally the measurement — centre to point, under the walking radius.
 *
 * Fainter and thinner than even the bus links, because a cell can capture thirty
 * competitors where it captures twenty-odd stops, and at equal weight the fan
 * stops being a fan and becomes a smear.
 */
export function poiLinksFC(ctx: MapCtx): FeatureCollection {
	const cell = ctx.app.selectedCell;
	if (!ctx.app.layers.poi || !cell) return emptyFC();
	return {
		type: 'FeatureCollection',
		features: ctx.app.selectedPois.map((p) => ({
			type: 'Feature' as const,
			geometry: {
				type: 'LineString' as const,
				coordinates: [
					[cell.lon, cell.lat],
					[p.lon, p.lat]
				]
			},
			properties: {}
		}))
	};
}
