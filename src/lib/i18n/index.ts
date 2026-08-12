import { en } from './en';
import { id, type Copy } from './id';

/**
 * Two languages, one shape.
 *
 * `id.ts` defines the shape of the dictionary; `en.ts` fills in that same shape and
 * TypeScript makes sure nothing is left out. So it is impossible for a sentence to
 * exist only in Indonesian and then show up as a raw key on the screen of someone
 * who picked English.
 *
 * Sentences that interpolate numbers are written as functions rather than as
 * fragments concatenated in the component: word order differs per language, and
 * concatenated fragments force both languages into the word order of whichever was
 * written first.
 */
export type Lang = 'id' | 'en';
export type { Copy };

export const LANGS: Lang[] = ['id', 'en'];

export const DICT: Record<Lang, Copy> = { id, en };

export const LANG_STORAGE = 'spoton:lang';

export function isLang(v: unknown): v is Lang {
	return v === 'id' || v === 'en';
}
