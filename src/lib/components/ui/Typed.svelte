<script lang="ts">
	/**
	 * A sentence arriving at the speed somebody says it.
	 *
	 * WHAT THIS IS, AND WHAT IT IS NOT
	 *
	 * It is a reveal, not a claim about where the words came from. Almost every sentence
	 * Tapak says is composed here in the browser from figures the scoring engine already
	 * computed, and it exists in full before the first letter of it shows. Revealing it
	 * is a presentation choice, made because a paragraph that appears all at once reads
	 * as a page loading, and Tapak is a person answering.
	 *
	 * The one sentence that genuinely does arrive in pieces, the casual reply, uses the
	 * very same component: it grows as the model writes it and the reveal simply keeps
	 * up. That is the reason to have one component rather than two — a reader must not
	 * be able to tell from the animation which sentences the model wrote, because the
	 * animation is not what tells them. `parsedBy` and the provenance list do.
	 *
	 * Nothing here is ever a figure being counted up. A number that animates towards its
	 * value is a number the reader watches being wrong, and this product does not put a
	 * wrong figure on the screen even for a third of a second.
	 */
	import { parseMarkdown, textLength } from '$lib/domain/markdown';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import Markdown from './Markdown.svelte';

	interface Props {
		text: string;
		/** Off shows the whole thing at once, for a sentence that is not being said now. */
		reveal?: boolean;
		/** Characters per second. Reading pace, not typing pace. */
		rate?: number;
	}
	let { text, reveal = true, rate = 380 }: Props = $props();

	const total = $derived(textLength(parseMarkdown(text)));

	let shown = $state(0);
	/**
	 * The same count, held outside the rune.
	 *
	 * The loop has to know where it got to, and reading `shown` to find out would make
	 * the effect depend on a value the effect itself writes sixty times a second, so it
	 * would tear itself down and start again on every frame. So the effect writes the
	 * rune and reads this.
	 */
	let at = 0;

	$effect(() => {
		const target = total;
		if (!reveal || prefersReducedMotion()) {
			at = target;
			shown = target;
			return;
		}
		// Shorter than what is already showing means this is a different sentence: the
		// preview was pulled, or the answer replaced it. Start it again from nothing
		// rather than cutting back to a prefix of something else.
		if (at > target) at = 0;
		if (at >= target) {
			shown = at;
			return;
		}

		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			// Capped so a tab coming back to life does not finish the sentence in one
			// frame and lose the whole point of the reveal.
			const dt = Math.min(0.064, (now - last) / 1000);
			last = now;
			at = Math.min(target, at + dt * rate);
			shown = at;
			raf = at < target ? requestAnimationFrame(tick) : 0;
		};
		raf = requestAnimationFrame(tick);
		return () => {
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<Markdown {text} visible={shown} />
