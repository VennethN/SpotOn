<script lang="ts">
	/**
	 * The grid, repainting itself as the conversation beside it asks.
	 *
	 * WHY THIS EXISTS
	 *
	 * The sample conversation used to be a chat box on its own. It quoted real places
	 * and real scores, and it still asked the visitor to take on trust the single thing
	 * this product is: that asking a question repaints a map. Reading "Pasar Pramuka, 66"
	 * in a speech bubble is not the same as watching the whole city change colour when
	 * the business type changes, and the second one is what SpotOn actually does.
	 *
	 * Every cell is at its real position and carries the score the engine gave it for
	 * that question. Nothing here is drawn to look good: ask about minimarkets and the
	 * dense retail corridors go dark, ask about laundries and a different city appears.
	 *
	 * HOW THE MOTION IS BUILT
	 *
	 * The repaint sweeps west to east rather than switching all at once. A whole map
	 * changing on one frame reads as a slide being swapped; a sweep reads as an answer
	 * arriving, and it takes just long enough for the eye to notice that the pattern
	 * itself changed rather than only its colours.
	 *
	 * One curve and one duration for every cell, with only the delay varying, so the
	 * 562 of them stay one movement instead of 562. The delay is computed once from the
	 * cell's x position, because it never changes.
	 *
	 * The marks are the places the answer named, and they land after the sweep has
	 * passed them. They scale up from nothing at their own centre, so they read as
	 * arriving on the map rather than as being drawn over it.
	 */
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { CoveragePoint } from './CoverageGrid.svelte';

	export interface QueryMapData {
		/** One character per cell, in the order of `map.pts`: a ramp step, or `.` for
		    a cell the active source has not surveyed. */
		bands: string;
		/** Indices into `map.pts` of the places the answer named. */
		marks: number[];
	}

	interface Props {
		map: { pts: CoveragePoint[]; height: number; radius: number };
		data: QueryMapData;
		/** The business type this reading is for, for the caption. */
		label: string;
		/** Held back until the answer has actually landed in the conversation. */
		answered: boolean;
	}
	let { map, data, label, answered }: Props = $props();

	const c = $derived(copy());
	const reduced = prefersReducedMotion();

	/** A pointy-top hexagon at the origin, at the grid's own pitch. */
	const hex = $derived.by(() => {
		const r = map.radius;
		const pts = Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 180) * (60 * i - 90);
			return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
		});
		return `M${pts.join('L')}Z`;
	});

	/* The sweep, as a per-cell delay in milliseconds. Computed once from x, since a
	   cell does not move between questions. 1000 is the projection's own width, so this
	   is a fraction of the city rather than a pixel count. */
	const SWEEP = 520;
	const delays = $derived(map.pts.map((p) => Math.round((p.x / 1000) * SWEEP)));

	const pad = $derived(map.radius * 1.4);

	/**
	 * The map holds the LAST answer until the next one lands.
	 *
	 * It used to blank while a question was being asked, which was accurate and read
	 * badly: an empty outline field for most of every cycle, and a reader arriving
	 * mid-question saw a product that draws nothing. Holding the previous reading is
	 * what the app does too, since the map there does not clear itself while you type.
	 *
	 * Empty only before the very first answer, where there genuinely is nothing yet.
	 */
	let shown = $state<QueryMapData | null>(null);
	$effect(() => {
		if (answered) shown = data;
	});

	const bands = $derived(shown?.bands ?? '');
	const marks = $derived(shown?.marks ?? []);
</script>

<figure class="qm">
	<svg
		viewBox={`${-pad} ${-pad} ${1000 + pad * 2} ${map.height + pad * 2}`}
		role="img"
		aria-label={shown ? c.ai.mapLabel(label) : c.ai.mapEmpty}
	>
		<defs><path id="qm-hex" d={hex} /></defs>

		{#each map.pts as p, i (i)}
			{@const b = bands[i] ?? '.'}
			<use
				href="#qm-hex"
				x={p.x}
				y={p.y}
				class="cell"
				class:blank={b === '.'}
				style:--fill={b === '.' ? 'transparent' : `var(--ramp-${b})`}
				style:--delay={reduced ? '0ms' : `${delays[i]}ms`}
			/>
		{/each}

		<!-- The places the answer named. Drawn last so they sit above every cell, and
		     held until the sweep has reached them. -->
		{#if shown}
			{#each marks as m, n (m)}
				{@const p = map.pts[m]}
				{#if p}
					<g
						class="mark"
						style:--delay={reduced ? '0ms' : `${delays[m] + 260 + n * 70}ms`}
						style:transform-origin={`${p.x}px ${p.y}px`}
					>
						<circle cx={p.x} cy={p.y} r={map.radius * 1.5} class="halo" />
						<circle cx={p.x} cy={p.y} r={map.radius * 0.92} class="pin" />
						<text x={p.x} y={p.y} class="num">{n + 1}</text>
					</g>
				{/if}
			{/each}
		{/if}
	</svg>

	<figcaption>{c.ai.mapCaption(label)}</figcaption>
</figure>

<style>
	.qm {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	/* One curve and one duration for all 562, with only the delay varying, so the
	   repaint is one movement rather than 562 of them. */
	.cell {
		fill: var(--fill);
		fill-opacity: 0.9;
		transition:
			fill 460ms cubic-bezier(0.32, 0.72, 0, 1) var(--delay),
			fill-opacity 460ms cubic-bezier(0.32, 0.72, 0, 1) var(--delay);
	}
	/* Not a low score: a cell nobody surveyed for this business type. An outline with
	   nothing in it, exactly as the coverage picture further down the page draws it. */
	.cell.blank {
		fill-opacity: 0;
		stroke: var(--label-3);
		stroke-width: 1.4;
		stroke-opacity: 0.5;
	}

	.mark {
		animation: land 420ms cubic-bezier(0.32, 0.72, 0, 1) var(--delay) both;
	}
	.halo {
		fill: var(--paper);
		fill-opacity: 0.92;
	}
	.pin {
		fill: var(--label-1);
	}
	.num {
		fill: var(--paper);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 700;
		text-anchor: middle;
		dominant-baseline: central;
	}

	figcaption {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	@keyframes land {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* A cross-fade rather than a sweep, and the marks simply appear. The reading is
	   identical; only the travel is gone. */
	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition:
				fill 160ms ease-out,
				fill-opacity 160ms ease-out;
		}
		.mark {
			animation: none;
		}
	}
</style>
