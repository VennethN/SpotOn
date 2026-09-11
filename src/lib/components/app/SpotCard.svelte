<script lang="ts">
	/**
	 * The card for the selected area.
	 *
	 * It leads with one number only. Everything else is told by the model underneath,
	 * in sentences, and the full table of figures stays folded away inside it for the
	 * moment a claim needs checking.
	 *
	 * The ramp colour is carried by the dot, not by the numeral: the bottom of the
	 * scale is a very pale blue, and a score of 8 set in it is unreadable on light
	 * material. Colour that cannot be read is not encoding anything.
	 */
	import CatchmentDiorama from '$lib/components/app/CatchmentDiorama.svelte';
	import PivotMark from '$lib/components/ui/PivotMark.svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { standingOf } from '$lib/domain/metrics';
	import { standingPhrase } from '$lib/domain/narrate';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { Tapak } from '$lib/state/tapak.svelte';
	import { pct, rampIndex } from '$lib/utils/format';

	/* The page's one conversation, handed in so the card can put this place into it.
	   The card does not ask anything itself: it names the place and hands over the
	   cursor, and what gets asked is typed. */
	let { tapak }: { tapak: Tapak } = $props();

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/* The one number the card leads with, set against the grid. 65 is out of 100 and
	   that is not the comparator: whether 65 is a lot depends on what the rest of the
	   grid scores, and this is the first figure the reader sees. */
	const standing = $derived(row ? standingPhrase(standingOf(row, 'skor', app.ladders.skor), c) : '');
</script>

{#if row}
	<div class="head">
		<!-- Which of the two things this card is. Unit cards now carry the same catchment
		     sections in the same order, so the badge is what tells 800 m of city apart from
		     one shopfront at a glance. -->
		<PivotMark kind="cell" />
		<div class="who">
			<h2>{row.name}</h2>
			<p class="sub">
				{#if row.score !== null}
					<span class="dot" style:background={`var(--ramp-${rampIndex(row.score)})`}></span>
				{/if}
				{c.typology[row.typology]}
			</p>
			<!-- The score against the grid, on a line of its own under the typology, which
			     is the other word for the same verdict. Not under the number: stacked
			     there it widened that column until "Kalibata City 2" broke in two. -->
			{#if standing}<p class="standing">{standing}</p>{/if}
		</div>
		{#if row.score !== null}
			<span class="score">{pct(row.score)}</span>
		{/if}
		<button
			type="button"
			class="close"
			onclick={() => app.select(null)}
			aria-label={c.app.closeArea}
		>
			<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
				<path
					d="M4 4l8 8M12 4l-8 8"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>

	<!-- Into the conversation, about this place, in the reader's own words. Not a list
	     of questions: the box takes anything, and this only tells it which place the
	     next one is about. On a line of its own under the head, because the name column
	     is half the card and the label wrapped inside it. -->
	<button type="button" class="ask" onclick={() => tapak.askAbout(row.name)}>
		<TapakFigure size={14} />
		<span>{c.tapak.askAbout}</span>
	</button>

	<CatchmentDiorama />
{/if}

<style>
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
		/* Large text: tracking in, leading tightened. */
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.sub {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.1875rem;
		font-size: 0.75rem;
		color: var(--label-3);
	}
	.standing {
		margin-top: 0.125rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.dot {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--separator) inset;
	}
	.score {
		font-size: 1.75rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.ask {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0.5rem 0 0.625rem;
		padding: 0.25rem 0.6875rem 0.25rem 0.5rem;
		white-space: nowrap;
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--label-1);
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.ask:hover {
		background: var(--fill-1);
	}
	.ask:active {
		transform: scale(0.96);
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
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.close:hover {
		background: var(--fill-2);
		color: var(--label-1);
	}
	.close:active {
		transform: scale(0.9);
	}
</style>
