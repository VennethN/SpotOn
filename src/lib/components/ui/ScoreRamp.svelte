<script lang="ts">
	/**
	 * The seven-step opportunity ramp — one hue, light to dark.
	 *
	 * The same strip used to be rewritten in three places (the map legend, the
	 * advanced panel, the landing page). Three copies means three chances to differ
	 * from the colours the map actually uses, and a legend that disagrees with its
	 * map is worse than no legend at all.
	 *
	 * The "no data" colour is deliberately off the ramp: it is not a small value, it
	 * is not a value — so it is marked with an outlined box, not the palest step.
	 */
	import { copy } from '$lib/state/lang.svelte';

	interface Props {
		/** Text at both ends. Leave empty when the context already explains it. */
		ends?: [string, string] | null;
		/** The "no data" row and its caption. */
		nodata?: string | null;
		/** A thin strip for narrow panels. */
		dense?: boolean;
	}
	let { ends, nodata = null, dense = false }: Props = $props();

	const c = $derived(copy());
	const labels = $derived(ends === null ? null : (ends ?? [c.scale.low, c.scale.high]));

	const STEPS = [0, 1, 2, 3, 4, 5, 6];
</script>

<div class="ramp-wrap" class:dense>
	<div class="ramp" aria-hidden="true">
		{#each STEPS as s (s)}
			<span style:background={`var(--ramp-${s})`}></span>
		{/each}
	</div>
	{#if labels}
		<div class="ends">
			<span>{labels[0]}</span>
			<span>{labels[1]}</span>
		</div>
	{/if}
	{#if nodata}
		<p class="nd">
			<span class="key" aria-hidden="true"></span>
			{nodata}
		</p>
	{/if}
</div>

<style>
	.ramp-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
	}
	.ramp {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		height: 0.5rem;
	}
	.dense .ramp {
		height: 0.4375rem;
	}
	.ramp span {
		border-radius: 1px;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.dense .ends {
		font-size: 0.5625rem;
	}
	.nd {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.6875rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.dense .nd {
		font-size: 0.625rem;
		color: var(--label-2);
	}
	/* Exactly the hatching the map uses for cells with no data. */
	.key {
		width: 0.6875rem;
		height: 0.6875rem;
		flex: none;
		border-radius: 2px;
		border: 1px solid var(--separator);
		background: repeating-linear-gradient(
			45deg,
			var(--fill-1) 0 2px,
			color-mix(in srgb, var(--nodata) 55%, transparent) 2px 4px
		);
	}
</style>
