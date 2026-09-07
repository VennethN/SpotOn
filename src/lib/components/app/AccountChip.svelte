<script lang="ts">
	/**
	 * What is left, in the chrome, next to the language and the theme.
	 *
	 * Two figures and nothing else. A meter is only worth showing while it can still be
	 * acted on, and the act it leads to is either asking one more question or opening
	 * one more area, so what it prints is how many of each are left. The plan name would
	 * be a third thing to read for a decision nobody makes from the map.
	 *
	 * It is a link to the account page rather than a menu. There is one thing to do from
	 * here and hiding it behind a disclosure would be a click spent on finding a click.
	 */
	import { base } from '$app/paths';
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
		<span class="pair" class:empty={ai === 0}>
			<!-- A speech mark for the question, a pin for the place. Both are drawn rather
			     than set as text: a glyph from the font would change size with it and sit
			     on a baseline these numbers do not share. -->
			<svg viewBox="0 0 12 12" aria-hidden="true">
				<path
					d="M2 2.6h8v5.2H6.4L4 10.2V7.8H2z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linejoin="round"
				/>
			</svg>
			{ai}
		</span>
		<span class="pair" class:empty={analysis === 0}>
			<svg viewBox="0 0 12 12" aria-hidden="true">
				<path
					d="M6 1.4 10.2 4v4.4L6 10.9 1.8 8.4V4z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linejoin="round"
				/>
			</svg>
			{analysis}
		</span>
	</a>
{/if}

<style>
	.chip {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		padding: 0.125rem 0.4375rem;
		border-radius: 999px;
		text-decoration: none;
		color: var(--label-2);
		transition:
			color 140ms ease-out,
			background-color 140ms ease-out;
	}
	.chip:hover {
		color: var(--label-1);
		background: var(--fill-1);
	}

	.pair {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		font-size: 0.6875rem;
		font-weight: 650;
		line-height: 1;
	}
	/* Nothing left reads as a warning rather than as a figure, because it is the one
	   value of this number that stops something from working. */
	.pair.empty {
		color: var(--warn);
	}

	svg {
		width: 11px;
		height: 11px;
		flex: none;
		opacity: 0.75;
	}
</style>
