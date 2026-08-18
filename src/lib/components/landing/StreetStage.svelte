<script lang="ts">
	/**
	 * The landing page's scroll stage.
	 *
	 * The canvas is sticky for several screens, and the scroll position drives two
	 * things at once: the camera moves along the corridor, and the light runs forward
	 * from the visitor's machine hour, one full turn, back to the same hour.
	 *
	 * WHAT THE SCENE CLAIMS, AND WHAT IT DOES NOT
	 *
	 * The crowd thins and thickens as the clock turns, because a street that holds the
	 * same number of figures at 03.00 and at 19.00 is not a street. That rise and fall is
	 * ILLUSTRATION and is labelled as such on screen: a morning shoulder, a midday rise,
	 * an evening peak, the small hours empty. It is not a reading, and no number is put
	 * on it.
	 *
	 * What IS a reading is its ceiling. The scene never gets busier than the cell it
	 * stands in deserves: the crowd is scaled by that cell's real share of the busiest
	 * cell on the grid, and the figure printed beside the clock is that cell's own count
	 * of businesses within walking range.
	 *
	 * The version before this drove the crowd off a 24-hour profile of receipts for the
	 * Bundaran HI catchment and printed "142 receipts at this hour" under it. That
	 * profile was generated hour by hour by a random number generator. The shape stays,
	 * the claim goes.
	 *
	 * Two things were fixed from the previous version, both about pacing:
	 *
	 * 1. **A day no longer passes in one push.** 18 hours used to be compressed into
	 *    a third of a track only 1.4 screens long — one flick of a thumb and the sun
	 *    had already set. Now one day takes almost the entire track on a stage that is
	 *    far longer.
	 * 2. **The day does not repeat.** Past midnight the clock used to keep running
	 *    on to the next midday, so the sun rose twice in a single scroll and what read
	 *    was a repetition, not one day.
	 *
	 * The mapping is still non-linear: some stretches hold so the reader has time to
	 * read, others move along calmly.
	 */
	import StreetScene from '$lib/components/ui/StreetScene.svelte';
	import { daylightAt, localHour } from '$lib/scene/daylight';
	import { formatHour } from '$lib/utils/format';
	import { copy } from '$lib/state/lang.svelte';
	import { SpringValue, prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { CategoryKey } from '$lib/types';

	/** One real cell, counted by the server. Every figure the scene shows comes from here. */
	export interface StageCell {
		name: string;
		/** Businesses of any kind within walking range. */
		businesses: number;
		/** Of those, the ones of the category on stage. */
		rivals: number;
		/** Premises on the market within the same range. */
		units: number;
		/** Its business count against the busiest cell on the grid, 0..1. */
		share: number;
	}

	interface Props {
		category?: CategoryKey;
		cell: StageCell;
	}
	let { category = 'kopi' as CategoryKey, cell }: Props = $props();

	const c = $derived(copy());

	/**
	 * The shape of a day on a trading street, 0..1. Illustration, not measurement.
	 *
	 * Three humps and a floor: the morning going to work, the middle of the day, the
	 * evening coming back. Written as arithmetic rather than as a stored table so that
	 * nobody can mistake it for a dataset, and so it cannot be quoted as one.
	 */
	function dayShape(h: number): number {
		const at = ((h % 24) + 24) % 24;
		const hump = (centre: number, width: number, height: number) =>
			Math.exp(-((at - centre) ** 2) / width) * height;
		const night = at >= 1 && at <= 4 ? 0 : 0.06;
		return Math.max(0, Math.min(1, hump(7.5, 5, 0.55) + hump(12.5, 7, 0.78) + hump(19, 8, 1) + night));
	}

	const START_HOUR = localHour();
	const reduced = prefersReducedMotion();

	/* A full day, once, always forward. It ends at the same hour the page was opened
	   — the visitor comes back to their own time, and the lot next to the cafe is
	   still empty. */
	const DAY = 24;

	let host = $state<HTMLElement | null>(null);
	let progress = $state(0);

	// A spring: raw scroll feels jittery, a spring gives the camera and sun some mass.
	const hourSpring = new SpringValue(START_HOUR, { damping: 1, response: 0.75 });
	const camSpring = new SpringValue(0, { damping: 1, response: 0.85 });

	/* Scroll mapping → (hour, camera). Each segment has its own speed. */
	function mapProgress(p: number) {
		if (p < 0.1) {
			// holding: the visitor's machine hour, camera still
			return { hour: START_HOUR, cam: 0 };
		}
		if (p < 0.8) {
			// one full turn, unhurried — this is the longest stretch of the track
			const t = (p - 0.1) / 0.7;
			return { hour: START_HOUR + t * DAY, cam: t * 0.78 };
		}
		// back to the starting hour; all that is left is the camera closing in on the empty lot
		const t = (p - 0.8) / 0.2;
		return { hour: START_HOUR + DAY, cam: 0.78 + t * 0.22 };
	}

	$effect(() => {
		if (!host) return;
		const el = host;

		const onScroll = () => {
			const rect = el.getBoundingClientRect();
			const total = rect.height - window.innerHeight;
			const p = total <= 0 ? 0 : Math.max(0, Math.min(1, -rect.top / total));
			progress = p;
			const m = mapProgress(p);
			hourSpring.to(m.hour);
			camSpring.to(m.cam);
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	const hour = $derived(reduced ? 19 : hourSpring.current);
	const day = $derived(daylightAt(hour));
	/* The illustrated day, held under the ceiling this cell's own count sets. */
	const density = $derived(dayShape(hour) * cell.share);

	// This hour's ink is broadcast to :root so the chrome floating over the scene (the
	// nav bar) changes with the sky rather than using a theme token that happens to be
	// dark while the scene is blazing bright.
	$effect(() => {
		const el = document.documentElement;
		el.style.setProperty('--stage-ink', day.ink);
		el.style.setProperty('--stage-ink-muted', day.inkMuted);
		el.style.setProperty('--stage-ink-inverse', day.inkInverse);
		return () => {
			el.style.removeProperty('--stage-ink');
			el.style.removeProperty('--stage-ink-muted');
			el.style.removeProperty('--stage-ink-inverse');
		};
	});

	// The text panels appear and leave over their own scroll ranges.
	function band(p: number, a: number, b: number, fade = 0.06) {
		if (p < a - fade || p > b + fade) return 0;
		if (p < a) return (p - (a - fade)) / fade;
		if (p > b) return 1 - (p - b) / fade;
		return 1;
	}
	const showHero = $derived(band(progress, 0, 0.09));
	const showDay = $derived(band(progress, 0.18, 0.52));
	const showLot = $derived(band(progress, 0.66, 1));
</script>

<section class="stage" bind:this={host} style:--ink={day.ink} style:--ink-muted={day.inkMuted}>
	<div class="sticky">
		<StreetScene
			{hour}
			{density}
			{category}
			cameraT={camSpring.current}
			rivals={cell.rivals}
			vacancies={cell.units}
			label={c.stage.sceneLabel(cell.name, cell.businesses, cell.rivals)}
		/>

		<div class="scrim" style:--scrim={day.scrim}></div>

		<!-- The one element always present, because it is what explains the scene. The
		     clock is the light and says so: the reading beside it is a count of what
		     stands around this cell, and it does not move with the sun.
		
		     A fourth line used to sit here saying the crowd was an illustration and the
		     figure a real count. It was true and it was in the wrong place: four lines
		     stacked in a corner is a footnote, and the section this scene belongs to
		     makes the same point in full a moment later ("Bukan dari firasat dan bukan
		     dari survei yang belum pernah ada"). The scene's own label carries it too,
		     for a reader who never sees the corner at all. -->
		<div class="clock">
			<span class="time">{formatHour(hour)}</span>
			<span class="phase">{c.phase[day.phase]}</span>
			<span class="reading">{c.stage.reading(cell.name, cell.businesses)}</span>
		</div>

		<div class="copy hero" style:opacity={showHero} aria-hidden={showHero < 0.5}>
			<h1>{c.stage.heroTitle}</h1>
			<p>{c.stage.heroBody}</p>
			<div class="cta">
				<a class="go" href="/app" style:--btn-ink={day.inkInverse}>{c.brand.open}</a>
				<span class="hint">{c.stage.heroHint}</span>
			</div>
		</div>

		<div class="copy mid" style:opacity={showDay} aria-hidden={showDay < 0.5}>
			<h2>{c.stage.dayTitle}</h2>
			<p>{c.stage.dayBody}</p>
		</div>

		<div class="copy mid" style:opacity={showLot} aria-hidden={showLot < 0.5}>
			<h2>{c.stage.lotTitle}</h2>
			<p>{c.stage.lotBody}</p>
			<span class="prov">{c.stage.lotProv}</span>
		</div>
	</div>
</section>

<style>
	.stage {
		position: relative;
		/* This height is what decides how long a day lasts. At 480vh, 24 hours passed in
		   ±1.4 screens; here each screen of scroll is roughly five hours, and the sun is
		   actually seen to move. */
		height: 760vh;
	}
	.sticky {
		position: sticky;
		top: 0;
		height: 100svh;
		overflow: hidden;
	}
	.scrim {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* Only the corner the text sits in is dimmed; the corridor down the middle stays bright. */
		background:
			linear-gradient(
				to top,
				rgba(0, 0, 0, calc(var(--scrim) * 1.05)) 0%,
				rgba(0, 0, 0, calc(var(--scrim) * 0.45)) 22%,
				transparent 46%
			),
			linear-gradient(to right, rgba(0, 0, 0, calc(var(--scrim) * 0.5)) 0%, transparent 34%),
			linear-gradient(to bottom, rgba(0, 0, 0, calc(var(--scrim) * 0.5)) 0%, transparent 16%),
			/* the clock sits against a bright sky; without this the numbers are white on white */
			radial-gradient(
				120% 70% at 100% 0%,
				rgba(0, 0, 0, calc(var(--scrim) * 0.92)) 0%,
				transparent 58%
			);
	}

	.clock {
		position: absolute;
		/* below the nav bar, not behind it */
		top: clamp(4.25rem, 9vh, 6rem);
		right: clamp(1rem, 4vw, 3rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		color: var(--ink);
		text-align: right;
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
	.reading {
		margin-top: 0.35rem;
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--ink-muted);
		max-width: 16ch;
	}
	.copy {
		position: absolute;
		left: clamp(1rem, 5vw, 4.5rem);
		bottom: clamp(2.5rem, 9vh, 5.5rem);
		max-width: min(33rem, 76vw);
		color: var(--ink);
		transition: opacity 220ms ease-out;
	}
	.copy p {
		margin-top: 0.75rem;
		font-size: clamp(0.875rem, 1.25vw, 1rem);
		line-height: 1.55;
		color: var(--ink-muted);
		max-width: 42ch;
	}

	h1 {
		/* The heading breaks itself via newlines in the copy rather than via <br>:
		   the break points differ per language. */
		white-space: pre-line;
		font-family: var(--font-display);
		font-size: clamp(2.25rem, 5.6vw, 4.5rem);
		font-weight: 620;
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: balance;
		margin: 0;
	}
	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3.1vw, 2.5rem);
		font-weight: 600;
		line-height: 1.06;
		letter-spacing: -0.028em;
		text-wrap: balance;
		margin: 0;
		max-width: 20ch;
	}

	.cta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}
	.go {
		display: inline-flex;
		align-items: center;
		background: var(--ink);
		color: var(--btn-ink, #0e1118);
		border-radius: 999px;
		padding: 0.6rem 1.4rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 620;
		letter-spacing: -0.01em;
		text-decoration: none;
		transition:
			transform 120ms cubic-bezier(0.22, 0.61, 0.24, 1),
			filter 180ms ease-out;
	}
	.go:hover {
		transform: translateY(-1px);
		filter: brightness(1.08);
	}
	.go:active {
		transform: scale(0.97);
	}
	.hint {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}
	.prov {
		display: block;
		margin-top: 1rem;
		font-size: 0.66rem;
		letter-spacing: 0.05em;
		color: var(--ink-muted);
	}

	@media (max-width: 720px) {
		.copy {
			max-width: none;
			right: clamp(1rem, 5vw, 4.5rem);
		}
		.clock .reading {
			display: none;
		}
		/* On a narrow screen the text takes almost half the height, so the scrim has to
		   rise that far too — otherwise the top line sits over a bright backdrop. */
		.scrim {
			background:
				linear-gradient(
					to top,
					rgba(0, 0, 0, calc(var(--scrim) * 1.15)) 0%,
					rgba(0, 0, 0, calc(var(--scrim) * 0.85)) 34%,
					transparent 66%
				),
				linear-gradient(to bottom, rgba(0, 0, 0, calc(var(--scrim) * 0.7)) 0%, transparent 20%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage {
			height: auto;
		}
		.sticky {
			position: relative;
			height: 88svh;
		}
		.copy {
			position: relative;
			opacity: 1 !important;
			left: auto;
			bottom: auto;
		}
	}
</style>
