<script lang="ts">
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';

	let {
		children,
		delay = 0,
		as = 'div'
	}: { children: Snippet; delay?: number; as?: 'div' | 'section' | 'li' } = $props();

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
				// Sekali muncul, tetap muncul — konten tidak boleh berkedip saat digulir balik.
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
>
	{@render children()}
</svelte:element>

<style>
	.reveal {
		opacity: 0;
		transform: translate3d(0, 14px, 0);
		transition:
			opacity 620ms cubic-bezier(0.22, 0.61, 0.24, 1) var(--delay),
			transform 720ms cubic-bezier(0.22, 0.61, 0.24, 1) var(--delay);
		will-change: opacity, transform;
	}
	.reveal.shown {
		opacity: 1;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal {
			opacity: 1;
			transform: none;
			transition: opacity 200ms ease;
		}
	}
</style>
