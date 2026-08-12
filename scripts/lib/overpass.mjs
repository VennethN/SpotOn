/**
 * Overpass client for the data-building scripts.
 *
 * The exact same block — endpoint list, User-Agent, backoff, and the whole retry
 * logic — used to be copied into build-hexes.mjs and build-routes.mjs. Two copies
 * meant a fix in one script (e.g. adding a new mirror while the old one is
 * saturated) never reached the other.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.osm.jp/api/interpreter'
];

const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Statuses that mean "the server is busy, try again" — not "this query is wrong".
 * Treating them as errors is the easiest way to throw away work that only needed
 * repeating.
 *
 * 503 was once missing from this list, and it cost a full run of
 * `join-mapid.mjs`: two mirrors answered 429, the third answered 503, and because
 * 503 fell into the generic error branch its backoff was only 5 seconds — far too
 * short for an Overpass queue, so the remaining attempts burned through in seconds
 * and the script gave up after seven minutes of waiting for nothing. Overpass uses
 * 503 for exactly "all query slots are in use".
 */
const BUSY = new Set([429, 502, 503, 504]);

/**
 * Runs a single Overpass query, rotating mirrors and backing off as needed.
 *
 * @param {string} query  Overpass QL query
 * @param {string} label  named in error messages so it is clear which query failed
 * @param {{ attempts?: number }} [opts]
 */
/**
 * The queries here set `[timeout:180]`, so waiting three minutes is normal. What is
 * not normal is waiting forever: a `fetch` with no signal never gives up on its own,
 * and a dead mirror hangs without answering anything. One unresponsive mirror once
 * consumed the entire attempt budget in the most confusing way possible — no error,
 * no progress, just silence.
 */
const REQUEST_TIMEOUT_MS = 200_000;

/**
 * A cache of Overpass answers, so queries that HAVE succeeded do not need repeating
 * when another query in the same script fails.
 *
 * `build-hexes.mjs` fires five queries in a row. Throughout this session Overpass
 * was saturated for long stretches, and three rebuilds were lost because one final
 * group gave up — throwing away the four earlier queries that had already passed,
 * each after minutes of waiting. With this cache, the next attempt continues from
 * where it failed.
 *
 * Its lifetime is deliberately short. This is a tool for making retries painless,
 * NOT a way to speed up data builds: if its contents were allowed to age,
 * `hexes.json` could quietly be built from last week's OSM without anyone noticing.
 * Delete it any time — `rm -rf scripts/.overpass-cache`.
 */
const CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.overpass-cache');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cachePath(query) {
	return resolve(CACHE_DIR, `${createHash('sha1').update(query).digest('hex')}.json`);
}

function readCache(query, label) {
	try {
		const p = cachePath(query);
		const age = Date.now() - statSync(p).mtimeMs;
		if (age > CACHE_TTL_MS) return null;
		const hit = JSON.parse(readFileSync(p, 'utf8'));
		console.log(`  (${label}) using cache, ${Math.round(age / 60000)} minutes old`);
		return hit;
	} catch {
		return null;
	}
}

function writeCache(query, data) {
	try {
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(cachePath(query), JSON.stringify(data));
	} catch {
		// Failing to write the cache is no reason to fail the fetch.
	}
}

export async function overpass(query, label, opts = {}) {
	// Heavy queries (e.g. administrative boundaries with `out geom`) often need
	// several turns before a mirror has a free slot. Eight attempts cycle each mirror
	// more than twice.
	const attempts = opts.attempts ?? 8;
	let lastErr;

	const cached = readCache(query, label);
	if (cached) return cached;

	// Mirrors that fail at the connection level — timeout, expired certificate, DNS —
	// are struck off for the rest of this call. Unlike a busy mirror, which is worth
	// retrying: these will not suddenly recover within seconds, and every attempt
	// spent on them eats a turn that should have gone to a mirror that is alive.
	const dead = new Set();

	for (let i = 0; i < attempts; i++) {
		const alive = ENDPOINTS.filter((e) => !dead.has(e));
		if (alive.length === 0) break;
		const url = alive[i % alive.length];
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
				body: new URLSearchParams({ data: query }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
			// Overpass is a shared service; being rate-limited is normal, not an error.
			if (BUSY.has(res.status)) {
				const wait = 8000 * (i + 1);
				console.log(`  (${label}) ${res.status}, mirror busy — waiting ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const data = await res.json();
			// Overpass answers a timed-out query with HTTP 200 and a body of
			// `{"elements":[], "remark":"runtime error: Query timed out"}`. `res.ok` is
			// true, so without this check that empty answer is accepted as a valid
			// result — and `build-hexes.mjs` writes an EXPLICIT zero for every category
			// in its group. An explicit zero is read by the scoring engine as "surveyed,
			// genuinely nothing there", which means the whole of Jakarta gets the
			// highest opportunity score for that category. It would be cached too, so
			// re-running to fix it would return the same result without touching the
			// network. Treated as a failure worth retrying.
			if (data?.remark) throw new Error(`Overpass remark: ${String(data.remark).slice(0, 120)}`);
			writeCache(query, data);
			return data;
		} catch (err) {
			lastErr = err;
			const host = new URL(url).host;
			// Only failures that will not recover on their own strike a mirror off.
			//
			// The first version struck a mirror off on EVERY throw, and that was far too
			// harsh: one ECONNRESET, one certificate mid-renewal, or one HTML error page
			// that failed to `json()` was enough to kill a mirror that was actually
			// healthy. With three mirrors, three unrelated momentary glitches exhausted
			// the whole list in seconds — where the previous version cycled the same
			// mirrors up to five times and recovered.
			const fatal = /certificate|ENOTFOUND|EAI_AGAIN|ERR_TLS|self-signed/i.test(err.message);
			if (fatal) {
				dead.add(url);
				console.log(`  (${label}) ${host}: ${err.message} — struck off, switching mirror…`);
			} else {
				console.log(`  (${label}) ${host}: ${err.message} — retrying…`);
			}
			await sleep(5000 * (i + 1));
		}
	}

	throw new Error(`Overpass failed for ${label}: ${lastErr?.message ?? 'all mirrors busy'}`);
}
