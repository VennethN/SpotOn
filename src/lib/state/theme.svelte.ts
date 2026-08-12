import { browser } from '$app/environment';

/**
 * Light/dark/follow-the-system theme — one place, used by both the landing page and
 * the app.
 *
 * The landing nav bar and `AppState` used to each write the `spoton:theme` key and
 * the `data-theme` attribute with their own code. Two copies of the same rule over
 * the same storage is the easiest way to get two pages disagreeing about which
 * theme the user has chosen.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE = 'spoton:theme';

/** The stored choice; 'system' if nothing has ever been picked. */
export function storedTheme(): Theme {
	if (!browser) return 'system';
	const v = localStorage.getItem(STORAGE);
	return v === 'dark' || v === 'light' ? v : 'system';
}

/** Applies the choice to the document and stores it. */
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

/** The theme button's cycle order: system → light → dark → system. */
export function nextTheme(theme: Theme): Theme {
	return theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
}



/**
 * Watches the system dark preference. Returns its cleanup, and calls `onChange`
 * once up front so the caller does not have to read it themselves.
 */
export function watchSystemDark(onChange: (dark: boolean) => void): () => void {
	if (!browser) return () => {};
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	onChange(mq.matches);
	const handler = (e: MediaQueryListEvent) => onChange(e.matches);
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
}
