<script lang="ts">
	/**
	 * The 24-hour profile of a transit area — the chart itself is shared with the app's
	 * detail panel (`ui/HourBars`); all that is specific to the landing page is the
	 * source note and the collapsible table of figures below it, so this reading is
	 * never the only route to the data.
	 */
	import HourBars from '$lib/components/ui/HourBars.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { formatHour, num } from '$lib/utils/format';

	let { hourly, caption }: { hourly: number[]; caption?: string } = $props();

	const c = $derived(copy());
</script>

<div class="prof">
	<figure>
		<HourBars {hourly} unit={c.hourChart.unit} />
		<figcaption>
			{caption ?? c.hourChart.caption}
			<span class="tag mock">MOCK</span>
		</figcaption>
	</figure>

	<details>
		<summary>{c.hourChart.table}</summary>
		<table>
			<caption class="sr">{c.hourChart.tableCaption}</caption>
			<thead>
				<tr><th scope="col">{c.hourChart.colHour}</th><th scope="col">{c.hourChart.colValue}</th></tr>
			</thead>
			<tbody>
				{#each hourly as v, h (h)}
					<tr><th scope="row">{formatHour(h)}</th><td>{num(v)}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>

<style>
	.prof,
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	figcaption {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	details {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.5rem;
	}
	summary {
		font-size: 0.6875rem;
		color: var(--label-3);
		cursor: pointer;
	}
	summary:hover {
		color: var(--label-2);
	}
	table {
		margin-top: 0.5rem;
		border-collapse: collapse;
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		text-align: left;
		padding: 0.125rem 1.25rem 0.125rem 0;
		font-weight: 400;
		color: var(--label-2);
	}
	thead th {
		color: var(--label-3);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
