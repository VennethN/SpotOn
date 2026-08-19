<script lang="ts">
	/**
	 * How the trade of a transit area is spread across the grid — the chart itself is
	 * `ui/SpreadBars`; all that is specific to the landing page is the source note and
	 * the collapsible table of figures below it, so this reading is never the only route
	 * to the data.
	 *
	 * There is no MOCK tag under it any more, because there is nothing left to tag. The
	 * chart that stood here was a 24-hour transaction profile, and every hour of it was
	 * generated.
	 */
	import SpreadBars, { type Band } from '$lib/components/ui/SpreadBars.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { num } from '$lib/utils/format';

	let { bands, caption }: { bands: Band[]; caption?: string } = $props();

	const c = $derived(copy());
</script>

<div class="prof">
	<figure>
		<SpreadBars {bands} unit={c.spreadChart.unit} />
		<figcaption>{caption ?? c.spreadChart.caption}</figcaption>
	</figure>

	<details>
		<summary>{c.spreadChart.table}</summary>
		<table>
			<caption class="sr">{c.spreadChart.tableCaption}</caption>
			<thead>
				<tr>
					<th scope="col">{c.spreadChart.colBand}</th><th scope="col">{c.spreadChart.colValue}</th>
				</tr>
			</thead>
			<tbody>
				{#each bands as b (b.upTo)}
					<tr><th scope="row">{c.spreadChart.upTo(num(b.upTo))}</th><td>{num(b.cells)}</td></tr>
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
