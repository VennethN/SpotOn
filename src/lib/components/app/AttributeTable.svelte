<script lang="ts">
	import { getAppState } from '$lib/state/app.svelte';
	import { copy, lang } from '$lib/state/lang.svelte';
	import { pct, rampVar } from '$lib/utils/format';
	import type { ScoredHex } from '$lib/types';

	const app = getAppState();
	const c = $derived(copy());

	type SortKey = 'name' | 'score' | 'demand' | 'supply' | 'osm' | 'listings' | 'nTot' | 'typology';

	const COLUMNS: Array<{ key: SortKey; num?: boolean }> = [
		{ key: 'name' },
		{ key: 'score', num: true },
		{ key: 'demand', num: true },
		{ key: 'supply', num: true },
		{ key: 'osm', num: true },
		{ key: 'listings', num: true },
		{ key: 'nTot', num: true },
		{ key: 'typology' }
	];

	let sortKey = $state<SortKey>('score');
	let sortDir = $state<1 | -1>(-1);

	function toggleSort(key: SortKey) {
		if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1;
		else {
			sortKey = key;
			sortDir = key === 'name' || key === 'typology' ? 1 : -1;
		}
	}

	// Hexes with no data always sort last: their value is absent, not zero.
	const rows = $derived(
		[...app.rows].sort((a, b) => {
			const va = a[sortKey] as string | number | null;
			const vb = b[sortKey] as string | number | null;
			if (va === null) return 1;
			if (vb === null) return -1;
			return typeof va === 'string' && typeof vb === 'string'
				? sortDir * va.localeCompare(vb, lang())
				: sortDir * ((va as number) - (vb as number));
		})
	);

	const cell = (r: ScoredHex, key: SortKey): string => {
		switch (key) {
			case 'name':
				return r.name;
			case 'typology':
				return c.typology[r.typology];
			case 'score':
			case 'demand':
			case 'supply':
				return pct(r[key]);
			default:
				return String(r[key]);
		}
	};
</script>

<!-- Every column here is per-category, so with no category loaded there is nothing to
     tabulate. Saying so beats an empty grid, which reads as "no cells match". -->
{#if !app.ready}
	<p class="empty">
		{app.sliceLoading ? c.app.heatmapLoading : (app.sliceError ?? c.app.needCategory)}
	</p>
{:else}
<div class="wrap scroll">
	<table>
		<thead>
			<tr>
				{#each COLUMNS as col (col.key)}
					<th
						class:num={col.num}
						aria-sort={sortKey === col.key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
					>
						<button type="button" onclick={() => toggleSort(col.key)}>
							{c.table.cols[col.key]}{#if sortKey === col.key}<span class="caret">{sortDir === 1 ? '↑' : '↓'}</span>{/if}
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr
					class:selected={app.selectedId === r.id}
					class:nodata={r.nodata}
					onclick={() => app.select(r.id)}
				>
					{#each COLUMNS as col (col.key)}
						<td class:num={col.num}>
							{#if col.key === 'name'}
								<span class="dot" style:background={rampVar(r.score)}></span>{r.name}
							{:else if col.key === 'score'}
								<strong>{cell(r, col.key)}</strong>
							{:else}
								{cell(r, col.key)}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
{/if}

<style>
	.empty {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
		padding: 0.75rem;
	}
	.wrap {
		max-height: min(50vh, 22rem);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		min-width: 40rem;
	}
	th,
	td {
		padding: 0.3125rem 0.625rem;
		text-align: left;
		white-space: nowrap;
		border-bottom: 1px solid var(--separator);
	}
	th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
	}
	th button {
		width: 100%;
		border: 0;
		background: none;
		padding: 0.4375rem 0.625rem;
		text-align: inherit;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--label-3);
		cursor: pointer;
	}
	th button:hover {
		color: var(--label-1);
	}
	th.num button {
		text-align: right;
	}
	.caret {
		margin-left: 0.25rem;
		color: var(--accent);
	}
	td.num {
		text-align: right;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.6875rem;
	}
	tbody tr {
		cursor: pointer;
		transition: background-color 120ms ease-out;
	}
	tbody tr:hover {
		background: var(--fill-1);
	}
	tbody tr.selected {
		background: var(--accent-soft);
	}
	tbody tr.nodata td {
		color: var(--label-3);
	}
	.dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 3px;
		margin-right: 0.4375rem;
		border: 1px solid var(--separator);
	}
</style>
