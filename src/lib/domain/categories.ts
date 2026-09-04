import type { CategoryKey } from '$lib/types';

export interface CategoryDef {
	key: CategoryKey;
	/** Short name for the segmented control. */
	short: string;
	/** Full name, for use in sentences. */
	name: string;
	/**
	 * The OSM tag the competitor count comes from — shown so the figure can be traced.
	 *
	 * `null` means OSM CANNOT count this category, and the scoring engine treats
	 * every cell as "not covered" on the OSM source. Not as zero. The difference is
	 * decisive: zero competitors is the best opportunity this map can report, so a
	 * category with no source but counted as zero would crown the whole of Jakarta
	 * as the ideal location.
	 */
	osmTag: string | null;
	/** The MAPID dataset the competitor count comes from — shown so the figure can be traced. */
	mapidSet: string;
	/**
	 * The Properti Go category considered a match for this kind of business.
	 *
	 * THIS IS THE LABEL THE READER SEES, NOT A KEY TO COMPARE AGAINST RAW DATA.
	 * It appears verbatim in the narration ("tersedia N listing Retail F&B"), so it is
	 * spelled the way the rules spell it. The data is not spelled that way: the real
	 * `Kategori Properti` column reads `Retail FnB`. Compare with
	 * `matchesPropertyCategory()`, never with `===`.
	 */
	propertyCategory: string;
}

/**
 * The business types that get scored.
 *
 * The order here is display order: food & drink first, then retail, then services.
 * It differs from the order in `scripts/build-hexes.mjs`, which has to keep the
 * five original categories up front — the reason for that lives over there.
 *
 * Every category must have A SOURCE ON BOTH SIDES, an OSM tag and a MAPID dataset.
 * The source switch in the top bar picks one of them, and a category with only one
 * side would quietly read as zero on the other — precisely the mistake this project
 * works hardest to avoid, because zero competitors reads as the best opportunity.
 * If a business type does not have both, it is not yet fit to be a category.
 */
export const CATEGORIES: CategoryDef[] = [
	{
		key: 'kopi',
		short: 'Kopi',
		name: 'Kedai Kopi',
		osmTag: 'amenity=cafe',
		mapidSet: 'COFFEE SHOP + BRAND COFFEE SHOP',
		propertyCategory: 'Coffee Shop'
	},
	{
		key: 'minuman',
		short: 'Minuman',
		name: 'Kedai Minuman',
		osmTag: 'shop=beverages|bubble_tea, amenity=ice_cream',
		mapidSet: 'MINUMAN',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'roti',
		short: 'Roti',
		name: 'Toko Roti & Kue',
		osmTag: 'shop=bakery|pastry',
		mapidSet: 'ROTI DAN KUE',
		propertyCategory: 'Retail F&B'
	},
	/**
	 * `warung` used to be one category holding 6,094 points: warteg, sushi, KFC, and
	 * Padang restaurants counted as the same competitor. For someone choosing a
	 * location that is a misleading figure — a warteg does not compete with a
	 * Japanese restaurant, and the density of fast-food outlets says nothing about
	 * the opportunity for opening a rice stall.
	 *
	 * Four of its five splits carry `osmTag: null`. OSM has no usable tagging: only
	 * 48.9% of eating places in Jakarta Pusat carry a `cuisine` tag at all, the
	 * vocabulary that exists knows neither warteg nor Padang restaurants, and
	 * `seafood` did not appear once in the sample. Forcing a mapping would produce
	 * counts that are both too low and skewed — worst of all for warteg, the least
	 * tagged of them. `cepat saji` survives because `amenity=fast_food` is a tag of
	 * its own that does not depend on `cuisine`.
	 */
	{
		key: 'warteg',
		short: 'Warteg',
		name: 'Warung & Rumah Makan',
		osmTag: null,
		mapidSet: 'RESTORAN → warteg, nasi goreng, padang, melayu, nusantara, ayam, jajanan',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'cepatsaji',
		short: 'Cepat Saji',
		name: 'Gerai Cepat Saji',
		osmTag: 'amenity=fast_food',
		mapidSet: 'RESTORAN → cepat saji',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'mie',
		short: 'Mie',
		name: 'Mie & Bakso',
		osmTag: null,
		mapidSet: 'RESTORAN → mie dan bakso, ramen',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'seafood',
		short: 'Seafood',
		name: 'Rumah Makan Seafood',
		osmTag: null,
		mapidSet: 'RESTORAN → seafood',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'restoasing',
		short: 'Resto Asing',
		name: 'Restoran Masakan Asing',
		osmTag: null,
		mapidSet: 'RESTORAN → korea, jepang, thailand, sushi, timur tengah, eropa, dll.',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'minimarket',
		short: 'Minimarket',
		name: 'Minimarket',
		osmTag: 'shop=convenience|supermarket',
		mapidSet: 'MINIMARKET',
		propertyCategory: 'Minimarket'
	},
	{
		key: 'kelontong',
		short: 'Kelontong',
		name: 'Toko Kelontong',
		osmTag: 'shop=grocery|general|kiosk',
		mapidSet: 'TOKO KELONTONG',
		propertyCategory: 'Ruko'
	},
	{
		key: 'laundry',
		short: 'Laundry',
		name: 'Laundry',
		osmTag: 'shop=laundry|dry_cleaning',
		mapidSet: 'LAYANAN ATAU JASA → BINATU (LAUNDRY)',
		propertyCategory: 'Laundry'
	},
	{
		key: 'bengkel',
		short: 'Bengkel',
		name: 'Bengkel Kendaraan',
		osmTag: 'shop=car_repair|motorcycle_repair',
		mapidSet: 'PERAWATAN DAN PERBAIKAN OTOMOTIF',
		propertyCategory: 'Ruko'
	},
	{
		key: 'apotek',
		short: 'Apotek',
		name: 'Apotek',
		osmTag: 'amenity=pharmacy',
		mapidSet: 'APOTEK',
		propertyCategory: 'Ruko'
	}
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
	CategoryKey,
	CategoryDef
>;

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function isCategory(v: unknown): v is CategoryKey {
	return typeof v === 'string' && CATEGORY_KEYS.includes(v as CategoryKey);
}

/**
 * Canonicalises a Properti Go `Kategori Properti` value so the rules' spelling and the
 * data's spelling land on the same string.
 *
 * WHY THIS EXISTS
 *
 * The rules (§A.4.1) list the dropdown option as `Retail F&B`, and that is what
 * `propertyCategory` says. The organisers' own sample data spells it **`Retail FnB`**.
 * Comparing the two with `===` yields false, and false here is not a visible failure: it
 * means zero matching listings, zero listings closes the commercial-space gate, and the
 * gate closing suppresses the opportunity score. Seven of the thirteen categories map to
 * that one value, so a single unnoticed character would have muted most of the F&B side
 * of the product — silently, and in the direction that looks like a real answer.
 *
 * The `&` → `N` rule is what does the work: `F&B` and `FnB` are the same name written two
 * ways, and Indonesian usage moves between them freely. Case and punctuation are dropped
 * for the same reason — `Retail (…, dll)` and `Retail (…, dll.)` differ by a full stop
 * that means nothing.
 *
 * Deliberately NOT a fuzzy match. `RETAILFNB` and `RETAILTOKOBAJU…` stay distinct, which
 * is the whole point: a shop unit is not a restaurant unit.
 */
export function normPropertyCategory(v: string): string {
	return String(v ?? '')
		.toUpperCase()
		.replace(/&/g, 'N')
		.replace(/[^A-Z0-9]/g, '');
}

/**
 * Does a raw `Kategori Properti` value from Properti Go count as commercial space for
 * this business type? Use this instead of comparing `propertyCategory` directly.
 */
export function matchesPropertyCategory(def: CategoryDef, raw: string): boolean {
	return normPropertyCategory(def.propertyCategory) === normPropertyCategory(raw);
}
