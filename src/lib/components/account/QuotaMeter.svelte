<script lang="ts">
	/**
	 * One meter: what is left, drawn against the week it belongs to.
	 *
	 * A ratio against a limit, so it is a meter and not a chart. The number IS the
	 * reading, the bar is what makes it a proportion at a glance, and neither is a
	 * decoration of the other.
	 *
	 * THE HEADLINE IS THE TOTAL, THE BAR IS THE WEEK, and they are labelled separately
	 * because they measure different things. The big figure is everything this account
	 * can spend, which is what the chip in the map chrome shows: two surfaces printing
	 * different totals for the same account is worse than either being harder to read.
	 * The bar is this week's allowance alone, because that is the only stable scale a
	 * meter can have. Credits bought outright have no weekly grant to be a fraction of,
	 * and folding them into the track would make it shrink as they were spent.
	 *
	 * So they sit apart: the track is the week, and what was bought is a pill under it
	 * with its own mark. That is also what the two are: one expires on Monday and the
	 * other does not.
	 *
	 * The colour carries state and only state. Plenty left is the accent, nearly gone and
	 * gone are the warning, and nothing here is coloured by which meter it is: an account
	 * has two of these and they are not two series to tell apart, they are the same
	 * reading of two different things.
	 */
	import MeterMark from '$lib/components/ui/MeterMark.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { Balance, MeterKey } from '$lib/types';

	let {
		meter,
		balance,
		refillAt
	}: { meter: MeterKey; balance: Balance; refillAt: number } = $props();

	const c = $derived(copy());

	/** Everything spendable. The figure the chip shows, so the two cannot disagree. */
	const total = $derived(balance.weekLeft + balance.extra);
	/** How much of THIS WEEK is left, which is what the track is a track of. */
	const weekPart = $derived(
		balance.week > 0 ? Math.max(0, Math.min(1, balance.weekLeft / balance.week)) : 0
	);

	/* Read against the week's grant rather than against the week's remainder, so an
	   account holding three hundred bought credits is not warned about a spent Tuesday.
	   Being out is the only state that stops something working, and it is the only one
	   drawn as a warning without qualification. */
	const spendable = $derived(balance.week > 0 ? total / balance.week : 0);
	const empty = $derived(total === 0);
	const low = $derived(!empty && spendable <= 0.2);

	/**
	 * The fill grows out of nothing, once, the first time it is drawn.
	 *
	 * A proportion drawn in front of you is read; the same proportion already sitting
	 * there is skimmed. The same reason `SpreadBars` grows its bars, on the same curve
	 * `Reveal` uses, so everything on the page that arrives arrives the same way.
	 */
	let grown = $state(false);
	$effect(() => {
		if (prefersReducedMotion()) {
			grown = true;
			return;
		}
		const t = requestAnimationFrame(() => (grown = true));
		return () => cancelAnimationFrame(t);
	});
</script>

<div class="tile material" class:empty class:low>
	<p class="label"><MeterMark {meter} size={13} />{c.account.meter[meter]}</p>

	<p class="figure">{c.account.count(total)}<span class="suffix">{c.account.leftSuffix}</span></p>

	<!-- Hidden from the reading order rather than given a role of its own. Everything it
	     says is said underneath it in words, and a meter that also announces itself makes
	     a screen reader read the same figure twice. -->
	<div class="track" aria-hidden="true">
		<div class="fill" style:width={grown ? `${weekPart * 100}%` : '0%'}></div>
	</div>

	<p class="line">{c.account.weekLeft(balance.weekLeft, balance.week)}</p>

	{#if balance.extra > 0}
		<p class="pill">
			<MeterMark {meter} size={11} />
			{c.account.extraLeft(balance.extra)}
		</p>
	{/if}

	<p class="line refill">{c.account.refillOn(refillAt)}</p>
	<p class="note">{c.account.meterNote[meter]}</p>
</div>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
		padding: 0.9375rem 1rem 1rem;
		border-radius: var(--r-lg);
		background: var(--bg-elevated);
	}

	.label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--label-2);
	}

	/* The one large number on the tile. Proportional figures, not the tabular ones the
	   body sets: tabular gives every digit the width of a zero, which at this size leaves
	   a figure like 1.550 looking loose and set rather than said. Tabular belongs in
	   columns that have to line up, and there is no column here. */
	.figure {
		font-size: 2.125rem;
		font-weight: 600;
		line-height: 1.05;
		letter-spacing: -0.03em;
		font-variant-numeric: proportional-nums;
		color: var(--label-1);
		margin-top: 0.0625rem;
	}
	.tile.empty .figure {
		color: var(--warn);
	}
	/* Says what the figure IS, since the bar below it measures something narrower. Set in
	   the label ink rather than the figure's, so it reads as the unit on a number and not
	   as part of the number. */
	.suffix {
		margin-left: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 550;
		letter-spacing: 0;
		color: var(--label-3);
	}

	/* The unfilled part is a light step of the same hue rather than a grey, so the state
	   reads across the whole bar rather than only across the filled part of it. */
	.track {
		position: relative;
		height: 8px;
		margin: 0.3125rem 0 0.125rem;
		border-radius: 4px;
		background: var(--accent-soft);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--accent);
		transition: width 620ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	/* Nearly gone and gone both wear the warning. The track goes with the fill: a warning
	   fill in an accent track reads as two states at once.

	   Faint, and that matters most when the meter is EMPTY. With no fill left, the track
	   is the only bar on screen, and a track carrying any real weight reads at a glance as
	   a bar that is full. It has to stay quiet enough that an empty meter looks empty. */
	.tile.low .track,
	.tile.empty .track {
		background: color-mix(in srgb, var(--warn) 10%, transparent);
	}
	.tile.low .fill {
		background: var(--warn);
	}

	.line {
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.refill {
		color: var(--label-3);
	}

	/* What was bought, kept off the track and given its own field. It is not a fraction
	   of the week, so it must not look like part of one. */
	.pill {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		margin: 0.0625rem 0 0.0625rem;
		padding: 0.1875rem 0.5rem;
		border-radius: 999px;
		background: var(--fill-1);
		color: var(--label-2);
		font-size: 0.6875rem;
		font-weight: 550;
	}

	.note {
		font-size: 0.75rem;
		color: var(--label-3);
		margin-top: 0.1875rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
