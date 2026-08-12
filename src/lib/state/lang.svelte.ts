import { browser } from '$app/environment';
import { DICT, isLang, LANG_STORAGE, type Copy, type Lang } from '$lib/i18n';

/**
 * Bahasa yang sedang dipakai.
 *
 * Disimpan di tingkat modul, bukan lewat context, supaya modul domain (narasi
 * Tapak) bisa ikut membacanya tanpa harus dioper melalui setiap pemanggil.
 * Nilainya hanya pernah berubah di peramban; di server ia tetap 'id', jadi tidak
 * ada keadaan yang bocor antar permintaan.
 *
 * Halaman dirender server dalam bahasa Indonesia lalu menyesuaikan diri saat
 * hidrasi. Pengunjung yang memilih Inggris melihat satu kedipan pada muat
 * pertama; itu harga yang lebih murah daripada menebak bahasa dari header dan
 * salah menebaknya untuk pembaca di Jakarta.
 */
function stored(): Lang {
	if (!browser) return 'id';
	const v = localStorage.getItem(LANG_STORAGE);
	return isLang(v) ? v : 'id';
}

/* Dibaca saat modul dimuat, bukan di dalam efek. Sapaan Tapak disusun pada saat
   panelnya pertama dipasang; kalau bahasanya baru dipulihkan sesudah itu,
   kalimat pertamanya terlanjur tersimpan dalam bahasa yang salah. */
let current = $state<Lang>(stored());

export function lang(): Lang {
	return current;
}

/** Kamus yang sedang aktif. Komponen memakainya lewat `$derived(copy())`. */
export function copy(): Copy {
	return DICT[current];
}

export function setLang(next: Lang): void {
	current = next;
	if (!browser) return;
	localStorage.setItem(LANG_STORAGE, next);
	document.documentElement.setAttribute('lang', next);
}

/** Menyelaraskan atribut `lang` dokumen. Dipanggil sekali saat aplikasi dimuat. */
export function initLang(): void {
	if (!browser) return;
	document.documentElement.setAttribute('lang', current);
}

export function otherLang(): Lang {
	return current === 'id' ? 'en' : 'id';
}
