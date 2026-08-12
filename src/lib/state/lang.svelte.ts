import { browser } from '$app/environment';
import { DICT, isLang, LANG_STORAGE, type Copy, type Lang } from '$lib/i18n';

/**
 * The language currently in use.
 *
 * Held at module level rather than in a context, so the domain modules (Tapak's
 * narration) can read it too without being threaded through every caller. Its value
 * only ever changes in the browser; on the server it stays 'id', so no state leaks
 * between requests.
 *
 * Pages are server-rendered in Indonesian and then adjust on hydration. A visitor
 * who picked English sees one flicker on the first load; that is a cheaper price
 * than guessing the language from headers and guessing it wrong for a reader in
 * Jakarta.
 */
function stored(): Lang {
	if (!browser) return 'id';
	const v = localStorage.getItem(LANG_STORAGE);
	return isLang(v) ? v : 'id';
}

/* Read when the module loads, not inside an effect. Tapak's greeting is composed
   the moment its panel first mounts; if the language were only restored after that,
   the first sentence would already be stored in the wrong language. */
let current = $state<Lang>(stored());

export function lang(): Lang {
	return current;
}

/** The active dictionary. Components use it via `$derived(copy())`. */
export function copy(): Copy {
	return DICT[current];
}

export function setLang(next: Lang): void {
	current = next;
	if (!browser) return;
	localStorage.setItem(LANG_STORAGE, next);
	document.documentElement.setAttribute('lang', next);
}

/** Syncs the document's `lang` attribute. Called once when the app loads. */
export function initLang(): void {
	if (!browser) return;
	document.documentElement.setAttribute('lang', current);
}

export function otherLang(): Lang {
	return current === 'id' ? 'en' : 'id';
}
