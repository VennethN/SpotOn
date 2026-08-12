/**
 * Overpass client for the data-building scripts.
 *
 * The exact same block — endpoint list, User-Agent, backoff, and the whole
 * retry logic — used to be copied into build-hexes.mjs and build-routes.mjs.
 * Two copies meant a fix in one script (e.g. adding a new mirror while the old
 * one is saturated) never reached the other.
 */

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.osm.jp/api/interpreter'
];

const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a single Overpass query, rotating mirrors and backing off as needed.
 *
 * @param {string} query  Overpass QL query
 * @param {string} label  named in error messages so it is clear which query failed
 * @param {{ attempts?: number }} [opts]
 */
export async function overpass(query, label, opts = {}) {
	const attempts = opts.attempts ?? 5;
	let lastErr;

	for (let i = 0; i < attempts; i++) {
		const url = ENDPOINTS[i % ENDPOINTS.length];
		try {
			// Overpass answers 406 for requests without an explicit User-Agent —
			// nothing to do with the query itself. This header is what gets it served.
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': UA,
					accept: 'application/json'
				},
				body: new URLSearchParams({ data: query })
			});
			// Overpass is a shared service; being rate-limited is normal, not an error.
			if (res.status === 429 || res.status === 504) {
				const wait = 8000 * (i + 1);
				console.log(`  (${label}) rate-limited, waiting ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			await sleep(5000 * (i + 1));
		}
	}

	throw new Error(`Overpass failed for ${label}: ${lastErr?.message ?? 'unknown'}`);
}
