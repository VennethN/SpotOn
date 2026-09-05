<script lang="ts">
	/**
	 * Where the selected area's competitors actually stand, and the switch for them.
	 *
	 * The sentence above this one already says how many there are. What it cannot say
	 * is that eight of the nine sit on one street and the far side of the cell is
	 * empty, which is a different business decision entirely. So this is deliberately
	 * not another figure: it is a switch, and the answer is on the map.
	 *
	 * It is also the one place that can explain an empty map. The positions come from
	 * MAPID and only from MAPID, so on the OSM source there is nothing to draw at all,
	 * and a reader left staring at a cell with no dots would reasonably conclude there
	 * were no competitors in it. That is the opposite of what the count beside it says.
	 */
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());

	const catMany = $derived(c.category[app.category].many.toLowerCase());
	/* The dots actually drawn, not the scored row's figure. This panel is a caption
	   for the map, so it counts what the map is showing. */
	const drawn = $derived(app.selectedPois.length);
	const missing = $derived(app.poisUnavailable);
	/* How many of the marks on screen carry a name. The stations beside them are
	   labelled, so competitors drawn bare need a reason given rather than left to
	   look like a label layer that failed. */
	const named = $derived(app.selectedPois.filter((p) => p.name).length);
</script>

<section class="rivals">
	<SectionHead icon="rivals">
		{c.mood.rivalsOnMap}
		{#snippet action()}
			{#if !missing}
				<button
					type="button"
					class="on-map"
					class:on={app.layers.poi}
					onclick={() => (app.layers.poi = !app.layers.poi)}
					aria-pressed={app.layers.poi}
				>
					{app.layers.poi ? c.mood.transitHide : c.mood.transitShow}
				</button>
			{/if}
		{/snippet}
	</SectionHead>

	{#if missing === 'source'}
		<p class="note">{c.mood.rivalsNoPositions}</p>
	{:else if missing === 'failed'}
		<p class="note">{c.mood.rivalsFailed}</p>
	{:else if app.poisLoading}
		<p class="note">{c.mood.rivalsLoading}</p>
	{:else if drawn > 0}
		<!-- This is a caption for the map, so it has to stop describing one the moment
		     the map stops showing it. The count is the same either way. -->
		<p class="read">
			<span class="dot" aria-hidden="true"></span>{app.layers.poi
				? c.mood.rivalsCount(drawn, catMany)
				: c.mood.rivalsHidden(drawn, catMany)}
		</p>
		{#if app.layers.poi && named === 0}
			<!-- Every station on the map is named and not one competitor is, which
			     reads as a broken label layer unless it is accounted for. -->
			<p class="note">{c.mood.rivalsNoNames}</p>
		{/if}
	{:else}
		<!-- Zero really is zero here: the source covers this city, it was checked, and
		     nothing was found inside the range. That is a finding, not an absence. -->
		<p class="read">{c.mood.rivalsNone}</p>
	{/if}
</section>

<style>
	.rivals {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	/* Same control as the transit switch, because it is the same job on the same map.
	   Its "on" state is the competitors' red rather than the accent, so the button
	   matches what it puts on screen. */
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
		background: var(--critical);
		border-color: var(--critical);
		color: #fff;
	}

	.read {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--label-2);
	}
	.dot {
		flex: none;
		align-self: center;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--critical);
	}
	.note {
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-3);
		border-left: 2px dashed var(--separator-strong);
		padding-left: 0.5rem;
	}
</style>
