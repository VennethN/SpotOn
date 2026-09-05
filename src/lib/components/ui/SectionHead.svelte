<script lang="ts">
	/**
	 * The heading of one section inside the area panel.
	 *
	 * The panel had grown to five sections stacked in a column, each announced by the
	 * same small grey uppercase line. Read top to bottom that is one continuous block of
	 * text with nothing to break it, and the sections stopped being findable: a reader
	 * scrolling for the price passed it twice.
	 *
	 * An icon fixes that where a bigger heading would not. The eyebrows are deliberately
	 * quiet, because they are labels rather than content, and making them loud enough to
	 * scan would have them competing with the figures underneath. A glyph is scannable at
	 * a size no wording can be, and it is the same shape every time — so the second visit
	 * to this panel is navigation rather than reading.
	 *
	 * The icons are drawn here rather than passed in, so that every section in the panel
	 * is drawn on one grid at one stroke weight. Passed in as markup they drift: one
	 * section ends up with a 16 px glyph at 1.2 stroke next to another at 14 and 2, and
	 * the row stops reading as a set.
	 */
	import type { Snippet } from 'svelte';

	type Icon = 'price' | 'market' | 'units' | 'rivals' | 'transit';

	let {
		icon,
		children,
		action
	}: {
		icon: Icon;
		children: Snippet;
		/** Optional control on the right of the heading, e.g. a "show on map" switch. */
		action?: Snippet;
	} = $props();
</script>

<header class="head">
	<span class="ico" aria-hidden="true">
		<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
			{#if icon === 'price'}
				<!-- A price tag: what the space costs. -->
				<path d="M8.4 1.9H14v5.6l-6.5 6.5a1 1 0 0 1-1.4 0l-4.2-4.2a1 1 0 0 1 0-1.4Z" />
				<circle cx="11.1" cy="4.9" r="1.05" />
			{:else if icon === 'market'}
				<!-- An awning over a shopfront: what is on the market. -->
				<path d="M2 6.2h12v7.3H2Z" />
				<path d="M1.4 3.1h13.2L14 6.2H2Z" />
				<path d="M6.4 13.5V9.4h3.2v4.1" />
			{:else if icon === 'units'}
				<!-- A list of rows: the units, one by one. -->
				<path d="M2.4 4.4h11.2M2.4 8h11.2M2.4 11.6h7.4" />
			{:else if icon === 'rivals'}
				<!-- Two marks side by side: the competitors already there. -->
				<rect x="2.2" y="2.2" width="5" height="5" rx="0.6" />
				<rect x="8.8" y="8.8" width="5" height="5" rx="0.6" />
				<path d="M8.8 4.7h5M2.2 11.3h5" />
			{:else}
				<!-- A carriage on a line: what is reachable from here. -->
				<rect x="4" y="1.9" width="8" height="9.4" rx="2" />
				<path d="M4 7.1h8M6.2 14.1l-1.4 0M11.2 14.1l-1.4 0M6.4 11.3 4.8 14.1M9.6 11.3l1.6 2.8" />
				<circle cx="6.4" cy="9.2" r="0.5" fill="currentColor" stroke="none" />
				<circle cx="9.6" cy="9.2" r="0.5" fill="currentColor" stroke="none" />
			{/if}
		</svg>
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
		gap: 0.375rem;
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
		width: 1.125rem;
		height: 1.125rem;
		border-radius: var(--r-sm, 6px);
		background: var(--fill-1);
		color: var(--label-2);
	}
	.eyebrow {
		min-width: 0;
		/* The rule the icon buys back: the label no longer has to shout to be found, so
		   it can be set at a size that reads as a caption. */
		letter-spacing: 0.05em;
	}
	/* Whatever the section put on the right of its heading is pushed there. */
	.head > :global(:not(.ico):not(.eyebrow)) {
		margin-left: auto;
	}
</style>
