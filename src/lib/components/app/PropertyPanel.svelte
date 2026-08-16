<script lang="ts">
	/**
	 * What space costs in the selected area, and what is actually on the market in it.
	 *
	 * THE ONE THING THIS PANEL MUST NOT BLUR
	 *
	 * These are asking prices to BUY. The MAPID premium catalogue publishes no rental
	 * listings for Jakarta — `scripts/fetch-property.mjs` tallies the sale-or-rent column
	 * across every property dataset in the province on every run and writes the result
	 * into the file it produces, so the claim is a measurement rather than a note
	 * somebody left behind. A monthly rent is never derived from these figures, because
	 * that takes a yield assumption and the assumption would be the only number on this
	 * screen that came from nobody's data. So the sale is said first, in the lead, not
	 * tucked into a footnote where a reader in a hurry will miss it.
	 *
	 * Every figure comes from `domain/cost`, which reads them back off the row the
	 * scoring engine already built, and from `domain/premises`, which matches the
	 * individual units to the cell using the same distance test the join used. Nothing
	 * here does arithmetic of its own beyond turning a share into a percentage, so the
	 * price on screen and the multiplier that moved the score cannot come apart.
	 */
	import { COST_FLOOR, readCost } from '$lib/domain/cost';
	import { composeScore } from '$lib/domain/composition';
	import { byType, pricedPremises, withoutPrice } from '$lib/domain/premises';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { PropertyType } from '$lib/types';

	/** How many units get a row of their own before the rest become a count. Enough to
	    show the spread of what is available without turning a panel into a listings site. */
	const SHOWN = 5;

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/* The grid's cell, not the scored row: what is on the market is real MAPID data and
	   is here from the first frame, including on cells the active category has no score
	   for. A panel that can say nothing about the opportunity can still say what space
	   is going for. */
	const cell = $derived(app.selectedCell);

	const cost = $derived(cell ? readCost(cell, app.priceLadder, app.weights.radius) : null);
	const comp = $derived(row ? composeScore(row, app.weights) : null);

	/** Its rank as a percentage, and the two ends called by name rather than as "0%". */
	const rankPct = $derived(cost?.level === null || cost === null ? null : Math.round(cost.level * 100));
	/** How the asking price compares with the grid's middle. A ratio is not what sets the
	    multiplier — a rank is — but it is what states the magnitude a rank hides, and
	    both come from the same two figures. Handed over as a number: which decimal mark
	    it gets is the locale's business, and formatted here it read "1.2×" inside an
	    Indonesian sentence. */
	const ratio = $derived(cost?.price && cost.median ? cost.price / cost.median : null);

	/**
	 * How many priced units a cell needs before the join will read a median off them,
	 * and how much data is behind the whole panel.
	 *
	 * Read from the grid file's own metadata rather than written into the sentence.
	 * `scripts/join-property.mjs` decides the threshold and records it there, so raising
	 * it moves the rule and the sentence explaining the rule together. A figure typed by
	 * hand here would go stale in silence, which has happened in this repository before.
	 */
	const prop = $derived(app.meta?.property ?? null);
	const minPriced = $derived(prop?.minPriced ?? 0);

	const listings = $derived(app.selectedListings);
	const groups = $derived(byType(listings));
	const priced = $derived(pricedPremises(listings));
	const unpriced = $derived(withoutPrice(listings));
	/* The units a business could actually take, which is also exactly the set the map
	   draws. The map switch appears only when there is something for it to switch on. */
	const premises = $derived(listings.filter((l) => l.premises));

	const typeName = (t: PropertyType) => c.property.types[t] ?? t;

	/** The unit's measured characteristics, in one line, skipping whatever the listing
	    did not publish. An absent floor count is left out rather than printed as one. */
	function traits(l: (typeof listings)[number]): string[] {
		const out: string[] = [];
		if (l.land !== null) out.push(c.property.unitLand(l.land));
		if (l.build !== null) out.push(c.property.unitBuild(l.build));
		if (l.floors !== null) out.push(c.property.unitFloors(l.floors));
		if (l.ppm !== null) out.push(c.property.unitPerM2(l.ppm));
		if (l.cert) out.push(l.cert);
		return out;
	}
</script>

{#if cell && cost}
	<section class="prop">
		<SectionHead icon="price">
			{c.property.title}
			{#snippet action()}
				{#if premises.length > 0}
					<!-- Same control as the competitor and transit switches, because it is
					     the same job on the same map: the panel lists the units, and this
					     puts them where they actually stand. -->
					<button
						type="button"
						class="on-map"
						class:on={app.layers.property}
						onclick={() => (app.layers.property = !app.layers.property)}
						aria-pressed={app.layers.property}
					>
						{app.layers.property ? c.property.mapHide : c.property.mapShow}
					</button>
				{/if}
			{/snippet}
		</SectionHead>

		<!-- ── The price, and what kind of price it is ─────────────────────── -->
		{#if cost.price !== null}
			<div class="lead">
				<p class="figure">
					<span class="n">{c.property.priceValue(cost.price)}</span>
					<span class="unit">
						{c.property.perM2}
						<span class="sub">{c.property.medianOf(cost.priced, app.weights.radius)}</span>
					</span>
				</p>
				<p class="sale">{c.property.saleNote}</p>
			</div>

			<!-- Where it sits on the grid. The bar is the rank, drawn cheap end to dear
			     end, so the sentence and the picture say the same thing. -->
			{#if rankPct !== null}
				<div class="rank">
					<span class="track" aria-hidden="true">
						<span class="fill" style:width={`${rankPct}%`}></span>
					</span>
					<p class="txt">
						{rankPct === 0
							? c.property.rankCheapest
							: rankPct === 100
								? c.property.rankDearest
								: c.property.rank(rankPct)}
						{#if ratio && cost.median !== null}
							<span class="vs">{c.property.vsMedian(cost.median, ratio)}</span>
						{/if}
					</p>
				</div>
			{/if}

			<!-- What it did to the score. Only where there is a score to have moved. -->
			{#if comp}
				<p class="effect">
					{comp.costBites
						? c.property.effect(comp.costPoints, comp.costFactor)
						: c.property.effectNone}
				</p>
			{/if}
			<p class="floor">{c.property.floor(COST_FLOOR)}</p>
		{:else}
			<!-- The silences, told apart. Only the first means nobody looked. -->
			<p class="none">
				{#if cost.absence === 'uncovered'}
					{c.property.noneUncovered}
				{:else if cost.absence === 'empty'}
					{c.property.noneEmpty(app.weights.radius)}
				{:else if cost.absence === 'unpriced'}
					{c.property.noneUnpriced(cost.units)}
				{:else if cost.absence === 'thin'}
					{c.property.noneThin(cost.priced, minPriced)}
				{:else}
					{c.property.noneUngraded}
				{/if}
			</p>
			{#if cost.units > 0}
				<p class="sale">{c.property.saleNote}</p>
			{/if}
		{/if}

		<!-- ── What is on the market ───────────────────────────────────────── -->
		{#if cost.covered}
			<SectionHead icon="market">{c.property.marketTitle}</SectionHead>
			{#if app.listingsFailed}
				<!-- The units are gone, the arithmetic is not: everything above this line
				     came from the grid, and says so. -->
				<p class="note">{c.property.marketFailed}</p>
			{:else if app.listingsLoading}
				<p class="note">{c.property.marketLoading}</p>
			{:else if listings.length === 0}
				<p class="note">{c.property.marketNone}</p>
			{:else}
				<p class="count">
					{c.property.marketCount(listings.length, app.weights.radius)}
					<span class="sub">{c.property.marketPremises(premises.length)}</span>
				</p>

				<ul class="chips">
					{#each groups as g (g.type)}
						<li class:aside={!g.premises} title={g.premises ? undefined : c.property.typeAside}>
							<span class="cn">{g.n}</span>
							<span class="cl">{typeName(g.type)}</span>
						</li>
					{/each}
				</ul>

				{#if priced.length}
					<SectionHead icon="units">{c.property.unitsTitle}</SectionHead>
					<ul class="units">
						<!--
							Keyed by position, which is the honest answer here: these listings
							have no identity in the data. 1,915 of the 3,547 share a coordinate
							with another row, because the catalogue geocodes to the street
							rather than to the door — four units at one point in Pancoran, two
							shophouses and two office buildings, all with different floors,
							areas, certificates and prices. They are four real units, so they
							must not be merged, and no key built from their columns can tell
							them apart. The list is rebuilt whole whenever the cell or the
							radius changes, so position is stable for as long as it is drawn.
						-->
						{#each priced.slice(0, SHOWN) as l, i (i)}
							<li>
								<p class="top">
									<span class="ty">{typeName(l.type)}</span>
									<span class="dist">{c.property.unitWalk(Math.round(l.distance))}</span>
									<span class="price">{c.property.unitPrice(l.price ?? 0)}</span>
								</p>
								{#if traits(l).length}
									<p class="traits">{traits(l).join(' · ')}</p>
								{/if}
							</li>
						{/each}
					</ul>
					{#if priced.length > SHOWN}
						<p class="note">{c.property.unitsMore(priced.length - SHOWN)}</p>
					{/if}
					{#if unpriced > 0}
						<p class="note">{c.property.unitNoPrice(unpriced)}</p>
					{/if}
				{/if}
			{/if}

			<!-- Where the whole panel came from, sized from the grid's own metadata so
			     rebuilding the data rewrites the sentence. -->
			{#if prop}
				<p class="note">
					{c.property.provenance(prop.listings, prop.coveredCities.length)}
				</p>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.prop {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.sub {
		color: var(--label-3);
		margin-top: 0.25rem;
	}
	/* The same control as the competitor and transit switches, because it is the same
	   job on the same map. Its "on" state carries the units' amber rather than the
	   accent, so the button wears the colour of what it puts on screen. */
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
		background: var(--warn);
		border-color: var(--warn);
		color: #fff;
	}

	/* ── the price ───────────────────────────────────────────────────────── */
	.lead {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem;
		border: 1px solid var(--separator);
		/* The same left rule the transit block carries, in the neutral label colour
		   rather than the accent: this is a cost, and the accent is the product's
		   "this is good" colour. */
		border-left: 2px solid var(--label-3);
		border-radius: 0 var(--r-md) var(--r-md) 0;
		background: var(--fill-1);
	}
	.figure {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.figure .n {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
		/* "Rp 51,9 jt" is one figure and has to read as one. At the panel's ~340 px it
		   was breaking after "Rp", which puts the currency on a line of its own and the
		   quantity underneath it. The caption beside it wraps instead. */
		flex: none;
		white-space: nowrap;
	}
	.figure .unit {
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--label-2);
		min-width: 0;
	}
	.figure .sub {
		display: block;
		font-size: 0.625rem;
		color: var(--label-3);
		margin-top: 0.0625rem;
	}
	/* Not a footnote. A reader who came looking for rent has to meet this before they
	   read the number as one. */
	.sale {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
	}

	/* ── rank on the grid ────────────────────────────────────────────────── */
	.rank {
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	.rank .track {
		height: 0.25rem;
		border-radius: 99px;
		background: var(--fill-2);
		overflow: hidden;
	}
	.rank .track .fill {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: color-mix(in srgb, var(--critical) 65%, transparent);
	}
	.rank .txt {
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--label-1);
	}
	.rank .vs {
		color: var(--label-3);
	}

	.effect {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.floor,
	.note {
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}
	.none {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}

	/* ── what is on the market ───────────────────────────────────────────── */
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
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3125rem;
	}
	.chips li {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.125rem 0.5rem;
		background: var(--bg-elevated);
	}
	/* The families a small business cannot take are drawn back rather than dropped:
	   "three shophouses and a warehouse" is a different street from "three shophouses". */
	.chips li.aside {
		opacity: 0.55;
	}
	.chips .cn {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.chips .cl {
		font-size: 0.625rem;
		color: var(--label-2);
	}

	/* ── the units ───────────────────────────────────────────────────────── */
	.units {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.units li {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--separator);
	}
	.units li:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.units .top {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
		font-size: 0.75rem;
	}
	.units .ty {
		color: var(--label-1);
		font-weight: 600;
		white-space: nowrap;
	}
	.units .dist {
		font-size: 0.6875rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
		margin-right: auto;
	}
	.units .price {
		font-weight: 600;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
		flex: none;
	}
	.units .traits {
		font-size: 0.625rem;
		line-height: 1.4;
		color: var(--label-3);
	}
</style>
