import { browser } from '$app/environment';

/**
 * Tema terang/gelap/ikut-sistem — satu tempat, dipakai landing maupun aplikasi.
 *
 * Sebelumnya bilah navigasi landing dan `AppState` sama-sama menulis kunci
 * `spoton:theme` dan atribut `data-theme` dengan kodenya sendiri-sendiri. Dua
 * salinan aturan yang sama pada penyimpanan yang sama adalah cara paling mudah
 * membuat dua halaman berselisih soal tema yang sedang dipilih pengguna.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE = 'spoton:theme';

/** Pilihan yang tersimpan; 'system' bila belum pernah memilih. */
export function storedTheme(): Theme {
	if (!browser) return 'system';
	const v = localStorage.getItem(STORAGE);
	return v === 'dark' || v === 'light' ? v : 'system';
}

/** Menerapkan pilihan ke dokumen dan menyimpannya. */
export function applyTheme(theme: Theme): void {
	if (!browser) return;
	if (theme === 'system') {
		document.documentElement.removeAttribute('data-theme');
		localStorage.removeItem(STORAGE);
	} else {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem(STORAGE, theme);
	}
}

/** Urutan siklus tombol tema: sistem → terang → gelap → sistem. */
export function nextTheme(theme: Theme): Theme {
	return theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
}

export function themeLabel(theme: Theme): string {
	return theme === 'system' ? 'Tema sistem' : theme === 'dark' ? 'Tema gelap' : 'Tema terang';
}

/**
 * Memantau preferensi gelap sistem. Mengembalikan pembersihnya, dan memanggil
 * `onChange` sekali di awal supaya pemanggil tidak perlu membaca sendiri.
 */
export function watchSystemDark(onChange: (dark: boolean) => void): () => void {
	if (!browser) return () => {};
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	onChange(mq.matches);
	const handler = (e: MediaQueryListEvent) => onChange(e.matches);
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
}
