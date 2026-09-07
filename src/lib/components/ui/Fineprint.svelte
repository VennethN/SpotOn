<script lang="ts">
	/**
	 * The apparatus under a section: what was counted, and what the count is not.
	 *
	 * These sentences are load-bearing and none of them is folded away. A chart of
	 * opening hours with no denominator beside it reads as the whole street, and the line
	 * saying the field surveys are not a census is the one thing keeping every figure
	 * above it from being read as a measurement. So they stay on screen.
	 *
	 * What they cannot go on doing is looking like prose. They were set as paragraphs one
	 * step greyer than the sentence above them, which is not a difference in kind: a
	 * reader meets three paragraphs of falling contrast and reads the whole section as
	 * hard to read, then reads none of it. Given a mark and a rule they become a shape
	 * instead, recognised before it is read and skipped by whoever does not want it. The
	 * words did not change. Only the claim they make on the eye.
	 *
	 * One mark for the block rather than one per line: two glyphs stacked in a column
	 * start to read as a list of warnings, which is a louder thing than this is.
	 */
	import Glyph from '$lib/components/ui/Glyph.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="fine">
	<span class="ico"><Glyph icon="info" size={11} /></span>
	<div class="txt">{@render children()}</div>
</div>

<style>
	.fine {
		display: flex;
		align-items: flex-start;
		gap: 0.375rem;
		margin-top: 0.125rem;
		padding-top: 0.4375rem;
		border-top: 1px solid var(--separator);
		color: var(--label-3);
	}
	.ico {
		flex: none;
		/* Set on the first line of text rather than on the top of the box, so the mark
		   sits beside the words and not above them. */
		margin-top: 0.1875rem;
	}
	.txt {
		min-width: 0;
		font-size: 0.6875rem;
		line-height: 1.5;
	}
	/* The lines inside are separate notes, not a paragraph that wrapped. */
	.txt > :global(p + p) {
		margin-top: 0.3125rem;
	}
</style>
