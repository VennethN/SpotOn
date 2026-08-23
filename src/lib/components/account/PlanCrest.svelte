<script lang="ts">
	/**
	 * The mark for one tier: as many hexagons as the tier is high.
	 *
	 * A rank insignia rather than an icon, because what a reader has to get from three
	 * cards side by side is an ORDER, and an order read off three prices is arithmetic
	 * while an order read off one, two and three shapes is not reading at all.
	 *
	 * Hexagons rather than stars or bars, because the hexagon is what this product is
	 * made of. It is the catchment on the map, the mark on the area card, and the meter
	 * mark for areas, so a crest built out of them says which product this is a plan for.
	 *
	 * The count comes from the tier's POSITION in `PLAN_KEYS`, not from a number written
	 * here. Insert a tier between two others and its crest follows, the same way every
	 * other figure on this page follows `domain/plans`.
	 */
	import { PLAN_KEYS } from '$lib/domain/plans';
	import type { PlanKey } from '$lib/types';

	let { plan, size = 30 }: { plan: PlanKey; size?: number } = $props();

	/** One hexagon for the lowest tier, one more for each step up. */
	const rank = $derived(PLAN_KEYS.indexOf(plan) + 1);

	/* Laid out on a 24 unit square: one centred, two side by side, three as a triangle
	   with two below. Written as positions rather than as three separate drawings so the
	   hexagon itself is defined once and every crest is the same hexagon. */
	const LAYOUTS: Record<number, { x: number; y: number }[]> = {
		1: [{ x: 12, y: 12 }],
		2: [
			{ x: 6.2, y: 12 },
			{ x: 17.8, y: 12 }
		],
		3: [
			{ x: 12, y: 6.2 },
			{ x: 6.2, y: 16 },
			{ x: 17.8, y: 16 }
		]
	};
	const spots = $derived(LAYOUTS[rank] ?? LAYOUTS[1]);
	/* One hexagon fills the square, two or three share it, so a crest never outgrows its
	   tile as the ladder gets longer.

	   The multiples are cut back further than the space needs. Sized to fill it they very
	   nearly touch, and at the twenty-six pixels these are drawn at a one-pixel gap closes
	   up: three hexagons stop being three hexagons and become one blob, which is the whole
	   reading gone. */
	const r = $derived(rank === 1 ? 7.4 : 4.8);

	/** A flat-top hexagon of radius `r`, centred on the point. The same six-sided shape
	    the grid draws, written once. */
	const hex = (cx: number, cy: number, radius: number): string =>
		[0, 1, 2, 3, 4, 5]
			.map((i) => {
				const a = (Math.PI / 3) * i - Math.PI / 2;
				return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
			})
			.join(' ');
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
	{#each spots as spot, i (i)}
		<polygon
			points={hex(spot.x, spot.y, r)}
			fill="currentColor"
			fill-opacity="0.14"
			stroke="currentColor"
			stroke-width="1.25"
			stroke-linejoin="round"
		/>
	{/each}
</svg>

<style>
	svg {
		flex: none;
		display: block;
		overflow: visible;
	}
</style>
