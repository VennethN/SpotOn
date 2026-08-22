<script lang="ts">
	/**
	 * Three dots, taking their turn.
	 *
	 * The waiting line used to end in a typed ellipsis, which is a full stop with two
	 * friends: it says the sentence trailed off, not that anything is still happening.
	 * These are the same three dots, spaced the way somebody counting under their breath
	 * would say them, and they keep going for as long as the wait does.
	 *
	 * Hidden from screen readers. The line beside it already says Tapak is checking, and
	 * a dot that announces itself three times a second is not information, it is
	 * interruption.
	 *
	 * `size` is in ems so the dots scale with whatever text they sit in.
	 */
	let { size = 0.3 }: { size?: number } = $props();
</script>

<span class="dots" aria-hidden="true" style="--dot: {size}em">
	<i></i><i></i><i></i>
</span>

<style>
	.dots {
		display: inline-flex;
		align-items: center;
		gap: calc(var(--dot) * 1.15);
		/* Sits on the text baseline rather than on its middle, so the dots read as the
		   end of the sentence rather than as a separate object beside it. */
		vertical-align: baseline;
		margin-left: 0.32em;
		height: 1em;
	}
	i {
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		background: currentColor;
		opacity: 0.28;
		animation: dot 1.32s ease-in-out infinite;
	}
	/* Staggered by a third of the cycle, so the lift travels left to right and comes
	   back round rather than all three breathing together. */
	i:nth-child(2) {
		animation-delay: 0.16s;
	}
	i:nth-child(3) {
		animation-delay: 0.32s;
	}

	@keyframes dot {
		0%,
		62%,
		100% {
			opacity: 0.28;
			transform: translateY(0);
		}
		28% {
			opacity: 1;
			/* Barely a lift. Enough that the eye catches the travel, not enough to make
			   the line of text look like it is bouncing. */
			transform: translateY(calc(var(--dot) * -0.5));
		}
	}

	/* Reduced motion keeps the three dots and drops the travel: the sentence still ends
	   in an ellipsis, it just holds still. */
	@media (prefers-reduced-motion: reduce) {
		i {
			animation: none;
			opacity: 0.55;
		}
	}
</style>
