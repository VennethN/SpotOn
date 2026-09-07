<script lang="ts">
	/**
	 * The plan, what is left of it, and the two ways to have more.
	 *
	 * Every figure on this page is read from `domain/plans`. Not one allowance and not
	 * one price is written into the copy, which is the same rule the rest of the product
	 * follows for cell counts and competitor totals: a number typed into a sentence goes
	 * stale in silence, and a pricing page is the worst place for that to happen.
	 *
	 * The tiers are shown side by side including the one the reader is already on, and a
	 * downgrade is offered as plainly as an upgrade. A page that only shows the way up
	 * is a page that has decided what the reader wants.
	 */
	import { untrack } from 'svelte';
	import { base } from '$app/paths';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import { METER_KEYS, PACKS, PACK_KEYS, PLANS, PLAN_KEYS } from '$lib/domain/plans';
	import { AccountState } from '$lib/state/account.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { MeterKey, PlanKey } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const c = $derived(copy());

	/* Its own instance rather than the app's. This page sits outside `/app`, so there is
	   no map state above it, and what it needs from an account is the half that is not
	   about the map: the plan, the balances and the two buttons that change them. */
	const account = new AccountState(untrack(() => data.account));

	const allowance = $derived(account.account?.allowance ?? null);
	const WEEK_MS = 7 * 86_400_000;
	const refillAt = $derived(allowance ? allowance.weekStart + WEEK_MS : null);

	const grant = (plan: PlanKey, meter: MeterKey) =>
		meter === 'ai'
			? c.account.grantAi(PLANS[plan].week.ai)
			: c.account.grantAnalysis(PLANS[plan].week.analysis);

	/** A code from the endpoint, said in the reader's language. A code this page has no
	    sentence for still gets one, rather than showing the reader the code itself. */
	const said = (code: string): string =>
		code in c.account.errors
			? c.account.errors[code as keyof typeof c.account.errors]
			: c.account.errors.unavailable;

	/* A full page load rather than a client-side navigation. The cookie has just been
	   taken away, and every server load that decided what this reader may see ran while
	   it was still there. */
	async function leave() {
		await account.signOut();
		location.href = `${base}/`;
	}
</script>

<svelte:head>
	<title>{c.account.pageTitle}</title>
</svelte:head>

<div class="page">
	<header>
		<a class="brand" href="{base}/app">
			<BrandMark size={15} />
			<span class="name">{c.brand.name}</span>
		</a>
		<div class="tools">
			<LangToggle />
			<a class="btn" href="{base}/app">{c.account.back}</a>
		</div>
	</header>

	<main>
		{#if account.account && allowance}
			<section class="head">
				<h1>{c.account.title}</h1>
				<p class="sub">{c.account.sub}</p>
				<p class="who">
					<strong>{account.account.name}</strong>
					<span class="muted">{account.account.email}</span>
					{#if account.account.demo}
						<span class="tag">{c.account.demoBadge}</span>
					{/if}
				</p>
				{#if account.account.demo}
					<p class="note">{c.account.demoNote}</p>
				{/if}
			</section>

			<!-- What is left, above what it costs. Somebody arriving here almost always
			     arrived because something stopped working, and the figure that explains
			     that has to be the first thing on the page. -->
			<section>
				<p class="eyebrow">{c.account.balance}</p>
				<div class="meters">
					{#each METER_KEYS as meter (meter)}
						{@const b = allowance.meters[meter]}
						<div class="meter material">
							<p class="label">{c.account.meter[meter]}</p>
							<p class="figure" class:empty={b.weekLeft + b.extra === 0}>
								{c.account.weekLeft(b.weekLeft, b.week)}
							</p>
							{#if b.extra > 0}
								<p class="note">{c.account.extraLeft(b.extra)}</p>
							{/if}
							{#if refillAt !== null}
								<p class="note">{c.account.refillOn(refillAt)}</p>
							{/if}
							<p class="note what">{c.account.meterNote[meter]}</p>
						</div>
					{/each}
				</div>
			</section>

			<section>
				<p class="eyebrow">{c.account.plans}</p>
				<div class="tiers">
					{#each PLAN_KEYS as key (key)}
						{@const plan = PLANS[key]}
						{@const here = allowance.plan === key}
						<div class="tier material" class:here>
							<p class="tier-name">{c.account.plan[key].name}</p>
							<p class="price">
								{plan.price === 0 ? c.account.priceFree : c.account.priceMonth(plan.price)}
							</p>
							<ul>
								<li>{grant(key, 'ai')}</li>
								<li>{grant(key, 'analysis')}</li>
							</ul>
							<p class="blurb">{c.account.plan[key].blurb}</p>
							{#if here}
								<p class="current">{c.account.currentPlan}</p>
							{:else}
								<button
									type="button"
									class="btn accent wide"
									disabled={account.busy}
									onclick={() => void account.subscribe(key)}
								>
									{account.busy ? c.account.working : c.account.choosePlan}
								</button>
							{/if}
						</div>
					{/each}
				</div>
				<p class="note">{c.account.planNote}</p>
			</section>

			<section>
				<p class="eyebrow">{c.account.packs}</p>
				<p class="note">{c.account.packsNote}</p>
				<div class="packs">
					{#each PACK_KEYS as key (key)}
						{@const pack = PACKS[key]}
						<div class="pack material">
							<p class="label">{c.account.pack[key](pack.amount)}</p>
							<p class="note">{c.account.meter[pack.meter]}</p>
							<button
								type="button"
								class="btn wide"
								disabled={account.busy}
								onclick={() => void account.topUp(key)}
							>
								{account.busy ? c.account.working : c.account.buy(pack.price)}
							</button>
						</div>
					{/each}
				</div>
			</section>

			<!-- Said once, under everything it applies to, rather than beside each
			     button. Repeated per button it would read as small print. -->
			<p class="note fine">{c.account.noPayment}</p>

			{#if account.failed}
				<p class="error" role="alert">{said(account.failed)}</p>
			{/if}

			<div class="out">
				<button type="button" class="btn" disabled={account.busy} onclick={leave}>
					{c.account.signOut}
				</button>
			</div>
		{/if}
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
		gap: 0.75rem;
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
	.tools a {
		text-decoration: none;
	}

	main {
		width: min(52rem, 100%);
		margin: 0 auto;
		padding: 0.5rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	h1 {
		font-size: 1.5rem;
		letter-spacing: -0.024em;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	.sub {
		font-size: 0.875rem;
		color: var(--label-2);
	}
	.who {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.4375rem;
		font-size: 0.8125rem;
		margin-top: 0.375rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meters,
	.tiers,
	.packs {
		display: grid;
		gap: 0.625rem;
	}
	.meters {
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}
	.tiers {
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}
	.packs {
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.meter,
	.tier,
	.pack {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
		padding: 0.875rem;
		border-radius: var(--r-lg);
		background: var(--bg-elevated);
	}

	/* The tier in use is outlined rather than tinted. A filled card among outlined ones
	   reads as the recommended one, and which tier suits somebody is not this page's
	   call to make. */
	.tier.here {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.label,
	.tier-name {
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.figure {
		font-size: 1.125rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}
	.figure.empty {
		color: var(--warn);
	}

	.price {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--label-1);
	}

	ul {
		margin: 0.125rem 0 0;
		padding-left: 1rem;
		font-size: 0.75rem;
		color: var(--label-2);
	}
	li + li {
		margin-top: 0.125rem;
	}

	.blurb,
	.note {
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.note.what {
		color: var(--label-3);
		margin-top: 0.125rem;
	}
	.note.fine {
		color: var(--label-3);
	}

	.blurb {
		flex: 1;
	}

	.current {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
		margin-top: 0.25rem;
	}

	.wide {
		justify-content: center;
		margin-top: 0.375rem;
		padding: 0.4375em 0.75em;
		font-size: 0.8125rem;
		font-weight: 600;
	}
	.btn:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.error {
		font-size: 0.8125rem;
		color: var(--warn);
	}

	.out {
		margin-top: 0.5rem;
	}
</style>
