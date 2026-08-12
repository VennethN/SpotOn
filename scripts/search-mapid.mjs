/**
 * Explores the MAPID premium data catalogue.
 *
 *   node scripts/search-mapid.mjs                 # SpotOn's thirteen categories
 *   node scripts/search-mapid.mjs APOTEK ATM      # free-form terms
 *   node scripts/search-mapid.mjs --kota "BANDUNG,SURABAYA" PASAR
 *
 * This is an exploration tool: used to decide which datasets deserve a place in the
 * MANIFEST in `scripts/fetch-mapid.mjs`. Fetching the data itself is not this
 * script's business — once a dataset is in the manifest, fetch-mapid finds and reads
 * it on its own.
 *
 * The `--kota` flag keeps its Indonesian name: it is a documented interface, written
 * up in docs/04-data-mapid.md.
 *
 * WHY THE ENDPOINT CHANGED
 *
 * The previous version used `layers_new/search_layers_public`, which only indexes
 * PUBLIC layers. The premium catalogue is not in it, so its answers misled in the
 * most expensive way possible: categories that were in fact fully available got
 * reported as "not visible along this path, check by hand". APOTEK was declared that
 * for weeks, when it exists for all five cities. RESTORAN and MINIMARKET turned up
 * purely because MAPID Database happens to publish those publicly as well.
 *
 * The right one is `moneys_bun/search_data_premium_v2` — the endpoint GEO MAPID's own
 * search box uses, and it does search the premium catalogue. It needs no
 * authentication at all.
 *
 * The old warning "empty means not visible, not absent" therefore no longer applies
 * here: empty from this endpoint means genuinely absent from the catalogue. LAUNDRY
 * is the real case in point.
 */

import { matchesDataset, searchPremium } from './lib/mapid.mjs';

/** The five DKI administrative cities. The catalogue ships one dataset per city. */
const CITIES_DEFAULT = ['JAKARTA PUSAT', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR', 'JAKARTA UTARA'];

/** The terms used by fetch-mapid.mjs's MANIFEST, so the two can be compared. */
const TERMS_DEFAULT = [
	'COFFEE SHOP',
	'BRAND COFFEE SHOP',
	'MINUMAN',
	'ROTI DAN KUE',
	'RESTORAN',
	'MAKANAN DAN MINUMAN',
	'MINIMARKET',
	'TOKO KELONTONG',
	'LAYANAN ATAU JASA',
	'PERAWATAN DAN PERBAIKAN OTOMOTIF',
	'APOTEK'
];

function parseArgv(argv) {
	const cities = [...CITIES_DEFAULT];
	const terms = [];
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--kota') {
			cities.length = 0;
			cities.push(...(argv[++i] ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
			continue;
		}
		terms.push(argv[i].toUpperCase());
	}
	return { cities, terms: terms.length ? terms : TERMS_DEFAULT };
}

async function main() {
	const { cities, terms } = parseArgv(process.argv.slice(2));
	console.log(`MAPID premium catalogue · ${terms.length} terms × ${cities.length} cities\n`);

	let found = 0;
	for (const term of terms) {
		console.log(`## ${term}`);
		for (const city of cities) {
			const hits = await searchPremium(`${term} ${city}`);
			// AND-per-word matching already narrows the results, but they are still
			// verified with exactly the same rule fetch-mapid.mjs uses — if the two
			// judged differently, this explorer could report a dataset that the
			// fetcher then skips.
			const exact = hits.filter((l) => matchesDataset(l.name, term, city));
			if (!exact.length) {
				console.log(`  ${city.padEnd(18)} —  not in the catalogue`);
				continue;
			}
			for (const l of exact) {
				found++;
				console.log(`  ${city.padEnd(18)} ✓  ${l.name}`);
				console.log(`  ${''.padEnd(18)}    https://geo.mapid.io/layer/${l._id}`);
			}
		}
		console.log('');
	}

	console.log(`${found} datasets found.`);
	console.log('Anything not yet in the MANIFEST in scripts/fetch-mapid.mjs can simply be added there —');
	console.log('there is no import step, fetch-mapid reads it straight from the catalogue.');
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
