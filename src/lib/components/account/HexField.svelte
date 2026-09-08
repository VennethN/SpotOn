<script lang="ts">
	/**
	 * A lattice of hexagons, behind the card at the head of the page.
	 *
	 * Decoration, and it says so by being uniform. Every cell is the same size at the same
	 * weight with no fill, so there is nothing in it that could be read as a value: the
	 * moment one hexagon were darker than another this would be a map of something, and a
	 * map of nothing is exactly the thing the rest of this product refuses to draw.
	 *
	 * The hexagon rather than a generic texture because it is the grid this product is
	 * made of. The head of the account page is the one surface here with no map on it, and
	 * the shape is what says which product these plans are for.
	 *
	 * An SVG pattern rather than an image, so it inherits the ink around it and follows
	 * the theme with no second asset to keep in step.
	 */
	let { opacity = 0.38 }: { opacity?: number } = $props();

	/**
	 * The tiling, worked out rather than nudged until the seams stopped showing.
	 *
	 * Flat-top hexagons of circumradius R stand 2R wide and √3·R tall. Columns step 1.5R
	 * apart and every other column drops half a row, so the pattern only comes back into
	 * phase after TWO columns: the tile is 3R by √3·R.
	 *
	 * Five centres are drawn into that tile, four of them on its corners. A pattern clips
	 * its own tile, so each corner hexagon is cut here and finished by the neighbour, and
	 * the seams meet because the arithmetic says they do rather than because they looked
	 * right at one zoom level.
	 */
	const R = 9;
	const TILE_W = 3 * R;
	const TILE_H = Math.sqrt(3) * R;

	const hex = (cx: number, cy: number): string =>
		[0, 1, 2, 3, 4, 5]
			.map((i) => {
				const a = (Math.PI / 3) * i;
				return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
			})
			.join(' ');

	const CENTRES: [number, number][] = [
		[0, 0],
		[TILE_W, 0],
		[0, TILE_H],
		[TILE_W, TILE_H],
		[TILE_W / 2, TILE_H / 2]
	];
</script>

<svg class="field" style:opacity aria-hidden="true" focusable="false">
	<defs>
		<pattern id="spoton-hexfield" width={TILE_W} height={TILE_H} patternUnits="userSpaceOnUse">
			{#each CENTRES as [cx, cy] (`${cx}:${cy}`)}
				<polygon points={hex(cx, cy)} fill="none" stroke="currentColor" stroke-width="1" />
			{/each}
		</pattern>
	</defs>
	<rect width="100%" height="100%" fill="url(#spoton-hexfield)" />
</svg>

<style>
	.field {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		color: var(--label-4);
		pointer-events: none;
		/* Faded out towards the text, so no word is ever read through a line. */
		-webkit-mask-image: linear-gradient(108deg, rgba(0, 0, 0, 0.8) 0%, transparent 44%);
		mask-image: linear-gradient(108deg, rgba(0, 0, 0, 0.8) 0%, transparent 44%);
	}
</style>
