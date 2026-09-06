<script lang="ts">
	/**
	 * The account, in the chrome, next to the language and the theme.
	 *
	 * It carries two figures and nothing else that has to be read. A meter is only worth
	 * showing while it can still be acted on, and the act it leads to is either asking
	 * one more question or opening one more area, so what it prints is how many of each
	 * are left. The plan name would be a third thing to read for a decision nobody makes
	 * from the map.
	 *
	 * The marks come from `ui/MeterMark` rather than being drawn here, so the chip and
	 * the account page label the same two meters with the same two shapes. Drawn twice
	 * they would drift, and a reader who learned the hexagon on one surface would have to
	 * learn it again on the other.
	 *
	 * It is a link to the account page rather than a menu. There is one thing to do from
	 * here, and hiding it behind a disclosure would be a click spent on finding a click.
	 *
	 * WHAT WAS WRONG WITH IT: it was two numbers with no owner. Both figures were right
	 * and neither said WHOSE they were, so the one route to the account page in the whole
	 * application was a pair of digits somebody had to guess was theirs. It read as part
	 * of the map's own readout, which is exactly what the rest of the chrome is.
	 *
	 * So Tapak stands at the head of it, and the chip is drawn as a control rather than
	 * as text: the same hairline and the same fill the language toggle beside it wears,
	 * so it reads as a thing to press. Tapak rather than an initial in a circle, for the
	 * same reason the account page uses the figure beside the name. It is the one face
	 * this product has, and an initial would introduce a stranger to stand in for it.
	 *
	 * A figure that has just changed rises into place. It is the one moment on this
	 * surface where a number moving is the news: something was just spent, and the chip
	 * is usually nowhere near where the reader was looking when it happened.
	 */
	import { base } from '$app/paths';
	import MeterMark from '$lib/components/ui/MeterMark.svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { getAccountState } from '$lib/state/account.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const account = getAccountState();
	const c = $derived(copy());

	const ai = $derived(account.left('ai'));
	const analysis = $derived(account.left('analysis'));
</script>

{#if account.signedIn}
	<a
		class="chip"
		href="{base}/account"
		aria-label={c.account.chip}
		title={c.account.chipLeft(ai, analysis)}
	>
		<span class="you" aria-hidden="true"><TapakFigure size={11} walking={false} /></span>
		<span class="pair" class:empty={ai === 0}>
			<MeterMark meter="ai" size={11} />
			{#key ai}<span class="n">{ai}</span>{/key}
		</span>
		<span class="pair" class:empty={analysis === 0}>
			<MeterMark meter="analysis" size={11} />
			{#key analysis}<span class="n">{analysis}</span>{/key}
		</span>
	</a>
{/if}

<style>
	/* The hairline and fill the language toggle beside it wears, so the two read as
	   siblings and both read as controls. */
	.chip {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		padding: 0.125rem 0.5rem 0.125rem 0.3125rem;
		border: 1px solid var(--separator);
		background: var(--fill-1);
		border-radius: 999px;
		text-decoration: none;
		color: var(--label-2);
		transition:
			color 140ms ease-out,
			background-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.chip:hover {
		color: var(--label-1);
		background: var(--fill-2);
	}
	/* Feedback on the press, not on the release, the same as the brand pill. */
	.chip:active {
		transform: scale(0.97);
	}

	.you {
		display: grid;
		place-items: center;
		flex: none;
		/* Held to the height of the row beside it, so the pill does not grow a
		   millimetre taller than the toggles it stands next to. */
		width: 0.6875rem;
		height: 0.9375rem;
	}
	.you :global(svg) {
		overflow: visible;
	}

	.pair {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		font-size: 0.6875rem;
		font-weight: 650;
		line-height: 1;
		/* Kept from reflowing the row as a figure ticks down from three digits to two. */
		font-variant-numeric: tabular-nums;
	}
	.pair :global(svg) {
		opacity: 0.75;
	}
	/* Nothing left reads as a warning rather than as a figure, because it is the one
	   value of this number that stops something from working. */
	.pair.empty {
		color: var(--warn);
	}

	/* The figure that replaced the last one rises into its place. Short, and only ever
	   on a change: an idle animation on a balance would be a number inventing news. */
	.n {
		display: inline-block;
		animation: tick 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}
	@keyframes tick {
		from {
			opacity: 0;
			transform: translateY(-0.45em);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.n {
			animation: none;
		}
	}
</style>
