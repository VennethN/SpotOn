<script lang="ts">
	/**
	 * One run of inline markdown: text, bold, italic, code, nested as deeply as it
	 * came.
	 *
	 * The component imports itself so `**bold with *emphasis* inside**` renders as what
	 * it says rather than as one flat level.
	 *
	 * The markup below is written on ONE LINE on purpose, and must stay that way. Svelte
	 * keeps the whitespace between template blocks, so breaking these branches across
	 * lines to make them read nicely inserts a space in front of every bold word.
	 */
	import type { Inline } from '$lib/domain/markdown';
	import Self from './MarkdownInline.svelte';

	let { parts }: { parts: readonly Inline[] } = $props();
</script>

{#each parts as part, i (i)}{#if part.kind === 'text'}{part.text}{:else if part.kind === 'code'}<code>{part.text}</code>{:else if part.kind === 'strong'}<strong><Self parts={part.children} /></strong>{:else}<em><Self parts={part.children} /></em>{/if}{/each}

<style>
	/* Emphasis inside a bubble whose whole job is to be read at a glance: enough weight
	   to lift the word, not enough to make it a heading. */
	strong {
		font-weight: 650;
		color: var(--label-1);
	}
	em {
		font-style: italic;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.9em;
		background: var(--fill-1);
		border-radius: var(--r-xs);
		padding: 0.05em 0.3em;
	}
</style>
