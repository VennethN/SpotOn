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
export function basemapStyle(theme: 'light' | 'dark'): string | StyleSpecification {
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
