<script lang="ts">
	/**
	 * The three controls that belong to the MAP rather than to any panel on top of it.
	 *
	 * WHY THEY LIVE OUT HERE
	 *
	 * The pivot switch spent a while inside the right-hand panel, above Tapak, and that
	 * was wrong in a way that only shows once you use it: putting it there made the panel
	 * swap wholesale between the conversation and the unit list, so choosing "per tempat"
	 * closed the chat. Tapak is not a mode of the map. It is the thing that can CHANGE the
	 * mode — ask it for cheap shophouses and it switches the pivot itself — so a control
	 * that replaces it is a control that takes away the thing operating it.
	 *
	 * The walking radius is out here for the plainer reason that it spans both pivots: it
	 * decides what a catchment contains and which cell a unit belongs to, so it cannot
	 * live inside a panel that only exists in one of the two modes.
	 *
	 * The flat-or-raised switch spans them the same way, and it changes nothing but the
	 * map itself. It is emphatically not a legend entry: the legend says what a colour
	 * means, and this does not touch that. It says whether the same figure is also drawn
	 * as a height.
	 *
	 * WHY THE BOTTOM CENTRE
	 *
	 * Every other corner is spoken for. The area card and the legend share the bottom
	 * left, Tapak has the right, the category picker and the theme switch have the top.
	 * The bottom centre is the one place a bar can sit without being underneath something
	 * or pushing something else off the screen.
	 *
	 * Deliberately quiet, and one row high. Almost nobody needs to move the radius, and a
	 * control nobody needs should not be the loudest thing on the map. The sentence saying
	 * what the radius does is not printed all the time either — it appears when the slider
	 * is hovered or focused, which is exactly when somebody is deciding whether to move it.
	 */
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { RADII } from '$lib/domain/weights';
	import { getAppState, type MapRender, type Pivot, type ViewMode } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());

	/* The slider moves in whole steps over the stops the data actually holds, rather than
	   over metres. A continuous slider would let a reader ask for 650 m, and there is no
	   median price at 650 m — `scripts/join-property.mjs` computes one per stop, because a
	   price interpolated between two radii is a figure nobody measured. */
	const index = $derived(Math.max(0, RADII.indexOf(app.weights.radius)));
</script>

<div class="controls">
	<div class="bar material">
		<Segmented
			label={c.units.pivotHint}
			value={app.pivot}
			onchange={(v: Pivot) => app.setPivot(v)}
			options={[
				{ value: 'cell', label: c.units.pivotCell },
				{ value: 'unit', label: c.units.pivotUnit }
			]}
		/>

		<span class="rule" aria-hidden="true"></span>

		<!-- Out here for the same reason the other two are: it belongs to the map rather
		     than to anything floating on top of it, and it spans both pivots. -->
		<Segmented
			label={c.app.viewLabel}
			value={app.view}
			onchange={(v: ViewMode) => (app.view = v)}
			options={[
				{ value: 'flat', label: c.app.viewFlat, hint: c.app.viewFlatHint },
				{ value: 'relief', label: c.app.viewRelief, hint: c.app.viewReliefHint }
			]}
		/>

		<!-- The same basemap two ways: as its publisher draws it, or modelled the way the
		     area model is, from the same tiles. Absent when there is nothing to model from,
		     which is the raster fallback and nothing else. Beside the flat-or-raised switch
		     because it is the same kind of thing: a way of looking, not a layer. -->
		{#if !app.basemapNone}
			<span class="rule" aria-hidden="true"></span>

			<Segmented
				label={c.app.renderLabel}
				value={app.render}
				onchange={(v: MapRender) => (app.render = v)}
				options={[
					{ value: 'drawn', label: c.app.renderDrawn, hint: c.app.renderDrawnHint },
					{ value: 'modelled', label: c.app.renderModelled, hint: c.app.renderModelledHint }
				]}
			/>
		{/if}

		<span class="rule" aria-hidden="true"></span>

		<label class="radius">
			<span class="lbl">{c.app.radiusLabel}</span>
			<input
				type="range"
				min="0"
				max={RADII.length - 1}
				step="1"
				value={index}
				oninput={(e) => app.setRadius(RADII[Number(e.currentTarget.value)])}
				aria-label={c.app.radiusAria}
				aria-valuetext={c.app.radiusValue(app.weights.radius)}
			/>
			<span class="val">{c.app.radiusValue(app.weights.radius)}</span>
			<!-- Inside the label, so hovering or tabbing to the slider is what reveals it.
			     Always visible it would be three lines of small print permanently across the
			     bottom of the map, explaining a control most readers never touch. -->
			<p class="hint material">{c.app.radiusHint}</p>
		</label>
	</div>
</div>

<style>
	.controls {
		position: fixed;
		left: 50%;
		bottom: 0.75rem;
		transform: translateX(-50%);
		z-index: 7;
		display: flex;
		justify-content: center;
		max-width: calc(100vw - 1.5rem);
		pointer-events: none;
	}
	.bar {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		/* The clamp on `.controls` only bites if the bar can actually give ground. Without
		   these two the row kept its natural width on a phone and hung off both edges of
		   the screen, taking half the pivot switch with it. */
		max-width: 100%;
		min-width: 0;
		padding: 0.3125rem 0.5rem;
		border-radius: 999px;
		box-shadow: var(--shadow-panel, 0 8px 30px rgba(0, 0, 0, 0.12));
	}

	.rule {
		flex: none;
		width: 1px;
		align-self: stretch;
		margin: 0.125rem 0.0625rem;
		background: var(--separator);
	}

	/* The half that gives ground when there is not enough room. The pivot switch does not:
	   its two labels are the mode names, and a truncated mode name is worse than a shorter
	   slider. */
	.radius {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		padding-right: 0.25rem;
	}
	.lbl {
		font-size: 0.6875rem;
		color: var(--label-3);
		white-space: nowrap;
	}
	.radius input {
		flex: 1;
		width: 6.5rem;
		/* Narrower than this and the five stops stop being distinguishable by drag, which
		   is the point at which the label and the arrow keys are all that is left. */
		min-width: 3.5rem;
		accent-color: var(--accent);
	}
	.val {
		flex: none;
		min-width: 3.1em;
		font-size: 0.6875rem;
		font-weight: 650;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Sits above the bar rather than below it: below, it would be off the bottom of the
	   screen. Not `display: none` — a screen reader should be able to reach the sentence
	   whether or not a pointer is over the slider. */
	.hint {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.5rem);
		width: 17rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--r-md, 12px);
		box-shadow: var(--shadow-panel, 0 8px 30px rgba(0, 0, 0, 0.12));
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-2);
		opacity: 0;
		visibility: hidden;
		transform: translate3d(0, 4px, 0);
		transition:
			opacity 140ms ease-out,
			transform 140ms ease-out,
			visibility 140ms;
	}
	.radius:hover .hint,
	.radius:focus-within .hint {
		opacity: 1;
		visibility: visible;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.hint {
			transition: none;
			transform: none;
		}
	}

	/* On a narrow screen the sheet owns the bottom of the map, so the bar moves up out
	   of its way and the hint flips to hanging below itself. The divider goes and the
	   spacing tightens: at 390 px the row is within a few pixels of the screen either
	   way, and those pixels are better spent on the radius reading than on a hairline. */
	@media (max-width: 1023px) {
		.controls {
			bottom: auto;
			top: 3.25rem;
			max-width: calc(100vw - 1rem);
		}
		/* Three switches and a slider do not fit one row at 390 px. The switches keep
		   their row and the slider takes the next, which is better than a slider too
		   short to drag or a mode name cut in half. A pill with two rows in it reads as a
		   mistake, so the corners come in. */
		.bar {
			flex-wrap: wrap;
			justify-content: center;
			gap: 0.375rem;
			padding: 0.3125rem 0.4375rem;
			border-radius: var(--r-lg, 16px);
		}
		.radius {
			flex-basis: 100%;
		}
		.rule {
			display: none;
		}
		.hint {
			bottom: auto;
			top: calc(100% + 0.5rem);
			right: auto;
			left: 50%;
			width: min(17rem, calc(100vw - 2rem));
			margin-left: -8.5rem;
			transform: translate3d(0, -4px, 0);
		}
	}
</style>
