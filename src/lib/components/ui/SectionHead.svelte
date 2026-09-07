<script lang="ts">
	/**
	 * The heading of one section inside the area panel.
	 *
	 * The panel had grown to five sections stacked in a column, each announced by the
	 * same small grey uppercase line. Read top to bottom that is one continuous block of
	 * text with nothing to break it, and the sections stopped being findable: a reader
	 * scrolling for the price passed it twice.
	 *
	 * An icon fixes that where a bigger heading would not. A glyph is scannable at a size
	 * no wording can be, and it is the same shape every time, so the second visit to this
	 * panel is navigation rather than reading. The drawing itself lives in `Glyph`, which
	 * keeps every mark in the product on one grid at one stroke.
	 *
	 * TWO RANKS, BECAUSE THE PANEL HAS TWO
	 *
	 * The price section carries headings of its own — what is on the market, and the
	 * units themselves. Drawn identically to the section that contains them, they read as
	 * three sections rather than one with two parts, and the card lost the one piece of
	 * structure it had. So a heading now declares its rank: a `section` is announced by a
	 * glyph in a tile and is preceded by a rule, a `sub` gets the bare glyph and no rule,
	 * and the difference is legible without reading either label.
	 */
	import Glyph, { type GlyphName } from '$lib/components/ui/Glyph.svelte';
	import type { Snippet } from 'svelte';

	let {
		icon,
		level = 'section',
		children,
		action
	}: {
		icon: GlyphName;
		/** `section` is a top part of the card. `sub` is a part of the part above it. */
		level?: 'section' | 'sub';
		children: Snippet;
		/** Optional control on the right of the heading, e.g. a "show on map" switch. */
		action?: Snippet;
	} = $props();
</script>

<header class="head" class:sub={level === 'sub'}>
	<span class="ico">
		<Glyph {icon} size={level === 'sub' ? 12 : 13} />
	</span>
	<h3 class="eyebrow">{@render children()}</h3>
	{#if action}
		{@render action()}
	{/if}
</header>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		/* Air above, not below. The heading belongs to what follows it, and an even gap
		   on both sides is what let five sections read as one undifferentiated column. */
		margin-top: 0.125rem;
	}
	/* The glyph sits in the eyebrow's colour rather than the accent: it is a marker for
	   finding the section again, not a thing to look at on the way past. */
	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: var(--r-xs);
		background: var(--fill-1);
		color: var(--label-1);
	}
	.eyebrow {
		min-width: 0;
		/* Full strength, which for ten pixels of uppercase is not loud. The eyebrows
		   were set in the quietest grey the palette has, and at this size that is not a
		   quiet label, it is an unreadable one: a reader scrolling for the price could
		   not pick the heading out of the paragraphs around it. Size and weight keep it
		   subordinate to the figures. Contrast is what makes it findable. */
		color: var(--label-1);
		letter-spacing: 0.05em;
	}

	/* A part of the section above it. Same glyph, no tile and no box: the mark still
	   says which part this is, and having no field behind it says it is not a new one. */
	.head.sub {
		gap: 0.375rem;
		margin-top: 0.375rem;
		padding-left: 0.125rem;
	}
	.head.sub .ico {
		width: auto;
		height: auto;
		border-radius: 0;
		background: none;
		color: var(--label-2);
	}
	.head.sub .eyebrow {
		color: var(--label-2);
		letter-spacing: 0.06em;
	}

	/* Whatever the section put on the right of its heading is pushed there. */
	.head > :global(:not(.ico):not(.eyebrow)) {
		margin-left: auto;
	}
</style>
