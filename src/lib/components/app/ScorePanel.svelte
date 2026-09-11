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
	import { ladderFor, standingOf } from '$lib/domain/metrics';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { pct } from '$lib/utils/format';
	import type { MetricKey } from '$lib/types';

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/** Counted, but nobody has said what they want to open yet. Same test the card
	    itself makes, on the same two fields, so the two cannot disagree. */
	const noType = $derived(Boolean(row) && row!.covered && row!.score === null);

	/**
	 * AN INDEX IS SET AGAINST THE GRID. A COUNT IS NOT.
	 *
	 * Four of the seven rows are indices out of 100 and three are counts, and the two
	 * kinds read differently. "207 other businesses nearby" is a number anybody can
	 * picture. "Busyness 65" is not: it is out of 100, and whether 65 is a lot depends
	 * entirely on what the rest of the grid reads. So each index says where it sits
	 * among every area that has one, the way the price already does on its own panel,
	 * and the counts are left to speak for themselves.
	 *
	 * The ladders are cut from the same scored rows the map is painted from, for the
	 * business type and walking range in force, and recut only when those change.
	 */
	const ladders = $derived({
		skor: ladderFor(app.rows, 'skor'),
		permintaan: ladderFor(app.rows, 'permintaan'),
		penawaran: ladderFor(app.rows, 'penawaran'),
		akses_transit: ladderFor(app.rows, 'akses_transit')
	});

	/**
	 * The comparator under one index, or nothing when there is too little to rank against.
	 *
	 * FLOORED, never rounded. "Higher than N% of areas" is a claim, and the claim has to
	 * be true: the second-highest cell of 462 stands at 0.998, and rounded that reads
	 * "higher than 100% of areas", which it is not. Floored it reads 99, which it is. The
	 * two exact ends get their own words, and the bottom hundredth, which floors to a
	 * "higher than 0%" that is true and useless, says what it is instead.
	 */
	function standing(key: keyof typeof ladders & MetricKey): string {
		if (!row) return '';
		const level = standingOf(row, key, ladders[key]);
		if (level === null) return '';
		if (level === 0) return c.mood.standingLowest;
		if (level === 1) return c.mood.standingHighest;
		const share = Math.floor(level * 100);
		return share === 0 ? c.mood.standingNearLowest : c.mood.standing(share);
	}
</script>

{#if row}
	<section class="score">
		<SectionHead icon="score">{c.mood.rows.score}</SectionHead>

		{#if noType}
			<p class="read">{c.mood.askForScore}</p>
			<dl>
				<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
				<div>
					<dt>{c.mood.rows.access}<small>{standing('akses_transit')}</small></dt>
					<dd>{pct(row.access)}</dd>
				</div>
				<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
			</dl>
		{:else}
			<!-- The four indices carry their standing on the grid under the label; the
			     three counts carry nothing, because a count is its own comparator. -->
			<dl>
				<div>
					<dt>{c.mood.rows.score}<small>{standing('skor')}</small></dt>
					<dd>{pct(row.score)}</dd>
				</div>
				<div>
					<dt>{c.mood.rows.demand}<small>{standing('permintaan')}</small></dt>
					<dd>{pct(row.demand)}</dd>
				</div>
				<div>
					<dt>{c.mood.rows.supply}<small>{standing('penawaran')}</small></dt>
					<dd>{pct(row.supply)}</dd>
				</div>
				<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
				<div><dt>{c.mood.rows.rivals}</dt><dd>{row.osm}</dd></div>
				<div>
					<dt>{c.mood.rows.access}<small>{standing('akses_transit')}</small></dt>
					<dd>{pct(row.access)}</dd>
				</div>
				<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
			</dl>

			<!-- The rows above are the figures, and this is what the engine did with
			     them. Somebody who opened this section is asking where the score came
			     from, and a list of inputs with no arithmetic between them answers half
			     of that. -->
			<ScoreBreakdown />
		{/if}

		<Fineprint>
			<p>{c.mood.standingNote}</p>
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
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		color: var(--label-3);
	}
	/* The comparator, quieter than the label it sits under. Empty for a count, and
	   empty takes no room: a blank line under three of seven rows would read as three
	   figures with something missing. */
	dt small {
		font-size: 0.6875rem;
		color: var(--label-4);
	}
	dt small:empty {
		display: none;
	}
	dd {
		margin: 0;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
</style>
