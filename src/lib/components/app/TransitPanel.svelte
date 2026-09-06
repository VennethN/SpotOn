<script lang="ts">
	/**
	 * What the selected area, or the place standing in it, reaches by transit.
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
	 *
	 * WHICH CENTRE THE COUNTS ARE TAKEN FROM
	 *
	 * `app.reach`, the same point the ring and the fan on the map are drawn from. In
	 * area mode that is the cell centre and nothing here has moved: the counts come off
	 * the grid, which is what the access index was computed from and is right before
	 * `stops.json` lands. With a place open the range is measured from its doorway, the
	 * grid has no count taken from there, and the nodes are counted off the very list
	 * named underneath them.
	 *
	 * The access index does NOT follow. It was computed at build time from the cell's
	 * own counts and there is no doorway version of it to read, so it stays the
	 * catchment's and the line carrying it says whose it is.
	 */
	import {
		MODES,
		RAIL,
		accessBand,
		accessUplift,
		countStops,
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
	/* The range is measured from a place, so the panel is about that place. */
	const fromPlace = $derived(app.reachIsPlace);
	/* Waiting is not the same as never coming: with the stop file lost, this panel
	   drops the loading line and keeps whatever counts it has. */
	const waiting = $derived(app.stops === null && !app.stopsFailed);
	/**
	 * The counts on display, and where they come from.
	 *
	 * Off the GRID while the range is the cell's: they are what access was actually
	 * computed from, the stop list only names them, and they read correctly even with
	 * the file missing. Off the captured list once the range is a place's, because the
	 * grid never counted anything from that doorway and a count that disagreed with the
	 * names under it would be the wrong half of the panel to trust.
	 */
	const counts = $derived(
		fromPlace ? countStops(stops) : (cell?.transit ?? { mrt: 0, krl: 0, lrt: 0, brt: 0 })
	);
	const modes = $derived(presentModes(counts));
	const total = $derived(stopTotal(counts));
	const railCount = $derived(railTotal(counts));
	const busCount = $derived(counts.brt);
	/* The CELL's index, in both modes. It came off the grid, built from the cell's own
	   counts, and there is no reading of it taken from a doorway to put here instead. */
	const access = $derived(cell?.access ?? 0);
	const band = $derived(accessBand(access));
	const uplift = $derived(accessUplift(access));
	const hasRail = $derived(modes.some((m) => RAIL.includes(m.mode)));
	/* Nothing counted yet, rather than nothing to count. Only reachable from a place:
	   with the range measured from the cell the counts are on the grid and are here
	   before the stop file is asked for, and this is the one state where an empty list
	   means the file has not landed. */
	const counting = $derived(fromPlace && waiting);
	/* The file is not coming, so nothing can be counted from this place at all. Also
	   only reachable from a place, and for the same reason: on a cell the counts survive
	   the file being lost, and only the names go. An empty list here is a request that
	   failed, and reporting it as an empty street would be a finding made out of one. */
	const lost = $derived(fromPlace && app.stopsFailed);

	const colour = (m: Mode) => `var(--route-${m})`;
</script>

{#if cell}
	<section class="transit">
		<SectionHead icon="transit">
			{fromPlace ? c.mood.transitPlace : c.mood.transit}
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

		{#if counting}
			<p class="none">{c.mood.transitLoading}</p>
		{:else if lost}
			<p class="none">{c.mood.transitFailedPlace}</p>
		{:else if modes.length === 0}
			<p class="none">{fromPlace ? c.mood.transitNonePlace : c.mood.transitNone}</p>
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

			<!-- The index belongs to the catchment in both modes, so beside a count taken
			     from a doorway it has to say so. Otherwise two figures a line apart would
			     read as two halves of one measurement, and they are measurements of two
			     different things. -->
			<p class="band">
				{fromPlace ? c.mood.transitBandCell[band] : c.mood.transitBand[band]}
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
				<p class="prov">
					{fromPlace
						? c.mood.transitRadiusPlace(app.weights.radius)
						: c.mood.transitRadius(app.weights.radius)} · OSM
				</p>
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
