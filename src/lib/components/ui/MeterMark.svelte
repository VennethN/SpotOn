<script lang="ts">
	/**
	 * The mark for one meter, drawn once for everywhere it appears.
	 *
	 * There are two of these in the product and they turn up in three places: the chip in
	 * the map chrome, the balance tiles on the account page, and the top-up cards beside
	 * them. Drawn at each of those it would be three drawings that drift, which is the
	 * mistake `SectionHead` and `PivotMark` already record: two marks that stop sitting on
	 * one grid at one stroke stop reading as a pair and start reading as decoration.
	 *
	 * The shapes are the subjects rather than the meters. A speech mark is a question put
	 * to Tapak. A hexagon is a catchment, the shape the grid is actually made of, and the
	 * same hexagon `PivotMark` draws for an area. A reader who has seen one on the map
	 * knows what the other is counting without being told.
	 */
	import type { MeterKey } from '$lib/types';

	let { meter, size = 14 }: { meter: MeterKey; size?: number } = $props();
</script>

<svg
	viewBox="0 0 16 16"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.3"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if meter === 'ai'}
		<!-- A speech mark: one question asked, which is what the meter counts. -->
		<path d="M2.6 3.4h10.8v7H8.4L5.2 13v-2.6H2.6Z" />
	{:else}
		<!-- The catchment hexagon, at the same proportions `PivotMark` uses. -->
		<path d="M8 1.7l5.4 3.15v6.3L8 14.3l-5.4-3.15v-6.3Z" />
		<circle cx="8" cy="8" r="1.15" />
	{/if}
</svg>

<style>
	svg {
		flex: none;
		display: block;
	}
</style>
