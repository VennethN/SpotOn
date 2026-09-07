<script lang="ts">
	/**
	 * One field record, in the place its list was.
	 *
	 * The list shows a record the way a list has to: a name, a distance, one line of
	 * traits. The photograph strip is worse off still, a row of thumbnails with nothing
	 * beside them but alt text nobody can read without hovering. This is the same record
	 * with room to breathe.
	 *
	 * It REPLACES the list rather than covering the panel. It used to be lifted out to
	 * the panel box and laid over the whole of it, which hid the model of the place and,
	 * on a phone, the grip the sheet is dragged by, so reading one receipt cost the
	 * reader the map that receipt is evidence about. Standing where the list stood keeps
	 * the head, the model and the section's own heading on screen, and keeps this a step
	 * further in rather than somewhere else entirely.
	 *
	 * It is not pushed in ABOVE the list either, which was the other thing it must not
	 * do: that leaves the list underneath and moves everything the reader was looking at
	 * down the page, which is the same as losing their place.
	 *
	 * It adds no field the record does not already carry. A detail view that asked
	 * the data a new question would belong in `domain/field`, not here.
	 */
	import Glyph from '$lib/components/ui/Glyph.svelte';
	import type { FieldRecord } from '$lib/domain/field';
	import { copy } from '$lib/state/lang.svelte';

	let { record, onclose }: { record: FieldRecord; onclose: () => void } = $props();

	const c = $derived(copy());

	/** The record's own name for itself, whichever field it wrote one into. Receipts
	    and eateries name the place, premises and notes name the kind or the finding. */
	const headline = $derived(
		record.place ?? record.title ?? record.sort ?? c.field.kinds[record.kind]
	);
	/** Shown as a second line only when it says something `headline` did not already. */
	const showSort = $derived(record.sort && record.sort !== headline);

	let photoBroken = $state(false);
	let box = $state<HTMLElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		closeButton?.focus({ preventScroll: true });
	});

	/**
	 * Escape puts THIS record down, and leaves the section it came out of open.
	 *
	 * The section around it is listening for the same key, and it is written outside
	 * this, so the innermost view is the last one in the document. The same test lives
	 * in `PanelDetail`, and it is the reason one press goes back one step rather than
	 * two.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !box) return;
		const open = document.querySelectorAll('[data-detail-view]');
		if (open.length > 0 && open[open.length - 1] !== box) return;
		onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="detail" bind:this={box} data-detail-view aria-labelledby="field-detail-title">
	<button
		bind:this={closeButton}
		type="button"
		class="close"
		onclick={onclose}
		aria-label={c.field.detail.close}
	>
		<Glyph icon="close" size={13} />
	</button>

	{#if record.photo && !photoBroken}
		<img
			class="photo"
			src={record.photo}
			alt={c.field.mapAria(c.field.kinds[record.kind], headline, record.distance)}
			loading="lazy"
			decoding="async"
			onerror={() => (photoBroken = true)}
		/>
	{/if}

	<div class="body">
		<p class="kindtag">
			{c.field.kinds[record.kind]}
			{#if record.kind === 'properti' && record.offer}
				<span class="tag" class:rent={record.offer === 'sewa'}>{c.field.offer[record.offer]}</span
				>
			{/if}
		</p>
		<h2 id="field-detail-title">{headline}</h2>
		{#if showSort}<p class="sort">{record.sort}</p>{/if}
		<p class="meta">
			{c.field.walk(record.distance)}{#if record.date}
				<span> · {c.field.day(record.date)}</span>
			{/if}
		</p>

		{#if record.kind === 'struk'}
			{#if record.pay}<p class="line">{c.field.detail.paid(record.pay)}</p>{/if}
			{#if record.cashless !== null}
				<p class="line">
					{record.cashless ? c.field.detail.cashlessYes : c.field.detail.cashlessNo}
				</p>
			{/if}
		{:else if record.kind === 'menu'}
			{#if record.dish}<p class="line">{record.dish}</p>{/if}
			{#if record.price !== null}<p class="line">{c.field.menuPrice(record.price)}</p>{/if}
			{#if record.crowd}<p class="line">{c.field.crowdSeen(c.field.crowd[record.crowd])}</p>{/if}
		{:else if record.kind === 'properti'}
			{#if record.address}<p class="line">{record.address}</p>{/if}
		{:else if record.kind === 'catatan'}
			{#if record.body}<p class="line body">{record.body}</p>{/if}
			{#if record.by}<p class="line">{c.field.noteBy(record.by)}</p>{/if}
			{#if record.community}<p class="line">{c.field.detail.team(record.community)}</p>{/if}
		{/if}
	</div>
</div>

<style>
	/* A card standing where the list stood, not a cover over the panel. It scrolls with
	   the section around it, because it IS part of that section now rather than a sheet
	   laid over the whole card. */
	.detail {
		position: relative;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--fill-1);
		border: 1px solid var(--separator);
	}

	.close {
		position: absolute;
		top: 0.625rem;
		right: 0.625rem;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		border: 1px solid var(--separator);
		border-radius: 999px;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		color: var(--label-2);
		cursor: pointer;
	}
	.close:hover {
		color: var(--label-1);
		background: var(--fill-1);
	}

	.photo {
		display: block;
		width: 100%;
		height: 11rem;
		object-fit: cover;
	}

	.body {
		padding: 0.875rem;
	}

	.kindtag {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--label-3);
	}
	.tag {
		padding: 0.0625rem 0.3125rem;
		border-radius: 3px;
		background: var(--fill-2);
		color: var(--label-2);
		font-size: 0.5625rem;
		letter-spacing: 0.02em;
		text-transform: none;
	}
	.tag.rent {
		background: var(--accent);
		color: #fff;
	}

	/* The panel's own heading size, so opening a record reads as going deeper into
	   this card rather than arriving somewhere else entirely. */
	h2 {
		margin: 0.25rem 0 0;
		font-size: 1.0625rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: var(--label-1);
	}
	.sort {
		margin-top: 0.1875rem;
		font-size: 0.75rem;
		color: var(--label-3);
	}
	.meta {
		margin-top: 0.375rem;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--label-3);
	}

	.line {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.line.body {
		color: var(--label-1);
	}
</style>
