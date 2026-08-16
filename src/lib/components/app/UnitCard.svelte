<script lang="ts">
	/**
	 * One unit on the market, and the catchment it stands in.
	 *
	 * The mirror image of `SpotCard`: that one leads with an area and lists what is
	 * inside it, this one leads with a doorway and describes what is around it. Both
	 * halves are on screen at once on purpose. A unit with no area figures is a listing
	 * off a property site, and an area with no unit is advice nobody can act on.
	 *
	 * WHY THE LOWER HALF IS THE AREA PANEL ITSELF
	 *
	 * It used to be a summary of it — a score, a competitor count, a stop count — and
	 * next to the area card that read as the poor relation: the same subject, a tenth of
	 * the detail, with nothing saying why. The catchment around a unit is not a lesser
	 * question than the catchment on its own, so the answer is not a lesser answer. The
	 * whole of `CatchmentDiorama` is here, which is exactly what `SpotCard` shows, and it
	 * is the SAME component rather than a second version of it — two of them would drift,
	 * and the day they did the two cards would describe the same place differently.
	 *
	 * That works because opening a unit selects its home cell (`selectUnit`), so every
	 * panel underneath reads the catchment this unit actually stands in.
	 *
	 * Which leaves the two cards nearly identical in shape, which is the point and also
	 * the risk — hence `PivotMark` in the header. One badge is a hexagon and the other is
	 * a shopfront, and that is what tells 800 m of city apart from one front door at a
	 * glance.
	 *
	 * Every figure is read, never recomputed: the unit's own columns come from the
	 * listing, and the area's come from the scored row of its home cell.
	 */
	import CatchmentDiorama from '$lib/components/app/CatchmentDiorama.svelte';
	import PivotMark from '$lib/components/ui/PivotMark.svelte';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { pct, rampIndex } from '$lib/utils/format';

	const app = getAppState();
	const c = $derived(copy());
	const unit = $derived(app.selectedUnit);
	const l = $derived(unit?.listing ?? null);
	const row = $derived(unit?.row ?? null);

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

	/**
	 * Every column the listing carries, as rows — the unit's answer to the area panel's
	 * "full figures".
	 *
	 * Built as a list rather than written out as markup so the empty columns disappear
	 * instead of printing a dash. Half the catalogue leaves the floor count or the
	 * certificate blank, and a table of dashes reads as a unit with nothing to say about
	 * itself rather than as a record somebody filled in partially.
	 */
	const figures = $derived.by(() => {
		if (!l || !unit) return [];
		const r = c.units.rows;
		const out: Array<[string, string]> = [
			[r.type, c.property.types[l.type] ?? l.type],
			[r.cell, unit.cellName],
			[r.distance, c.units.value('jarak_pusat', unit.distance)]
		];
		if (l.price !== null) out.push([r.price, c.units.value('harga', l.price)]);
		if (l.ppm !== null) out.push([r.ppm, c.units.value('harga_m2', l.ppm)]);
		if (l.land !== null) out.push([r.land, c.units.value('luas_tanah', l.land)]);
		if (l.build !== null) out.push([r.build, c.units.value('luas_bangunan', l.build)]);
		if (l.floors !== null) out.push([r.floors, c.units.value('lantai', l.floors)]);
		if (l.cert) out.push([r.cert, l.cert]);
		return out;
	});
</script>

{#if unit && l}
	<div class="card">
		<div class="head">
			<!-- A shopfront, against the hexagon the area card carries. The two panels are
			     deliberately alike below this line, so this is what says which one it is. -->
			<PivotMark kind="unit" />
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
		{#if figures.length}
			<!-- Behind the same fold the area panel puts its figures behind, and for the
			     same reason: the sentence above is the reading, and this is what it was
			     read from, for whoever wants to check it. -->
			<details class="numbers">
				<summary>{c.units.cardFigures}</summary>
				<dl>
					{#each figures as [label, value] (label)}
						<div><dt>{label}</dt><dd>{value}</dd></div>
					{/each}
				</dl>
				<p class="prov">{c.units.provenance}</p>
			</details>
		{/if}

		<SectionHead icon="market">{c.units.cardArea}</SectionHead>
		{#if row && row.score !== null}
			<p class="score">
				<span class="dot" style:background={`var(--ramp-${rampIndex(row.score)})`}></span>
				<span class="n">{pct(row.score)}</span>
				<span class="lbl">{c.typology[row.typology]}</span>
			</p>
		{:else}
			<!-- The area cannot be scored for this business type. Said plainly, because a
			     card that skipped straight to the panel below would leave a reader hunting
			     for a score that is never coming. The panel is still shown: what space
			     costs and what the place reaches are real either way. -->
			<p class="note">{c.units.cardNoScore}</p>
		{/if}

		<!-- The area card's whole contents, not a summary of them. Reads the selected
		     cell, which `selectUnit` set to this unit's home cell. -->
		<CatchmentDiorama />
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
		gap: 0.5rem;
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

	/* Same treatment as the area panel's own fold, so the two read as one product
	   rather than as two people's tables. */
	.numbers summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
	}
	.numbers summary:hover {
		color: var(--label-2);
	}
	.numbers dl {
		margin: 0.625rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.numbers dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3125rem 0;
		border-bottom: 1px solid var(--separator);
		font-size: 0.75rem;
	}
	.numbers dt {
		color: var(--label-3);
	}
	.numbers dd {
		margin: 0;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.prov {
		margin-top: 0.5rem;
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}
</style>
