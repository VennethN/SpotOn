<script lang="ts">
	/**
	 * The map key, always visible.
	 *
	 * The legend used to live only inside the closed "Advanced settings" drawer —
	 * meaning a first-time user saw a coloured map without a single word explaining
	 * those colours. For a user who has never read a choropleth, that is not a map,
	 * that is guesswork.
	 *
	 * It deliberately holds three lines only: the ramp, what its ends mean, and cells
	 * with no data yet. The rest stays in the advanced drawer.
	 */
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());
	const coverage = $derived(app.coverage);

	/* Cells left unscored because the active source does not yet cover this city +
	   category. Without saying so, the map reads as "every score is zero" — the exact
	   opposite conclusion from what is actually the case.

	   This used to be forced to zero for the OSM source, on the assumption that only
	   MAPID could be uncovered. That assumption stopped being true once four food
	   categories (warteg, mie, seafood, foreign restaurants) were declared to have no
	   OSM source: picking Warteg on OSM dashes EVERY cell, and it is exactly in that
	   state that the note was being suppressed. */
	const uncovered = $derived(coverage.notCovered);
	const catName = $derived(c.category[app.category].name);
	const srcName = $derived(app.weights.source === 'mapid' ? 'MAPID' : 'OSM');
	const otherSrcName = $derived(app.weights.source === 'mapid' ? 'OSM' : 'MAPID');

	let open = $state(true);
</script>

<div class="legend material" class:closed={!open}>
	<button
		type="button"
		class="head"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-controls="legend-body"
	>
		<span class="cat">{c.category[app.category].name}</span>
		<span class="lbl">{c.app.legendUnit}</span>
		<span class="chev" aria-hidden="true" class:up={open}>
			<svg viewBox="0 0 10 10" width="9" height="9">
				<path
					d="M2 6.5 5 3.5 8 6.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
	</button>

	{#if open}
		<div class="body" id="legend-body">
			<ScoreRamp dense nodata={c.app.legendNodata(coverage.withoutData)} />

			{#if uncovered > 0}
				<p class="uncovered" class:blocking={coverage.scored === 0}>
					{coverage.scored === 0
						? c.app.legendUncoveredAll(catName, srcName, otherSrcName)
						: c.app.legendUncovered(uncovered, catName, srcName)}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.uncovered {
		margin-top: 0.5rem;
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-3);
		border-left: 2px dashed var(--nodata);
		padding-left: 0.5rem;
	}
	/* If not one cell can be scored, this is not a footnote — it is the only thing in
	   this panel worth reading. */
	.uncovered.blocking {
		color: var(--label-1);
		border-left-color: var(--warn);
	}

	.legend {
		position: fixed;
		left: 0.75rem;
		bottom: 2.75rem;
		z-index: 6;
		width: 13.75rem;
		border-radius: var(--r-md);
		overflow: hidden;
	}
	.legend.closed {
		width: auto;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		width: 100%;
		background: none;
		border: 0;
		padding: 0.4375rem 0.5625rem;
		cursor: pointer;
		text-align: left;
	}
	.cat {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: -0.005em;
		color: var(--label-1);
	}
	.lbl {
		font-size: 0.625rem;
		color: var(--label-3);
		margin-right: auto;
	}
	.chev {
		display: grid;
		place-items: center;
		color: var(--label-3);
		transform: rotate(180deg);
		transition: transform 180ms ease-out;
		align-self: center;
	}
	.chev.up {
		transform: none;
	}

	.body {
		padding: 0 0.5625rem 0.5rem;
	}
	/* In the compact layout the sheet takes the bottom — so the legend moves to the
	   top left, just under the bar, and collapses itself to keep the map open. */
	@media (max-width: 1023px) {
		.legend {
			top: 3.25rem;
			bottom: auto;
			left: 0.5rem;
			width: 11rem;
		}
	}
</style>
