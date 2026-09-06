<script lang="ts">
	/**
	 * Markdown, rendered as elements rather than as HTML.
	 *
	 * Every sentence Tapak says goes through here, and only two of them are ever
	 * markdown: the casual reply and the reason a question was not understood, both
	 * written by the model. Plain text passes through as a paragraph, unchanged, which
	 * is why it is safe to put the composed sentences through the same path — one
	 * renderer means the bubble looks the same whoever wrote the words in it.
	 *
	 * `visible` is a budget of prose characters, used for the reveal. Left alone it is
	 * infinite and everything shows at once. See `domain/markdown` for why the budget is
	 * spent on the parsed tree rather than on the source string.
	 */
	import { parseMarkdown, truncate } from '$lib/domain/markdown';
	import MarkdownInline from './MarkdownInline.svelte';

	let { text, visible = Infinity }: { text: string; visible?: number } = $props();

	const parsed = $derived(parseMarkdown(text));
	const blocks = $derived(truncate(parsed, visible));
</script>

{#each blocks as block, i (i)}
	{#if block.kind === 'p'}
		<p><MarkdownInline parts={block.children} /></p>
	{:else if block.ordered}
		<ol start={block.start}>
			{#each block.items as item, k (k)}
				<li><MarkdownInline parts={item} /></li>
			{/each}
		</ol>
	{:else}
		<ul>
			{#each block.items as item, k (k)}
				<li><MarkdownInline parts={item} /></li>
			{/each}
		</ul>
	{/if}
{/each}

<style>
	/* No margin at the ends: the bubble around this already carries the padding, and a
	   paragraph adding its own leaves the text sitting off centre in it. The blocks are
	   direct children of whatever holds this, so first and last mean what they say. */
	p,
	ul,
	ol {
		margin: 0.5em 0;
	}
	p:first-child,
	ul:first-child,
	ol:first-child {
		margin-top: 0;
	}
	p:last-child,
	ul:last-child,
	ol:last-child {
		margin-bottom: 0;
	}
	ul,
	ol {
		padding-left: 1.2em;
	}
	li {
		margin: 0.15em 0;
	}
</style>
