<script lang="ts">
	/**
	 * The badge at the top of a detail card saying WHAT the card is about.
	 *
	 * The two cards became deliberately alike — a unit now carries the same catchment
	 * sections an area does, because a doorway without its surroundings is a listing off
	 * a property site — and that similarity is the reason this exists. Two panels with
	 * the same sections in the same order, one describing 800 m of city and the other
	 * describing one shopfront, are two panels a reader can confuse at a glance.
	 *
	 * A glyph separates them at a size no wording can be read at, and it survives being
	 * scrolled past out of the corner of an eye. The words are still there underneath —
	 * this is a marker, not the label.
	 *
	 * Drawn here rather than passed in for the same reason `SectionHead` draws its own:
	 * the two shapes have to sit on one grid at one stroke weight, or the pair stops
	 * reading as a pair and starts reading as two unrelated decorations.
	 */
	import { copy } from '$lib/state/lang.svelte';
	import type { Pivot } from '$lib/state/app.svelte';

	let { kind }: { kind: Pivot } = $props();

	const c = $derived(copy());
	const label = $derived(kind === 'unit' ? c.units.markUnit : c.units.markCell);
</script>

<span class="mark" class:unit={kind === 'unit'} title={label}>
	<svg
		viewBox="0 0 16 16"
		width="15"
		height="15"
		fill="none"
		stroke="currentColor"
		stroke-width="1.3"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if kind === 'unit'}
			<!-- A shopfront with its door: one premises, the thing you would actually sign
			     for. Deliberately the same awning the market section uses, so the badge and
			     that section read as the same subject. -->
			<path d="M2.6 6.4h10.8v7.2H2.6Z" />
			<path d="M1.7 2.9h12.6l-.9 3.5H2.6Z" />
			<path d="M6.6 13.6V9.5h2.8v4.1" />
		{:else}
			<!-- A hexagon: the catchment, the shape the grid is actually made of. -->
			<path d="M8 1.7l5.4 3.15v6.3L8 14.3l-5.4-3.15v-6.3Z" />
			<circle cx="8" cy="8" r="1.15" />
		{/if}
	</svg>
	<span class="sr">{label}</span>
</span>

<style>
	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		margin-top: 0.0625rem;
		border-radius: var(--r-sm, 8px);
		/* The area keeps the quiet fill every section eyebrow uses. */
		background: var(--fill-1);
		color: var(--label-2);
	}
	/* The unit is the louder of the two on purpose: an area is the map's default subject
	   and needs no announcing, while a card about one shopfront is the state a reader
	   arrived at by choosing it, and the badge is what says so. */
	.mark.unit {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
