<script lang="ts">
	/**
	 * Where in the week this account currently is, and where the refill sits.
	 *
	 * "Refills on Monday 24 August" is a date somebody has to hold against today's date
	 * to get anything out of. Seven cells with today marked turns that into a position,
	 * and the answer becomes a glance rather than a subtraction.
	 *
	 * It is a calendar and not a usage chart, which is the one thing it must not be
	 * mistaken for. Nothing is stored per day, so nothing here is drawn per day: every
	 * cell is the same size and the same shade, and the only thing that varies is whether
	 * a day has been reached. A strip whose cells differed in weight would be claiming a
	 * daily breakdown this product does not have.
	 *
	 * The week runs Monday to Sunday because that is where `domain/plans` puts the
	 * boundary, and it is read in Jakarta for the same reason the refill sentence is: the
	 * boundary is one instant, and read from another zone it lands on the wrong day.
	 */
	import { copy } from '$lib/state/lang.svelte';

	let { weekStart, refillAt }: { weekStart: number; refillAt: number } = $props();

	const c = $derived(copy());
	const DAY = 86_400_000;

	/* Read once when the page is drawn. A clock that ticked would move a marker nobody is
	   watching, and the only moment it matters is the one this was opened at. */
	const now = Date.now();
	const days = $derived([0, 1, 2, 3, 4, 5, 6].map((i) => weekStart + i * DAY));
	/** Clamped, because a page left open across a Monday would otherwise point past the
	    end of its own strip until it is reloaded. */
	const todayAt = $derived(Math.max(0, Math.min(6, Math.floor((now - weekStart) / DAY))));
</script>

<div class="strip material">
	<p class="eyebrow">{c.account.weekTitle}</p>

	<ol class="days">
		{#each days as at, i (at)}
			<li
				class="day"
				class:done={i < todayAt}
				class:now={i === todayAt}
				title={c.account.weekdayLong(at)}
			>
				<span aria-hidden="true">{c.account.weekdayNarrow(at)}</span>
				<span class="sr">{c.account.weekdayLong(at)}{i === todayAt ? `, ${c.account.today}` : ''}</span>
			</li>
		{/each}
		<!-- The boundary itself, drawn at the end of the row it is the end of. A chevron
		     rather than an eighth cell: next Monday is not part of this week, and a cell
		     would put it in one. -->
		<li class="turn" aria-hidden="true">
			<svg viewBox="0 0 8 12" width="8" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
				<path d="M2 1.6 6 6l-4 4.4" />
			</svg>
		</li>
	</ol>

	<p class="when">{c.account.refillOn(refillAt)}</p>
</div>

<style>
	.strip {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 0.875rem;
		padding: 0.75rem 1rem;
		border-radius: var(--r-lg);
		background: var(--bg-elevated);
	}

	.days {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.day {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--r-xs);
		border: 1px solid var(--separator);
		font-size: 0.625rem;
		font-weight: 650;
		color: var(--label-3);
		text-transform: uppercase;
	}
	/* Reached already. One shade for all of them, because nothing is counted per day and
	   a gradient across the week would be inventing one. */
	.day.done {
		background: var(--fill-1);
		border-color: transparent;
		color: var(--label-2);
	}
	.day.now {
		background: var(--accent);
		border-color: transparent;
		color: var(--accent-ink);
	}

	.turn {
		display: grid;
		place-items: center;
		margin-left: 0.0625rem;
		color: var(--label-4);
	}

	.when {
		font-size: 0.75rem;
		color: var(--label-2);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
