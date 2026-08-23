<script lang="ts">
	/**
	 * Every catchment an account can open, where it actually is.
	 *
	 * This is the unit the second meter counts. "1,500 areas a week" is an allowance
	 * nobody can picture, and the picture is the city: 562 hexagons in their real
	 * positions, coloured by the trade standing around each one.
	 *
	 * IT IS A MAP AND IT IS ALLOWED TO BE ONE, which is the difference between this and
	 * the hexagon field behind the head of the page. That one is uniform because it is
	 * decoration, and a decoration with one cell darker than another would be a map of
	 * nothing. This one is a map of something: every position is a real cell centre and
	 * every colour is a real count, both read from the grid on disk. So it carries a
	 * legend and says what it is coloured by.
	 *
	 * Flat, not extruded. The page already has one three-dimensional object, in the head,
	 * and the landing page settled why there is only ever one: a second slab competing
	 * with it made both look like decoration.
	 *
	 * The measure is TRADE, not an opportunity score. Nobody choosing a plan has named a
	 * business type, and an opportunity score without one would be a score for a business
	 * the reader never mentioned. Trade is what the map itself paints before anything has
	 * been asked, so this field and the app's opening screen say the same thing.
	 *
	 * A cell the catalogue has never read is drawn as an outline with nothing in it. It is
	 * not a quiet street, and colouring it with the bottom of the ramp would say it was.
	 */
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { rampVar } from '$lib/utils/format';

	export interface FieldPoint {
		x: number;
		y: number;
		/** Trade around this cell, 0..1 of the busiest. Null where nothing was read. */
		v: number | null;
	}

	let {
		field,
		cells,
		measured
	}: {
		field: { pts: FieldPoint[]; height: number; radius: number };
		cells: number;
		measured: number;
	} = $props();

	const c = $derived(copy());

	/** A pointy-top hexagon at the origin, at the grid's own pitch. Derived from the
	    radius the projection measured, so the cells tile at whatever resolution the grid
	    is rebuilt at rather than at one somebody typed. */
	const hex = $derived.by(() => {
		const r = field.radius;
		const pts = Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 180) * (60 * i - 90);
			return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
		});
		return `M${pts.join('L')}Z`;
	});

	const pad = $derived(field.radius * 1.4);
</script>

<figure class="field material">
	<svg
		viewBox={`${-pad} ${-pad} ${1000 + pad * 2} ${field.height + pad * 2}`}
		role="img"
		aria-label={c.account.fieldLabel(cells, measured)}
	>
		<defs><path id="acct-hex" d={hex} /></defs>
		{#each field.pts as p, i (i)}
			{#if p.v === null}
				<use href="#acct-hex" x={p.x} y={p.y} class="none" />
			{:else}
				<use href="#acct-hex" x={p.x} y={p.y} fill={rampVar(p.v)} />
			{/if}
		{/each}
	</svg>

	<figcaption>
		<p class="lead">{c.account.fieldLead(cells)}</p>
		<p class="note">{c.account.fieldNote(cells - measured)}</p>
		<!-- Directly under the field that uses it. A ramp that has to be hunted down
		     elsewhere stops being an explanation of the colour. -->
		<div class="legend">
			<ScoreRamp
				dense
				ends={[c.account.fieldLow, c.account.fieldHigh]}
				nodata={c.account.fieldNoData}
			/>
		</div>
	</figcaption>
</figure>

<style>
	.field {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(13rem, 1fr);
		gap: 1rem 1.25rem;
		align-items: center;
		padding: 1rem;
		border-radius: var(--r-lg);
		background: var(--bg-elevated);
		margin: 0;
	}

	/* Capped, because Jakarta is taller than it is wide once the corridors south are in
	   it, and an uncapped figure makes a card half a screen high on a page whose subject
	   is a balance. The cap is on the height rather than the width so the cells keep
	   their pitch and the shape stays the shape. */
	svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 19rem;
		margin: 0 auto;
		overflow: visible;
	}

	/* No outline on a cell that carries a colour. 562 hexagons each wearing a hairline
	   turns the field into a mesh, and the mesh is louder than the values in it. */
	use {
		stroke: none;
	}
	/* Never read: an outline with nothing in it. It reads at a glance and does not
	   depend on telling two similar colours apart. */
	.none {
		fill: none;
		stroke: var(--separator-strong);
		stroke-width: 0.9;
	}

	figcaption {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
	}
	.lead {
		font-size: 0.8125rem;
		font-weight: 550;
		color: var(--label-1);
	}
	.note {
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.legend {
		margin-top: 0.125rem;
		max-width: 18rem;
	}

	@media (max-width: 46rem) {
		.field {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
