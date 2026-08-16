<script lang="ts">
	/**
	 * The map key — and the switch for the thing it is a key to.
	 *
	 * The legend used to live only inside the closed "Advanced settings" drawer —
	 * meaning a first-time user saw a coloured map without a single word explaining
	 * those colours. For a user who has never read a choropleth, that is not a map,
	 * that is guesswork.
	 *
	 * It deliberately holds three lines only: the ramp, what its ends mean, and cells
	 * with no data yet. The rest stays in the advanced drawer.
	 *
	 * WHY THE BUTTON LIVES HERE
	 *
	 * The heatmap now starts off, and a key to colours that are not on screen is just
	 * a puzzle. So with the heatmap off this collapses to the one control that makes
	 * sense in that state — turn it on — and unfolds into the key once there are
	 * colours to explain. One object, two states, rather than a floating button
	 * somewhere else that the legend never mentions.
	 */
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { PoiSource } from '$lib/types';

	const app = getAppState();
	const c = $derived(copy());
	const coverage = $derived(app.coverage);
	const catName = $derived(c.category[app.category].name);
	/* Colours actually on screen — the key only describes what is being drawn, so
	   between the button press and the data landing it stays a loading state rather
	   than explaining a ramp nobody can see yet. */
	const showing = $derived(app.layers.score && app.ready);

	/* Cells left unscored because the active source does not yet cover this city +
	   category. Without saying so, the map reads as "every score is zero" — the exact
	   opposite conclusion from what is actually the case.

	   This used to be forced to zero for the OSM source, on the assumption that only
	   MAPID could be uncovered. That assumption stopped being true once four food
	   categories (warteg, mie, seafood, foreign restaurants) were declared to have no
	   OSM source: picking Warteg on OSM dashes EVERY cell, and it is exactly in that
	   state that the note was being suppressed. */
	const uncovered = $derived(coverage.notCovered);
	const srcName = $derived(app.weights.source === 'mapid' ? 'MAPID' : 'OSM');
	const otherSrcName = $derived(app.weights.source === 'mapid' ? 'OSM' : 'MAPID');

	let open = $state(true);
</script>

{#if !showing}
	<div class="legend material off">
		<button
			type="button"
			class="turn-on"
			onclick={() => app.showHeatmap()}
			disabled={app.sliceLoading}
			aria-label={c.app.heatmapAria}
		>
			<span class="ramp-chip" aria-hidden="true"></span>
			<span class="turn-on-text">
				<span class="turn-on-title"
					>{app.sliceLoading ? c.app.heatmapLoading : c.app.heatmapShow}</span
				>
				<span class="turn-on-sub">{c.app.heatmapHint(catName.toLowerCase())}</span>
			</span>
		</button>
		{#if app.sliceError}
			<p class="err">{app.sliceError}</p>
		{/if}
	</div>
{:else}
	<div class="legend material" class:closed={!open}>
		<button
			type="button"
			class="head"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="legend-body"
		>
			<span class="cat">{catName}</span>
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
				<ScoreRamp dense nodata={c.app.legendNodata(coverage.notCovered)} />

				{#if uncovered > 0}
					<p class="uncovered" class:blocking={coverage.scored === 0}>
						{coverage.scored === 0
							? c.app.legendUncoveredAll(catName, srcName, otherSrcName)
							: c.app.legendUncovered(uncovered, catName, srcName)}
					</p>
				{/if}

				<!-- The competitor source used to sit in the title bar, three metres from
				     anything it changed. It belongs here: it decides the numbers the ramp
				     is drawn from, and the sentence directly above already names it as the
				     reason some cells cannot be scored. Switching it is the fix for that
				     sentence, so the fix sits next to the complaint. -->
				<div class="source">
					<span class="src-lbl">{c.app.sourceLabel}</span>
					<Segmented
						label={c.app.sourceLabel}
						value={app.weights.source}
						onchange={(v: PoiSource) => app.setSource(v)}
						options={[
							{ value: 'osm', label: 'OSM', hint: c.app.sourceOsm },
							{ value: 'mapid', label: 'MAPID', hint: c.app.sourceMapid }
						]}
					/>
				</div>

				<button type="button" class="turn-off" onclick={() => (app.layers.score = false)}>
					{c.app.heatmapHide}
				</button>
			</div>
		{/if}
	</div>
{/if}

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
	/* Off state: sized to its own content rather than to the key it is not showing. */
	.legend.off {
		width: auto;
		max-width: 15rem;
	}

	.turn-on {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		background: none;
		border: 0;
		padding: 0.4375rem 0.625rem;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}
	.turn-on:hover:not(:disabled) {
		background: var(--fill-1);
	}
	.turn-on:disabled {
		cursor: default;
		opacity: 0.7;
	}
	/* A slice of the ramp itself, so the button shows what it is about to put on the
	   map rather than describing it in words alone. */
	.ramp-chip {
		flex: none;
		width: 1.375rem;
		height: 1.375rem;
		border-radius: var(--r-xs);
		border: 1px solid var(--separator);
		background: linear-gradient(
			135deg,
			var(--ramp-0),
			var(--ramp-2),
			var(--ramp-4),
			var(--ramp-6)
		);
	}
	.turn-on-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.turn-on-title {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: -0.005em;
		color: var(--label-1);
	}
	.turn-on-sub {
		font-size: 0.625rem;
		color: var(--label-3);
	}
	.err {
		padding: 0 0.625rem 0.4375rem;
		font-size: 0.625rem;
		line-height: 1.4;
		color: var(--critical);
	}

	.source {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--separator);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.src-lbl {
		font-size: 0.625rem;
		color: var(--label-3);
	}

	.turn-off {
		margin-top: 0.5rem;
		width: 100%;
		border: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		border-radius: var(--r-xs);
		padding: 0.25rem;
		font-size: 0.625rem;
		cursor: pointer;
	}
	.turn-off:hover {
		background: var(--fill-1);
		color: var(--label-1);
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
