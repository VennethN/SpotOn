<script lang="ts">
	/**
	 * The market, pivoted: one row per unit on it.
	 *
	 * The cell panel answers "is this a good area". This answers the question that comes
	 * after it and that the cell panel structurally cannot: "which of these could I
	 * actually take, and what would it cost me". Nobody rents a hexagon.
	 *
	 * Every row carries both halves — what the unit is, and how the catchment around it
	 * scores — because either one alone is a trap. The cheapest shophouse in Jakarta is
	 * cheap for a reason, and the best-scoring catchment has units in it nobody reading
	 * this could afford.
	 *
	 * The list and the map marks are the SAME set. Sorting or filtering here redraws the
	 * map, so a reader can see what a filter did rather than being told.
	 */
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { UNIT_METRIC_MAP, type UnitMetricKey } from '$lib/domain/units';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { pct } from '$lib/utils/format';

	/** How many rows get drawn. The market runs to a couple of thousand units, and a
	    panel that renders all of them is a scroll nobody reaches the end of. The count
	    above says how many the sort ran over, so the cut is stated rather than hidden. */
	const SHOWN = 40;

	/** The sorts offered. A subset of the registry on purpose: these are the four a
	    reader actually chooses between, and a dropdown of ten is a decision rather than
	    a control. The rest of the registry is still reachable by asking Tapak. */
	const SORTS: UnitMetricKey[] = ['harga', 'harga_m2', 'skor_petak', 'luas_bangunan'];

	const app = getAppState();
	const c = $derived(copy());

	const rows = $derived(app.unitRows);
	const shown = $derived(rows.slice(0, SHOWN));
	/** Units a filter removed, and units the SORT could not place because they carry no
	    reading for the measure it uses. Counted separately: telling a reader they
	    filtered out 253 places when they have touched no filter is worse than saying
	    nothing, and the second number is a fact about the listings rather than about
	    anything they did. */
	const filteredOut = $derived(app.units.length - app.unitFiltered.length);
	const unmeasured = $derived(app.unitFiltered.length - rows.length);

	function setSort(k: UnitMetricKey) {
		if (app.unitSort === k) {
			// Second press flips it. The first press uses the measure's own idea of
			// "best", which is cheapest for a price and highest for a score — pressing
			// "price" and getting the most expensive units first would be absurd.
			app.unitOrder = app.unitOrder === 'asc' ? 'desc' : 'asc';
			return;
		}
		app.unitSort = k;
		app.unitOrder = UNIT_METRIC_MAP[k].best;
	}

	const value = (k: UnitMetricKey, v: number | null): string =>
		v === null ? '·' : c.units.value(k, v);
</script>

<section class="list">
	<SectionHead icon="units">{c.units.title}</SectionHead>

	{#if app.listingsFailed}
		<p class="note">{c.property.marketFailed}</p>
	{:else if app.listings === null}
		<p class="note">{c.property.marketLoading}</p>
	{:else}
		<p class="count">
			{c.units.count(rows.length)}
			{#if filteredOut > 0}
				<span class="sub">{c.units.filteredOut(filteredOut)}</span>
			{/if}
			{#if unmeasured > 0}
				<span class="sub">{c.units.unmeasured(unmeasured, c.units.metrics[app.unitSort])}</span>
			{/if}
		</p>

		<!-- The sort. Chips rather than a select, because the same row of controls
		     doubles as the legend for the column on the right of every row. -->
		<ul class="sorts">
			{#each SORTS as k (k)}
				<li>
					<button
						type="button"
						class:on={app.unitSort === k}
						onclick={() => setSort(k)}
						aria-pressed={app.unitSort === k}
					>
						{c.units.metrics[k]}
						{#if app.unitSort === k}
							<span class="dir" aria-hidden="true">{app.unitOrder === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if rows.length === 0}
			<p class="note">{c.units.none}</p>
		{:else}
			<ul class="units">
				{#each shown as { unit, value: v } (unit.id)}
					<li>
						<button
							type="button"
							class="unit"
							class:on={app.selectedUnitId === unit.id}
							onclick={() => app.selectUnit(unit.id)}
						>
							<span class="top">
								<span class="ty">{c.property.types[unit.listing.type] ?? unit.listing.type}</span>
								<!-- The catchment's score, as a dot rather than a number. The row is
								     already carrying one figure, and two competing numerals make the
								     reader work out which is the one they sorted by. -->
								<span
									class="dot"
									style:background={unit.row?.score == null
										? 'var(--nodata)'
										: `var(--ramp-${Math.round(unit.row.score * 6)})`}
									aria-hidden="true"
								></span>
								<span class="where">{unit.cellName}</span>
								<span class="val">{value(app.unitSort, v)}</span>
							</span>
							<span class="traits">
								{#if unit.listing.price !== null && app.unitSort !== 'harga'}
									{c.units.value('harga', unit.listing.price)} ·
								{/if}
								{#if unit.listing.land !== null}{c.property.unitLand(unit.listing.land)} ·{/if}
								{#if unit.listing.floors !== null}{c.property.unitFloors(unit.listing.floors)} ·{/if}
								{#if unit.row?.score != null}
									{c.units.cellScore(pct(unit.row.score))}
								{:else}
									{c.units.cellUnscored}
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if rows.length > SHOWN}
				<p class="note">{c.units.more(rows.length - SHOWN)}</p>
			{/if}
			<p class="note">{c.units.provenance}</p>
		{/if}
	{/if}
</section>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.count {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--label-1);
	}
	.count .sub {
		display: block;
		font-size: 0.6875rem;
		color: var(--label-3);
	}
	.note {
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}

	.sorts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3125rem;
	}
	.sorts button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		border-radius: 999px;
		padding: 0.1875rem 0.5rem;
		font-size: 0.625rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.sorts button:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
	.sorts button.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.sorts .dir {
		font-size: 0.6875rem;
		line-height: 1;
	}

	.units {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.units li + li {
		border-top: 1px solid var(--separator);
	}
	.unit {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		width: 100%;
		text-align: left;
		border: 0;
		background: transparent;
		padding: 0.4375rem 0.375rem;
		border-radius: var(--r-sm, 6px);
		cursor: pointer;
		transition: background-color 120ms ease-out;
	}
	.unit:hover {
		background: var(--fill-1);
	}
	.unit.on {
		background: var(--accent-soft);
	}
	.top {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 0.75rem;
	}
	.ty {
		font-weight: 600;
		color: var(--label-1);
		white-space: nowrap;
	}
	.dot {
		flex: none;
		align-self: center;
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--separator) inset;
	}
	.where {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--label-3);
		font-size: 0.6875rem;
	}
	.val {
		flex: none;
		font-weight: 650;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.traits {
		font-size: 0.625rem;
		line-height: 1.4;
		color: var(--label-3);
	}
</style>
