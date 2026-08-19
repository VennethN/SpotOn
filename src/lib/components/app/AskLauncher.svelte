<script lang="ts">
	/**
	 * The starting point: one question box in the middle of the screen.
	 *
	 * Before anything has been asked there is nothing for a side panel to hold, so
	 * none is shown. What appears is a single question and a single field, centred,
	 * where the eye already is. Once it is used, this box flies right and becomes the
	 * conversation panel — leaving along a path the eye can follow rather than
	 * vanishing here and reappearing somewhere else.
	 *
	 * The examples do two things at once. Inside the field they type themselves out
	 * and clear again, which teaches the SHAPE of a question — something the old row
	 * of business-type chips never did, because a chip names a noun and leaves the
	 * reader still guessing what kind of sentence the box accepts. Below the field
	 * the same four sit as short buttons, so nobody has to type to get started.
	 *
	 * One list feeds both, so a button can never send a question different from the
	 * one it offered.
	 */
	import { onMount } from 'svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { CATEGORIES } from '$lib/domain/categories';
	import { copy, lang } from '$lib/state/lang.svelte';
	import type { Tapak } from '$lib/state/tapak.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { GridMeta } from '$lib/types';

	let { tapak, meta, onskip }: { tapak: Tapak; meta: GridMeta; onskip: () => void } = $props();

	const c = $derived(copy());
	const n = $derived((v: number) => v.toLocaleString(lang() === 'en' ? 'en-GB' : 'id-ID'));

	/**
	 * How thick the evidence is, in four figures.
	 *
	 * Every one is read from the grid file's own metadata, so rebuilding the grid
	 * moves them and nobody has to remember. The competitor count takes whichever
	 * source is larger: MAPID's premium join covers all thirteen categories across
	 * the five Jakarta cities, OSM covers nine — quoting the smaller one would
	 * understate what the map is actually reading.
	 */
	const stats = $derived([
		{ v: n(meta.hexes), l: c.app.launchStats.hexes },
		{ v: n(meta.stops), l: c.app.launchStats.stops },
		{ v: n(Math.max(meta.mapid?.points ?? 0, meta.pois)), l: c.app.launchStats.pois },
		{ v: String(CATEGORIES.length), l: c.app.launchStats.cats }
	]);

	let draft = $state('');
	let field = $state<HTMLInputElement | null>(null);

	/**
	 * The box is inviting a question: nothing is being worked out, and nothing has
	 * been typed. An empty field is still actionable here, because the example on show
	 * is what an empty field sends, so the glow is honest about what pressing the
	 * arrow would do.
	 */
	const inviting = $derived(!tapak.busy && !draft.trim());

	/** The example being shown in full — what an empty field submits. */
	let suggestion = $state('');
	/** How much of it is typed out so far. This is the placeholder. */
	let typed = $state('');

	/**
	 * Type it, hold it, take it back, move to the next.
	 *
	 * Deliberately not a loop of CSS animations: the text differs per language and
	 * per example, so the timing has to follow the string rather than a fixed
	 * duration. Under reduced motion the first example is simply shown, still whole
	 * and still submittable — the information survives, only the movement goes.
	 */
	$effect(() => {
		const list = c.app.launchSuggestions.map((s) => s.ask);
		if (!list.length) return;

		if (prefersReducedMotion()) {
			suggestion = list[0];
			typed = list[0];
			return;
		}

		let i = 0;
		let at = 0;
		let erasing = false;
		let timer: ReturnType<typeof setTimeout>;

		const step = () => {
			const full = list[i];
			suggestion = full;
			at += erasing ? -1 : 1;
			typed = full.slice(0, Math.max(0, at));

			if (!erasing && at >= full.length) {
				erasing = true;
				// Long enough to read the whole sentence, not long enough to feel stuck.
				timer = setTimeout(step, 2000);
				return;
			}
			if (erasing && at <= 0) {
				erasing = false;
				i = (i + 1) % list.length;
				timer = setTimeout(step, 360);
				return;
			}
			// Erasing runs faster than typing, the way a real correction does.
			timer = setTimeout(step, erasing ? 18 : 38);
		};

		timer = setTimeout(step, 600);
		return () => clearTimeout(timer);
	});

	// Autofocus only where the pointer is fine. On a touch screen, forcing focus
	// summons the keyboard and swallows half the map before the user has decided
	// whether to type at all.
	onMount(() => {
		if (window.matchMedia('(pointer: fine)').matches) field?.focus();
	});

	function send(e: SubmitEvent) {
		e.preventDefault();
		// An empty field sends the example on show, not the half-typed placeholder:
		// pressing the arrow means "ask that", and half a question is not that.
		ask(draft.trim() || suggestion);
	}

	function ask(question: string) {
		if (!question) return;
		tapak.submit(question);
		draft = '';
	}
</script>

<div class="launcher material">
	<!-- While an answer is being worked out the figure paces: a few steps one way, a
	     turn, a few steps back. It is the same figure that will do the answering, so
	     the wait is Tapak thinking rather than a machine being busy. -->
	<span class="face" aria-hidden="true"><TapakFigure size={40} pacing={tapak.busy} /></span>

	<h1>{c.app.launchTitle}</h1>

	<form onsubmit={send} class:inviting>
		<!-- Two elements, one light. The inner span breathes forever, the outer one
		     fades that breathing in and out. Both eased, so the glow never arrives or
		     leaves on a single frame. -->
		<span class="glow" aria-hidden="true"><span class="pulse"></span></span>
		<input
			bind:this={field}
			bind:value={draft}
			placeholder={typed}
			aria-label={c.app.askAria}
			disabled={tapak.busy}
		/>
		<button
			type="submit"
			class="go"
			disabled={tapak.busy || (!draft.trim() && !suggestion)}
			aria-label={c.app.askSend}
		>
			<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
				<path
					d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	</form>

	<!-- No heading over these. A row of four short pills directly under a question
	     field is already unmistakably a set of suggestions; a label saying so would
	     only be a line of text earning nothing. -->
	<ul class="picks">
		{#each c.app.launchSuggestions as s (s.short)}
			<li>
				<button type="button" onclick={() => ask(s.ask)} disabled={tapak.busy} title={s.ask}>
					{s.short}
				</button>
			</li>
		{/each}
	</ul>

	<!-- The figures sit last on purpose. They are the reason to trust the answer, not
	     the reason to start — so they must not stand between the question and the
	     field where it gets typed. -->
	<dl class="stats">
		{#each stats as s (s.l)}
			<div>
				<dt>{s.v}</dt>
				<dd>{s.l}</dd>
			</div>
		{/each}
	</dl>

	<!-- The way past. Not everyone arrives with a question, and someone who wants to
	     look around first should not have to invent one to get at the map. Small and
	     last, because asking is still the way this is meant to be used, and quiet
	     enough that it does not compete with the field above it. -->
	<button type="button" class="skip" onclick={onskip}>{c.app.launchSkip}</button>
</div>

<style>
	.launcher {
		width: min(32rem, calc(100vw - 1.5rem));
		padding: 1.5rem 1.375rem 1.25rem;
		border-radius: var(--r-xl);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		box-shadow: var(--shadow-sheet);
		text-align: center;
	}
	.face {
		display: flex;
		justify-content: center;
		margin-bottom: 0.75rem;
	}

	h1 {
		/* Size up, tracking in, leading tightened. */
		font-size: clamp(1.3125rem, 3.4vw, 1.75rem);
		font-weight: 650;
		letter-spacing: -0.026em;
		line-height: 1.1;
	}

	form {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 1.125rem;
		padding: 0.3125rem 0.3125rem 0.3125rem 0.5rem;
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		background: var(--bg-elevated);
		transition: border-color 420ms ease-in-out;
	}
	form:focus-within {
		border-color: var(--accent);
	}
	form.inviting {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--separator-strong));
	}

	/* Just outside the field's own edge, and never takes a pointer: it is a light, not
	   a control. */
	.glow {
		position: absolute;
		inset: -1px;
		border-radius: 999px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 520ms ease-in-out;
	}
	form.inviting .glow {
		opacity: 1;
	}
	.pulse {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			0 0 0 4px var(--accent-soft),
			0 0 20px 2px color-mix(in srgb, var(--accent) 30%, transparent);
		animation: breathe-glow 3.2s ease-in-out infinite;
	}
	/* Eased at both ends, so the light swells and settles rather than switching. */
	@keyframes breathe-glow {
		0%,
		100% {
			opacity: 0.32;
		}
		50% {
			opacity: 1;
		}
	}

	/* Reduced motion keeps the signal and drops the movement: the box still says it is
	   ready, it just says it by holding still. */
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0.7;
		}
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: none;
		padding: 0.375rem 0.5rem;
		font-size: 0.9375rem;
		letter-spacing: -0.006em;
		/* The example is text being written, so it reads left-aligned even though the
		   card around it is centred. */
		text-align: left;
	}
	input:focus {
		outline: none;
	}
	input:disabled {
		opacity: 0.6;
	}
	/* One line, always. A long example must not wrap the field into two rows halfway
	   through typing itself. */
	input::placeholder {
		color: var(--label-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: clip;
	}
	.go {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.875rem;
		height: 1.875rem;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			opacity 140ms ease-out;
	}
	/* Feedback on the press, not on the release. */
	.go:active:not(:disabled) {
		transform: scale(0.9);
	}
	.go:disabled {
		opacity: 0.35;
		cursor: default;
	}

	/* Quieter than the chips they replace: no fill, a hairline border, and text one
	   step down. They are a way in, not the point of the card — the field above is. */
	.picks {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.375rem;
	}
	.picks button {
		border: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		border-radius: 999px;
		padding: 0.25rem 0.6875rem;
		font-size: 0.75rem;
		letter-spacing: 0.002em;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 140ms ease-out,
			border-color 140ms ease-out,
			color 140ms ease-out,
			transform 100ms ease-out;
	}
	.picks button:hover:not(:disabled) {
		background: var(--fill-1);
		border-color: var(--separator-strong);
		color: var(--label-1);
	}
	/* Feedback on the press, not on the release. */
	.picks button:active:not(:disabled) {
		transform: scale(0.95);
	}
	.picks button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	/* A title block, like the corner of a drawing sheet: figures light and large,
	   labels small and quiet, hairlines doing the dividing rather than boxes. */
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 1.375rem 0 0;
		padding-top: 0.875rem;
		border-top: 1px solid var(--separator);
	}

	/* Deliberately the quietest thing on the card: a text button, no fill, no border.
	   It is a way out, not an offer. */
	.skip {
		margin-top: 0.875rem;
		border: 0;
		background: none;
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
		transition:
			color 140ms ease-out,
			background-color 140ms ease-out;
	}
	.skip:hover {
		color: var(--label-1);
		background: var(--fill-1);
	}
	.stats > :global(div) {
		padding-inline: 0.375rem;
		border-left: 1px solid var(--separator);
	}
	.stats > :global(div:first-child) {
		border-left: 0;
	}
	.stats dt {
		/* Large figure: light weight, tracking in, lining figures so the columns align. */
		font-size: 1.0625rem;
		font-weight: 400;
		letter-spacing: -0.022em;
		line-height: 1.1;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.stats dd {
		margin: 0.1875rem 0 0;
		/* Small text: tracking out a little, so it stays legible against the material. */
		font-size: 0.625rem;
		line-height: 1.3;
		letter-spacing: 0.012em;
		color: var(--label-3);
		text-wrap: balance;
	}

	/* Four columns of figures do not survive a phone. Two rows of two keep every
	   label on one or two lines instead of breaking mid-word. */
	@media (max-width: 30rem) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
			row-gap: 0.75rem;
		}
		.stats > :global(div:nth-child(3)) {
			border-left: 0;
		}
	}
</style>
