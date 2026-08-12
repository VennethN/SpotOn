import type { CategoryKey } from '$lib/types';

export interface CategoryDef {
	key: CategoryKey;
	/** Short name for the segmented control. */
	short: string;
	/** Full name, for use in sentences. */
	name: string;
	/** The OSM tag the competitor count comes from — shown so the figure can be traced. */
	osmTag: string;
	/** The Properti Go category considered a match for this kind of business. */
	propertyCategory: string;
}

export const CATEGORIES: CategoryDef[] = [
	{ key: 'kopi', short: 'Kopi', name: 'Kedai Kopi', osmTag: 'amenity=cafe', propertyCategory: 'Coffee Shop' },
	{
		key: 'warung',
		short: 'Warung',
		name: 'Warung Makan',
		osmTag: 'amenity=restaurant|fast_food',
		propertyCategory: 'Retail F&B'
	},
	{
		key: 'minimarket',
		short: 'Minimarket',
		name: 'Minimarket',
		osmTag: 'shop=convenience|supermarket',
		propertyCategory: 'Minimarket'
	},
	{ key: 'laundry', short: 'Laundry', name: 'Laundry', osmTag: 'shop=laundry', propertyCategory: 'Laundry' },
	{
		key: 'apotek',
		short: 'Apotek',
		name: 'Apotek',
		osmTag: 'amenity=pharmacy',
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
