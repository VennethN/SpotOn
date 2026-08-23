<script lang="ts">
	/**
	 * The opportunity score, and everything it was made of.
	 *
	 * This was a `<details>` fold in the middle of the area card, opened by a line
	 * reading "see the full figures". Two things were wrong with that. A fold that
	 * expands in place pushes the four sections under it down the page, so opening the
	 * figures moved everything the reader had already found. And it made the score the
	 * only thing on the card with no section of its own, which is backwards: it is the
	 * figure the whole product is for.
	 *
	 * So it is a section like the rest, opened from the summary like the rest, and it
	 * holds what the fold held: the inputs as rows, the engine's arithmetic under them,
	 * and where the numbers came from.
	 *
	 * WITH NO BUSINESS TYPE NAMED IT SHOWS A SHORTER TABLE, NOT A TABLE OF BLANKS
	 *
	 * Three of the seven rows need somebody to have said what they want to open. Until
	 * then those rows do not exist rather than reading as a middot, and the section says
	 * what to do about it. `ScoreBreakdown` goes too, because there is no arithmetic to
	 * take apart.
	 */
	import Fineprint from '$lib/components/ui/Fineprint.svelte';
	import ScoreBreakdown from '$lib/components/app/ScoreBreakdown.svelte';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { pct } from '$lib/utils/format';

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/** Counted, but nobody has said what they want to open yet. Same test the card
	    itself makes, on the same two fields, so the two cannot disagree. */
	const noType = $derived(Boolean(row) && row!.covered && row!.score === null);
</script>

{#if row}
	<section class="score">
		<SectionHead icon="score">{c.mood.rows.score}</SectionHead>

		{#if noType}
			<p class="read">{c.mood.askForScore}</p>
			<dl>
				<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
				<div><dt>{c.mood.rows.access}</dt><dd>{pct(row.access)}</dd></div>
				<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
			</dl>
		{:else}
			<dl>
				<div><dt>{c.mood.rows.score}</dt><dd>{pct(row.score)}</dd></div>
				<div><dt>{c.mood.rows.demand}</dt><dd>{pct(row.demand)}</dd></div>
				<div><dt>{c.mood.rows.supply}</dt><dd>{pct(row.supply)}</dd></div>
				<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
				<div><dt>{c.mood.rows.rivals}</dt><dd>{row.osm}</dd></div>
				<div><dt>{c.mood.rows.access}</dt><dd>{pct(row.access)}</dd></div>
				<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
			</dl>

			<!-- The rows above are the figures, and this is what the engine did with
			     them. Somebody who opened this section is asking where the score came
			     from, and a list of inputs with no arithmetic between them answers half
			     of that. -->
			<ScoreBreakdown />
		{/if}

		<Fineprint>
			<p>{c.mood.prov}</p>
		</Fineprint>
	</section>
{/if}

<style>
	.score {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.read {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3125rem 0;
		border-bottom: 1px solid var(--separator);
		font-size: 0.75rem;
	}
	dt {
		color: var(--label-3);
	}
	dd {
		margin: 0;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
</style>
