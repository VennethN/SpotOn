<script lang="ts">
	/**
	 * One hexagon per H3 cell — 558 of them, in the same order as the grid.
	 *
	 * Drawn isometric and with thickness rather than flat, because the model on the
	 * stage above has already set the language: white objects seen from above and to
	 * the side, with their sides visible. A flat grid on the same page would read as
	 * an image borrowed from a different product.
	 *
	 * Cells with no data yet are drawn as holes — edges only, no body and no sides.
	 * Not given the palest colour: the palest colour still reads as "a small value",
	 * and that is not what is happening here. What is happening is that we do not
	 * know.
	 */
	import { copy } from '$lib/state/lang.svelte';

	interface Props {
		/** One character per cell, '1' = no data yet. */
		mask: string;
		withData: number;
		nodata: number;
	}
	let { mask, withData, nodata }: Props = $props();

	const c = $derived(copy());

	const COLS = 31;
	/* A pointy-top hexagon plan, squashed into an isometric projection and then given
	   thickness. These four numbers are the viewing angle. */
	const W = 15;
	const H_PLAN = W * 1.1547;
	const SQUASH = 0.54;
	const H = H_PLAN * SQUASH;
	const DEPTH = 3.4;
	const PITCH_X = W + 1.2;
	const PITCH_Y = H_PLAN * 0.75 * SQUASH + 1.1;

	/** The top face: the squashed hexagon. */
	const FACE = `M ${W / 2} 0 L ${W} ${H * 0.25} L ${W} ${H * 0.75} L ${W / 2} ${H} L 0 ${
		H * 0.75
	} L 0 ${H * 0.25} Z`;
	/** The sides: the hexagon's three lower edges, dropped by DEPTH. */
	const SIDE = `M 0 ${H * 0.75} L ${W / 2} ${H} L ${W} ${H * 0.75} L ${W} ${H * 0.75 + DEPTH} L ${
		W / 2
	} ${H + DEPTH} L 0 ${H * 0.75 + DEPTH} Z`;

	const rows = $derived(Math.ceil(mask.length / COLS));
	const cells = $derived(
		Array.from(mask, (c, i) => {
			const r = Math.floor(i / COLS);
			const q = i % COLS;
			return {
				x: q * PITCH_X + (r % 2 ? PITCH_X / 2 : 0),
				y: r * PITCH_Y,
				empty: c === '1'
			};
		})
	);

	const w = $derived((COLS - 1) * PITCH_X + PITCH_X / 2 + W);
	const h = $derived((rows - 1) * PITCH_Y + H + DEPTH);
</script>

<figure class="cov">
	<svg
		viewBox={`-1 -1 ${w + 2} ${h + 2}`}
		role="img"
		aria-label={c.data.gridLabel(mask.length, withData, nodata)}
	>
		<defs>
			<!-- One gradient across the whole field, not one per cell: the light
			     falls on the model, not on each tile individually. -->
			<linearGradient id="cov-lift" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
				<stop offset="0" class="g-top" />
				<stop offset="1" class="g-bot" />
			</linearGradient>
			<path id="cov-face" d={FACE} />
			<path id="cov-side" d={SIDE} />
		</defs>

		<!-- Row by row from back to front: the sides of a front-row cell have to
		     cover the cell behind it, not the other way round. -->
		{#each cells as c, i (i)}
			{#if c.empty}
				<use href="#cov-face" x={c.x} y={c.y} class="hole" />
			{:else}
				<use href="#cov-side" x={c.x} y={c.y} class="side" />
				<use href="#cov-face" x={c.x} y={c.y} class="face" />
			{/if}
		{/each}
	</svg>

	<figcaption>
		<span class="key">
			<span class="sw ada" aria-hidden="true"></span>
			<b>{withData}</b> {c.data.gridWithData}
		</span>
		<span class="key">
			<span class="sw empty" aria-hidden="true"></span>
			<b>{nodata}</b> {c.data.gridEmpty}
		</span>
	</figcaption>
</figure>

<style>
	.cov {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		/* This is a diagram, not a mural: left page-wide it would swallow its own section. */
		max-width: 34rem;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	/* The tiles are lit white objects, not coloured cells: the blue is only a tint on
	   a bright surface, and what separates a face from a side is light and shade.
	   Painted fully blue, this grid becomes the loudest field on a page made entirely
	   of hairlines. Its base is `--bg-elevated`, which in both themes is always
	   lighter than the paper. */
	.g-top {
		stop-color: color-mix(in srgb, var(--accent) 30%, var(--bg-elevated));
	}
	.g-bot {
		stop-color: color-mix(in srgb, var(--accent) 18%, var(--bg-elevated));
	}
	.face {
		fill: url(#cov-lift);
	}
	.side {
		fill: color-mix(in srgb, var(--accent) 34%, #05070c);
		fill-opacity: 0.5;
	}
	/* A hole has to read as a recess, not as a differently coloured tile. Without a
	   fill, the warm paper shows between pale blue tiles and the eye can invert the
	   image: the holes appear to stand proud. A thin shadow inside locks that reading
	   in place, and its ink is pinned dark so the direction stays the same in both
	   the light and the dark theme. */
	.hole {
		fill: #05070c;
		fill-opacity: 0.09;
		stroke: var(--label-3);
		stroke-width: 0.9;
	}

	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 1.25rem;
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.key {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.key b {
		color: var(--label-1);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.sw {
		width: 0.6875rem;
		height: 0.5rem;
		flex: none;
		/* The same squashed hexagon as in the grid, at letter size. */
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		background: color-mix(in srgb, var(--accent) 26%, var(--bg-elevated));
	}
	/* An outlined box, not an outlined hexagon: at this size the hexagon's lines
	   touch each other and the shape stops reading. */
	.sw.empty {
		clip-path: none;
		border-radius: 1px;
		background: transparent;
		border: 1px solid var(--label-3);
	}
</style>
