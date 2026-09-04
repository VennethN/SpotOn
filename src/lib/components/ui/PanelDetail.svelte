<script lang="ts">
	/**
	 * One section of the area card, given the whole panel.
	 *
	 * WHY THE CARD NEEDED THIS
	 *
	 * The area panel had grown to six sections stacked in one column: a chart of the
	 * week, a price with its rank and every unit behind it, a transit list, four field
	 * surveys and a table of figures with the score's arithmetic under it. Every one of
	 * them earns its place, and all of them at once is a scroll nobody reads. A reader
	 * comparing two streets wants six numbers, and then one section in full.
	 *
	 * So the card now shows the six numbers, and this is where the section in full goes.
	 * It takes the panel rather than a fold inside it, for the same reason
	 * `FieldRecordDetail` takes the panel to show one receipt: a section that expands in
	 * place pushes everything the reader was looking at down the page, which is the same
	 * as losing their place, and a section that opens over the whole screen loses the map
	 * that the whole panel is about.
	 *
	 * IT ADDS NOTHING TO WHAT IT SHOWS
	 *
	 * The sections inside are the same components the card used to stack, unchanged: they
	 * keep their own headings, their own map switches and their own fine print. This is
	 * a frame and a way back, not a second version of any of them.
	 *
	 * `utils/portal` lifts it to the panel box, so it covers the panel without joining
	 * the scroller it was written inside. The scroller is left untouched, which is how
	 * the reader gets their place back when they come out.
	 */
	import Glyph from '$lib/components/ui/Glyph.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { portal } from '$lib/utils/portal';
	import type { Snippet } from 'svelte';

	let {
		title,
		onclose,
		children
	}: {
		/** Named for the reader who has just arrived here, and for the one leaving. */
		title: string;
		onclose: () => void;
		children: Snippet;
	} = $props();

	const c = $derived(copy());

	let box = $state<HTMLElement | null>(null);
	let backButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		backButton?.focus({ preventScroll: true });
	});

	/**
	 * Escape closes the TOPMOST detail view, not every one that is listening.
	 *
	 * The field section can be inspected here and then one of its records inspected
	 * again on top of that, and both are portalled to the same panel box, so both are
	 * hearing this key. Without the test the record and the section it came out of
	 * would close together, and one press would put the reader two rooms back.
	 *
	 * Last in the document wins because that is what is drawn on top: the portal
	 * appends, so the newer overlay is always the later sibling.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !box) return;
		const open = document.querySelectorAll('[role="dialog"]');
		if (open.length > 0 && open[open.length - 1] !== box) return;
		onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="detail"
	bind:this={box}
	role="dialog"
	aria-modal="true"
	aria-label={title}
	use:portal
>
	<!-- The way back, and nothing else. Pinned rather than scrolled away: a section can
	     be a chart, a price and forty units long, and a way out that is only reachable by
	     scrolling back to the top is not a way out.

	     No title on this bar. The section underneath announces itself in its own heading,
	     with its own glyph and its own map switch, and a second copy of that name one
	     line above it is the kind of repetition this whole redesign is removing. The name
	     is still on the dialog, for a reader who is hearing the panel rather than
	     looking at it. -->
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

	<div class="scroll">
		{@render children()}
	</div>
</div>

<style>
	/* Against the panel box, not the viewport and not the scrolled content. Opaque
	   rather than a blur of what is behind, because what is behind is the summary this
	   section was opened from, and reading a chart through its own summary is not depth,
	   it is noise. */
	.detail {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		flex-direction: column;
		border-radius: inherit;
		overflow: hidden;
		background: var(--bg-elevated);
	}

	.bar {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
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

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		padding: 0.875rem 0.875rem 1.5rem;
	}
</style>
