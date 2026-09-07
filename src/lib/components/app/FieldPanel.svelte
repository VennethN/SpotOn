<script lang="ts">
	/**
	 * What somebody wrote down while standing in the selected area.
	 *
	 * WHY THIS PANEL READS DIFFERENTLY FROM EVERY OTHER ONE
	 *
	 * The three panels above it read catalogues. OpenStreetMap and the MAPID premium
	 * catalogue both CLAIM completeness for the city they cover, which is what makes a
	 * zero from them a finding: no coffee shop in range means no coffee shop in range.
	 *
	 * This panel reads field surveys. 191 of the 562 catchments carry a record, and the
	 * other 371 are not quiet places, they are places nobody has walked. So every count
	 * here is worded as a count of RECORDS, the panel says outright that it is not a
	 * census, and nothing in it is allowed near the score. `domain/scoring` keeps that
	 * last part true and the self-test asserts it.
	 *
	 * WHAT IT IS FOR
	 *
	 * Everything else on the card is a statistic about a place. This is the place. A
	 * receipt with the payment method on it, what one warung actually charges, whether
	 * there was a queue when somebody looked, a shopfront with a rental banner on it, a
	 * photograph of the pavement outside. It is the only evidence in this product that a
	 * person can check by walking there.
	 *
	 * AND IT IS WHERE THE RENT FINALLY LIVES
	 *
	 * Every other surface in SpotOn is careful never to say "rent", because the premium
	 * catalogue publishes none for Jakarta and a monthly figure derived from a sale
	 * price would be the one number on screen that came from nobody's data. The property
	 * survey asks a different question on a different form, and a share of its records
	 * answer "Disewa". So this panel can say it. What it still cannot say is the price,
	 * because the form never asks, and it says that too.
	 */
	import FieldRecordDetail from '$lib/components/app/FieldRecordDetail.svelte';
	import Fineprint from '$lib/components/ui/Fineprint.svelte';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import {
		lastRecorded,
		menusWithoutPrice,
		ofKind,
		payMethods,
		premisesRecorded,
		pricedMenus,
		type FieldRecord
	} from '$lib/domain/field';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { tick } from 'svelte';
	import { pct } from '$lib/utils/format';

	/** How many rows of a survey get a line of their own before the rest become a count.
	    Three: enough to show a spread, short enough that four surveys stacked in one
	    card stay a card rather than a feed. */
	const SHOWN = 3;
	/** Photographs across the top. Six fills the width of the panel at the size they are
	    drawn, and a seventh would start a second row for no more information. */
	const PHOTOS = 6;

	const app = getAppState();
	const c = $derived(copy());
	/* The grid's cell rather than the scored row: these counts are here from the first
	   frame and need no business type, so the panel works on a cell that has no score. */
	const cell = $derived(app.selectedCell);
	const stats = $derived(cell?.field ?? null);

	const records = $derived(app.selectedField);
	const struk = $derived(ofKind(records, 'struk'));
	const menus = $derived(pricedMenus(records));
	const menusNoPrice = $derived(menusWithoutPrice(records));
	const premises = $derived(premisesRecorded(records));
	const notes = $derived(ofKind(records, 'catatan'));
	const methods = $derived(payMethods(records));
	const last = $derived(lastRecorded(records));

	/**
	 * Photographs the CDN would not serve, by record id.
	 *
	 * Kept as state and filtered out below rather than removed from the DOM by hand. A
	 * broken image is genuinely worth dropping, and reaching into the page to delete the
	 * element Svelte is holding is how a panel stops updating altogether: the block still
	 * points at a node that is no longer in the document. Filtering also does something
	 * the DOM surgery could not, which is pull the next photograph up into the gap.
	 */
	let broken = $state<string[]>([]);

	/** The record open in the detail view, or none. Cleared whenever the selected
	    cell changes, rather than left pointing at a record from a different area's
	    list once the reader has moved on from it. */
	let opened = $state<FieldRecord | null>(null);
	/** The section's own box, for finding a row again by the record it stands for.
	    The record now stands WHERE the list stood, so the button that was clicked is
	    gone by the time there is anything to go back to, and focusing a detached
	    element drops focus to the document instead. */
	let section = $state<HTMLElement | null>(null);

	function openDetail(record: FieldRecord) {
		opened = record;
	}
	async function closeDetail() {
		const was = opened?.id;
		opened = null;
		await tick();
		if (!was || !section) return;
		/* Matched by reading the attribute rather than by building a selector out of it:
		   these ids come from the survey files, and a selector is not the place to find
		   out one of them carries a quote. */
		for (const el of section.querySelectorAll<HTMLElement>('[data-record]')) {
			if (el.dataset.record === was) {
				el.focus({ preventScroll: true });
				return;
			}
		}
	}

	$effect(() => {
		void cell;
		opened = null;
	});

	/** The photographs, one per record that has one. Held to `PHOTOS` here rather than
	    in the markup so the strip is always full when there is enough to fill it. */
	const photos = $derived(
		records.filter((r) => r.photo && !broken.includes(r.id)).slice(0, PHOTOS)
	);

	const mission = $derived(app.meta?.mission ?? null);

	/** Receipts whose payment method was recognised. The share is taken over these, so
	    this is the number the sentence about it has to quote. */
	const paid = $derived(struk.filter((r) => r.cashless !== null).length);

	/** Drops a photograph the CDN could not serve, rather than leaving a broken frame
	    in a row of good ones. */
	function drop(id: string) {
		if (!broken.includes(id)) broken = [...broken, id];
	}
</script>

<!-- No cell, or a cell nobody has been to. The second one is said out loud rather than
     left as an absent section: "nothing was recorded here" is worth knowing, and a
     section that silently disappears reads as a panel that failed. -->
{#if cell}
	<section class="field" bind:this={section}>
		<SectionHead icon="field">
			{c.field.title}
			{#snippet action()}
				{#if records.length > 0}
					<button
						type="button"
						class="on-map"
						class:on={app.layers.field}
						onclick={() => (app.layers.field = !app.layers.field)}
						aria-pressed={app.layers.field}
					>
						{app.layers.field ? c.field.mapHide : c.field.mapShow}
					</button>
				{/if}
			{/snippet}
		</SectionHead>

		{#if opened}
			<!-- One record, standing where its list stood. Inside the section rather than
			     over the card, so the heading above it still says which section this is
			     and the model of the place is still on screen behind the words. -->
			{#key opened.id}
				<FieldRecordDetail record={opened} onclose={closeDetail} />
			{/key}
		{:else if !stats}
			<p class="note">{c.field.none}</p>
		{:else if app.fieldFailed}
			<!-- The records are gone, the counts are not: every figure the panel leads
			     with was written onto the grid, and is still here. -->
			<p class="count">{c.field.count(stats.struk + stats.menu + stats.properti + stats.catatan)}</p>
			<p class="note">{c.field.failed}</p>
		{:else if app.fieldLoading}
			<p class="count">{c.field.count(stats.struk + stats.menu + stats.properti + stats.catatan)}</p>
			<p class="note">{c.field.loading}</p>
		{:else}
			<p class="count">
				{c.field.count(records.length)}
				{#if last}<span class="sub">{c.field.last(c.field.day(last))}</span>{/if}
			</p>

			<!-- The photographs. One strip rather than a thumbnail on every row: this is
			     the only place in the product with a picture of the actual street, and
			     spread across four sub-lists it would read as decoration on each. -->
			{#if photos.length}
				<ul class="strip">
					{#each photos as p (p.id)}
						<li>
							<button
								type="button"
								class="phototrig"
								data-record={p.id}
								onclick={() => openDetail(p)}
							>
								<img
									src={p.photo}
									alt={c.field.mapAria(c.field.kinds[p.kind], p.place ?? p.title ?? '', p.distance)}
									loading="lazy"
									decoding="async"
									onerror={() => drop(p.id)}
								/>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<!-- ── Receipts ──────────────────────────────────────────────────── -->
			{#if struk.length}
				<div class="block">
					<p class="lead">{c.field.strukCount(struk.length)}</p>
					<p class="sub">
						{#if stats.nontunai !== null}
							{c.field.cashless(Number(pct(stats.nontunai)))}
						{:else}
							{c.field.cashlessThin(paid)}
						{/if}
					</p>
					{#if methods.length}
						<ul class="chips">
							{#each methods as m (m.pay)}
								<li><span class="cn">{m.n}</span><span class="cl">{m.pay}</span></li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<!-- ── Places to eat ─────────────────────────────────────────────── -->
			{#if stats.menu > 0}
				<div class="block">
					<p class="lead">{c.field.menuCount(stats.menu)}</p>
					<p class="sub">
						{#if stats.harga !== null}
							{c.field.menuTypical(stats.harga)}
						{:else}
							{c.field.menuTypicalThin(menus.length)}
						{/if}
					</p>
					{#if menus.length}
						<ul class="rows">
							{#each menus.slice(0, SHOWN) as m (m.id)}
								<li>
									<button type="button" class="rowtrig" data-record={m.id} onclick={() => openDetail(m)}>
										<p class="top">
											<span class="name">{m.place ?? c.field.kinds.menu}</span>
											<span class="dist">{c.field.walk(m.distance)}</span>
											<span class="price">{c.field.menuPrice(m.price ?? 0)}</span>
										</p>
										<p class="traits">
											{[m.dish, m.sort, m.crowd ? c.field.crowdSeen(c.field.crowd[m.crowd]) : null]
												.filter(Boolean)
												.join(' · ')}
										</p>
									</button>
								</li>
							{/each}
						</ul>
						{#if menus.length > SHOWN}
							<p class="note">{c.field.more(menus.length - SHOWN)}</p>
						{/if}
					{/if}
					{#if menusNoPrice > 0}
						<p class="note">{c.field.menuNoPrice(menusNoPrice)}</p>
					{/if}
				</div>
			{/if}

			<!-- ── Space being offered ───────────────────────────────────────── -->
			{#if premises.length}
				<div class="block">
					<p class="lead">{c.field.propCount(premises.length)}</p>
					<p class="sub">
						{stats.sewa > 0 ? c.field.propRent(stats.sewa) : c.field.propNoRent}
					</p>
					<ul class="rows">
						{#each premises.slice(0, SHOWN) as p (p.id)}
							<li>
								<button type="button" class="rowtrig" data-record={p.id} onclick={() => openDetail(p)}>
									<p class="top">
										{#if p.offer}
											<span class="tag" class:rent={p.offer === 'sewa'}>{c.field.offer[p.offer]}</span>
										{/if}
										<span class="name">{p.sort ?? c.field.kinds.properti}</span>
										<span class="dist">{c.field.walk(p.distance)}</span>
									</p>
									{#if p.address}<p class="traits">{p.address}</p>{/if}
								</button>
							</li>
						{/each}
					</ul>
					{#if premises.length > SHOWN}
						<p class="note">{c.field.more(premises.length - SHOWN)}</p>
					{/if}
					{#if stats.sewa > 0}
						<p class="note">{c.field.rentNote}</p>
					{/if}
				</div>
			{/if}

			<!-- ── What people wrote ─────────────────────────────────────────── -->
			{#if notes.length}
				<div class="block">
					<p class="lead">{c.field.noteCount(notes.length)}</p>
					<ul class="rows">
						{#each notes.slice(0, 2) as n (n.id)}
							<li>
								<button type="button" class="rowtrig" data-record={n.id} onclick={() => openDetail(n)}>
									<p class="top">
										<span class="name">{n.title ?? c.field.kinds.catatan}</span>
										<span class="dist">{c.field.walk(n.distance)}</span>
									</p>
									{#if n.body}<p class="body">{n.body}</p>{/if}
									{#if n.by}<p class="traits">{c.field.noteBy(n.by)}</p>{/if}
								</button>
							</li>
						{/each}
					</ul>
					{#if notes.length > 2}
						<p class="note">{c.field.more(notes.length - 2)}</p>
					{/if}
				</div>
			{/if}

			<!-- The one thing this panel must not let a reader forget, and the figures
			     behind it, read from the grid's own metadata so a rebuild rewrites them. -->
			<Fineprint>
				<p class="census">{c.field.notCensus}</p>
				{#if mission}
					<p>{c.field.provenance(mission.records, mission.cells, app.meta?.hexes ?? 0)}</p>
				{/if}
			</Fineprint>
		{/if}
	</section>
{/if}

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* The same switch the competitor, transit and property sections carry, because it
	   is the same job on the same map. Its "on" state wears the accent rather than the
	   units' amber: these marks are not a price, they are evidence. */
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
		color: #fff;
	}

	.count {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
	}
	.sub {
		display: block;
		margin-top: 0.125rem;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	/* ── the photographs ─────────────────────────────────────────────────── */
	.strip {
		display: flex;
		gap: 0.25rem;
		list-style: none;
		margin: 0.125rem 0 0;
		padding: 0;
	}
	.strip li {
		flex: 1 1 0;
		min-width: 0;
		aspect-ratio: 1;
		border-radius: var(--r-sm);
		overflow: hidden;
		background: var(--fill-1);
	}
	.strip img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	/* The strip's only affordance: nothing else marks a thumbnail as clickable, so
	   the trigger itself carries no border and leans on the cursor and a hover dim
	   instead, the same restraint the map's own layer toggle uses. */
	.phototrig {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}
	.phototrig:hover img {
		opacity: 0.85;
	}
	.phototrig:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* ── one survey ──────────────────────────────────────────────────────── */
	.block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--separator);
		/* The same left rule the price block carries, so the four surveys read as a set
		   of readings rather than as four unrelated lists. */
		border-left: 2px solid var(--label-3);
		border-radius: 0 var(--r-md) var(--r-md) 0;
		background: var(--fill-1);
	}
	.lead {
		font-size: 0.8125rem;
		font-weight: 550;
		color: var(--label-1);
	}
	.block .sub {
		margin-top: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		list-style: none;
		margin: 0.125rem 0 0;
		padding: 0;
	}
	.chips li {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		padding: 0.0625rem 0.375rem;
		border: 1px solid var(--separator);
		border-radius: 999px;
		font-size: 0.625rem;
		color: var(--label-2);
	}
	.cn {
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
	}
	.cl {
		color: var(--label-3);
	}

	.rows {
		list-style: none;
		margin: 0.125rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	/* Each row is now a button standing in for the record, styled back down to a
	   row: full width, left-aligned, its own type reset to match the paragraphs
	   inside it rather than the browser's button font. */
	.rowtrig {
		display: block;
		width: calc(100% + 0.5rem);
		margin: -0.1875rem -0.25rem;
		border: 0;
		padding: 0.1875rem 0.25rem;
		background: transparent;
		font: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
		border-radius: var(--r-sm);
	}
	.rowtrig:hover {
		background: var(--fill-2);
	}
	.rowtrig:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.rows .top {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 0.75rem;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--label-1);
	}
	.dist,
	.price {
		flex: none;
		font-variant-numeric: tabular-nums;
		color: var(--label-3);
	}
	.price {
		color: var(--label-1);
	}
	.tag {
		flex: none;
		padding: 0.0625rem 0.3125rem;
		border-radius: 3px;
		background: var(--fill-2);
		color: var(--label-2);
		font-size: 0.5625rem;
		letter-spacing: 0.02em;
	}
	/* The half this product has never been able to show. It gets the accent, and it is
	   the only thing in this panel that does. */
	.tag.rent {
		background: var(--accent);
		color: #fff;
	}
	.traits,
	.body {
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-3);
	}
	.body {
		margin-top: 0.125rem;
		color: var(--label-2);
	}

	.note {
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}
	/* Said once, quietly, and never folded away: it is the sentence that keeps every
	   count above it from being read as a measurement of the street. Of everything in
	   the fine print it is the only line a reader has to actually meet, so it is the
	   one line in there set above the fine print's own grey. */
	.census {
		color: var(--label-2);
	}
</style>
