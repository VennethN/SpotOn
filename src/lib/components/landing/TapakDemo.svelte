<script lang="ts">
	/**
	 * A conversation with Tapak, playing itself on the landing page.
	 *
	 * The questions are predetermined — the answers are not. Every list of places and
	 * every sentence here is computed by `runQuery` on the server from the same data
	 * the app uses, through the same narration module. So what the visitor watches is
	 * genuinely what they will find, not an advert someone made up.
	 *
	 * Three things keep it from being annoying:
	 *
	 * - **It can be grabbed.** Tapping a business type moves the conversation there
	 *     at once; there is a pause button; and the scroll is never hijacked.
	 * - **Silent when unwatched.** Off screen or in another tab, the player stops —
	 *     this page gets opened on mid-range phones with limited data.
	 * - **It does not force motion.** With `prefers-reduced-motion`, the whole
	 *     conversation is shown at once and nothing runs on its own.
	 */
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import { pct } from '$lib/utils/format';
	import type { CategoryKey } from '$lib/types';

	export interface DemoResult {
		name: string;
		value: number | null;
	}
	export interface DemoSet {
		id: string;
		category: CategoryKey;
		/** The business type, for the map's caption. Not spoken as a turn. */
		choice: string;
		/** The whole question, asked in one go. */
		question: string;
		captured: string[];
		sentence: string;
		results: DemoResult[];
		more: number;
	}

	interface Props {
		sets: DemoSet[];
		greeting: string;
		/**
		 * Called whenever the conversation moves, so the map beside it can follow.
		 *
		 * The map is a sibling rather than a child because it is the bigger half of the
		 * section: this panel is the question, the map is the answer, and nesting the
		 * answer inside the question would size the answer to the question's column.
		 */
		onstep?: (state: { index: number; answered: boolean }) => void;
	}
	let { sets, greeting, onstep }: Props = $props();

	const c = $derived(copy());

	/**
	 * Four steps: greeting, the question, a moment of work, the answer.
	 *
	 * It used to be seven. The reader named a business type, Tapak asked back about
	 * rent, the reader answered that, Tapak repeated it, then thought, then answered —
	 * a courteous exchange that took the better part of half a minute before saying
	 * anything. On a landing page nobody waits that long to find out what a product
	 * does, and the back-and-forth was demonstrating the manner rather than the work.
	 *
	 * So the question is asked whole, the way somebody who knows what they want would
	 * type it, and the answer follows. The app still has the conversation; this is the
	 * trailer, not the film.
	 */
	const LAST = 3;
	/** How long each step is held, in ms. Only the answer is held long enough to read. */
	const BEAT = [1100, 900, 560, 6200];

	const reduced = prefersReducedMotion();

	let i = $state(0);
	let step = $state(reduced ? LAST : 0);
	let playing = $state(!reduced);
	/**
	 * On screen, and in a tab somebody is looking at. Two flags rather than one, and
	 * that is a fix rather than a refinement: they used to share a variable, and the
	 * visibility handler could only ever clear it. Once the tab had been hidden the
	 * conversation stopped for good, and nothing short of scrolling it out of view and
	 * back would start it again.
	 */
	let inView = $state(false);
	let visible = $state(true);
	let host = $state<HTMLElement | null>(null);

	const set = $derived(sets[i] ?? sets[0]);

	/* Reported rather than read from outside, so there is one clock: the conversation
	   decides when an answer has landed and everything else in the section follows it. */
	$effect(() => {
		onstep?.({ index: i, answered: step >= LAST });
	});

	// The player: a single timer taking turns, not an interval running continuously.
	// It is re-armed each step so each step can have its own tempo.
	$effect(() => {
		if (!playing || !inView || !visible || reduced) return;
		const wait = BEAT[Math.min(step, BEAT.length - 1)];
		const t = setTimeout(() => {
			if (step < LAST) step += 1;
			else {
				i = (i + 1) % sets.length;
				step = 0;
			}
		}, wait);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!host || reduced) return;
		const el = host;
		const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), {
			threshold: 0.2
		});
		io.observe(el);
		const onVis = () => (visible = !document.hidden);
		document.addEventListener('visibilitychange', onVis);
		return () => {
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>

<div class="demo" bind:this={host}>
	<div class="bar">
		<span class="who"><TapakFigure size={18} walking={false} /> {c.app.tapak}</span>
		<!-- A row of six buttons naming the business types used to sit here, and it was
		     the wrong offer. This panel is a demonstration, not a control surface: the
		     one thing to do about it is watch it, and the one control worth having is
		     the ability to stop it. -->
		<span class="spacer"></span>
		{#if !reduced}
			<button
				type="button"
				class="pp"
				onclick={() => (playing = !playing)}
				aria-label={playing ? c.ai.pause : c.ai.play}
			>
				{#if playing}
					<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"
						><rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" /><rect
							x="7"
							y="1.5"
							width="3"
							height="9"
							rx="1"
							fill="currentColor"
						/></svg
					>
				{:else}
					<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"
						><path d="M3 1.5 10.5 6 3 10.5Z" fill="currentColor" /></svg
					>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Changes are announced politely: a screen reader must not be interrupted every
	     1.5 seconds, so only a genuinely new turn is read out. -->
	<div class="log" aria-live="polite" aria-atomic="false">
		<div class="turn tapak">
			<span class="av"><TapakFigure size={22} walking={false} /></span>
			<p class="bub">{greeting}</p>
		</div>

		<!-- The whole question in one go, the way somebody who knows what they want
		     types it. -->
		{#if step >= 1}
			<div class="turn mine"><p class="bub said">{set.question}</p></div>
		{/if}
		{#if step === 2}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<p class="bub think">{c.ai.thinking}</p>
			</div>
		{/if}
		{#if step >= LAST}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<div class="bub">
					<!-- What the map understood, before a single number. Moved in here with the
					     preface turn it used to follow: it belongs to the answer, and as a turn
					     of its own it was a beat the reader had to wait through. -->
					<div class="caught">
						<span class="cap">{c.ai.caught}</span>
						<ul>
							{#each set.captured as t (t)}
								<li>{t}</li>
							{/each}
						</ul>
					</div>
					<p class="said-after">{set.sentence}</p>
					{#if set.results.length}
						<ol class="places">
							{#each set.results as r, k (r.name)}
								<li>
									<span class="rank">{k + 1}</span>
									<span class="nm">{r.name}</span>
									{#if r.value != null}
										<span class="sc">{pct(r.value)}</span>
									{:else}
										<span class="sc none">·</span>
									{/if}
								</li>
							{/each}
						</ol>
						{#if set.more > 0}
							<p class="more">{c.ai.more(set.more)}</p>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>

</div>

<style>
	/* The height is pinned. Left to follow its contents, conversations of differing
	   length would make the whole page below it jump every dozen seconds or so — and
	   that is far more disruptive than one old turn being clipped at the top.
	   */
	/* Shaped like the panel it is a picture of. Tapak floats over the map in the app
	   as a rounded, raised surface, and a square-cornered box on the landing page was
	   showing the reader something they will not find when they open it. */
	.demo {
		border: 1px solid var(--paper-line);
		border-radius: var(--r-xl);
		overflow: hidden;
		background-image: var(--lift-panel);
		box-shadow: inset 0 1px 0 var(--lift-edge);
		display: flex;
		flex-direction: column;
		height: clamp(26rem, 58vh, 32rem);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--paper-line);
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		flex: none;
	}
	.spacer {
		flex: 1;
	}
	.pp {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		border: 1px solid var(--separator-strong);
		background: none;
		color: var(--label-2);
		border-radius: 999px;
		cursor: pointer;
	}
	.pp:hover {
		color: var(--label-1);
	}

	/* The conversation stacks from the bottom like a messaging app: stacked from the
	   top, each new turn shoves the old ones and the whole block wobbles. */
	.log {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		/* Old turns pushed off the top are faded rather than cut flat — a straight cut
		   through the middle of a sentence reads as broken layout. */
		mask-image: linear-gradient(to bottom, transparent 0, #000 2.75rem);
		-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 2.75rem);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.turn {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		/* A new turn enters from below, like a message that has just arrived. */
		animation: enter 320ms cubic-bezier(0.22, 0.61, 0.24, 1) both;
	}
	.turn.mine {
		justify-content: flex-end;
	}
	.av {
		flex: none;
		margin-top: 0.125rem;
	}

	/* The same bubble the app draws: a filled surface with no outline, and the reader's
	   own turns in the accent. An outlined bubble on this page and a filled one in the
	   app is the sort of small inconsistency that makes a demo look like a mock-up. */
	.bub {
		border-radius: var(--r-md);
		padding: 0.5rem 0.6875rem;
		background: var(--fill-1);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
		max-width: 34ch;
	}
	.bub.said {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.bub.think {
		color: var(--label-3);
	}
	.said-after {
		margin-top: 0.5rem;
	}

	.caught .cap {
		display: block;
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--label-3);
		margin-bottom: 0.3125rem;
	}
	.caught ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.caught li {
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--label-2);
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		padding: 0.0625rem 0.5rem;
	}

	.places {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.places li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		border-top: 1px solid var(--paper-line);
		padding-top: 0.3125rem;
	}
	.rank {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.nm {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.sc {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.sc.none {
		color: var(--label-3);
	}
	.more {
		margin-top: 0.4375rem;
		font-size: 0.6875rem;
		color: var(--label-3);
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translate3d(0, 6px, 0);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.turn {
			animation: none;
		}
	}
</style>
