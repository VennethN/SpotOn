/**
 * Reads `MAPID_API_KEY` for the MAPID scripts.
 *
 * This block used to be copied into fetch-mapid.mjs and search-mapid.mjs, and both
 * would only read from the `.env` file.
 *
 * WHY THE ENVIRONMENT COMES FIRST
 *
 * `.env` is the right approach on your own machine — the file is not committed and
 * the key lives in one place. But these scripts also run in places that have no
 * such file at all: CI, containers, remote sessions. There the key arrives as an
 * environment variable, and the old version stopped at `readFileSync` with
 * `ENOENT: no such file or directory, open '.env'` — a message pointing at a
 * missing file when the key was already in the environment, waiting to be read.
 * What failed was not the credential but the way it was looked for.
 *
 * The order: environment first, `.env` as the fallback. That way a single
 * `MAPID_API_KEY=… node scripts/fetch-mapid.mjs` can override the contents of
 * `.env` without editing the file — useful when testing a different key.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Pulls a single value out of `.env` without pulling in a loader library.
 * Enough for a plain `KEY=value` file like this project's.
 */
function fromDotenv(name) {
	let raw;
	try {
		raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
	} catch {
		// A missing `.env` is not an error — the caller decides whether that is fatal,
		// once the environment has turned out to be empty too.
		return '';
	}
	const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'));
	return (m?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
}

/**
 * The MAPID read key. Throws with a message naming both routes if it is not found
 * anywhere.
 */
export function mapidKey() {
	const key = (process.env.MAPID_API_KEY ?? '').trim() || fromDotenv('MAPID_API_KEY');
	if (!key) {
		throw new Error(
			'MAPID_API_KEY not found — set it in .env (see .env.example) ' +
				'or export it as an environment variable'
		);
	}
	return key;
}
