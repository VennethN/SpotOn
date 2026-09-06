<script lang="ts">
	/**
	 * The conversation with Tapak.
	 *
	 * Tapak opens and offers the next step, so a user who does not know what to ask
	 * can still get moving just by tapping options. The text box stays for those who
	 * already know what they want to ask.
	 *
	 * The instance is handed in by the page rather than created here: the question
	 * box in the middle of the screen drives the same Tapak, and the thread has to
	 * survive intact when that box turns into this panel. Greeting, the language
	 * reset and the map-selection remark live with the instance, on the page.
	 */
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { metricValue } from '$lib/domain/narrate';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { Tapak } from '$lib/state/tapak.svelte';
	import { pct } from '$lib/utils/format';

	let { tapak }: { tapak: Tapak } = $props();

	const app = getAppState();
	const c = $derived(copy());

	let draft = $state('');
	let log = $state<HTMLDivElement | null>(null);

	/**
	 * The box is inviting a question: Tapak is not working on one, and nothing has
	 * been typed yet. That is the only moment the glow says anything — once there are
	 * words in the field the reader has clearly found it, and once Tapak is thinking
	 * the box cannot be acted on at all.
	 */
	const inviting = $derived(!tapak.busy && !draft.trim());

	// The scroll follows the newest turn rather than jumping: the user has to see
	// the new message arrive, not suddenly find themselves at the bottom.
	$effect(() => {
		void tapak.turns.length;
		if (!log) return;
		queueMicrotask(() => log?.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }));
	});

	function send(e: SubmitEvent) {
		e.preventDefault();
		tapak.submit(draft);
		draft = '';
	}
</script>

<div class="tapak">
	<div class="log scroll" bind:this={log}>
		{#each tapak.turns as turn (turn.id)}
			{#if turn.who === 'tapak'}
				<div class="row">
					<span class="avatar"><TapakFigure size={26} pacing={turn.pending} /></span>
					<div class="bubble">
						<p class:thinking={turn.pending}>{turn.text}</p>

						{#if turn.answer && turn.answer.items.length}
							<ul class="places">
								{#each turn.answer.items as item, k (item.id)}
									<li>
										<button
											type="button"
											class="place"
											class:on={app.selectedId === item.id}
											onclick={() => app.select(item.id)}
										>
											<span class="rank">{k + 1}</span>
											<span class="nm">{item.name}</span>
											<!-- The figure the question was about leads, and the
											     opportunity score keeps its place beside it. A list
											     answering "where is it busiest" that shows only a
											     score is answering a question nobody asked, which is
											     what this whole layer exists to stop. -->
											{#if item.measure}
												<span class="metric">{metricValue(item.measure, c)}</span>
											{/if}
											{#if item.value != null}
												<span class="score" class:aside={Boolean(item.measure)}>
													{pct(item.value)}
												</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{:else}
				<div class="row mine"><p class="bubble said">{turn.text}</p></div>
			{/if}

			{#if turn.chips?.length}
				<ul class="chips">
					{#each turn.chips as chip (chip.label)}
						<li>
							<button type="button" onclick={() => tapak.tap(chip)} disabled={tapak.busy}>
								{chip.label}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
	</div>

	<form onsubmit={send}>
		<!-- The halo is its own element rather than a shadow on the field, because the
		     breathing and the fading are two separate things: the pulse runs forever on
		     the inner span, the outer one fades it in and out. Put both on one opacity
		     and the fade has nothing to hand over to, so the glow vanishes on a frame. -->
		<span class="field" class:inviting>
			<span class="glow" aria-hidden="true"><span class="pulse"></span></span>
			<input
				bind:value={draft}
				placeholder={c.app.ask}
				aria-label={c.app.askAria}
				disabled={tapak.busy}
			/>
		</span>
		<button type="submit" class="btn accent" disabled={tapak.busy || !draft.trim()}>
			{c.app.askSend}
		</button>
	</form>
</div>

<style>
	.tapak {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
	}
	/* No maximum height of its own: what bounds this is the surface holding it (the
	   floating panel or the sheet), so there are never two rules fighting over it. */
	.log {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
		padding-right: 0.25rem;
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.row.mine {
		justify-content: flex-end;
	}
	.avatar {
		flex: none;
		margin-top: 0.1rem;
	}

	.bubble {
		border-radius: var(--r-md);
		padding: 0.5rem 0.6875rem;
		background: var(--fill-1);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
		max-width: 92%;
	}
	.bubble.said {
		background: var(--accent);
		color: var(--accent-ink);
	}
	/* Waiting reads on two things at once: the figure beside the bubble is pacing, and
	   the line itself breathes. Slow and shallow on purpose. It has to be legible as
	   "still going" out of the corner of an eye, without pulling the eye off the
	   answer above it. */
	.thinking {
		color: var(--label-3);
		animation: breathe-text 1.9s ease-in-out infinite;
	}
	@keyframes breathe-text {
		0%,
		100% {
			opacity: 0.58;
		}
		50% {
			opacity: 1;
		}
	}

	.places {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.place {
		width: 100%;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		text-align: left;
		border: 1px solid var(--separator);
		background: var(--bg-elevated);
		border-radius: var(--r-sm);
		padding: 0.375rem 0.5rem;
		cursor: pointer;
		transition:
			border-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.place:hover {
		border-color: var(--separator-strong);
	}
	.place:active {
		transform: scale(0.985);
	}
	.place.on {
		border-color: var(--accent);
	}
	.rank {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
		min-width: 1ch;
	}
	.nm {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		flex: 1;
		min-width: 0;
	}
	.score {
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	/* The figure the question was about. It takes the accent and the weight; the
	   opportunity score beside it steps back to a caption, because on a list answering
	   "where is it busiest" the score is context rather than the answer. */
	.metric {
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.score.aside {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--label-3);
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0 0 0 2.125rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3125rem;
	}
	.chips button {
		border: 1px solid var(--separator-strong);
		background: transparent;
		color: var(--label-1);
		border-radius: 999px;
		padding: 0.25rem 0.6875rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.chips button:hover:not(:disabled) {
		background: var(--fill-1);
	}
	.chips button:active:not(:disabled) {
		transform: scale(0.96);
	}
	.chips button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	form {
		display: flex;
		gap: 0.375rem;
	}
	.field {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
	}
	input {
		position: relative;
		flex: 1;
		min-width: 0;
		border: 1px solid var(--separator);
		background: var(--bg-elevated);
		border-radius: 999px;
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		transition: border-color 420ms ease-in-out;
	}
	input:disabled {
		opacity: 0.6;
	}
	.field.inviting input {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--separator));
	}

	/* A full-strength accent button that cannot be pressed is a lie about what is
	   available. It steps back while Tapak is thinking, and while there is nothing
	   typed to send, on the same easing as everything else here. */
	form button {
		flex: none;
		transition:
			transform 100ms ease-out,
			opacity 320ms ease-in-out,
			background-color 320ms ease-in-out;
	}
	form button:disabled {
		opacity: 0.4;
		box-shadow: none;
		cursor: default;
	}
	form button:disabled:hover {
		filter: none;
	}

	/* Sits just outside the field's own edge, under it in the stack, and never takes a
	   pointer: it is a light, not a control. */
	.glow {
		position: absolute;
		inset: -1px;
		border-radius: 999px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 520ms ease-in-out;
	}
	.field.inviting .glow {
		opacity: 1;
	}
	.pulse {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			0 0 0 3px var(--accent-soft),
			0 0 14px 1px color-mix(in srgb, var(--accent) 32%, transparent);
		animation: breathe-glow 3.2s ease-in-out infinite;
	}
	/* Eased at both ends, so the light arrives and leaves rather than switching. */
	@keyframes breathe-glow {
		0%,
		100% {
			opacity: 0.34;
		}
		50% {
			opacity: 1;
		}
	}

	/* Reduced motion keeps the signal and drops the movement: the box still says it is
	   ready, it just says it by holding still. */
	@media (prefers-reduced-motion: reduce) {
		.thinking {
			animation: none;
		}
		.pulse {
			animation: none;
			opacity: 0.72;
		}
	}
</style>
