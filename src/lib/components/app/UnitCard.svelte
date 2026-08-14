<script lang="ts">
	/**
	 * One unit on the market, and the catchment it stands in.
	 *
	 * The mirror image of `SpotCard`: that one leads with an area and lists what is
	 * inside it, this one leads with a doorway and describes what is around it. Both
	 * halves are on screen at once on purpose. A unit with no area figures is a listing
	 * off a property site, and an area with no unit is advice nobody can act on.
	 *
	 * Every figure here already exists elsewhere in the product and is read, not
	 * recomputed: the unit's own columns come from the listing, and the area's come from
	 * the scored row of its home cell. The one thing this component works out for itself
	 * is which of them are present.
	 */
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { pct, rampIndex } from '$lib/utils/format';
	import { stopTotal } from '$lib/domain/transit';

	const app = getAppState();
	const c = $derived(copy());
	const unit = $derived(app.selectedUnit);
	const l = $derived(unit?.listing ?? null);
	const row = $derived(unit?.row ?? null);
	const cell = $derived(unit ? (app.base.find((h) => h.id === unit.cellId) ?? null) : null);
	const catMany = $derived(c.category[app.category].many.toLowerCase());

	/** The unit's measured characteristics, skipping whatever the listing left empty. An
	    absent floor count is left out rather than printed as one. */
	const traits = $derived.by(() => {
		if (!l) return [];
		const out: string[] = [];
		if (l.land !== null) out.push(c.property.unitLand(l.land));
		if (l.build !== null) out.push(c.property.unitBuild(l.build));
		if (l.floors !== null) out.push(c.property.unitFloors(l.floors));
		if (l.ppm !== null) out.push(c.property.unitPerM2(l.ppm));
		if (l.cert) out.push(l.cert);
		return out;
	});
</script>

{#if unit && l}
	<div class="card">
		<div class="head">
			<div class="who">
				<h2>{c.property.types[l.type] ?? l.type}</h2>
				<p class="sub">
					{c.units.cardIn(unit.cellName)} · {c.units.cardWalk(unit.distance)}
				</p>
			</div>
			{#if l.price !== null}
				<span class="price">{c.property.unitPrice(l.price)}</span>
			{/if}
			<button
				type="button"
				class="close"
				onclick={() => app.selectUnit(null)}
				aria-label={c.app.closeArea}
			>
				<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
					<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<!-- Not a footnote here either. The reader is looking at one price on one
		     doorway, which is exactly the moment it could be read as a monthly rent. -->
		<p class="sale">{c.property.saleNote}</p>

		<SectionHead icon="price">{c.units.cardAbout}</SectionHead>
		{#if traits.length}
			<p class="traits">{traits.join(' · ')}</p>
		{:else}
			<p class="note">{c.property.noneUnpriced(1)}</p>
		{/if}

		<SectionHead icon="market">{c.units.cardArea}</SectionHead>
		{#if row && row.score !== null}
			<p class="score">
				<span class="dot" style:background={`var(--ramp-${rampIndex(row.score)})`}></span>
				<span class="n">{pct(row.score)}</span>
				<span class="lbl">{c.typology[row.typology]}</span>
			</p>
			<p class="traits">
				{c.units.cardRivals(row.osm, catMany, app.weights.radius)}
				{#if cell} · {c.units.cardStops(stopTotal(cell.transit))}{/if}
			</p>
		{:else}
			<!-- The area cannot be scored for this business type. Said plainly, because a
			     card with the area section simply missing reads as a loading state. -->
			<p class="note">{c.units.cardNoScore}</p>
		{/if}

		<!-- The way back to the other pivot. The area panel says far more about the
		     catchment than this card can, and a reader who wants that should not have to
		     find the cell on the map by eye. -->
		<button
			type="button"
			class="open"
			onclick={() => {
				app.setPivot('cell');
				app.select(unit.cellId);
			}}
		>
			{c.units.cardOpen}
		</button>
	</div>
{/if}

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
	}
	.who {
		flex: 1;
		min-width: 0;
	}
	h2 {
		font-size: 1.0625rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.sub {
		margin-top: 0.1875rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.price {
		font-size: 1.125rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.1;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		margin-top: 0.0625rem;
		border: 0;
		border-radius: 999px;
		background: var(--fill-1);
		color: var(--label-3);
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out;
	}
	.close:hover {
		background: var(--fill-2);
		color: var(--label-1);
	}
	.close:active {
		transform: scale(0.9);
	}

	.sale {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
		border-left: 2px solid var(--warn);
		padding-left: 0.5rem;
	}
	.traits {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.note {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.score {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
	}
	.score .dot {
		align-self: center;
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--separator) inset;
	}
	.score .n {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
	}
	.score .lbl {
		font-size: 0.75rem;
		color: var(--label-2);
	}

	.open {
		align-self: flex-start;
		border: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		border-radius: 999px;
		padding: 0.25rem 0.625rem;
		font-size: 0.6875rem;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.open:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
</style>
