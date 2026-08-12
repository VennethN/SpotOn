import { en } from './en';
import { id, type Copy } from './id';

/**
 * Dua bahasa, satu bentuk.
 *
 * `id.ts` yang menentukan bentuk kamusnya; `en.ts` mengisi bentuk yang sama dan
 * TypeScript yang memastikan tidak ada yang tertinggal. Jadi tidak mungkin ada
 * satu kalimat yang cuma punya versi Indonesia lalu muncul sebagai kunci mentah
 * di layar orang yang memilih Inggris.
 *
 * Kalimat yang menyisipkan angka ditulis sebagai fungsi, bukan potongan yang
 * disambung di komponen: urutan kata tiap bahasa berbeda, dan potongan yang
 * disambung memaksa keduanya memakai urutan bahasa yang menulisnya duluan.
 */
export type Lang = 'id' | 'en';
export type { Copy };

export const LANGS: Lang[] = ['id', 'en'];

export const DICT: Record<Lang, Copy> = { id, en };

export const LANG_STORAGE = 'spoton:lang';

export function isLang(v: unknown): v is Lang {
	return v === 'id' || v === 'en';
}
