<script lang="ts">
	/**
	 * Content that arrives as it is scrolled to.
	 *
	 * ONE CURVE, ONE DURATION. Opacity used to run 620ms and the transform 720ms, both
	 * on the same easing — so every element finished fading a tenth of a second before
	 * it stopped moving, and what the eye caught was a solid block still drifting. Two
	 * durations on one gesture is two motions, and the slower one is the one you see.
	 *
	 * The curve is the house spring: critically damped, no overshoot. Nothing here was
	 * thrown by the reader, and an entrance that bounces without a gesture behind it
	 * reads as decoration.
	 *
	 * `distance` exists because the same 14px looked timid under a display heading and
	 * heavy under a table row. Motion should scale with the thing that is moving.
	 */
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';

	let {
		children,
		delay = 0,
		distance = 12,
		as = 'div'
	}: {
		children: Snippet;
		delay?: number;
		/** How far it travels, in px. Larger for display type, smaller for dense rows. */
		distance?: number;
		as?: 'div' | 'section' | 'li';
	} = $props();

	let el = $state<HTMLElement | null>(null);
	let shown = $state(false);

	$effect(() => {
		if (!el) return;
		if (prefersReducedMotion()) {
			shown = true;
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				// Once shown, stays shown — content must not flicker when scrolled back over.
				if (entries.some((e) => e.isIntersecting)) {
					shown = true;
					io.disconnect();
				}
			},
			{ rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
		);
		io.observe(el);
		return () => io.disconnect();
	});
</script>

<svelte:element
	this={as}
	bind:this={el}
	class="reveal"
	class:shown
	style:--delay={`${delay}ms`}
	style:--rise={`${distance}px`}
>
	{@render children()}
</svelte:element>

<style>
	.reveal {
		opacity: 0;
		transform: translate3d(0, var(--rise, 12px), 0);
		transition:
			opacity 520ms cubic-bezier(0.32, 0.72, 0, 1) var(--delay),
			transform 520ms cubic-bezier(0.32, 0.72, 0, 1) var(--delay);
		will-change: opacity, transform;
	}
	.reveal.shown {
		opacity: 1;
		transform: none;
		/* Dropped once it has arrived: a page of elements permanently promised to the
		   compositor costs memory for a transition that will never run again. */
		will-change: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal {
			opacity: 1;
			transform: none;
			transition: opacity 200ms ease;
		}
	}
</style>
