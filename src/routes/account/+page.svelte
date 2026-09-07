<script lang="ts">
	/**
	 * The plan, what is left of it, and the two ways to have more.
	 *
	 * Every figure on this page is read from `domain/plans`. Not one allowance and not
	 * one price is written into the copy, which is the same rule the rest of the product
	 * follows for cell counts and competitor totals: a number typed into a sentence goes
	 * stale in silence, and a pricing page is the worst place for that to happen.
	 *
	 * WHAT IS DRAWN, AND WHY EACH DRAWING EARNS ITS PLACE
	 *
	 * Nothing here is a picture of a number that was already legible. Each of the four
	 * marks does something the text next to it cannot:
	 *
	 * - `QuotaMeter` makes a remainder a PROPORTION. "1.480 left" is a quantity, and the
	 *   question a reader actually has is whether that is most of the week or the end of
	 *   it, which is a ratio and reads instantly as a bar.
	 * - `WeekStrip` makes a refill date a POSITION. "Refills on Monday 24 August" is a
	 *   date to hold against today's date; seven cells with today marked is a glance.
	 * - `GrantBar` makes three tiers an ORDER. Six numbers across three cards is
	 *   arithmetic the reader has to do to see the ladder they are being sold.
	 * - `PlanCrest` makes a tier a RANK, at a size no wording is legible at, so the three
	 *   cards are told apart while they are being scanned rather than after.
	 *
	 * The hexagon field behind the head is the one thing on the page that is decoration,
	 * and it is uniform on purpose. One cell darker than another and it would be a map of
	 * something, which is the one thing this product does not draw.
	 *
	 * The tiers are shown side by side including the one the reader is already on, and a
	 * downgrade is offered as plainly as an upgrade. A page that only shows the way up is
	 * a page that has decided what the reader wants.
	 *
	 * The sections arrive ON MOUNT, staggered, rather than through `Reveal`. That
	 * component waits for a section to be scrolled to, which is right for a landing page
	 * being read top to bottom and wrong here: this is a page somebody opened to check one
	 * figure, and a panel that stays invisible until it has been scrolled past is a panel
	 * that is missing for anybody who did not scroll. It already cost the top-ups their
	 * whole section once.
	 */
	import { untrack } from 'svelte';
	import { base } from '$app/paths';
	import GrantBar from '$lib/components/account/GrantBar.svelte';
	import HexField from '$lib/components/account/HexField.svelte';
	import PlanCrest from '$lib/components/account/PlanCrest.svelte';
	import QuotaMeter from '$lib/components/account/QuotaMeter.svelte';
	import WeekStrip from '$lib/components/account/WeekStrip.svelte';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import ThemeControl from '$lib/components/ui/ThemeControl.svelte';
	import MeterMark from '$lib/components/ui/MeterMark.svelte';
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
	const plan = $derived(allowance ? PLANS[allowance.plan] : null);

	const grant = (key: PlanKey, meter: MeterKey) =>
		meter === 'ai'
			? c.account.grantAi(PLANS[key].week.ai)
			: c.account.grantAnalysis(PLANS[key].week.analysis);

	/* The scale every comparison bar is drawn against: the largest grant on that meter,
	   across the tiers that exist. Computed rather than pinned to Premier, so the bars
	   still mean something the day a tier is added above it. */
	const peak = (meter: MeterKey): number =>
		Math.max(...PLAN_KEYS.map((k) => PLANS[k].week[meter]));

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
			<ThemeControl />
			<a class="btn" href="{base}/app">{c.account.back}</a>
		</div>
	</header>

	<main>
		{#if account.account && allowance && plan && refillAt !== null}
			<!-- The head says which plan this is, first and largest, because everything
			     under it is either a reading of that plan or an offer to change it. -->
			<section class="bay" style:--in="0ms">
				<div class="hero material">
					<HexField />
					<div class="hero-in">
						<span class="crest"><PlanCrest plan={allowance.plan} size={38} /></span>
						<div class="hero-text">
							<p class="eyebrow">{c.account.currentPlan}</p>
							<h1>{c.account.plan[allowance.plan].name}</h1>
							<p class="price">
								{plan.price === 0 ? c.account.priceFree : c.account.priceMonth(plan.price)}
							</p>
						</div>
						<div class="who">
							<p class="who-name">{account.account.name}</p>
							<p class="who-mail muted">{account.account.email}</p>
							{#if account.account.demo}
								<p><span class="tag">{c.account.demoBadge}</span></p>
							{/if}
						</div>
					</div>
					{#if account.account.demo}
						<p class="note demo-note">{c.account.demoNote}</p>
					{/if}
				</div>
			</section>

			<!-- What is left, above what it costs. Somebody arriving here almost always
			     arrived because something stopped working, and the figure that explains
			     that has to be the first thing under the head. -->
			<section class="bay" style:--in="60ms">
				<p class="eyebrow section-label">{c.account.balance}</p>
				<div class="meters">
					{#each METER_KEYS as meter (meter)}
						<QuotaMeter {meter} balance={allowance.meters[meter]} {refillAt} />
					{/each}
				</div>
				<WeekStrip weekStart={allowance.weekStart} {refillAt} />
			</section>

			<section class="bay" style:--in="110ms">
				<p class="eyebrow section-label">{c.account.plans}</p>
				<div class="tiers">
					{#each PLAN_KEYS as key (key)}
						{@const tier = PLANS[key]}
						{@const here = allowance.plan === key}
						<div class="tier material" class:here>
							<span class="tier-crest" class:on={here}><PlanCrest plan={key} size={26} /></span>
							<p class="tier-name">{c.account.plan[key].name}</p>
							<p class="tier-price">
								{tier.price === 0 ? c.account.priceFree : c.account.priceMonth(tier.price)}
							</p>

							<!-- Each allowance as a figure and as a bar on one scale. The figure is
							     the reading, the bar is what makes the three cards a ladder. -->
							<div class="grants">
								{#each METER_KEYS as meter (meter)}
									<p class="grant"><MeterMark {meter} size={12} />{grant(key, meter)}</p>
									<GrantBar value={tier.week[meter]} peak={peak(meter)} />
								{/each}
							</div>

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

			<section class="bay" style:--in="160ms">
				<p class="eyebrow section-label">{c.account.packs}</p>
				<p class="note">{c.account.packsNote}</p>
				<div class="packs">
					{#each PACK_KEYS as key (key)}
						{@const pack = PACKS[key]}
						<div class="pack material">
							<span class="pack-mark"><MeterMark meter={pack.meter} size={15} /></span>
							<div class="pack-text">
								<p class="pack-name">{c.account.pack[key](pack.amount)}</p>
								<p class="note">{c.account.meter[pack.meter]}</p>
							</div>
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
		width: min(54rem, 100%);
		margin: 0 auto;
		padding: 0.5rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}
	/* Every section stacks the same way, so the four of them read as four rather than
	   as one long column with headings in it. */
	.bay {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		animation: arrive 460ms cubic-bezier(0.32, 0.72, 0, 1) var(--in, 0ms) both;
	}
	/* The house curve, and the house distance. One curve and one duration for opacity
	   and transform together: two durations on one gesture is two motions, and the
	   slower one is the one the eye follows. */
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
		.bay {
			animation: none;
		}
	}
	.section-label {
		margin-bottom: -0.125rem;
	}

	/* ── the head ─────────────────────────────────────────────────────────────── */

	.hero {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem;
		border-radius: var(--r-xl);
		background: var(--bg-elevated);
	}
	.hero-in {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
	}
	/* The crest wears the accent here and only here. It is the one place on the page
	   saying which tier this account is on, and the three cards below it repeat that in
	   a quieter voice. */
	.crest {
		flex: none;
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: var(--r-md);
		background: var(--accent-soft);
		color: var(--accent);
	}
	.hero-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	h1 {
		font-size: 1.75rem;
		letter-spacing: -0.026em;
		font-variant-numeric: proportional-nums;
	}
	.price {
		font-size: 0.875rem;
		font-weight: 550;
		color: var(--label-2);
	}
	.who {
		margin-left: auto;
		text-align: right;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.75rem;
	}
	.who-name {
		font-weight: 650;
	}
	.who-mail {
		font-size: 0.6875rem;
	}
	.demo-note {
		position: relative;
		padding-top: 0.625rem;
		border-top: 1px solid var(--separator);
	}

	/* ── the meters ───────────────────────────────────────────────────────────── */

	.meters {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}

	/* ── the tiers ────────────────────────────────────────────────────────────── */

	.tiers {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
	}
	.tier {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
		padding: 0.9375rem 1rem 1rem;
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

	.tier-crest {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		margin-bottom: 0.375rem;
		border-radius: var(--r-sm);
		background: var(--fill-1);
		color: var(--label-2);
	}
	.tier-crest.on {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.tier-name {
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.tier-price {
		font-size: 1.0625rem;
		font-weight: 600;
		letter-spacing: -0.018em;
		font-variant-numeric: proportional-nums;
	}

	.grants {
		margin-top: 0.5rem;
	}
	.grant {
		display: flex;
		margin-top: 0.4375rem;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.grant :global(svg) {
		color: var(--label-3);
	}

	.blurb {
		flex: 1;
		font-size: 0.75rem;
		color: var(--label-2);
		margin-top: 0.125rem;
	}

	.current {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent);
		margin-top: 0.625rem;
	}

	/* ── the top-ups ──────────────────────────────────────────────────────────── */

	.packs {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
	}
	.pack {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.875rem 1rem;
		border-radius: var(--r-lg);
		background: var(--bg-elevated);
	}
	.pack-mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-sm);
		background: var(--fill-1);
		color: var(--label-2);
	}
	.pack-text {
		min-width: 0;
		flex: 1;
	}
	.pack-name {
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	.pack .wide {
		margin-top: 0;
	}

	/* ── the rest ─────────────────────────────────────────────────────────────── */

	.note {
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.note.fine {
		color: var(--label-3);
	}

	.wide {
		justify-content: center;
		margin-top: 0.625rem;
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

	/* On a narrow screen the head stacks: the identity drops under the plan rather than
	   being squeezed against it, because a right-aligned column two words wide reads as
	   a mistake. */
	@media (max-width: 30rem) {
		.hero-in {
			flex-wrap: wrap;
		}
		.who {
			margin-left: 0;
			text-align: left;
			width: 100%;
			padding-top: 0.625rem;
			border-top: 1px solid var(--separator);
		}
	}
</style>
