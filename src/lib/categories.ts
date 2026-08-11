import type { CategoryKey } from './types';

export interface CategoryDef {
	key: CategoryKey;
	/** Nama pendek untuk segmented control. */
	short: string;
	/** Nama lengkap untuk kalimat. */
	name: string;
	/** Tag OSM sumber hitungan pesaing — ditampilkan agar angka dapat ditelusuri. */
	osmTag: string;
	/** Kategori Properti Go yang dianggap cocok untuk usaha ini. */
	propKat: string;
}

export const CATEGORIES: CategoryDef[] = [
	{ key: 'kopi', short: 'Kopi', name: 'Kedai Kopi', osmTag: 'amenity=cafe', propKat: 'Coffee Shop' },
	{
		key: 'warung',
		short: 'Warung',
		name: 'Warung Makan',
		osmTag: 'amenity=restaurant|fast_food',
		propKat: 'Retail F&B'
	},
	{
		key: 'minimarket',
		short: 'Minimarket',
		name: 'Minimarket',
		osmTag: 'shop=convenience|supermarket',
		propKat: 'Minimarket'
	},
	{ key: 'laundry', short: 'Laundry', name: 'Laundry', osmTag: 'shop=laundry', propKat: 'Laundry' },
	{
		key: 'apotek',
		short: 'Apotek',
		name: 'Apotek',
		osmTag: 'amenity=pharmacy',
		propKat: 'Ruko'
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
