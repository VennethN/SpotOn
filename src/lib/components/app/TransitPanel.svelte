<script lang="ts">
	/**
	 * What the selected area reaches by transit.
	 *
	 * This sits inside the area panel rather than in the technical drawer, because
	 * transit access is the one input a non-technical reader already has intuitions
	 * about — everybody knows what being next to a station is worth. It is also the
	 * only part of the score built entirely from REAL data (OSM), while the demand and
	 * competition figures around it are still MAPID samples.
	 *
	 * So it leads with station NAMES, not with the access index. "Blok M, 320 m" is
	 * something the reader can picture, check on the way home, and disagree with. The
	 * index is underneath, doing the arithmetic it was always doing.
	 */
	import {
		MODES,
		RAIL,
		accessBand,
		accessUplift,
		namedStops,
		presentModes,
		railTotal,
		stopTotal,
		type Mode
	} from '$lib/domain/transit';
	import Fineprint from '$lib/components/ui/Fineprint.svelte';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());

	const row = $derived(app.selected);
	const cell = $derived(app.selectedCell);

	const stops = $derived(app.selectedStops);
	const rail = $derived(namedStops(stops, RAIL));
	/* The counts come from the GRID, not from the stop list — they are what access was
	   actually computed from. The stop list only names them. If the file were missing
	   these still read correctly. */
	const modes = $derived(cell ? presentModes(cell.transit) : []);
	const total = $derived(cell ? stopTotal(cell.transit) : 0);
	const railCount = $derived(cell ? railTotal(cell.transit) : 0);
	const busCount = $derived(cell?.transit.brt ?? 0);
	const access = $derived(cell?.access ?? 0);
	const band = $derived(accessBand(access));
	const uplift = $derived(accessUplift(access));
	const hasRail = $derived(modes.some((m) => RAIL.includes(m.mode)));
	/* Waiting is not the same as never coming: with the stop file lost, this panel
	   drops the loading line and keeps the counts, which is what the note above
	   promises it does. */
	const waiting = $derived(app.stops === null && !app.stopsFailed);

	const colour = (m: Mode) => `var(--route-${m})`;
</script>

{#if cell}
	<section class="transit">
		<SectionHead icon="transit">
			{c.mood.transit}
			{#snippet action()}
				<button
					type="button"
					class="on-map"
					class:on={app.layers.stops}
					onclick={() => (app.layers.stops = !app.layers.stops)}
					aria-pressed={app.layers.stops}
				>
					{app.layers.stops ? c.mood.transitHide : c.mood.transitShow}
				</button>
			{/snippet}
		</SectionHead>

		{#if modes.length === 0}
			<p class="none">{c.mood.transitNone}</p>
		{:else}
			<!-- The count leads. Everything below it — the modes, the names, the index —
			     answers "which ones?"; this answers "how many?", which is the question
			     someone comparing two sites asks first, and the one this whole product
			     is organised around. Read from the grid, so it is right on the first
			     frame and never disagrees with the score beside it. -->
			<p class="count">
				<span class="n">{total}</span>
				<span class="unit">{c.mood.transitCount(total)}</span>
			</p>
			<p class="split">{c.mood.transitCountSplit(railCount, busCount)}</p>

			<!-- The mode chips read off the grid's own counts, so they are right from the
			     first frame — before the stop list has been fetched. -->
			<ul class="modes">
				{#each modes as m (m.mode)}
					<li style:--dot={colour(m.mode)}>
						<span class="dot" aria-hidden="true"></span>
						<span class="n">{m.n}</span>
						<span class="lbl">{c.mood.transitModes[m.mode]}</span>
					</li>
				{/each}
			</ul>

			<p class="band">
				{c.mood.transitBand[band]}
				<span class="uplift">{c.mood.transitUplift(uplift)}</span>
			</p>

			{#if rail.length}
				<div class="rail">
					<h4 class="eyebrow sub">{c.mood.transitRail}</h4>
					<ul>
						{#each rail as s (s.name)}
							<li style:--dot={colour(s.mode)}>
								<span class="dot" aria-hidden="true"></span>
								<span class="nm">{s.name}</span>
								<span class="mode">{c.mood.transitModes[s.mode]}</span>
								<span class="dist">{c.mood.transitWalk(Math.round(s.distance))}</span>
							</li>
						{/each}
					</ul>
				</div>
			{:else if waiting && hasRail}
				<p class="none">{c.mood.transitLoading}</p>
			{/if}

			{#if busCount > 0}
				<p class="bus"><span class="dot" style:--dot="var(--route-brt)"></span>{c.mood.transitBus(busCount)}</p>
			{/if}

			<Fineprint>
				<p>{hasRail ? c.mood.transitWhyRail : c.mood.transitWhyBus}</p>
				<p class="prov">{c.mood.transitRadius(app.weights.radius)} · OSM</p>
			</Fineprint>
		{/if}
	</section>
{/if}

<style>
	.transit {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.on-map {
		border: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		border-radius: 999px;
		padding: 0.125rem 0.5rem;
		font-size: 0.625rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.on-map:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
	.on-map.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--dot);
		flex: none;
	}

	/* The headline count. Set at display size because it is the headline: on a phone
	   this is the one line that has to survive being read at arm's length. */
	.count {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
	}
	.count .n {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
	}
	.count .unit {
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--label-2);
	}
	.split {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--label-1);
		margin-top: -0.1875rem;
	}

	.modes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.modes li {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.1875rem 0.5rem 0.1875rem 0.4375rem;
	}
	.modes .n {
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
	}
	.modes .lbl {
		font-size: 0.6875rem;
		color: var(--label-2);
	}

	.band {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--label-1);
	}
	.uplift {
		display: block;
		font-size: 0.6875rem;
		color: var(--label-3);
		margin-top: 0.125rem;
	}

	.rail ul {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}
	.rail li {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
		font-size: 0.75rem;
	}
	.rail .dot {
		align-self: center;
	}
	.rail .nm {
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--label-1);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rail .mode {
		font-size: 0.625rem;
		color: var(--label-3);
		margin-right: auto;
	}
	.rail .dist {
		font-size: 0.6875rem;
		color: var(--label-2);
		font-variant-numeric: tabular-nums;
		flex: none;
	}
	.sub {
		color: var(--label-3);
	}

	.bus {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.75rem;
		color: var(--label-2);
	}

	.none {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	/* It used to be set a step below the note above it, on the reasoning that where the
	   figures came from is the last thing anyone needs. In the fine print that is one
	   demotion too many: at 22% of white on the dark ground the line is not quiet, it is
	   gone. The block it now sits in already says "skip me", so the line inside it can
	   be legible to whoever does not. */
	.prov {
		font-size: 0.625rem;
	}
</style>
