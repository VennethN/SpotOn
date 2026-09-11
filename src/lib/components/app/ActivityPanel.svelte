<script lang="ts">
	/**
	 * When the businesses around the selected area, or around the place standing in it,
	 * open their doors.
	 *
	 * THE ONE THING THIS PANEL MUST NOT BLUR
	 *
	 * It counts DOORS, not people. The chart is the shape Google draws as "popular
	 * times" and it is a different measurement: Google counts phones moving through a
	 * place, and nobody has counted a phone in Jakarta for this product. Every column
	 * here is a number of businesses within walking range whose published opening hours
	 * say they are open in that hour, read from OpenStreetMap.
	 *
	 * So the word "ramai" appears nowhere in this section, and the caption says what was
	 * counted before the reader has finished looking at the bars.
	 *
	 * THE OTHER HALF, AND WHY IT IS NOT ON THIS CHART
	 *
	 * The MAPID Apps field surveys hold the spending side: receipts photographed in
	 * range, and eateries a surveyor rated while standing in front of them. Real people,
	 * real crowds, and no hour on any of it — every record carries a date and no time,
	 * which `scripts/fetch-missions.mjs` measures on every run rather than assuming.
	 * `FieldPanel` shows them as their own section further down this card, not as a
	 * second series on these bars, where they would need an hour nobody wrote down.
	 *
	 * WHAT IT REFUSES TO DRAW
	 *
	 * A curve below the threshold the join recorded. Three shops do not have a rhythm,
	 * they have three timetables, and one 24-hour minimart among them draws a street
	 * that never sleeps. Under the threshold the panel says how many it found and draws
	 * nothing, which is the true statement.
	 *
	 * Every figure comes from `domain/activity`, which reads the counts off the grid and
	 * builds the profile from the very points the join counted, with the same distance
	 * test. Nothing here does arithmetic of its own beyond scaling a bar to the tallest
	 * one, so the curve and the count above it cannot come apart.
	 */
	import { HOURS_IN_DAY, jakartaNow, peakOf, weekProfile } from '$lib/domain/activity';
	import Fineprint from '$lib/components/ui/Fineprint.svelte';
	import SectionHead from '$lib/components/ui/SectionHead.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());
	/* The grid's cell, not the scored row. When a street is awake is counted from
	   OpenStreetMap and is here from the first frame, including on cells the active
	   category has no score for. */
	const cell = $derived(app.selectedCell);
	const radius = $derived(app.weights.radius);

	/**
	 * What was counted around the point the range is measured from.
	 *
	 * `readable` is the denominator every sentence here quotes, and it is the size of
	 * the very set the curve is drawn from in both modes. `counted` is the join's own
	 * pair of wider figures — businesses in range at all, and how many of them published
	 * hours — which exist only for a cell centre: `join-hours.mjs` never stood in a
	 * doorway, so with a place open it is null and the two sentences that quote those
	 * figures give way to ones that do not.
	 *
	 * Null altogether on a grid the join has never been run on.
	 */
	const reading = $derived(app.hoursReading);
	const readable = $derived(reading?.readable ?? 0);
	const counted = $derived(reading?.counted ?? null);
	/** The range is measured from a place, so the panel is about that place. */
	const fromPlace = $derived(app.reachIsPlace);

	/**
	 * The rules and the size of the evidence, from the grid file's own metadata.
	 *
	 * Read rather than written into the sentences. `scripts/join-hours.mjs` decides how
	 * many readable businesses a curve needs and records it there, so raising the bar
	 * moves the rule and the sentence explaining the rule together. A figure typed by
	 * hand into copy goes stale in silence, and that has happened in this repository
	 * before.
	 */
	const meta = $derived(app.meta?.hours ?? null);
	const minReadable = $derived(meta?.minReadable ?? 0);

	/* The businesses the cell captures, from the app rather than recaptured here. One
	   distance test in the app, as the property panel takes its units from
	   `selectedListings` rather than matching them again. */
	const profile = $derived(weekProfile(app.selectedOpen));

	/**
	 * The tallest column of the WEEK, not of the day on screen.
	 *
	 * One scale across all seven days, so switching from Monday to Sunday shows a
	 * genuinely quieter street rather than the same chart with different labels. Per-day
	 * scaling would make every day look equally busy at its own peak, which is the one
	 * comparison somebody flicking between the tabs is trying to make.
	 */
	const tallest = $derived(Math.max(1, ...profile.flat()));

	/**
	 * Jakarta's clock, not the reader's. The doors are in Jakarta.
	 *
	 * It ticks. Read once at mount it would be right for an hour and then quietly wrong
	 * for as long as the tab stayed open, and "right now" is the one sentence on this
	 * panel that is a claim about the present rather than about a usual week.
	 */
	let clock = $state(new Date());
	$effect(() => {
		const tick = setInterval(() => (clock = new Date()), 60_000);
		return () => clearInterval(tick);
	});
	const now = $derived(jakartaNow(clock));
	/** Which day is on screen. Null means "whatever day it is in Jakarta", so the panel
	    opens on today and follows it, and a reader who picks a day keeps it. */
	let picked = $state<number | null>(null);
	const day = $derived(picked ?? now.day);
	const today = $derived(day === now.day);

	const bars = $derived(profile[day] ?? []);
	const peak = $derived(peakOf(bars));
	/** How many doors are open in Jakarta right now, of the ones counted here. Only
	    meaningful on today's column, which is the only place it is shown. */
	const openNow = $derived(bars[now.hour] ?? 0);

	/** The hours the axis is labelled at. Every sixth, so the row stays readable at the
	    width of a panel. */
	const TICKS = [0, 6, 12, 18];

	/**
	 * Which of the five things this section is doing, decided once.
	 *
	 * The order matters and it is not the same order in the two modes. With the range on
	 * a cell centre the grid already knows how many readable businesses are in range, so
	 * a cell below the threshold says so straight away and never flashes a loading line
	 * for a curve that was never going to be drawn. With the range on a place nobody has
	 * counted anything until `hours.json` lands, so an empty capture means "not yet"
	 * rather than "none", and saying "none" first would be a finding invented out of a
	 * request still in flight.
	 */
	type Showing = 'loading' | 'failed' | 'chart' | 'thin' | 'none';
	const showing = $derived.by<Showing>(() => {
		if (fromPlace) {
			if (app.hoursLoading) return 'loading';
			if (app.openPlacesFailed) return 'failed';
			return readable >= minReadable ? 'chart' : readable > 0 ? 'thin' : 'none';
		}
		if (readable < minReadable) return counted && counted.p > 0 ? 'thin' : 'none';
		if (app.hoursLoading) return 'loading';
		if (app.openPlacesFailed) return 'failed';
		return 'chart';
	});
	/** Whether the curve is actually on screen. The denominator belongs to the curve, so
	    it is only stated where there is one, and the two silences carry those same
	    figures inside their own sentence instead. */
	const drawn = $derived(showing === 'chart');
</script>

<!-- Nothing at all on a grid that has never been through `join-hours.mjs`. That is a
     build state, not a finding about the place, and a section explaining it would be
     an apology to the wrong reader. -->
{#if cell && reading}
	<section class="act">
		<SectionHead icon="hours">{fromPlace ? c.activity.titlePlace : c.activity.title}</SectionHead>

		{#if showing === 'loading'}
			<p class="note">{c.activity.loading}</p>
		{:else if showing === 'failed'}
			<p class="note">{fromPlace ? c.activity.failedPlace : c.activity.failed(readable)}</p>
		{:else if showing === 'chart'}
			<!-- ── The week, one day at a time ──────────────────────────────── -->
			<div class="days" role="group" aria-label={c.activity.dayPicker}>
				{#each c.activity.days as name, i (name)}
					<!-- Pressed rather than selected, and no tab roles: there is one chart
					     below and it is always the same chart, so a tablist would promise a
					     panel per day that does not exist. The full day name is the label
					     because "Sen" is three letters of a word read aloud. -->
					<button
						type="button"
						class="day"
						class:on={day === i}
						aria-pressed={day === i}
						aria-label={c.activity.dayFull[i]}
						onclick={() => (picked = i)}
					>
						{name}
					</button>
				{/each}
			</div>

			<div class="chart">
				<div class="bars">
					{#each bars as n, h (h)}
						<!-- The bar is the figure, so it carries the figure: a screen reader
						     gets the count and the hour, not a picture it cannot see. -->
						<div
							class="slot"
							class:now={today && h === now.hour}
							title={c.activity.barTitle(h, n, readable)}
						>
							<div
								class="bar"
								style:height={`${Math.round((n / tallest) * 100)}%`}
								aria-hidden="true"
							></div>
							<span class="sr">{c.activity.barTitle(h, n, readable)}</span>
						</div>
					{/each}
				</div>
				<div class="axis" aria-hidden="true">
					{#each Array(HOURS_IN_DAY) as _, h (h)}
						<span class="tick">{TICKS.includes(h) ? c.activity.hourShort(h) : ''}</span>
					{/each}
				</div>
			</div>

			<!-- Two facts, on two lines. Run together in one paragraph the reader has
			     to parse a sentence to find out whether the doors are open now, which
			     is the question the chart was opened to answer. -->
			{#if today}
				<p class="read now">
					<span class="mark" aria-hidden="true"></span>
					{c.activity.nowOpen(now.hour, openNow, readable)}
				</p>
			{/if}
			<p class="read">{c.activity.peak(peak.hour, peak.n, readable)}</p>
		{:else if showing === 'thin'}
			<!-- Published, but too few to draw. Different from nobody publishing, and the
			     reader is told which of the two they are looking at. Without the join's
			     wider counts there is no denominator to give, so the sentence measured
			     from a place states what it has rather than borrowing the cell's. -->
			<p class="read">
				{#if counted}
					{c.activity.thin(readable, counted.n, radius)}
					{#if counted.p > readable}
						{c.activity.refused(counted.p - readable)}
					{/if}
				{:else}
					{c.activity.thinPlace(readable, radius)}
				{/if}
			</p>
		{:else}
			<p class="read">
				{counted ? c.activity.none(counted.n, radius) : c.activity.nonePlace(radius)}
			</p>
		{/if}

		<!-- The denominator and the disclaimer, in the shape a reader can recognise as
		     apparatus and skip. Neither is optional: fewer than one business in six
		     publishes hours at all, so a chart with no count beside it reads as the whole
		     street, and the second line is what stops the bars being read as a crowd. -->
		<Fineprint>
			{#if drawn}
				<p>
					{#if counted}
						{c.activity.basis(readable, counted.n, radius)}
						{#if counted.p > readable}
							{c.activity.refused(counted.p - readable)}
						{/if}
					{:else}
						{c.activity.basisPlace(readable, radius)}
					{/if}
				</p>
			{/if}
			<p>{c.activity.notFootfall}</p>
		</Fineprint>
	</section>
{/if}

<style>
	.act {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* ── The day tabs ─────────────────────────────────────────────────────── */
	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.125rem;
		padding: 0.125rem;
		border-radius: var(--r-sm);
		background: var(--fill-1);
	}
	.day {
		border: 0;
		border-radius: calc(var(--r-sm) - 2px);
		padding: 0.3125rem 0;
		background: transparent;
		color: var(--label-3);
		font: inherit;
		font-size: 0.6875rem;
		font-weight: 550;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	.day:hover {
		color: var(--label-1);
	}
	.day.on {
		background: var(--bg-elevated);
		color: var(--label-1);
		box-shadow: var(--shadow-chip);
	}

	/* ── The bars ─────────────────────────────────────────────────────────── */
	.chart {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.bars {
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		align-items: end;
		gap: 1px;
		height: 4.5rem;
	}
	.slot {
		position: relative;
		display: flex;
		align-items: flex-end;
		height: 100%;
		/* The whole column is the hit area for the tooltip, so an hour with nothing open
		   can still be pointed at and read as the zero it is. */
		border-radius: 2px;
	}
	.slot:hover {
		background: var(--fill-1);
	}
	.bar {
		width: 100%;
		/* A minimum so an hour with one door open is a mark rather than nothing. A zero
		   gets no mark at all, which is the difference the panel is drawing. */
		min-height: 0;
		border-radius: 2px 2px 1px 1px;
		background: var(--ramp-3);
	}
	/* Jakarta's current hour, on Jakarta's current day. The one column that is a claim
	   about right now rather than about a usual week. */
	.slot.now .bar {
		background: var(--accent);
	}
	/* A tint behind the whole column rather than an outline around it. An outline is only
	   ever visible ABOVE the bar, where it reads as an empty box floating over the
	   chart rather than as a mark on the hour underneath it. */
	.slot.now {
		background: var(--accent-soft);
	}
	.axis {
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		gap: 1px;
		font-size: 0.5625rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.tick {
		white-space: nowrap;
	}

	/* ── The words ────────────────────────────────────────────────────────── */
	.read {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	/* The one line here that is a claim about right now. It gets the accent the current
	   column already wears, so the sentence and the bar it is about are visibly the same
	   statement, and it is set at full strength because it is the line a reader who
	   opened this section came for. */
	.read.now {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
		color: var(--label-1);
	}
	.read.now .mark {
		flex: none;
		align-self: center;
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 999px;
		background: var(--accent);
	}
	.note {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	/* Available to a screen reader, invisible to everyone else. */
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
