<script lang="ts">
	/**
	 * Inside the selected area's model, with the day on a slider.
	 *
	 * The card's model is a thumbnail: the block around the point, ±340 px wide, lit by
	 * Jakarta's clock and holding still. This is the same model given the whole screen
	 * and the whole disc, plus the one control it was missing, which is the hour.
	 * Dragging it runs the light from midnight to midnight exactly as the landing page's
	 * stage does, because both read `scene/daylight` and there is only one sun over
	 * Jakarta.
	 *
	 * WHAT MOVES BECAUSE IT WAS COUNTED, AND WHAT MOVES BECAUSE IT CAN BE COMPUTED
	 *
	 * Two different things move with that slider and they are not the same kind of
	 * claim, so the panel keeps them apart.
	 *
	 * The LIGHT is arithmetic. Jakarta sits on the equator, the sun rises at about ten
	 * to six and sets at six, and `scene/daylight` says so all year. Nothing was
	 * surveyed to know that.
	 *
	 * The DOORS are a reading. Each business within walking range whose published
	 * opening hours could be read stands on the model as one mark, at the position
	 * OpenStreetMap holds for it, and the mark is lit in the hours its timetable says
	 * the door is open and dark in the hours it does not. That is `domain/activity`'s
	 * count, drawn where it was taken: the figure under the slider and the lit marks on
	 * the model are one measurement, and the curve over the slider is the same
	 * measurement summed. The model used to sculpt a crowd and scale it by this count.
	 * At the scale of a real street a person is a pixel, and a crowd drawn large enough
	 * to see would have been a claim about where people stand that nobody counted.
	 *
	 * So the figure under the slider counts DOORS, never people, in the same words
	 * `ActivityPanel` uses.
	 *
	 * WHERE THE DOORS WERE NOT COUNTED, NOTHING IS INVENTED TO FILL THE HOUR
	 *
	 * A cell under the join's threshold, a cell where nobody published hours at all, a
	 * cell whose city is not in the catalogue, and a file that failed to load are four
	 * different silences. In every one of them only the light moves and the panel says
	 * which silence this is. The alternative is a street that empties at three in the
	 * morning because streets do, which is a sentence about streets in general and not
	 * about this one.
	 */
	import { untrack } from 'svelte';
	import AreaScene from '$lib/components/ui/AreaScene.svelte';
	import { HOURS_IN_DAY, jakartaNow, weekProfile } from '$lib/domain/activity';
	import { categoryNames } from '$lib/domain/narrate';
	import { daylightAt } from '$lib/scene/daylight';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { Spinner, SpringValue } from '$lib/utils/motion.svelte';

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	const radius = $derived(app.weights.radius);
	const catMany = $derived(categoryNames(app.categories, c, 'many'));

	/**
	 * How close the camera stands: 1 is the block around the point, 0 the whole disc.
	 *
	 * IT OPENS CLOSE. The whole disc was the first framing, and on a screen the whole
	 * disc is a texture: a house is four pixels, and a house is what the reader came in
	 * to see. So the view opens on the block, where a building is a building, and the
	 * edge of the disc and the whole range are a press away rather than the other way
	 * round. A spring rather than a jump, so the eye can follow where it went.
	 */
	const CLOSE = 1;
	const WHOLE = 0;
	const STEP = 0.5;
	let level = $state(CLOSE);
	const camera = new SpringValue(CLOSE, { damping: 1, response: 0.6 });
	$effect(() => () => camera.destroy());

	/* And it can be turned: a drag across the model takes it round the point, one to
	   one under the hand and thrown on release. The sun stays put in the world, so
	   turning the model turns the light on it the way turning a real one would. */
	const spinner = new Spinner(0);
	$effect(() => () => spinner.destroy());

	function zoomTo(next: number) {
		level = Math.max(WHOLE, Math.min(CLOSE, next));
		camera.to(level);
	}
	/* The wheel does what the buttons do, a little at a time. Nothing behind the model
	   scrolls, so there is nothing for the wheel to be taken from. */
	function onWheel(e: WheelEvent) {
		if (e.deltaY === 0) return;
		zoomTo(level - Math.sign(e.deltaY) * 0.2);
	}
	function onZoomKey(e: KeyboardEvent) {
		if (e.key === '+' || e.key === '=') zoomTo(level + STEP);
		else if (e.key === '-' || e.key === '_') zoomTo(level - STEP);
		else return;
		e.preventDefault();
	}

	/** A day at a pace that can be watched: twenty-four hours in eighteen seconds. */
	const HOURS_PER_SECOND = HOURS_IN_DAY / 18;

	/* Jakarta's clock, not the reader's, and it ticks. The doors are in Jakarta, and
	   "now" is the one word on this panel that is a claim about the present. */
	let clock = $state(new Date());
	$effect(() => {
		const tick = setInterval(() => (clock = new Date()), 60_000);
		return () => clearInterval(tick);
	});
	const now = $derived(jakartaNow(clock));

	/* The hour being shown. Opens on Jakarta's hour, which is where the card's own
	   light already stood, so stepping inside changes the frame and not the scene. */
	let hour = $state(jakartaNow().hour);
	let playing = $state(false);
	let slider = $state<HTMLInputElement | null>(null);

	/* Straight into the control that is the point of this view. Without it the first
	   arrow key a keyboard reader presses scrolls the page behind the model. */
	$effect(() => {
		slider?.focus();
	});

	/**
	 * The day, running.
	 *
	 * The loop depends on `playing` alone. Reading `hour` here would make every frame
	 * it writes restart the effect that wrote it, so the hour is carried in a local and
	 * the state is written from it.
	 */
	$effect(() => {
		if (!playing) return;
		let raf = 0;
		let at = untrack(() => hour);
		let last = performance.now();
		const step = (t: number) => {
			// Capped, so a tab that was left in the background does not come back having
			// skipped a day and a half between two frames.
			const dt = Math.min(0.064, (t - last) / 1000);
			last = t;
			at = (at + dt * HOURS_PER_SECOND) % HOURS_IN_DAY;
			hour = at;
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	/* Touching the slider stops the playback rather than fighting it. */
	function scrub(v: number) {
		playing = false;
		hour = v;
	}

	const day = $derived(daylightAt(hour));
	/**
	 * The counted hour the slider is standing inside, which is the only one quoted.
	 *
	 * It is also what the scene is described to a screen reader as, rather than the
	 * exact position: with the day running that description would otherwise be rewritten
	 * sixty times a second.
	 */
	const at = $derived(Math.floor(hour) % HOURS_IN_DAY);

	/* ── what was counted here ─────────────────────────────────────────────── */

	/**
	 * What was counted around the point the range is measured from.
	 *
	 * The same reading `ActivityPanel` draws its chart from, taken from the app rather
	 * than recomputed here: the model and the chart are one measurement looked at two
	 * ways, and this view opens on top of that card. `counted` carries the join's wider
	 * figures and exists only for a cell centre, which is why the silences below check
	 * `readable` where there is none.
	 */
	const reading = $derived(app.hoursReading);
	const readable = $derived(reading?.readable ?? 0);
	const counted = $derived(reading?.counted ?? null);
	/** The rule, from the grid's own metadata rather than typed into a sentence. */
	const minReadable = $derived(app.meta?.hours?.minReadable ?? 0);
	const profile = $derived(weekProfile(app.selectedOpen));
	/** Today in Jakarta. There is no day picker here: the model is one street at one
	    moment, and a reader comparing days has the chart on the card for that. */
	const bars = $derived(profile[now.day] ?? []);
	/**
	 * TODAY's tallest hour, which is what the crowd is drawn against.
	 *
	 * `ActivityPanel` scales its chart to the tallest hour of the WEEK, and it is right
	 * to: a reader flicking between Monday and Sunday there is comparing them, and
	 * per-day scaling would draw every day equally busy at its own peak.
	 *
	 * Nothing is being compared here. This view is one street on one day with no day
	 * picker, so the week's scale bought nothing and cost the model its top end: on a
	 * day quieter than the week's best, the busiest hour drew a street that was still
	 * visibly short of the crowd the card shows for the same place. Against today's own
	 * peak the two agree again, which is what the note above promises they do.
	 */
	const tallest = $derived(Math.max(1, ...bars));

	/** Nothing counted here at all: the catalogue has never read this cell's city. */
	const blank = $derived(row ? !row.covered : false);

	/**
	 * Whether the doors were counted well enough to be shown at all, and if not, which
	 * silence this is.
	 *
	 * One derivation rather than two, so the sentence and the model cannot come apart:
	 * a note on screen always means no door is drawn, and no note always means every
	 * lit mark is a counted door.
	 */
	const tally = $derived.by(() => {
		if (blank) return { counted: false, note: c.zoom.stillNodata };
		// No counts on the grid at all is a build state, not a finding about the place,
		// and a sentence explaining it would be an apology to the wrong reader.
		if (!reading) return { counted: false, note: null };
		if (app.hoursLoading) return { counted: false, note: c.zoom.stillLoading };
		if (app.openPlacesFailed) return { counted: false, note: c.zoom.stillFailed };
		/* Nobody publishing at all, and nothing readable in range, are two different
		   silences and only one of them is provable from each mode. The join counted
		   how many businesses published hours around a cell centre. Around a place all
		   that is known is how many published hours could be read there, so that is what
		   the sentence claims. */
		if (counted ? counted.p === 0 : readable === 0) {
			return { counted: false, note: counted ? c.zoom.stillNone : c.zoom.stillPlaceNone };
		}
		if (readable < minReadable) return { counted: false, note: c.zoom.still(readable) };
		return { counted: true, note: null };
	});

	/** Doors open at the counted hour the slider is standing in. */
	const openHere = $derived(bars[at] ?? 0);
	/**
	 * Where this hour sits in the day, as the reader is scrubbing through it.
	 *
	 * The line above already says how many doors are open. What it cannot say is whether
	 * that is a lot for this street, which is the whole question somebody dragging the
	 * slider is asking. Said against the street's own busiest hour rather than against
	 * any other place, because the doors were counted here and nowhere else.
	 *
	 * Nothing at all at an hour with nothing open: the count beside it is already "0 of
	 * 13", and a second sentence saying zero per cent of the peak is the same fact in a
	 * worse form.
	 */
	const standing = $derived.by(() => {
		if (!tally.counted || openHere === 0) return null;
		if (openHere >= tallest) return c.zoom.peakHour;
		return c.zoom.share(Math.round((openHere / tallest) * 100));
	});

	/** The same marks with no doors on them, for the hours nobody counted. */
	const bare = $derived(app.areaMarks ? { ...app.areaMarks, doors: [] } : null);

	/* ── words ─────────────────────────────────────────────────────────────── */

	const body = $derived(
		blank
			? c.mood.sceneNodata
			: !row
				? ''
				: row.score === null
					? c.mood.sceneNoType(row.density, row.units)
					: c.mood.sceneBody(row.density, row.osm, catMany, row.units)
	);

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			app.zoomed = false;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		onKey(e);
		onZoomKey(e);
	}}
	onwheel={onWheel}
/>

{#if row}
	<div
		class="zoom"
		role="dialog"
		aria-modal="true"
		aria-label={c.zoom.title(row.name)}
		style:--ink={day.ink}
		style:--ink-muted={day.inkMuted}
	>
		<!-- The doors follow the timetables only where they were counted well enough to
		     say anything: below the threshold, or with the file missing, no door is drawn
		     and the note under the slider says so. -->
		<AreaScene
			{hour}
			day={now.day}
			cameraT={camera.current}
			nodata={blank}
			{radius}
			geometry={app.areaReady}
			marks={tally.counted ? app.areaMarks : bare}
			label={c.zoom.sceneLabel(row.name, at, body)}
			{spinner}
		/>

		<!-- The same treatment the landing stage uses: the text is always light, over a
		     scrim that thickens as the sky brightens. One reading at midday and at
		     midnight, rather than two sets of colours that swap at some hour. -->
		<div class="scrim" style:--scrim={day.scrim} aria-hidden="true"></div>

		<div class="top">
			<div class="who">
				<h2>{row.name}</h2>
				<p class="mark">{c.app.model[app.areaStatus]}</p>
			</div>
			<button type="button" class="close" onclick={() => (app.zoomed = false)}>
				<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
					<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
				</svg>
				<span>{c.zoom.close}</span>
			</button>
		</div>

		<!-- The clock reads the hour on the slider, not the reader's own. It is the one
		     number on screen that the light is actually a function of. -->
		<div class="clock">
			<span class="time">{c.zoom.clock(hour)}</span>
			<span class="phase">{c.phase[day.phase]}</span>
		</div>

		<!-- Closer, or out to the whole range. Away from the slider, because the slider
		     is about the hour and this is about where the reader is standing. -->
		<div class="steps">
			<button
				type="button"
				class="step"
				onclick={() => zoomTo(level + STEP)}
				disabled={level >= CLOSE}
				aria-label={c.zoom.closer}
				title={c.zoom.closer}
			>
				<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
					<path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
				</svg>
			</button>
			<button
				type="button"
				class="step"
				onclick={() => zoomTo(level - STEP)}
				disabled={level <= WHOLE}
				aria-label={c.zoom.farther}
				title={c.zoom.farther}
			>
				<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
					<path d="M2.5 7h9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<div class="dock">
			<p class="read">
				{#if tally.note}
					{tally.note}
				{:else if reading}
					{c.zoom.doors(c.activity.dayFull[now.day], at, openHere, readable)}
					{#if standing}<span class="standing">{standing}</span>{/if}
				{/if}
			</p>

			<div class="scrubber">
				<button
					type="button"
					class="play"
					aria-pressed={playing}
					aria-label={playing ? c.zoom.pause : c.zoom.play}
					onclick={() => (playing = !playing)}
				>
					{#if playing}
						<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
							<path d="M3.5 2.5h2.6v9H3.5zM7.9 2.5h2.6v9H7.9z" fill="currentColor" />
						</svg>
					{:else}
						<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">
							<path d="M4 2.4l7.4 4.6L4 11.6z" fill="currentColor" />
						</svg>
					{/if}
				</button>

				<div class="track">
					<!-- The day the crowd is following, drawn over the control that moves
					     through it.

					     The crowd in the model answers this shape, and at the size a person
					     is drawn at across a whole block that answer is easy to miss: a
					     street can lose two thirds of its figures between four in the
					     morning and ten and still look like the same picture at a glance.
					     Here the same fact is a shape, and the lit column says where the
					     reader is standing in it.

					     Only where the doors were counted. There is no curve otherwise, and
					     drawing a flat row of stubs would be a claim that every hour is
					     alike rather than that nobody looked. -->
					{#if tally.counted}
						<div class="curve" aria-hidden="true">
							{#each bars as n, h (h)}
								<span
									class="bar"
									class:on={h === at}
									style:height={`${Math.max(2, Math.round((n / tallest) * 100))}%`}
								></span>
							{/each}
						</div>
					{/if}
					<input
						bind:this={slider}
						type="range"
						min="0"
						max={HOURS_IN_DAY}
						step="0.25"
						value={hour}
						oninput={(e) => scrub(Number(e.currentTarget.value))}
						aria-label={c.zoom.hourAria}
						aria-valuetext={c.zoom.hourValue(hour)}
					/>
					<div class="ticks" aria-hidden="true">
						{#each [0, 6, 12, 18, 24] as t (t)}
							<span>{c.activity.hourShort(t % HOURS_IN_DAY)}</span>
						{/each}
					</div>
				</div>

				<!-- Back to Jakarta's hour, which is where this opened. A reader who has
				     scrubbed to four in the morning has no other way of finding it again. -->
				<button
					type="button"
					class="now"
					aria-label={c.zoom.nowAria}
					onclick={() => scrub(now.hour)}
				>
					{c.zoom.now}
				</button>
			</div>

			<p class="basis">
				{#if tally.counted}
					{c.zoom.basis()}
				{:else}
					{c.zoom.hint}
				{/if}
			</p>
		</div>
	</div>
{/if}

<style>
	.zoom {
		position: fixed;
		inset: 0;
		/* Over every floating surface, including the compact layout's sheet, which is
		   itself at 20. */
		z-index: 30;
		overflow: hidden;
		background: var(--bg-base);
	}

	.scrim {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(
				to top,
				rgba(0, 0, 0, calc(var(--scrim) * 1.1)) 0%,
				rgba(0, 0, 0, calc(var(--scrim) * 0.5)) 28%,
				transparent 52%
			),
			linear-gradient(to bottom, rgba(0, 0, 0, calc(var(--scrim) * 0.7)) 0%, transparent 22%);
	}

	.top {
		position: absolute;
		top: clamp(0.75rem, 2.5vh, 1.5rem);
		left: clamp(0.75rem, 3vw, 2rem);
		right: clamp(0.75rem, 3vw, 2rem);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		color: var(--ink);
	}
	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.125rem, 2.4vw, 1.75rem);
		font-weight: 620;
		letter-spacing: -0.025em;
		line-height: 1.1;
		margin: 0;
	}
	.mark {
		margin-top: 0.25rem;
		font-size: 0.625rem;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}

	.close {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 0;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.42);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--ink);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 550;
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out;
	}
	.close:hover {
		background: rgba(0, 0, 0, 0.58);
	}
	.close:active {
		transform: scale(0.96);
	}

	/* The two steps, mid-height at the edge, in the close button's material. */
	.steps {
		position: absolute;
		right: clamp(0.75rem, 3vw, 2rem);
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	.step {
		display: grid;
		place-items: center;
		width: 2.125rem;
		height: 2.125rem;
		border: 0;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.42);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--ink);
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out,
			opacity 140ms ease-out;
	}
	.step:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.58);
	}
	.step:active:not(:disabled) {
		transform: scale(0.94);
	}
	/* At either end the step that cannot go further stays, faded, so the pair keeps
	   its shape and the reader can see which way is left. */
	.step:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.clock {
		position: absolute;
		top: clamp(3.75rem, 12vh, 6.5rem);
		right: clamp(0.75rem, 3vw, 2rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		color: var(--ink);
		text-align: right;
		pointer-events: none;
	}
	.time {
		font-family: var(--font-display);
		font-size: clamp(2rem, 4.4vw, 3.25rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 0.9;
		font-variant-numeric: tabular-nums;
	}
	.phase {
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	/* The one panel with a background of its own. A slider drawn straight onto the
	   scene is unreadable at exactly the hours worth looking at, and this is the
	   control the whole view exists for. */
	.dock {
		position: absolute;
		left: 50%;
		bottom: clamp(0.75rem, 3vh, 1.75rem);
		transform: translateX(-50%);
		width: min(38rem, calc(100vw - 1.5rem));
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 0.875rem 0.625rem;
		border-radius: var(--r-xl);
		background: rgba(0, 0, 0, 0.42);
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		color: var(--ink);
	}
	.read {
		font-size: 0.8125rem;
		line-height: 1.5;
		min-height: 1.25rem;
	}
	.basis {
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--ink-muted);
	}

	.scrubber {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.play,
	.now {
		flex: none;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out;
	}
	.play {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
	}
	.now {
		padding: 0.3125rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 550;
	}
	.play:hover,
	.now:hover {
		background: rgba(255, 255, 255, 0.24);
	}
	.play:active,
	.now:active {
		transform: scale(0.94);
	}

	.track {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}
	input[type='range'] {
		width: 100%;
		margin: 0;
		/* The one colour in this view that is not the hour's: the handle has to be
		   findable against a sky that runs from black to white behind it. */
		accent-color: var(--ink);
		cursor: pointer;
	}
	.ticks {
		display: flex;
		justify-content: space-between;
		font-size: 0.5625rem;
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
	}

	/* The day, over the slider that runs through it. Drawn in the hour's own ink so it
	   stays readable against a sky that goes from black to white behind the dock. */
	.curve {
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		align-items: end;
		gap: 1px;
		height: 1.75rem;
		margin-bottom: 0.1875rem;
	}
	.bar {
		border-radius: 1.5px 1.5px 0 0;
		background: color-mix(in srgb, var(--ink) 38%, transparent);
	}
	/* The hour the slider is standing in. Full strength against the rest, because this
	   is the one column the model on screen is drawn from. */
	.bar.on {
		background: var(--ink);
	}

	/* The second half of the reading, in the quieter ink: the count comes first, and
	   this is what the count means for this street. */
	.standing {
		color: var(--ink-muted);
	}

	@media (max-width: 720px) {
		/* The clock stays at the top with the name and the way out. It was tried against
		   the bottom edge, above the dock, and the dock is exactly the element whose
		   height cannot be predicted: three lines of a sentence explaining a silence and
		   the numerals are behind it. */
		.time {
			font-size: 2.25rem;
		}
	}
</style>
