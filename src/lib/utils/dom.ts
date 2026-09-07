/**
 * The scrolling box an element lives in, whichever surface is hosting it: the panel on
 * a wide screen, the sheet on a narrow one.
 *
 * Found by asking the elements rather than by naming either host's class. A card does
 * not know which of the two it is inside, and a list of class names here would be a
 * third place to remember when a third surface is added.
 *
 * `null` when nothing above it scrolls, which is a real answer and not a failure: the
 * caller is then sitting in a box the viewport is scrolling.
 */
export function scrollerOf(node: HTMLElement | null): HTMLElement | null {
	let el = node?.parentElement ?? null;
	while (el) {
		const overflow = getComputedStyle(el).overflowY;
		if (overflow === 'auto' || overflow === 'scroll') return el;
		el = el.parentElement;
	}
	return null;
}
