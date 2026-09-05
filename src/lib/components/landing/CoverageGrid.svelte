<script lang="ts">
	/**
	 * Where the survey reaches, drawn as the grid actually lies on the ground.
	 *
	 * WHAT THIS REPLACED, AND WHY
	 *
	 * One hexagon per cell, 31 to a row, extruded into an isometric slab. Grid order is
	 * by transit access, so the field came out as a rectangle with holes wherever the
	 * sort had put them: a picture with the authority of a map and the content of a
	 * shuffled list. In the dark it was worse than useless — a flat blue wall with black
	 * pits in it, every hexagon carrying an outline, and nothing to read.
	 *
	 * These are the real positions. The holes fall where the catalogue genuinely stops,
	 * along the edges of the province, and the corridors show as the arms they are. It is
	 * the same claim as before and now it is worth looking at.
	 *
	 * Flat, not extruded. The model on the stage above is the page's one three-dimensional
	 * object, and a second slab competing with it made both look like decoration. A cell
	 * that has been surveyed is filled and has no outline at all; one that has not is an
	 * outline with nothing in it. That reads at a glance and does not depend on telling
	 * two similar colours apart.
	 */
	import { copy } from '$lib/state/lang.svelte';

	export interface CoveragePoint {
		x: number;
		y: number;
		/** Has this cell's city been read from the catalogue. */
		s: boolean;
	}

	interface Props {
		map: { pts: CoveragePoint[]; height: number; radius: number };
		surveyed: number;
		unsurveyed: number;
	}
	let { map, surveyed, unsurveyed }: Props = $props();

	const c = $derived(copy());

	/** A pointy-top hexagon at the origin, as a path, at the grid's own pitch. */
	const hex = $derived.by(() => {
		const r = map.radius;
		const pts = Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 180) * (60 * i - 90);
			return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
		});
		return `M${pts.join('L')}Z`;
	});

	const pad = $derived(map.radius * 1.4);
</script>

<figure class="cov">
	<svg
		viewBox={`${-pad} ${-pad} ${1000 + pad * 2} ${map.height + pad * 2}`}
		role="img"
		aria-label={c.data.gridLabel(map.pts.length, surveyed, unsurveyed)}
	>
		<defs><path id="cov-hex" d={hex} /></defs>
		{#each map.pts as p, i (i)}
			<use href="#cov-hex" x={p.x} y={p.y} class={p.s ? 'on' : 'off'} />
		{/each}
	</svg>

	<figcaption>
		<span class="key">
			<span class="sw on" aria-hidden="true"></span>
			<b>{surveyed}</b>
			{c.data.gridWithData}
		</span>
		<span class="key">
			<span class="sw off" aria-hidden="true"></span>
			<b>{unsurveyed}</b>
			{c.data.gridEmpty}
		</span>
	</figcaption>
</figure>

<style>
	.cov {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	svg {
		display: block;
		width: 100%;
		/* Capped, and centred once it is. The field is nearly square, so at full panel
		   width it stood a screen tall and the caption under it fell off the bottom. */
		max-width: 42rem;
		margin-inline: auto;
		height: auto;
		overflow: visible;
	}

	/* Surveyed: filled, no stroke. An outline on 462 of these turned the field into a
	   mesh, and the mesh was the loudest thing in the picture. */
	.on {
		fill: var(--accent);
		fill-opacity: 0.62;
	}
	/* Not surveyed: the shape of a cell with nothing in it, which is the claim. */
	.off {
		fill: none;
		stroke: var(--label-3);
		stroke-width: 1.6;
	}

	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		font-size: 0.75rem;
		color: var(--ink-3, var(--label-3));
	}
	.key {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
	}
	.key b {
		color: var(--label-1);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.sw {
		width: 0.625rem;
		height: 0.6875rem;
		flex: none;
		/* The same silhouette as the field itself, so the key is the thing it explains
		   rather than a square standing in for it. */
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
	}
	.sw.on {
		background: color-mix(in srgb, var(--accent) 62%, transparent);
	}
	/* An outline, exactly as the field draws it. A filled grey swatch stood for a
	   shape that is never filled. */
	.sw.off {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--label-3);
	}
</style>
