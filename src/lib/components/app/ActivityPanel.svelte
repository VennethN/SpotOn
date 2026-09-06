<script lang="ts">
	/**
	 * When the businesses around the selected area open their doors.
	 *
	 * THE ONE THING THIS PANEL MUST NOT BLUR
	 *
	 * It counts DOORS, not people. The chart is the shape Google draws as "popular
	 * times" and it is a different measurement: Google counts phones moving through a
	 * place, and nobody has counted a phone in Jakarta for this product. Every column
	 * here is a number of businesses within walking range whose published opening hours
	 * say they are open in that hour, read from OpenStreetMap.
	 *
	 * So the word "ramai" appears nowhere in this section, the caption says what was
	 * counted before the reader has finished looking at the bars, and the panel names
	 * the datasets that would carry the other half. Struk Go and Mission Go publish
	 * receipts, which is the demand side of the same hour. They do not exist yet. When
	 * they do the two sit beside each other, and neither is renamed to sound like the
	 * other in the meantime.
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
	import { HOURS_IN_DAY, jakartaNow, peakOf, readHours, weekProfile } from '$lib/domain/activity';
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

	/** The counts the join wrote: businesses in range, how many publish hours, how many
	    of those could be read. Null on a grid the join has never been run on. */
	const stat = $derived(cell ? readHours(cell, radius) : null);

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
</script>

<!-- Nothing at all on a grid that has never been through `join-hours.mjs`. That is a
     build state, not a finding about the place, and a section explaining it would be
     an apology to the wrong reader. -->
{#if cell && stat}
	<section class="act">
		<SectionHead icon="hours">{c.activity.title}</SectionHead>

		{#if stat.h >= minReadable}
			{#if app.hoursLoading}
				<p class="note">{c.activity.loading}</p>
			{:else if app.openPlacesFailed}
				<p class="note">{c.activity.failed(stat.h)}</p>
			{:else}
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
								title={c.activity.barTitle(h, n, stat.h)}
							>
								<div
									class="bar"
									style:height={`${Math.round((n / tallest) * 100)}%`}
									aria-hidden="true"
								></div>
								<span class="sr">{c.activity.barTitle(h, n, stat.h)}</span>
							</div>
						{/each}
					</div>
					<div class="axis" aria-hidden="true">
						{#each Array(HOURS_IN_DAY) as _, h (h)}
							<span class="tick">{TICKS.includes(h) ? c.activity.hourShort(h) : ''}</span>
						{/each}
					</div>
				</div>

				<p class="read">
					{#if today}
						{c.activity.nowOpen(now.hour, openNow, stat.h)}
					{/if}
					{c.activity.peak(peak.hour, peak.n, stat.h)}
				</p>

				<!-- The denominator, directly under the curve it belongs to. Fewer than one
				     business in six publishes hours at all, and a chart with no count beside
				     it reads as the whole street. The two silences below carry the same
				     figures inside their own sentence, which is why this is not repeated
				     there. -->
				<p class="basis">
					{c.activity.basis(stat.h, stat.n, radius)}
					{#if stat.p > stat.h}
						{c.activity.refused(stat.p - stat.h)}
					{/if}
				</p>
			{/if}
		{:else if stat.p > 0}
			<!-- Published, but too few to draw. Different from nobody publishing, and the
			     reader is told which of the two they are looking at. -->
			<p class="read">
				{c.activity.thin(stat.h, minReadable, stat.n, radius)}
				{#if stat.p > stat.h}
					{c.activity.refused(stat.p - stat.h)}
				{/if}
			</p>
		{:else}
			<p class="read">{c.activity.none(stat.n, radius)}</p>
		{/if}

		<p class="note">{c.activity.notFootfall}</p>
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
	.basis {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
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
