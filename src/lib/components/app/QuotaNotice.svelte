<script lang="ts">
	/**
	 * What is said when a meter runs out, and when a session does.
	 *
	 * One surface for both, because both are the same event to the reader: the thing
	 * they just tried did not happen, and there is one way on. Neither is drawn as an
	 * error. An account that has spent its week is working exactly as the tier it is on
	 * says it will, and saying so in red would be the interface calling its own pricing
	 * a fault.
	 *
	 * It carries the refill DATE rather than a countdown. "In 4 days" is a figure that
	 * goes stale while it is being read, and the date is the thing somebody can act on:
	 * they either wait for it or they do not.
	 */
	import { base } from '$app/paths';
	import { getAccountState } from '$lib/state/account.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const account = getAccountState();
	const c = $derived(copy());

	/** A week on from the Monday this allowance was granted, which is the next one. */
	const WEEK_MS = 7 * 86_400_000;
	const refillAt = $derived(
		account.account ? account.account.allowance.weekStart + WEEK_MS : null
	);

	const meter = $derived(app.outOf);
	const shown = $derived(app.signedOut || meter !== null);

	function dismiss() {
		app.outOf = null;
		app.signedOut = false;
	}
</script>

{#if shown}
	<div class="notice material" role="status">
		{#if app.signedOut}
			<p class="head">{c.account.signedOut}</p>
			<p class="note">{c.account.signedOutNote}</p>
			<div class="row">
				<a class="btn accent" href="{base}/signin">{c.account.signIn}</a>
				<button type="button" class="btn" onclick={dismiss}>{c.account.dismiss}</button>
			</div>
		{:else if meter}
			<p class="head">{c.account.outOf[meter]}</p>
			<p class="note">{c.account.outOfNote[meter]}</p>
			{#if refillAt !== null}
				<p class="note">{c.account.refillOn(refillAt)}</p>
			{/if}
			<div class="row">
				<a class="btn accent" href="{base}/account">{c.account.seePlans}</a>
				<button type="button" class="btn" onclick={dismiss}>{c.account.dismiss}</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Bottom centre, over everything. Not anchored to the panel that raised it: the
	   question box, the area card and the map itself can all raise this, and a notice
	   that moved with whichever one did would read as three different notices. */
	.notice {
		position: fixed;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		z-index: 9;
		width: min(24rem, calc(100vw - 1.5rem));
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.875rem;
		border-radius: var(--r-lg);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
	}

	.head {
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.note {
		font-size: 0.75rem;
		color: var(--label-2);
	}

	.row {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}
	.row a {
		text-decoration: none;
	}
</style>
