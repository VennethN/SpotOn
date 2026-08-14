/**
 * Writes the property listings the app shows for a selected catchment.
 *
 *   node scripts/build-property.mjs
 *
 * Output: `static/data/property.json`
 *
 * The grid already knows HOW MANY units are on the market around a cell and what the
 * middle one is asking per m² — that is what the cost of space in the score is built
 * from. What it does not keep is the units themselves, because a median is all the
 * score needs.
 *
 * A median is not what somebody choosing a location wants to read. "Rp 45 jt per m²"
 * and "a 96 m² two-storey shophouse on Jl. Tebet Raya asking Rp 4.3 billion, freehold"
 * are the same fact at two different distances from a decision, and only the second can
 * be argued with. So the units a cell captures are drawn from here, the same way its
 * competitors and its transit nodes are.
 *
 * Read from `src/lib/data/mapid-property.json`, the same file `join-property.mjs`
 * counted — so the units listed ARE the ones the median was taken over, not a second
 * dataset that resembles them.
 *
 * Served from `static/` rather than imported, like the stops and the competitor points:
 * fetched by URL when a cell is actually selected, so none of it is in the JS bundle
 * and the browser caches it as an ordinary asset.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The on-disk shape: a fixed-length tuple rather than named keys.
 *
 * 3,547 listings × nine key names is more bytes than the figures themselves, the same
 * economy `build-pois.mjs` and `build-stops.mjs` apply. `parseListings` in
 * `src/lib/domain/premises.ts` is the other half of this contract, and the order below
 * is the order it reads.
 *
 *   [lat, lon, type, price, ppm, land, build, floors, cert]
 *
 * An absent figure is null and stays null. Not 0, and not dropped: a shophouse with no
 * published floor count and one on a single floor are different listings, and the panel
 * says so rather than printing "1".
 *
 * NEITHER `NAMA` NOR `ALAMAT` IS CARRIED, AND THE SECOND IS THE IMPORTANT ONE
 *
 * `NAMA` is not a name. It is built from the fields either side of it — "RUKO - GAMBIR
 * - KOTA ADM. JAKARTA PUSAT" — so it tells a reader nothing the type and the map dot
 * have not already told them, at 40 bytes a listing.
 *
 * `ALAMAT` is the advertisement, and it is left out on purpose. 176 of these listings
 * carry the word SEWA in it, in copy of the form "DI JUAL SEWA APARTEMEN KEMANG MANSION
 * FULL FURNISHED". Not one of them is a rent — the catalogue publishes none, which
 * `fetch-property.mjs` re-establishes on every run — so printing that line under a sale
 * price would put the word "rent" on the screen beside a figure that is not one, in the
 * one panel whose whole job is to keep those two apart.
 */
export function toRow(p) {
	return [
		p.lat,
		p.lon,
		p.type,
		p.price ?? null,
		p.ppm ?? null,
		p.land ?? null,
		p.build ?? null,
		p.floors ?? null,
		p.cert ?? null
	];
}

function main() {
	const src = resolve(ROOT, 'src/lib/data/mapid-property.json');
	const file = JSON.parse(readFileSync(src, 'utf8'));
	const points = file.points ?? [];
	console.log(`Reading ${points.length} property listings…`);

	const payload = {
		meta: {
			source: file.meta?.source ?? 'MAPID premium data (Data Premium)',
			note: 'Listing properti komersial MAPID. Persis titik yang dihitung join-property.mjs untuk kolom `prop` tiap petak, jadi unit yang terdaftar sama dengan unit yang mediannya dipakai mesin skor.',
			listingType: file.meta?.listingType ?? '',
			count: points.length,
			priced: points.filter((p) => typeof p.ppm === 'number' && p.ppm > 0).length,
			byType: file.meta?.byType ?? {},
			coverage: file.meta?.coverage ?? [],
			fields: ['lat', 'lon', 'type', 'price', 'ppm', 'land', 'build', 'floors', 'cert'],
			regenerate: 'node scripts/build-property.mjs'
		},
		listings: points.map(toRow)
	};

	const dir = resolve(ROOT, 'static/data');
	mkdirSync(dir, { recursive: true });
	const dest = resolve(dir, 'property.json');
	writeFileSync(dest, JSON.stringify(payload));

	const kb = Math.round(JSON.stringify(payload).length / 1024);
	console.log(`  ${payload.meta.count} listings · ${payload.meta.priced} priced · ${kb} KB`);
	console.log(`\n→ ${dest}`);
}

// Only when run as a script, so `toRow` can be reached by a test without writing
// anything — the same guard `build-pois.mjs` uses and for the same reason.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (err) {
		console.error('Failed:', err.message);
		process.exit(1);
	}
}
