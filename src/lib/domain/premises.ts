import { haversine } from '$lib/utils/geo';
import type { HexBase, PropertyType } from '$lib/types';

/**
 * The listing types the catalogue publishes, in the order they are listed.
 *
 * This lived in `domain/cost`, which meant the module about what space COSTS owned the
 * vocabulary for what space IS, and `premises.ts` had to import its own core predicate
 * from it. The names belong here; `cost` is one of the callers.
 */
export const PROPERTY_TYPES: readonly PropertyType[] = [
	'ruko',
	'toko',
	'ruang',
	'rukan',
	'komersial',
	'kantor',
	'gedung',
	'gudang'
];

/**
 * The families a small business could actually occupy.
 *
 * The score's price level, the space gate and the whole unit pivot are computed from
 * these alone. An office floor and a warehouse are commercial property on the market
 * too, and neither is a shopfront — see `scripts/fetch-property.mjs`.
 */
export const PREMISES_TYPES: readonly PropertyType[] = [
	'ruko',
	'toko',
	'ruang',
	'rukan',
	'komersial'
];

export const isPremises = (t: string): t is PropertyType =>
	(PREMISES_TYPES as readonly string[]).includes(t);

/**
 * The individual units on the market around a cell.
 *
 * The grid stores what is on the market as a COUNT and a MEDIAN, because that is all
 * the score needs: the count opens or closes the space gate, and the median sets the
 * cost multiplier. But neither is what somebody choosing a location wants to read.
 * "Rp 45 jt per m²" and "a 96 m² shophouse over two floors asking Rp 4.3 billion,
 * freehold" are the same fact at two different distances from a decision, and only the
 * second can be argued with.
 *
 * So the listings themselves are loaded separately (`static/data/property.json`,
 * written by `scripts/build-property.mjs` from the very same point file
 * `join-property.mjs` counted) and matched back to a cell here, on demand, for one cell
 * at a time. This mirrors `domain/transit` and `domain/competitors` exactly, for the
 * same reason and by the same route.
 *
 * THESE ARE ASKING PRICES FOR SALE
 *
 * MAPID publishes no rent listings for Jakarta. Every property dataset in the premium
 * catalogue is tallied by `scripts/fetch-property.mjs` on every run and every value in
 * the sale-or-rent column comes back a sale. Nothing here is called a rent, and no rent
 * is derived from a price: that would take a yield assumption, and the assumption would
 * be the only figure on the screen that came from nobody's data.
 *
 * A COORDINATE IS NOT AN IDENTITY IN THIS DATASET
 *
 * 1,915 of the 3,547 listings share their exact coordinates with another listing,
 * because the catalogue geocodes to the street rather than to the door. One point in
 * Pancoran carries four: two shophouses and two office buildings, with different floor
 * counts, areas, certificates and asking prices.
 *
 * So these must NOT be deduped the way `dedupePoints` collapses competitors in
 * `scripts/lib/mapid.mjs`. There, two records at one coordinate in one category are one
 * shop described twice. Here they are separate units in one building, and merging them
 * would delete real supply and pull the median towards whichever one survived.
 */

export interface Listing {
	lat: number;
	lon: number;
	type: PropertyType;
	/** Asking price for sale, rupiah. Null when the listing published none. */
	price: number | null;
	/** Asking price per m² of land, as the catalogue publishes it. */
	ppm: number | null;
	/** Land area, m². */
	land: number | null;
	/** Building floor area, m². Absent on most listings, which is why the score's price
	    is read against land area and not this. */
	build: number | null;
	floors: number | null;
	/** Certificate of title, e.g. SHM or HGB. */
	cert: string | null;
	/** Metres from the cell centre — filled in when matched to a cell. */
	distance: number;
	/** Could a small business occupy this unit? Derived from the type, not stored. */
	premises: boolean;
}

/** The on-disk shape: a fixed-length tuple, because this file carries 3,547 of them.
    The order is `toRow`'s in `scripts/build-property.mjs`, and the two are one contract. */
type RawListing = [
	number,
	number,
	string,
	number | null,
	number | null,
	number | null,
	number | null,
	number | null,
	string | null
];

export interface PropertyFile {
	meta: {
		count: number;
		priced: number;
		byType: Record<string, number>;
		/** Cities whose property datasets were read. Absent from this list means NOT
		    CHECKED, which is not the same as nothing being on the market. */
		coverage: string[];
	};
	listings: RawListing[];
}

export function parseListings(file: PropertyFile): Array<Omit<Listing, 'distance'>> {
	return file.listings.map(([lat, lon, type, price, ppm, land, build, floors, cert]) => ({
		lat,
		lon,
		type: type as PropertyType,
		price,
		ppm,
		land,
		build,
		floors,
		cert,
		premises: isPremises(type)
	}));
}

/**
 * The listings one cell captures, nearest first.
 *
 * The same test the grid used when it counted them: distance from the CELL CENTRE,
 * within the walking radius. Measuring any other way would return a different set from
 * the one the median was taken over, and the list on screen would quietly disagree with
 * the price above it.
 */
export function capturedListings(
	cell: Pick<HexBase, 'lat' | 'lon'>,
	listings: Array<Omit<Listing, 'distance'>>,
	radiusM: number
): Listing[] {
	const out: Listing[] = [];
	// A cheap box test before the trigonometry, as in `capturedStops` and
	// `capturedCompetitors`: 0.012° is ~1.3 km, comfortably wider than the walking
	// radius, and it discards nearly every listing in the city immediately.
	const box = 0.012;
	for (const l of listings) {
		if (Math.abs(l.lat - cell.lat) > box || Math.abs(l.lon - cell.lon) > box) continue;
		const distance = haversine(cell.lat, cell.lon, l.lat, l.lon);
		if (distance <= radiusM) out.push({ ...l, distance });
	}
	return out.sort((a, b) => a.distance - b.distance);
}

/**
 * The captured listings grouped by type, largest group first.
 *
 * Premises first within a tie, because those are the ones the score was built from and
 * the ones a reader is shopping for. A warehouse in the list is context, not a candidate.
 */
export function byType(listings: Listing[]): Array<{ type: PropertyType; n: number; premises: boolean }> {
	const counts = new Map<PropertyType, number>();
	for (const l of listings) counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
	return [...counts]
		.map(([type, n]) => ({ type, n, premises: isPremises(type) }))
		.sort((a, b) => b.n - a.n || Number(b.premises) - Number(a.premises));
}

/**
 * The units worth putting in front of a reader, nearest first.
 *
 * Premises only, and only the ones carrying an asking price. A listing with no price is
 * still a real vacancy and still counts towards the gate, but a row on screen reading
 * "shophouse, price ·" costs a line and settles nothing. How many were left out is
 * stated instead, by `withoutPrice` below.
 */
export function pricedPremises(listings: Listing[]): Listing[] {
	return listings.filter((l) => l.premises && l.price !== null);
}

/** Premises in range that published no asking price. Stated rather than hidden: they
    are the difference between the count on the gate and the length of the list. */
export function withoutPrice(listings: Listing[]): number {
	return listings.filter((l) => l.premises && l.price === null).length;
}
