import { browser } from '$app/environment';
import { dayPartAt, greetingAt, readingIn, readingOn, type Reading } from '$lib/domain/daypart';
import type { DayPart } from '$lib/types';

/**
 * Whose clock the greeting is read from.
 *
 * The reader's own device, which is the only clock that knows what time it is where
 * they are sitting. Not the server's: this deploys to whichever region is nearest and
 * a machine in Virginia would greet Jakarta with the middle of the night.
 *
 * READ ONCE, WHEN THE PAGE LOADS
 *
 * Not on a timer, and not again on every render. The opening card is on screen for as
 * long as it takes to ask one question, and Tapak's first sentence is composed once
 * and then kept as a turn in the thread. Neither is improved by changing its mind at
 * six in the evening while somebody is typing, and a greeting that rewrote itself
 * mid-sentence would be the interface talking about itself.
 *
 * WHAT THE SERVER SAYS INSTEAD
 *
 * The opening card is server-rendered and the server has no device to ask, so it reads
 * Jakarta, the same fixed zone the week boundary already stands in. A reader in Jakarta
 * therefore sees one greeting, before and after hydration, and a reader elsewhere sees
 * it corrected once on the way in. That is the trade `state/lang` already makes by
 * rendering Indonesian first: guess where the readers are and be right for nearly all
 * of them, rather than guess from a header and be wrong in a way nobody can correct.
 *
 * There is no rune in this file. The value never changes once the page has loaded, so
 * there is nothing to react to. And on the server it is not held at all: a module is
 * evaluated once per process, and a value frozen there would still be saying "selamat
 * pagi" at midnight, days after the deploy that warmed it.
 */

/** The zone the server falls back to. The same one the week turns on in `domain/plans`. */
const JAKARTA = 'Asia/Jakarta';

/* Taken as the module loads, which in the browser is once per page load. On the server
   this stays null and the clock is read at the moment it is asked for instead. */
const atLoad: Reading | null = browser ? readingOn(new Date()) : null;

/** The part of the day the reader is in, and which wording of the greeting it gets. */
export function greetingNow(): { part: DayPart; wording: number } {
	const at = atLoad ?? readingIn(new Date(), JAKARTA);
	const part = dayPartAt(at.hour);
	return { part, wording: greetingAt(at.day, part) };
}
