import { env } from '$env/dynamic/public';
import type {
	LayerSpecification,
	Map as MapLibreMap,
	StyleSpecification,
	VectorTileSource
} from 'maplibre-gl';
import type { BasemapSource, BasemapTiles } from '$lib/types';

/**
 * Which basemap the map draws on.
 *
 * Lifted out of `MapView` along with the icon generators and the source builders,
 * because that component had grown past 1,800 lines and everything in it was one closure
 * over the same handful of variables. What is here depends on configuration and on
 * nothing else in the app, so it can be read and changed without the map in front of you.
 */

/**
 * MAPID MAPS' style server, and the two styles this map uses.
 *
 * The shape comes from MAPID's own documentation:
 *
 *   https://v2.basemap.mapid.io/styles/{style}/style.json?key=<Map Service key>
 *
 * with `street-v2.0`, `satellite-v2.0`, `dark-v2.0` and `light-v2.0` published. The two
 * plain ones are used here because this map draws a coloured hexagon over every part of
 * the city it has an opinion about: a street map underneath fights the ramp for the same
 * hues, and satellite imagery loses to it outright.
 *
 * The buildings are in all four. `MapView` raises them when the reader asks for 3D.
 */
const STYLE_HOST = 'https://v2.basemap.mapid.io/styles';
const MAPID_STYLE = { light: 'light-v2.0', dark: 'dark-v2.0' } as const;

/** A MAPID key rather than a URL: a run of hexadecimal and nothing else. The lengths
    differ, which is why this is a range — MAPID's documentation demonstrates a
    24-character key and the dashboard has handed out 32. */
const looksLikeKey = (s: string) => /^[0-9a-f]{16,64}$/i.test(s);

/**
 * The Map Service key, from whichever place it might reasonably be in.
 *
 * `MAPID_MAPSERVICES_KEY` is the setting, named after the MAPID Dashboard section that
 * hands it out, so the dashboard and the environment use the same words. It carries no
 * `PUBLIC_` prefix, so SvelteKit keeps it on the server: the `/app` layout load reads it
 * and hands it down, and that is what `given` is.
 *
 * `PUBLIC_MAPID_MAP_KEY` is read too, because that is where the key went before the
 * server route existed. And the key was in `PUBLIC_MAPID_STYLE_URL` before that, because
 * that was the only setting there was and a dashboard that hands out a key next to a
 * field asking for a URL is going to be answered with a key. Reading all three costs two
 * tests and saves everyone who has already done either from being told they put it in
 * the wrong place.
 */
function mapidKey(given?: string | null): string | null {
	const handed = given?.trim();
	if (handed) return handed;
	const named = env.PUBLIC_MAPID_MAP_KEY?.trim();
	if (named) return named;
	const legacy = env.PUBLIC_MAPID_STYLE_URL?.trim();
	return legacy && looksLikeKey(legacy) ? legacy : null;
}

export const mapidStyleUrl = (theme: 'light' | 'dark', key: string): string =>
	`${STYLE_HOST}/${MAPID_STYLE[theme]}/style.json?key=${encodeURIComponent(key)}`;

/**
 * The open basemap, used when MAPID's cannot be.
 *
 * CARTO publishes this cartography twice, and the two halves stopped being equivalent.
 * The raster tiles are the ones everybody linked for a decade, and CARTO now stamps
 * "API KEY REQUIRED" and its own signup URL diagonally across every one it serves
 * unkeyed. They still answer 200, so nothing errors anywhere and the nag is simply drawn
 * into the picture, which leaves the reader blaming MAPID or this app for a charge
 * neither of them made. The vector tiles behind `positron` and `dark-matter` are the
 * same map rendered from the same OpenStreetMap data, and they are served clean.
 *
 * Vector also returns the two things the raster fallback quietly cost. It carries
 * building footprints, so the 3D view has something to stand up rather than only
 * tilting, and it carries a `glyphs` source, so `text-field` layers render at all.
 *
 * CARTO's fair use limit applies to both, a key is free and lifts it, and the finished
 * product is meant to be on MAPID MAPS rather than on either of these.
 */
const CARTO_VECTOR = { light: 'positron-gl-style', dark: 'dark-matter-gl-style' } as const;

/** One credit line for both, so it reads the same whichever the reader ends up on. */
const OPEN_ATTRIBUTION =
	'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a> · basemap final: MAPID MAPS';

const vectorStyles = new Map<string, Promise<StyleSpecification | null>>();

/**
 * CARTO's vector style, read here rather than handed to MapLibre as a URL.
 *
 * Passing the URL straight through would work and would save a round trip, since the
 * browser has the file cached by the time the map asks a second time. It is not worth
 * what it reintroduces: a style URL MapLibre cannot load leaves a blank canvas and never
 * fires `styledata`, which is the single outcome this file exists to prevent. Fetched
 * here, a style that does not arrive is a `null` the caller can answer, and the caller
 * always returns something MapLibre can mount.
 *
 * Cached per theme, because switching theme must not pay for the same file twice.
 */
function vectorStyle(theme: 'light' | 'dark'): Promise<StyleSpecification | null> {
	const cached = vectorStyles.get(theme);
	if (cached) return cached;
	const pending = fetch(`https://a.basemaps.cartocdn.com/gl/${CARTO_VECTOR[theme]}/style.json`)
		.then((res) => (res.ok ? (res.json() as Promise<StyleSpecification>) : null))
		.then((style) => {
			// The style credits CARTO and OpenStreetMap through its own TileJSON, which is a
			// second request and a different wording. Say it here, once, in ours.
			const source = style?.sources?.carto;
			if (source && source.type === 'vector') source.attribution = OPEN_ATTRIBUTION;
			return style;
		})
		.catch(() => null);
	vectorStyles.set(theme, pending);
	return pending;
}

/**
 * The raster basemap, kept for the one case the vector style cannot cover.
 *
 * THIS ONE IS WATERMARKED, and it is reached only when CARTO's style server does not
 * answer at all. Its tiles come from the host that just failed, so it will usually draw
 * nothing. Drawing is not what it is for. It is a style MapLibre can mount without
 * asking anyone anything, so `styledata` fires, the recommendation layers go on, and
 * every figure in SpotOn stays readable over an empty canvas. Losing the basemap has to
 * cost the basemap and nothing else.
 */
export function rasterStyle(theme: 'light' | 'dark'): StyleSpecification {
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
				attribution: OPEN_ATTRIBUTION
			}
		},
		layers: [{ id: 'base', type: 'raster', source: 'base' }]
	} satisfies StyleSpecification;
}

/**
 * Whether the configured key is actually accepted, asked once and remembered.
 *
 * THIS IS THE PART THAT CANNOT BE SKIPPED. A style URL MapLibre cannot fetch does not
 * degrade, it stops: `styledata` never fires, the recommendation layers are never
 * mounted, and the reader gets a blank canvas with a score engine sitting behind it
 * that had nothing to do with the failure. Every figure in this product is computed
 * locally and none of it needs a basemap at all, so losing the basemap must cost the
 * basemap and nothing else.
 *
 * A refused key is not a hypothetical. MAPID's tile service answers 401 with "pastikan
 * token atau kredensial yang digunakan sudah benar dan masih aktif" for a key that has
 * expired or was issued for a different service, and the two are indistinguishable from
 * out here.
 *
 * Keyed on the key rather than on the theme: authorisation is the same for both styles,
 * so switching theme must not pay for a second round trip.
 */
const probes = new Map<string, Promise<boolean>>();

function keyWorks(key: string, theme: 'light' | 'dark'): Promise<boolean> {
	const cached = probes.get(key);
	if (cached) return cached;
	const fellBack =
		'so the open basemap is being used instead. Nothing else changes: every figure in SpotOn is computed locally, ' +
		'and the relief view stands the catchments up rather than the basemap, so it works over either. ' +
		'What is lost is MAPID MAPS itself, which the finished product is meant to draw on. ' +
		'A Map Service key from the MAPID Dashboard goes in MAPID_MAPSERVICES_KEY.';
	const probe = fetch(mapidStyleUrl(theme, key))
		.then((res) => {
			if (!res.ok) console.warn(`[SpotOn] MAPID MAPS refused the key (HTTP ${res.status}), ${fellBack}`);
			return res.ok;
		})
		.catch(() => {
			/*
			 * A REFUSED KEY LOOKS EXACTLY LIKE THIS FROM A BROWSER, and there is no way
			 * to tell the two apart from here. MAPID sends `access-control-allow-origin`
			 * on a 200 and nothing at all on a 401, so a rejected key fails CORS and the
			 * fetch rejects before any status is readable. A server that is genuinely
			 * down rejects the same way. The message covers both rather than picking one
			 * and being confidently wrong half the time.
			 */
			console.warn(
				`[SpotOn] MAPID MAPS did not answer, which is what both a refused key and an unreachable server look like from a browser, ${fellBack}`
			);
			return false;
		});
	probes.set(key, probe);
	return probe;
}

/**
 * The style to draw on, resolved.
 *
 * `given` is the Map Service key the server read from `MAPID_MAPSERVICES_KEY`, when
 * there is one. See `mapidKey` for the two `PUBLIC_` names read when there is not.
 *
 * Async because of the probe above, and the callers are async already: the map waits on
 * `import('maplibre-gl')` before it can be built at all.
 */
export async function basemapStyle(
	theme: 'light' | 'dark',
	given?: string | null
): Promise<string | StyleSpecification> {
	/*
	 * A full style URL wins and is not probed, because it is the only setting that can
	 * point at something this file does not know about — a style MAPID publishes later,
	 * a self-hosted one, a proxy in front of either. Somebody who wrote a URL meant it.
	 */
	const configured = env.PUBLIC_MAPID_STYLE_URL?.trim();
	if (configured && (/^(https?:)?\/\//.test(configured) || configured.startsWith('/'))) {
		return configured;
	}

	const key = mapidKey(given);
	if (key && (await keyWorks(key, theme))) return mapidStyleUrl(theme, key);

	if (configured && !key) {
		// Something is in the URL variable and it is neither a URL nor a key. Pasted as
		// is it resolves as a path relative to the page, 404s, and leaves a blank canvas
		// with no error anywhere the user can see.
		console.warn(
			`[SpotOn] PUBLIC_MAPID_STYLE_URL is neither a URL nor a MAPID key ("${configured}"), so the open basemap is being used instead.`
		);
	} else if (!key) {
		/*
		 * Nothing is configured at all, which used to be the one branch that fell back in
		 * silence. It is the branch a bare clone lands on, so it is the one most people see,
		 * and what it draws is somebody else's cartography under a product that names MAPID
		 * MAPS on its own attribution line. Worth one line in the console.
		 */
		console.warn(
			'[SpotOn] No MAPID Map Service key is set, so the open basemap is being used instead. ' +
				'Nothing else changes, every figure in SpotOn is computed locally. ' +
				'A Map Service key from the MAPID Dashboard goes in MAPID_MAPSERVICES_KEY.'
		);
	}

	// Vector first, raster only if CARTO's style server does not answer. See `rasterStyle`.
	return (await vectorStyle(theme)) ?? rasterStyle(theme);
}

/* ── what the area model is built from ─────────────────────────────────────
   The model of a selected area is the basemap's own geometry, cut to the walking
   range: see `domain/basemap`. Which basemap that is gets decided above, at runtime,
   so the tile source has to be read back off the style MapLibre actually loaded rather
   than off configuration. `MapView` calls this once the style is in and hands the
   answer to `AppState`, which fetches the tiles the way it fetches the stops. */

/** A layer's source-layer, on the kinds of layer that have one. */
const sourceLayerOf = (layer: LayerSpecification): string | null => {
	const named = (layer as { 'source-layer'?: unknown })['source-layer'];
	return typeof named === 'string' ? named : null;
};

/**
 * Every vector source carrying buildings, as the live map holds them.
 *
 * All of them, in the style's order, because a style can draw a city from more than
 * one: MAPID's lays an Indonesia set over a world set, and for Jakarta the world tiles
 * come back empty while the Indonesia tiles carry the streets. Reading only the first
 * source found was how the model of a Jakarta cell once came back as a bare disc under
 * a mark saying it was built from the basemap.
 *
 * `'pending'` means a source is there but its tile templates are not known yet: a
 * source declared by TileJSON URL learns them when that file arrives, which is a
 * `sourcedata` event later. `null` means this style draws no vector buildings at all,
 * which is the last-resort raster basemap and nothing else, and then there is nothing
 * to model from and the interface says so.
 */
export function readBasemapTiles(map: MapLibreMap): BasemapTiles | 'pending' | null {
	const layers = map.getStyle()?.layers ?? [];

	// Which source each building layer draws from, and what it calls the layer.
	const buildingLayers = new Map<string, string>();
	for (const l of layers) {
		const name = sourceLayerOf(l);
		if (l.type === 'symbol' || !name || !/building/i.test(name)) continue;
		const sourceId = 'source' in l ? l.source : null;
		if (typeof sourceId === 'string' && !buildingLayers.has(sourceId)) buildingLayers.set(sourceId, name);
	}
	if (!buildingLayers.size) return null;

	const sources: BasemapSource[] = [];
	for (const [sourceId, building] of buildingLayers) {
		const source = map.getSource(sourceId);
		if (!source || source.type !== 'vector') continue;
		const vector = source as VectorTileSource;
		if (!vector.tiles?.length) return 'pending';

		// Every source-layer this style draws from the same source, spelled as it
		// spells them. Read by name rather than assumed, so a style that calls its roads
		// something else is read rather than ignored.
		const names = new Set<string>();
		for (const l of layers) {
			if ('source' in l && l.source === sourceId) {
				const name = sourceLayerOf(l);
				if (name) names.add(name);
			}
		}
		const pick = (re: RegExp): string | undefined => [...names].find((n) => re.test(n));
		sources.push({
			id: sourceId,
			tiles: vector.tiles,
			minzoom: vector.minzoom ?? 0,
			maxzoom: vector.maxzoom ?? 14,
			scheme: vector.scheme === 'tms' ? 'tms' : 'xyz',
			layers: {
				building,
				transportation: pick(/^transportation$|^road|^street|^highway/i),
				water: pick(/^water$/i),
				waterway: pick(/^waterway/i),
				park: pick(/^park$/i),
				landcover: pick(/^landcover/i),
				landuse: pick(/^landuse$/i)
			}
		});
	}
	if (!sources.length) return null;
	return { key: sources.map((s) => s.tiles[0]).join(' '), sources };
}
