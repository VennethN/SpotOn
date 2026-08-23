/**
 * Lifts an element out of where it was written and into the panel box that
 * encloses it, so it can cover that panel rather than sit in its flow.
 *
 * A detail view for one row wants to fill the panel the row lives in. It
 * cannot simply be an absolutely positioned child, because the element it is
 * written inside IS the scrolling one: an absolute child of a scroller is
 * placed against the scrolled content and slides away with it. So the panels
 * mark their outer box with `data-panel-host`, keep the scrolling to an inner
 * element, and anything with this action is moved up to the box itself, where
 * `inset: 0` means the panel and stays put.
 *
 * Moving it also leaves the scroller untouched, which is the point: the reader
 * gets their scroll position back when the overlay closes, because it was never
 * disturbed.
 *
 * Falls back to the body when nothing above it is a panel, so a caller mounted
 * somewhere unexpected still renders rather than silently vanishing.
 */
export function portal(node: HTMLElement) {
	const host = node.closest('[data-panel-host]') ?? document.body;
	host.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
