<script lang="ts">
	/**
	 * One section of the area card, given the rest of the panel.
	 *
	 * WHY THE CARD NEEDED THIS
	 *
	 * The area panel had grown to six sections stacked in one column: a chart of the
	 * week, a price with its rank and every unit behind it, a transit list, four field
	 * surveys and a table of figures with the score's arithmetic under it. Every one of
	 * them earns its place, and all of them at once is a scroll nobody reads. A reader
	 * comparing two streets wants six numbers, and then one section in full.
	 *
	 * So the card shows the six numbers, and this is where the section in full goes.
	 *
	 * WHAT IT DELIBERATELY DOES NOT COVER
	 *
	 * It took the whole panel once, the way `FieldRecordDetail` takes it for one receipt,
	 * and on a phone that was the wrong trade twice over. It hid the model of the place,
	 * which is the one thing on the card that says WHERE you are while you read what is
	 * there. And it covered the sheet's own grip, so the panel could not be dragged back
	 * down, which left a reader holding a price list with no way back to the map the
	 * price is about.
	 *
	 * So it opens BELOW the head and the model, and takes everything under them. The
	 * card still says which place this is, the sheet can still be pulled down, and the
	 * map is still there to pan. On a wide screen the same rule gives the section the
	 * whole of the panel under the model, which is more room than it ever had inside it.
	 *
	 * IT ADDS NOTHING TO WHAT IT SHOWS
	 *
	 * The sections inside are the same components the card used to stack, unchanged: they
	 * keep their own headings, their own map switches and their own fine print. This is
	 * a frame and a way back, not a second version of any of them.
	 */
	import Glyph from '$lib/components/ui/Glyph.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		onclose,
		children
	}: {
		/** Named for whoever is hearing the panel rather than looking at it. The section
		    underneath announces itself in its own heading, so this is not drawn. */
		title: string;
		onclose: () => void;
		children: Snippet;
	} = $props();

	const c = $derived(copy());

	let box = $state<HTMLElement | null>(null);
	let backButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		backButton?.focus({ preventScroll: true });
		/* Opening from a row further down a scrolled panel would otherwise leave the
		   reader looking at the middle of a chart with the model and the way back both
		   above the fold. The panel goes to the top, where the section starts. */
		scrollerOf(box)?.scrollTo({ top: 0 });
	});

	/** The scrolling box this card lives in, whichever surface is hosting it: the panel
	    on a wide screen, the sheet on a narrow one. Found by asking the elements rather
	    than by naming either host's class. */
	function scrollerOf(node: HTMLElement | null): HTMLElement | null {
		let el = node?.parentElement ?? null;
		while (el) {
			const overflow = getComputedStyle(el).overflowY;
			if (overflow === 'auto' || overflow === 'scroll') return el;
			el = el.parentElement;
		}
		return null;
	}

	/**
	 * Escape leaves the INNERMOST view open, not every one that is listening.
	 *
	 * The field section can be opened here and one of its records opened again inside
	 * that, and both are listening for this key. Without the test the record and the
	 * section it came out of would close together, and one press would put the reader
	 * two rooms back. Last in the document wins, because a view opened from inside
	 * another is written inside it.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !box) return;
		const open = document.querySelectorAll('[data-detail-view]');
		if (open.length > 0 && open[open.length - 1] !== box) return;
		onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<section class="detail" bind:this={box} data-detail-view aria-label={title}>
	<!-- The way back, and nothing else. It sticks to the top of the panel because a
	     section can be a chart, a price and forty units long, and a way out that is only
	     reachable by scrolling back to the top is not a way out.

	     No title on this bar. The section underneath announces itself in its own heading,
	     with its own glyph and its own map switch, and a second copy of that name one
	     line above it is the kind of repetition this redesign is removing. -->
	<div class="bar">
		<button
			bind:this={backButton}
			type="button"
			class="back"
			onclick={onclose}
			aria-label={c.panel.backAria}
		>
			<span class="arrow"><Glyph icon="chevron" size={12} /></span>
			<span>{c.panel.back}</span>
		</button>
	</div>

	{@render children()}
</section>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Bleeds to the panel's edges. Both surfaces that host this card pad their scroller
	   by the same amount, so one negative margin serves the sheet and the panel, and the
	   bar reads as a bar across the top rather than a box floating inside the padding. */
	.bar {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: 0 -0.875rem;
		padding: 0.375rem 0.875rem 0.4375rem;
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--separator);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: -0.375rem;
		padding: 0.25rem 0.5rem 0.25rem 0.375rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--label-2);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 550;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.back:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
	.back:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	/* The same chevron the row into this section carries, turned round. One shape for
	   going in and coming out. */
	.arrow {
		display: grid;
		place-items: center;
		transform: rotate(180deg);
	}
</style>
