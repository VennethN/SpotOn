/**
 * The shared MAPID client for the data scripts.
 *
 * WHY A MANUAL IMPORT TURNS OUT NOT TO BE REQUIRED
 *
 * The docs once concluded the opposite: that a premium layer's contents could only
 * be read after the dataset had been imported into your own project through the GEO
 * MAPID interface, because `get_layer` rejects someone else's layer with
 * `{"is_owner_project": false, "is_owner_layer": false}`.
 *
 * What was missed: that rejection comes from the `project_id` being sent, not from
 * the `layer_id`. What was tried at the time was MAPID Database's own `project_id` —
 * a project that genuinely is not ours, so of course it was refused. The server
 * checks "does the caller own this project", then serves the layer requested; it
 * never checks whether that layer is actually a member of that project.
 *
 * So a catalogue `layer_id` + OUR OWN `project_id` = 200 with the full contents, no
 * import at all. The old mistake was not in the endpoint but in concluding "not
 * allowed" from a single attempt with the wrong parameter.
 *
 * TWO TRAPS ALREADY SPRUNG ONCE — DO NOT REPEAT THEM
 *
 * 1. `get_layer` truncates at 200 features with no marker of any kind — a truncated
 *    response looks perfectly successful. RESTORAN Jakarta Barat is really 1,246
 *    points; without an explicit `limit`, 84% vanishes silently. That is why
 *    `readLayer` always sets `limit` and never accepts the default.
 *
 * 2. Searching the premium catalogue uses the parameter name `search_params` — not
 *    `search`, `q`, or `keyword`. Unknown parameters are silently ignored, so every
 *    guess returns the first unfiltered page and looks like "search is unsupported".
 */

import { mapidKey } from './mapid-key.mjs';

export { mapidKey };

export const GEOSERVER = 'https://geoserver.mapid.io';
export const BUN_SERVER = 'https://server.mapid.io';

const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; contact via repo)';

/** The official publisher of the premium data catalogue. */
const PUBLISHER = /mapid\.database|MAPID Database/i;

/**
 * Far above the largest layer ever encountered (MAKANAN DAN MINUMAN Jakarta Pusat,
 * 1,714 features). Raise it if one ever reaches it — and note that whatever hits the
 * limit will NOT tell you.
 */
export const FEATURE_LIMIT = 100000;

/** Our own GEO MAPID project. Used as a "read ticket", see the note above. */
export function projectId() {
	return process.env.MAPID_PROJECT_ID || '6a7c1672fb8d434002151fa7';
}

/**
 * Normalises a city name so that "KOTA ADM. JAKARTA PUSAT", "Kota Administrasi
 * Jakarta Pusat", and "JAKARTA PUSAT" all become the same key.
 *
 * It lives here rather than being copied into each script because it is used on both
 * sides of a balance that has to match exactly: `fetch-mapid.mjs` writes the list of
 * covered cities, `join-mapid.mjs` matches city names from OSM against that list. If
 * the two normalised even slightly differently, no error would surface — all that
 * would happen is every cell quietly being marked "not covered".
 */
export function normCity(s) {
	return String(s ?? '')
		.toUpperCase()
		.replace(/KOTA ADMINISTRASI|KOTA ADM\.?|KABUPATEN|KOTA/g, '')
		.replace(/[^A-Z]/g, '');
}

/**
 * An outlet name fit to print, or null.
 *
 * The catalogue writes an absent name several ways: missing, empty, and the literal
 * "-" that also stands in for an empty TIPE column. All three mean the same thing and
 * none of them is a name, so they collapse to null and the map draws that outlet as a
 * mark with no label. An unnamed competitor is still a competitor.
 *
 * It lives in this module rather than inside `fetch-mapid.mjs` for one reason: that
 * script calls `main()` on import and reaches the network, so nothing in it can be
 * loaded by a test. This is the only part of the fetch that has to be RIGHT rather
 * than merely reachable, and `selftest-pois.mjs` exercises it here without a key and
 * without a request.
 */
export function cleanName(v) {
	const s = String(v ?? '')
		.trim()
		.replace(/\s+/g, ' ');
	if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
	return s;
}

/**
 * One record per outlet, names merged.
 *
 * An outlet can appear in two datasets — COFFEE SHOP and MAKANAN DAN MINUMAN for the
 * same city both carry it — and without this, competitors get double-counted and a
 * busy cell looks twice as busy as it is.
 *
 * The key is the outlet, not the record, so it deliberately ignores the name: two
 * datasets spelling the same shop differently are still one shop, and keying on the
 * name would let it through twice. But when the copy already kept has no name and
 * the duplicate does, the name is taken. Same outlet, described better by the second
 * dataset, and dropping that would leave a mark on the map with no label for no
 * reason other than the order the layers happened to be read in.
 */
export function dedupePoints(points) {
	const byKey = new Map();
	for (const p of points) {
		const k = `${p.cat}|${p.lat}|${p.lon}`;
		const kept = byKey.get(k);
		if (!kept) byKey.set(k, { ...p });
		else if (!kept.name && p.name) kept.name = p.name;
	}
	return [...byKey.values()];
}

/**
 * Matches a dataset name against a search term and a city.
 *
 * Used by `fetch-mapid.mjs` and `search-mapid.mjs` so both judge "this is the
 * dataset we were looking for" in exactly the same way — if they differed, the
 * explorer could report a dataset as present while the fetcher skipped it, and vice
 * versa.
 *
 * The term is escaped before becoming a RegExp. `search-mapid.mjs` takes free-form
 * terms from the command line, so without this a single parenthesis is enough to
 * bring the script down with an error about regex syntax — an error with nothing to
 * do with anything the user was actually working on.
 */
export function matchesDataset(name, term, city) {
	const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const n = String(name ?? '');
	// `\b` only applies when the term ends in a word character. After a parenthesis
	// or punctuation there is never a word boundary before a space, so a `\b` applied
	// unconditionally would throw away correct matches. The boundary genuinely is
	// needed — without it "APOTEK" also grabs "APOTEKER SEJAHTERA".
	const boundary = /\w$/.test(term) ? '\\b' : '';
	return (
		new RegExp(`^${esc(term)}${boundary}`, 'i').test(n) &&
		new RegExp(esc(city).replace(/\s+/g, '\\s+'), 'i').test(n)
	);
}

/** GET JSON with staged retries. */
export async function getJSON(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': UA } });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
}

/**
 * Searches the PREMIUM CATALOGUE.
 *
 *   GET server.mapid.io/moneys_bun/search_data_premium_v2?search_params=<term>
 *
 * Unlike `layers_new/search_layers_public`, which only indexes public layers and
 * therefore gives misleading answers: APOTEK and LAUNDRY were once concluded to be
 * "not visible, check by hand" when APOTEK is in fact complete for all five cities
 * in the premium catalogue. This is the right endpoint for the question "does
 * dataset X exist".
 *
 * Its matching is AND per word, so a narrow query like "APOTEK JAKARTA PUSAT"
 * returns exactly one dataset. `skip` is accepted but ignored by the server — do not
 * rely on pagination; narrow the query instead.
 *
 * Results are filtered to MAPID Database's publications so that "IMPORT" copies made
 * by other users with similar names are not swept up.
 */
export async function searchPremium(term) {
	const q = new URLSearchParams({ search_params: term });
	const j = await getJSON(`${BUN_SERVER}/moneys_bun/search_data_premium_v2?${q}`, `search "${term}"`);
	return (j?.layers ?? []).filter((l) => PUBLISHER.test(`${l.user?.name ?? ''} ${l.user?.full_name ?? ''}`));
}

/**
 * Reads one layer's contents. `layerId` may belong to anyone as long as the layer is
 * public; the `project_id` sent is our own project.
 */
export async function readLayer(layerId, key, label = layerId) {
	const q = new URLSearchParams({
		api_key: key,
		layer_id: layerId,
		project_id: projectId(),
		limit: String(FEATURE_LIMIT)
	});
	const j = await getJSON(`${GEOSERVER}/layers_new/get_layer?${q}`, label);
	const features = j?.features ?? [];
	if (features.length >= FEATURE_LIMIT) {
		throw new Error(`${label}: hit FEATURE_LIMIT (${FEATURE_LIMIT}) — the data may be truncated, raise the limit`);
	}
	return { name: j?.layer_name ?? label, features };
}

/** Lists the layers inside one of our own projects. */
export async function listProjectLayers(key) {
	const q = new URLSearchParams({ api_key: key, project_id: projectId() });
	const listed = await getJSON(`${GEOSERVER}/layers_new/get_layer_list?${q}`, 'get_layer_list');
	return Object.values(listed).filter((l) => l && typeof l === 'object' && l._id);
}
