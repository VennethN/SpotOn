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
 * The Map Service key, from either variable it might reasonably be in.
 *
 * `PUBLIC_MAPID_MAP_KEY` is the name that says what it holds. But the key was in
 * `PUBLIC_MAPID_STYLE_URL` first, because that was the only setting there was and a
 * dashboard that hands out a key next to a field asking for a URL is going to be
 * answered with a key. Reading it from there too costs one test and saves everyone who
 * has already done that from being told they put it in the wrong place.
 */
function mapidKey(): string | null {
	const named = env.PUBLIC_MAPID_MAP_KEY?.trim();
	if (named) return named;
	const legacy = env.PUBLIC_MAPID_STYLE_URL?.trim();
	return legacy && looksLikeKey(legacy) ? legacy : null;
}

export const mapidStyleUrl = (theme: 'light' | 'dark', key: string): string =>
	`${STYLE_HOST}/${MAPID_STYLE[theme]}/style.json?key=${encodeURIComponent(key)}`;

/**
 * The open raster basemap, used when MAPID's cannot be.
 *
 * Equally valid attribution, and a map that draws. It carries no building footprints,
 * so the 3D view can tilt over it but has nothing to stand up.
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
				attribution:
					'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a> · basemap final: MAPID MAPS'
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
		'so the open raster basemap is being used instead. Nothing else changes: every figure in SpotOn is computed locally, ' +
		'and the relief view stands the catchments up rather than the basemap, so it works over either. ' +
		'What is lost is MAPID MAPS itself, which the finished product is meant to draw on. ' +
		'A Map Service key from the MAPID Dashboard goes in PUBLIC_MAPID_MAP_KEY.';
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
 * Async because of the probe above, and the callers are async already: the map waits on
 * `import('maplibre-gl')` before it can be built at all.
 */
export async function basemapStyle(
	theme: 'light' | 'dark'
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

	const key = mapidKey();
	if (key && (await keyWorks(key, theme))) return mapidStyleUrl(theme, key);

	if (configured && !key) {
		// Something is in the URL variable and it is neither a URL nor a key. Pasted as
		// is it resolves as a path relative to the page, 404s, and leaves a blank canvas
		// with no error anywhere the user can see.
		console.warn(
			`[SpotOn] PUBLIC_MAPID_STYLE_URL is neither a URL nor a MAPID key ("${configured}"), so the open raster basemap is being used instead.`
		);
	} else if (!key) {
		/*
		 * Nothing is configured at all, which used to be the one branch that fell back in
		 * silence. It is also the branch a bare clone lands on, and the map it falls back to
		 * is no longer neutral: CARTO now stamps "API KEY REQUIRED" and its own signup URL
		 * diagonally across every tile it serves unkeyed. Saying nothing here leaves that
		 * watermark as the only account of what happened, and the watermark names CARTO,
		 * which is not the basemap this product is meant to be drawing on.
		 */
		console.warn(
			'[SpotOn] No MAPID Map Service key is set, so the open raster basemap is being used instead. ' +
				'The "API KEY REQUIRED" watermark across the map is CARTO stamping its own unkeyed tiles, not a fault in SpotOn. ' +
				'A Map Service key from the MAPID Dashboard goes in PUBLIC_MAPID_MAP_KEY.'
		);
	}
	return rasterStyle(theme);
}
