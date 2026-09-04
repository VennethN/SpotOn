<script lang="ts" module>
	/**
	 * One drawing per business type, on the same grid and stroke as `Glyph`.
	 *
	 * WHY IT IS NOT IN `Glyph` ITSELF
	 *
	 * `Glyph` draws the chrome: a price tag, a clock, a chevron. Those are named by
	 * whoever needs them. These thirteen are named by the domain instead, one per
	 * `CategoryKey`, and the set has to stay complete: the last branch below is a plain
	 * `else`, so a fourteenth category with no drawing of its own would silently wear
	 * the pharmacy cross. `DRAWN` is what stops that. It is the compiler's copy of the
	 * branch list, and adding a category without adding a branch fails the typecheck
	 * rather than shipping a wrong icon.
	 *
	 * SAME GRID, SAME STROKE. The constants come from `Glyph` rather than being copied,
	 * because the point of one stroke weight is that it stays one number. A coffee cup
	 * a hair lighter than the clock beside it reads as a different set of marks.
	 */
	import { GLYPH_BASE, GLYPH_STROKE } from '$lib/components/ui/Glyph.svelte';
	import type { CategoryKey } from '$lib/types';

	/** Every key with a branch of its own below. Keep the two in step. */
	const DRAWN = [
		'kopi',
		'minuman',
		'roti',
		'warteg',
		'cepatsaji',
		'mie',
		'seafood',
		'restoasing',
		'minimarket',
		'kelontong',
		'laundry',
		'bengkel',
		'apotek'
	] as const satisfies readonly CategoryKey[];

	/* Empty while every category is drawn, and a type error the moment one is not. */
	const UNDRAWN: never[] = [] as Exclude<CategoryKey, (typeof DRAWN)[number]>[];
	void UNDRAWN;
</script>

<script lang="ts">
	let { category, size = GLYPH_BASE }: { category: CategoryKey; size?: number } = $props();
</script>

<svg
	viewBox="0 0 16 16"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width={(GLYPH_STROKE * GLYPH_BASE) / size}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if category === 'kopi'}
		<!-- A cup on nothing, with its handle out: served sitting down. -->
		<path d="M3.1 6h7.6v3.5a3.2 3.2 0 0 1-3.2 3.2H6.3a3.2 3.2 0 0 1-3.2-3.2Z" />
		<path d="M10.7 6.9h1.1a2 2 0 0 1 0 4h-1.1" />
		<path d="M5.6 4V2.5M8.2 4V2.5" />
	{:else if category === 'minuman'}
		<!-- A tapered cup with a straw: the same drink, taken away. -->
		<path d="M4 6h8l-.9 6.6a1 1 0 0 1-1 .9H5.9a1 1 0 0 1-1-.9Z" />
		<path d="M3.1 6h9.8" />
		<path d="M9.7 6 11.9 2.7" />
	{:else if category === 'roti'}
		<!-- A loaf with the baker's cuts across it. -->
		<path d="M2.5 12.4V9.2a5.5 5.5 0 0 1 11 0v3.2Z" />
		<path d="M5.9 5.3 4.6 7.7M9.5 4.9 8.2 7.3" />
	{:else if category === 'warteg'}
		<!-- A tudung saji over the plate: home cooking, already made. -->
		<path d="M2.6 11.2a5.4 5.4 0 0 1 10.8 0Z" />
		<path d="M1.5 11.2h13" />
		<path d="M8 5.8V4.4" />
	{:else if category === 'cepatsaji'}
		<!-- A burger, which is the one shape nobody has to be told the name of. -->
		<path d="M2.6 6.7a5.4 5.4 0 0 1 10.8 0Z" />
		<path d="M2.7 8.7h10.6" />
		<path d="M2.6 10.5h10.8a2.4 2.4 0 0 1-2.4 2.4H5a2.4 2.4 0 0 1-2.4-2.4Z" />
	{:else if category === 'mie'}
		<!-- A bowl with the chopsticks still in it. -->
		<path d="M2.3 8.3h11.4a5.7 5.7 0 0 1-11.4 0Z" />
		<path d="M8.5 7.5 13.4 3.3M6.7 7.5 11.6 3.3" />
	{:else if category === 'seafood'}
		<!-- A fish, tail out: the catch rather than the kitchen. -->
		<ellipse cx="6.4" cy="8" rx="4.6" ry="3.2" />
		<path d="M11 8 14.5 5v6Z" />
		<circle cx="4.2" cy="7.2" r="0.5" fill="currentColor" stroke="none" />
	{:else if category === 'restoasing'}
		<!-- Knife and fork laid out: a table you sit down at and order from. -->
		<path d="M3.4 2.4v3.5a1.8 1.8 0 0 0 3.6 0V2.4" />
		<path d="M5.2 2.4v3.5M5.2 7.7v5.9" />
		<path d="M11.4 13.6V2.4c1.6 1.1 2.4 3 2.4 5 0 1.6-1 2.6-2.4 2.6" />
	{:else if category === 'minimarket'}
		<!-- A basket you carry to the till: a few things, quickly. -->
		<path d="M2.3 5.9h11.4l-1.1 6.2a1.4 1.4 0 0 1-1.4 1.2H4.8a1.4 1.4 0 0 1-1.4-1.2Z" />
		<path d="M5.8 5.9 8 2.7l2.2 3.2" />
		<path d="M6.4 8.6v2.3M9.6 8.6v2.3" />
	{:else if category === 'kelontong'}
		<!-- Racking with the stock on it: the shop that is mostly its shelves. -->
		<path d="M2.5 2.7h11v10.8h-11Z" />
		<path d="M2.5 6.3h11M2.5 9.9h11" />
		<path d="M5.6 2.7v3.6M10 6.3v3.6M6.8 9.9v3.6" />
	{:else if category === 'laundry'}
		<!-- A machine with its drum: the service, not the clothes. -->
		<path d="M2.9 2.5h10.2v11h-10.2Z" />
		<path d="M2.9 5.5h10.2" />
		<circle cx="11.2" cy="4" r="0.55" fill="currentColor" stroke="none" />
		<circle cx="8" cy="9.6" r="2.8" />
		<circle cx="8" cy="9.6" r="1" />
	{:else if category === 'bengkel'}
		<!-- A spanner: the trade that is called out by its tool. -->
		<path
			d="M14.5 5.8a3.6 3.6 0 0 1-4.8 4.1l-5 5a1.6 1.6 0 0 1-2.3-2.3l5-5a3.6 3.6 0 0 1 4.1-4.8L9.3 5.1l.4 2.3 2.3.4Z"
		/>
	{:else}
		<!-- The cross on the door, which is the sign this trade has had for a century. -->
		<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4" />
		<path d="M8 5.4v5.2M5.4 8h5.2" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
