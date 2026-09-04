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
	 *
	 * WHAT THE PRESS IS ANSWERED WITH, WHICH IS THE PART THAT WAS MISSING.
	 *
	 * Signing in is not one wait, it is two, and only the first of them is short. The
	 * credentials go out and come back in a moment. Then the browser navigates, the
	 * layout's server load runs again for a request that finally has a cookie, and the
	 * map fetches the base grid before it can paint one cell. That second stretch is the
	 * long one, and until now the whole of it was spent on a card that had gone grey and
	 * said "one moment", which for several seconds is indistinguishable from a button
	 * that did not take.
	 *
	 * So the two stages are named, each from where the work actually is: `checking`
	 * while the address and password are out, `arriving` once they came back good and
	 * the destination is loading. Neither is a percentage and neither is on a timer,
	 * which is the rule the answer stream already follows. The destination's own outline
	 * takes the screen from `RouteSkeleton` a moment later, so the door hands over to the
	 * shape of the room rather than to a blank.
	 *
	 * Tapak stands at the door and paces while the check is out. It is the product's own
	 * waiting state, the same figure and the same reasoning as the panel on the map: a
	 * spinner says the machine is busy, and a figure pacing says somebody is looking it
	 * up. It is also the figure standing beside the account's own name one page further
	 * in, so the first thing met at the door is the thing that greets you inside.
	 *
	 * A refusal nudges the card sideways once. That is the one thing here that has to be
	 * noticed without being read, because somebody who mistyped a password is looking at
	 * the field rather than at the line under the button. It is played rather than
	 * declared, so a second wrong password moves the card a second time.
	 *
	 * The lattice behind all of it is `HexField`, which is decoration and says so by
	 * being uniform: one weight, no cell darker than its neighbour, nothing on it that
	 * could be read as a value. It drifts, slowly, and it is allowed to because nothing
	 * in it is a reading. What moves is the crop, not a figure.
	 */
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import HexField from '$lib/components/account/HexField.svelte';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import Dots from '$lib/components/ui/Dots.svelte';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import ThemeControl from '$lib/components/ui/ThemeControl.svelte';
	import { MIN_PASSWORD_LENGTH } from '$lib/domain/account';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
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

	/**
	 * Where the work is, in the reader's terms.
	 *
	 * `checking` is the address and the password out on the wire. `arriving` is them
	 * having come back good, with the destination now loading. Two sentences because
	 * they are two waits of very different lengths, and one label covering both would go
	 * stale halfway through with nothing on screen moving.
	 */
	let stage = $state<'idle' | 'checking' | 'arriving'>('idle');
	const busy = $derived(stage !== 'idle');

	/** A code from the endpoint, turned into a sentence here. The server has no business
	    choosing which language the reader is in. */
	let error = $state<keyof typeof c.account.errors | null>(null);

	let card = $state<HTMLDivElement | null>(null);

	/* What is being waited for, said as the place it leads to. `next` is a path on this
	   site and the server has already made sure of that, so reading it here is reading
	   where this reader was headed. */
	const arrivingAt = $derived(
		data.next.startsWith('/account') ? c.account.openingAccount : c.account.openingMap
	);
	const stageLine = $derived(
		stage === 'checking' ? (creating ? c.account.making : c.account.checking) : arrivingAt
	);

	/** Played rather than declared: a class would only fire on the first refusal, and
	    the second wrong password is the one somebody is most likely to miss. */
	function nudge() {
		if (!card || prefersReducedMotion()) return;
		card.animate(
			[
				{ translate: '0' },
				{ translate: '-5px' },
				{ translate: '4px' },
				{ translate: '-2px' },
				{ translate: '0' }
			],
			{ duration: 320, easing: 'ease-out' }
		);
	}

	function refuse(code: keyof typeof c.account.errors) {
		error = code;
		stage = 'idle';
		nudge();
	}

	async function send(path: string, body: Record<string, string>) {
		if (busy) return;
		stage = 'checking';
		error = null;
		try {
			const res = await fetch(path, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = (await res.json()) as { error?: string };
			if (!res.ok) {
				refuse((out.error ?? 'unavailable') as keyof typeof c.account.errors);
				return;
			}
			/* Accepted. The form is deliberately not put back: what follows is a
			   navigation, and a card that came back to life for the half second before the
			   page changes invites a second press on a door that is already open. */
			stage = 'arriving';
			/* A full navigation rather than a client-side one. The session arrived as a
			   cookie, and every server load that decides what this reader may see has
			   already run for a request that did not have it. */
			await goto(data.next, { invalidateAll: true });
		} catch {
			refuse('unavailable');
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

<div class="page" class:accepted={stage === 'arriving'}>
	<!-- The grid this product is made of, carrying on past the frame. Decoration, and
	     uniform on purpose, so there is nothing on it to read. -->
	<div class="ground" aria-hidden="true">
		<HexField opacity={0.4} mask="edges" drift />
		<span class="bloom"></span>
	</div>

	<header class="arrive" style:--in="0ms">
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
		<div class="card material arrive" style:--in="70ms" bind:this={card}>
			<!-- Tapak at the door, pacing while the check is out. The waiting state the
			     rest of the product already uses, rather than a second one invented here. -->
			<div class="greeter">
				<TapakFigure size={34} walking={!busy} pacing={stage === 'checking'} />
			</div>

			{#if data.demo}
				<div class="lede arrive" style:--in="130ms">
					<p class="eyebrow">{c.account.demoHead}</p>
					<h1>{c.account.signInHead}</h1>
					<p class="sub">{c.account.demoWhy}</p>
				</div>
				<div class="act arrive" style:--in="190ms">
					<button
						type="button"
						class="btn accent wide"
						disabled={busy}
						onclick={() => void send('/api/auth/login', {})}
					>
						{busy ? c.account.working : c.account.demoEnter}
					</button>
				</div>
			{:else}
				<div class="lede arrive" style:--in="130ms">
					<h1>{creating ? c.account.signUpHead : c.account.signInHead}</h1>
					<p class="sub">{creating ? c.account.signUpSub : c.account.signInSub}</p>
				</div>

				<form onsubmit={submit}>
					<label class="arrive" style:--in="170ms">
						<span>{c.account.email}</span>
						<input type="email" bind:value={email} autocomplete="email" disabled={busy} required />
					</label>

					{#if creating}
						<!-- The row grows in rather than appearing. Swapping between the two doors
						     keeps everything already typed, so the only thing that should move is
						     the one field that is genuinely new. -->
						<label transition:slide={{ duration: 220 }}>
							<span>{c.account.name} <em>{c.account.nameOptional}</em></span>
							<input type="text" bind:value={name} autocomplete="name" disabled={busy} />
						</label>
					{/if}

					<label class="arrive" style:--in="210ms">
						<span>{c.account.password}</span>
						<input
							type="password"
							bind:value={password}
							autocomplete={creating ? 'new-password' : 'current-password'}
							minlength={creating ? MIN_PASSWORD_LENGTH : undefined}
							disabled={busy}
							required
						/>
						{#if creating}
							<em class="hint">{c.account.passwordHint(MIN_PASSWORD_LENGTH)}</em>
						{/if}
					</label>

					<div class="act arrive" style:--in="250ms">
						<button type="submit" class="btn accent wide" disabled={busy}>
							{busy ? c.account.working : creating ? c.account.signUp : c.account.signIn}
						</button>
					</div>
				</form>
			{/if}

			<!-- Which of the two waits is running, and what came back if it was a refusal.
			     Directly under whichever button was pressed, in both doors, because that is
			     where the eye already is. Live, so a change is read out rather than found
			     on a second pass. -->
			{#if busy}
				<p class="stage" role="status" transition:slide={{ duration: 200 }}>
					{stageLine}<Dots />
				</p>
			{/if}

			{#if error}
				<p class="error" role="alert" transition:slide={{ duration: 200 }}>
					{c.account.errors[error]}
				</p>
			{/if}

			{#if !data.demo}
				<!-- Last, because it leads away from what everything above it is for. -->
				<button
					type="button"
					class="swap arrive"
					style:--in="290ms"
					disabled={busy}
					onclick={() => (creating = !creating)}
				>
					{creating ? c.account.toSignIn : c.account.toSignUp}
				</button>
			{/if}
		</div>
	</main>
</div>

<style>
	.page {
		position: relative;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-base);
		overflow: hidden;
	}

	/* ── the ground ───────────────────────────────────────────────────────────── */

	.ground {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* One soft wash of the accent behind the card, so the material has something to be a
	   material over. It holds still: the lattice is what moves, and two things moving
	   behind one form is a background asking to be watched. */
	.bloom {
		position: absolute;
		left: 50%;
		top: 46%;
		width: min(44rem, 130vw);
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(circle, var(--accent-soft) 0%, transparent 68%);
		opacity: 0.85;
		transition: opacity 420ms ease-out;
	}
	/* Accepted: the wash comes up, once, under the handover. One change of state, on the
	   one event that changed anything. */
	.page.accepted .bloom {
		opacity: 1.6;
	}

	/* ── the frame ────────────────────────────────────────────────────────────── */

	header {
		position: relative;
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
		position: relative;
		flex: 1;
		display: grid;
		place-items: center;
		padding: 2.5rem 1rem 8vh;
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

	/* Tapak stands ON the card's top edge, the way the figures in the diorama stand on
	   the ground rather than on a plinth. */
	.greeter {
		position: absolute;
		left: 1.25rem;
		top: 0;
		transform: translateY(-78%);
		filter: drop-shadow(0 6px 10px rgba(15, 22, 36, 0.18));
	}

	.lede {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.625rem;
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
		transition:
			border-color 160ms ease-out,
			box-shadow 160ms ease-out;
	}
	/* The ring is drawn on the field rather than around it, so the row does not grow by
	   two pixels the moment it is typed into. */
	input:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	input:disabled {
		opacity: 0.6;
	}

	.wide {
		width: 100%;
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
		transition: color 140ms ease-out;
	}
	.swap:hover {
		color: var(--label-1);
	}
	.swap:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.stage {
		display: flex;
		align-items: baseline;
		font-size: 0.75rem;
		color: var(--label-2);
	}

	.error {
		font-size: 0.75rem;
		color: var(--warn);
	}

	/* ── motion ───────────────────────────────────────────────────────────────── */

	/* The house curve and the house distance, the same pair the account page arrives on.
	   Staggered in the order the card is read rather than by where things sit. */
	.arrive {
		animation: arrive 460ms cubic-bezier(0.32, 0.72, 0, 1) var(--in, 0ms) both;
	}
	@keyframes arrive {
		from {
			opacity: 0;
			transform: translate3d(0, 12px, 0);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arrive {
			animation: none;
		}
	}
</style>
