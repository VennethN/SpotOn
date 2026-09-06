<script lang="ts">
	/**
	 * Whether there is an account, on the one page that cannot be told.
	 *
	 * The landing page is prerendered, which means it is rendered by a build with no
	 * reader in front of it: there is no cookie, so `locals.account` is null for
	 * everybody and the bar had no way to say anything. What it said instead was
	 * nothing. Somebody who had signed in, spent half a week's questions and then
	 * followed a link back to the front page found a bar offering to open SpotOn and no
	 * sign anywhere that they already had an account, let alone a way to their plan.
	 *
	 * So it is asked for in the browser, once, and the bar draws one of the three states
	 * it can honestly be in:
	 *
	 * - Not known yet. A block the size and shape of what is coming, so the bar does not
	 *   jump when the answer lands. This is the one placeholder on the site standing in
	 *   for something genuinely unknown at build time rather than merely slow.
	 * - Signed in. Tapak and the account's own name, leading to the account page.
	 * - Signed out. The way in.
	 *
	 * Signed out is also what a failed request draws. The endpoint answers "nobody" with
	 * a 200 rather than an error precisely so that not being signed in is a state to be
	 * drawn, and a network that dropped leaves this page in the state it can always
	 * offer: a door.
	 */
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { left } from '$lib/domain/plans';
	import { copy } from '$lib/state/lang.svelte';
	import type { AccountView } from '$lib/types';

	/** The bar has condensed over paper, so the stage's ink no longer applies. Passed in
	    rather than read from a global, because the bar is the thing that knows. */
	let { scrolled = false }: { scrolled?: boolean } = $props();

	const c = $derived(copy());

	let known = $state(false);
	let account = $state<AccountView | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/account');
			if (res.ok) account = ((await res.json()) as { account: AccountView | null }).account;
		} catch {
			// Left as nobody, which is the state this page can always offer a way out of.
		} finally {
			known = true;
		}
	});
</script>

<!-- One slot holding all three states, at one minimum width, so the answer landing
     does not shove the bar sideways in front of somebody reading it. All three are the
     same pill for the same reason: two of them are, and a bare word between two pills
     reads as a link that wandered into a row of controls. -->
<span class="slot">
	{#if !known}
		<Skeleton w="4.25rem" h="1.5rem" radius="999px" />
	{:else if account}
		<a
			class="pill who"
			class:scrolled
			href="{base}/account"
			aria-label={c.account.chip}
			title={c.account.chipLeft(
				left(account.allowance, 'ai'),
				left(account.allowance, 'analysis')
			)}
		>
			<TapakFigure size={11} walking={false} />
			<span class="name">{account.name}</span>
		</a>
	{:else}
		<a class="pill" class:scrolled href="{base}/signin">
			<span class="name">{c.account.signIn}</span>
		</a>
	{/if}
</span>

<style>
	.slot {
		display: inline-flex;
		justify-content: flex-end;
		flex: none;
		min-width: 4.25rem;
	}

	/* The same pill the toggles beside it wear, so the row reads as one set of controls
	   and this one reads as pressable. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		max-width: 9.5rem;
		padding: 0.1875rem 0.625rem;
		border: 1px solid currentColor;
		border-radius: 999px;
		color: var(--stage-ink-muted, var(--label-2));
		text-decoration: none;
		transition:
			color 160ms ease-out,
			background-color 160ms ease-out,
			transform 100ms ease-out;
	}
	.pill.who {
		padding-left: 0.4375rem;
	}
	.pill.scrolled {
		color: var(--label-2);
		border-color: var(--separator);
		background: var(--fill-1);
	}
	.pill:hover {
		color: var(--stage-ink, var(--label-1));
	}
	.pill.scrolled:hover {
		color: var(--label-1);
		background: var(--fill-2);
	}
	.pill:active {
		transform: scale(0.97);
	}
	/* One name, one line. A long one is cut rather than allowed to push the bar wide,
	   because what this control is for is getting to the account page and not for
	   reading a name that is written on it. */
	.name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
</style>
