import { env } from '$env/dynamic/public';
import type { StyleSpecification } from 'maplibre-gl';

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
 */
const STYLE_HOST = 'https://v2.basemap.mapid.io/styles';
const MAPID_STYLE = { light: 'light-v2.0', dark: 'dark-v2.0' } as const;

/**
 * Looks like a MAPID key rather than a URL: a run of hexadecimal and nothing else.
 *
 * The lengths differ, which is why this is a range rather than a count. MAPID's own
 * documentation demonstrates a 24-character key and the one sitting in this project's
 * `.env` is 32, so a test written against either would miss the other and fall back to
 * the generic warning, which is the one that does not say where to put it.
 */
const looksLikeKey = (s: string) => /^[0-9a-f]{16,64}$/i.test(s);

export function basemapStyle(theme: 'light' | 'dark'): string | StyleSpecification {
	/*
	 * A full style URL wins, because it is the only setting that can point at something
	 * this file does not know about — a style MAPID publishes later, a self-hosted one,
	 * a proxy in front of either.
	 *
	 * It is checked rather than trusted. A bare key pasted here (they look like
	 * `f3b5f5f0…`) is not rejected by MapLibre: it is resolved as a path relative to the
	 * page, 404s, and leaves a blank canvas with no basemap and no error anywhere the
	 * user can see. So the warning names the variable the value actually belongs in,
	 * which is the mistake that has been sitting in this project's own `.env`.
	 */
	const configured = env.PUBLIC_MAPID_STYLE_URL?.trim();
	if (configured) {
		if (/^(https?:)?\/\//.test(configured) || configured.startsWith('/')) return configured;
		console.warn(
			`[SpotOn] PUBLIC_MAPID_STYLE_URL is not a URL ("${configured}").` +
				(looksLikeKey(configured)
					? ' That looks like a MAPID Map Service key rather than a style URL. Put it in PUBLIC_MAPID_MAP_KEY and this map will build the URL itself, in the theme the reader is using.'
					: ' MapLibre needs the full MAPID MAPS style URL, not the style id on its own.')
		);
	}

	/*
	 * A key is the setting to reach for, and the reason is the theme.
	 *
	 * One pasted URL names one style, so a map configured with the light one stayed light
	 * when the reader switched to dark and the hexagons sat on a white page in a dark
	 * interface. The key names the account rather than the picture, so the style can
	 * follow the theme the way the rest of the interface does.
	 */
	const key = env.PUBLIC_MAPID_MAP_KEY?.trim();
	if (key) return `${STYLE_HOST}/${MAPID_STYLE[theme]}/style.json?key=${encodeURIComponent(key)}`;

	// Neither is set. An open raster with equally valid attribution, rather than an
	// empty canvas, and the console says which variable would replace it.
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
