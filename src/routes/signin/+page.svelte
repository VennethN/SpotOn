<script lang="ts">
	/**
	 * The front door.
	 *
	 * Two shapes, and which one is drawn is not the reader's choice. With a database
	 * configured this is an address and a password, with a second tab for making an
	 * account. Without one it is a single button, because there is one account and
	 * nothing to prove.
	 *
	 * The demo door says what it is rather than looking like a shortcut. Somebody who
	 * presses it should already know that nothing they do afterwards is being kept, and
	 * finding that out later is the one thing this page could get badly wrong.
	 */
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import ThemeControl from '$lib/components/ui/ThemeControl.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/domain/account';
	import { copy } from '$lib/state/lang.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const c = $derived(copy());

	/** Making an account rather than signing in to one. One page, because the two are
	    the same three fields and a reader who guessed wrong should not lose what they
	    typed by moving between two of them. */
	let creating = $state(false);
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let busy = $state(false);
	/** A code from the endpoint, turned into a sentence here. The server has no business
	    choosing which language the reader is in. */
	let error = $state<keyof typeof c.account.errors | null>(null);

	async function send(path: string, body: Record<string, string>) {
		if (busy) return;
		busy = true;
		error = null;
		try {
			const res = await fetch(path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = (await res.json()) as { error?: string };
			if (!res.ok) {
				error = (out.error ?? 'unavailable') as keyof typeof c.account.errors;
				return;
			}
			/* A full navigation rather than a client-side one. The session arrived as a
			   cookie, and every server load that decides what this reader may see has
			   already run for a request that did not have it. */
			await goto(data.next, { invalidateAll: true });
		} catch {
			error = 'unavailable';
		} finally {
			busy = false;
		}
	}

	const submit = (e: SubmitEvent) => {
		e.preventDefault();
		if (data.demo) return void send('/api/auth/login', {});
		void send(creating ? '/api/auth/register' : '/api/auth/login', { email, password, name });
	};
</script>

<svelte:head>
	<title>{c.account.signinTitle}</title>
</svelte:head>

<div class="page">
	<header>
		<a class="brand" href="{base}/">
			<BrandMark size={15} />
			<span class="name">{c.brand.name}</span>
		</a>
		<div class="tools">
			<LangToggle />
			<ThemeControl />
		</div>
	</header>

	<main>
		<div class="card material">
			{#if data.demo}
				<p class="eyebrow">{c.account.demoHead}</p>
				<h1>{c.account.signInHead}</h1>
				<p class="sub">{c.account.demoWhy}</p>
				<button
					type="button"
					class="btn accent wide"
					disabled={busy}
					onclick={() => void send('/api/auth/login', {})}
				>
					{busy ? c.account.working : c.account.demoEnter}
				</button>
			{:else}
				<h1>{creating ? c.account.signUpHead : c.account.signInHead}</h1>
				<p class="sub">{creating ? c.account.signUpSub : c.account.signInSub}</p>

				<form onsubmit={submit}>
					<label>
						<span>{c.account.email}</span>
						<input type="email" bind:value={email} autocomplete="email" required />
					</label>

					{#if creating}
						<label>
							<span>{c.account.name} <em>{c.account.nameOptional}</em></span>
							<input type="text" bind:value={name} autocomplete="name" />
						</label>
					{/if}

					<label>
						<span>{c.account.password}</span>
						<input
							type="password"
							bind:value={password}
							autocomplete={creating ? 'new-password' : 'current-password'}
							minlength={creating ? MIN_PASSWORD_LENGTH : undefined}
							required
						/>
						{#if creating}
							<em class="hint">{c.account.passwordHint(MIN_PASSWORD_LENGTH)}</em>
						{/if}
					</label>

					<button type="submit" class="btn accent wide" disabled={busy}>
						{busy ? c.account.working : creating ? c.account.signUp : c.account.signIn}
					</button>
				</form>

				<button type="button" class="swap" onclick={() => (creating = !creating)}>
					{creating ? c.account.toSignIn : c.account.toSignUp}
				</button>
			{/if}

			{#if error}
				<p class="error" role="alert">{c.account.errors[error]}</p>
			{/if}
		</div>
	</main>
</div>

<style>
	.page {
		min-height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-base);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--label-1);
	}
	.name {
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.018em;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	main {
		flex: 1;
		display: grid;
		place-items: center;
		padding: 1rem 1rem 8vh;
	}

	.card {
		position: relative;
		width: min(22rem, 100%);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1.25rem;
		border-radius: var(--r-xl);
	}

	h1 {
		font-size: 1.25rem;
		letter-spacing: -0.022em;
	}
	.sub {
		font-size: 0.8125rem;
		color: var(--label-2);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.25rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label > span {
		font-size: 0.75rem;
		font-weight: 550;
		color: var(--label-2);
	}
	em {
		font-style: normal;
		color: var(--label-3);
		font-size: 0.6875rem;
		font-weight: 400;
	}
	.hint {
		margin-top: 0.125rem;
	}

	input {
		border: 1px solid var(--separator-strong);
		background: var(--bg-elevated);
		border-radius: var(--r-sm);
		padding: 0.4375rem 0.625rem;
		font-size: 0.8125rem;
	}
	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.wide {
		justify-content: center;
		padding: 0.5em 0.75em;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.swap {
		border: 0;
		background: none;
		padding: 0;
		align-self: flex-start;
		color: var(--label-2);
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.swap:hover {
		color: var(--label-1);
	}

	.error {
		font-size: 0.75rem;
		color: var(--warn);
	}
</style>
