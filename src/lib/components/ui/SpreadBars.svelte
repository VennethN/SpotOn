<script lang="ts">
	/**
	 * A distribution: one bar per band, with the fullest band picked out.
	 *
	 * This was a 24-hour profile, and the series behind it — receipts per hour, summed
	 * over the grid — was generated cell by cell. Nobody has counted an hour of trade in
	 * Jakarta. What is counted is how many businesses stand within walking range of each
	 * cell, so the chart now shows how those cells are spread across that count: most
	 * quiet, a long tail of dense ones.
	 *
	 * One series, one hue — height carries the magnitude, the colour carries nothing
	 * beyond "this is the data". Only the fullest band gets a label; putting a number on
	 * every bar means not one of them reads. The full figures are supplied by the caller,
	 * in the collapsible table.
	 */
	import { copy } from '$lib/state/lang.svelte';
	import { num } from '$lib/utils/format';

	export interface Band {
		/** The top of this band, inclusive — bands run from the one below it up to here. */
		upTo: number;
		/** How many cells fall in it. */
		cells: number;
	}

	interface Props {
		bands: Band[];
		/** What one bar counts, for screen readers and the tooltip. */
		unit?: string;
		/** Compact: short height for narrow panels, no axis and no tooltip. */
		dense?: boolean;
	}
	let { bands, unit, dense = false }: Props = $props();

	const c = $derived(copy());
	const u = $derived(unit ?? c.spreadChart.unit);

	const values = $derived(bands.map((b) => b.cells));
	const peak = $derived(Math.max(1, ...values));
	const peakAt = $derived(values.indexOf(Math.max(...values)));
	const total = $derived(values.reduce((a, b) => a + b, 0));
	// Ticks that land right under the peak label are skipped; two labels stacked on
	// each other is worse than one missing tick.
	const ticks = $derived(
		[0, Math.floor(bands.length / 2), bands.length - 1].filter(
			(i) => i >= 0 && Math.abs(i - peakAt) > 1.5
		)
	);

	let hover = $state<number | null>(null);

	const at = (i: number) => ((i + 0.5) / Math.max(1, bands.length)) * 100;
	/**
	 * Axis labels are centred on their bar, except at both edges: there half
	 * the label falls outside the plot and the number gets clipped.
	 */
	const anchor = (i: number) => (at(i) < 6 ? '0' : at(i) > 94 ? '-100%' : '-50%');
	const band = (i: number) => num(bands[i]?.upTo ?? 0);
</script>

<div class="bars" class:dense>
	<div
		class="plot"
		role="img"
		aria-label={c.spreadChart.label(num(total), band(peakAt), num(peak), u)}
		onpointerleave={() => (hover = null)}
	>
		{#each bands as b, i (b.upTo)}
			<button
				type="button"
				class="col"
				class:on={i === peakAt}
				class:hot={hover === i}
				aria-label={c.spreadChart.bar(band(i), num(b.cells), u)}
				onpointerenter={() => (hover = i)}
				onfocus={() => (hover = i)}
				onblur={() => (hover = null)}
			>
				<span class="bar" style:height={`${Math.max(1.5, (b.cells / peak) * 100)}%`}></span>
			</button>
		{/each}

		{#if hover !== null && !dense}
			<span class="tip" style:left={`${at(hover)}%`}>
				<b>{num(bands[hover].cells)}</b>
				{u} · {c.spreadChart.upTo(band(hover))}
			</span>
		{/if}
	</div>

	<div class="axis" aria-hidden="true">
		{#each ticks as i (i)}
			<span style:left={`${at(i)}%`} style:--anchor={anchor(i)}>{band(i)}</span>
		{/each}
		<span class="peak" style:left={`${at(peakAt)}%`} style:--anchor={anchor(peakAt)}>
			{c.spreadChart.peak}
			{band(peakAt)}
		</span>
	</div>
</div>

<style>
	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.plot {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: clamp(6rem, 14vh, 9.5rem);
		border-bottom: 1px solid var(--separator-strong);
	}
	.dense .plot {
		height: 3.25rem;
		gap: 1px;
	}
	.col {
		flex: 1;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: flex-end;
		background: none;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.bar {
		display: block;
		width: 100%;
		/* The data end is rounded, the foot stays flush with the baseline. */
		border-radius: 3px 3px 0 0;
		background-color: color-mix(in srgb, var(--accent) 42%, transparent);
		background-image: var(--lift-bar);
		transition: background-color 140ms ease-out;
	}
	.dense .bar {
		border-radius: 2px 2px 0 0;
	}
	.col.on .bar {
		background: var(--accent);
	}
	.col.hot .bar {
		background: color-mix(in srgb, var(--accent) 78%, transparent);
	}
	.col.on.hot .bar {
		background: var(--accent);
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 0.375rem);
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 0.6875rem;
		color: var(--label-2);
		background: var(--bg-elevated);
		border: 1px solid var(--separator);
		border-radius: var(--r-xs);
		padding: 0.125rem 0.375rem;
		pointer-events: none;
		box-shadow: var(--shadow-chip);
	}
	.tip b {
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}

	.axis {
		position: relative;
		height: 1.6rem;
		font-size: 0.625rem;
		color: var(--label-3);
	}
	.dense .axis {
		height: 1.1rem;
		font-size: 0.5625rem;
	}
	.axis span {
		position: absolute;
		top: 0.25rem;
		transform: translateX(var(--anchor, -50%));
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.axis .peak {
		color: var(--accent);
		font-weight: 600;
	}
</style>
