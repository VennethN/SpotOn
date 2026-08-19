<script lang="ts">
	/**
	 * One row of short labels, travelling.
	 *
	 * WHY A MARQUEE HERE AND NOWHERE ELSE
	 *
	 * The section it serves is a list of names: who this is for, and what it scores.
	 * Set as a grid of headings with a sentence under each, it took a screen and a half
	 * to say five short things, and the sentences were padding around the only content
	 * that mattered, which was the names. A moving row says "there are more of these
	 * than fit" without printing a single extra word, and it is the one place on this
	 * page where nothing is being measured, so movement costs no precision.
	 *
	 * Two of them run against each other. One row alone reads as a ticker and invites
	 * you to read it; two moving in opposite directions read as texture, which is what
	 * a list of names at the end of a page should be.
	 *
	 * HOW THE LOOP IS SEAMLESS
	 *
	 * The list is rendered twice and the track travels exactly half its own width, so
	 * the second copy is under the pointer at the moment the first wraps. The duplicate
	 * is hidden from assistive technology: it is the same list said twice, and a screen
	 * reader should hear it once.
	 */
	interface Props {
		items: string[];
		/** Travel right instead of left. */
		reverse?: boolean;
		/** Seconds for one full pass. Longer is calmer. */
		speed?: number;
		label: string;
	}
	let { items, reverse = false, speed = 46, label }: Props = $props();
</script>

<div
	class="marquee"
	class:reverse
	style:--dur={`${speed}s`}
	role="list"
	aria-label={label}
>
	<div class="track">
		{#each [0, 1] as copy (copy)}
			<ul aria-hidden={copy === 1}>
				{#each items as it (it)}
					<li role={copy === 0 ? 'listitem' : 'presentation'}>{it}</li>
				{/each}
			</ul>
		{/each}
	</div>
</div>

<style>
	.marquee {
		overflow: hidden;
		/* The row fades out at both edges rather than being cut, because a hard cut through
		   the middle of a word reads as a layout that broke. Wide rather than narrow: a
		   short fade leaves the pill under the edge almost fully opaque when the row runs
		   out, which is the same cut with a gradient on it. */
		mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
		-webkit-mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
	}
	.track {
		display: flex;
		width: max-content;
		animation: travel var(--dur) linear infinite;
	}
	.reverse .track {
		animation-direction: reverse;
	}

	ul {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0 0.25rem 0 0;
	}
	li {
		flex: none;
		padding: 0.5rem 1rem;
		border: 1px solid var(--panel-line, var(--paper-line));
		border-radius: 999px;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 500;
		/* Tightened as it grows, per the type scale used across this page. */
		letter-spacing: -0.01em;
		white-space: nowrap;
		color: var(--ink-2, var(--label-2));
	}

	@keyframes travel {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			/* Exactly one copy's width, which is half the track. */
			transform: translate3d(-50%, 0, 0);
		}
	}

	/* Stopped, and scrollable by hand instead. The row still says there are more than
	   fit; it just does not move on its own. */
	@media (prefers-reduced-motion: reduce) {
		.marquee {
			overflow-x: auto;
			overscroll-behavior-x: contain;
		}
		.track {
			animation: none;
		}
	}
</style>
