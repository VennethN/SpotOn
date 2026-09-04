<script lang="ts">
	/**
	 * Language picker: two words, not flags.
	 *
	 * A flag marks a country, not a language, and both Indonesian and English
	 * are spoken in many countries. Two readable abbreviations are more
	 * honest, and smaller.
	 */
	import { DICT, LANGS, type Lang } from '$lib/i18n';
	import { lang, setLang } from '$lib/state/lang.svelte';

	/** Landing-bar styling: follows the ink of the sky behind it. */
	let { ghost = false }: { ghost?: boolean } = $props();

	const now = $derived(lang());
</script>

<div class="langs" class:ghost role="group" aria-label={DICT[now].lang.label}>
	{#each LANGS as l (l)}
		<button
			type="button"
			class:on={l === now}
			aria-pressed={l === now}
			title={DICT[l].lang.label}
			onclick={() => setLang(l as Lang)}
		>
			{DICT[l].lang.short}
		</button>
	{/each}
</div>

<style>
	.langs {
		display: flex;
		align-items: center;
		gap: 1px;
		flex: none;
		border: 1px solid var(--separator);
		background: var(--fill-1);
		border-radius: 999px;
		padding: 1px;
	}
	.langs.ghost {
		border-color: currentColor;
		background: transparent;
		color: var(--stage-ink-muted, var(--label-2));
	}
	button {
		border: 0;
		background: none;
		color: var(--label-3);
		border-radius: 999px;
		padding: 0.125rem 0.4375rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
		transition:
			color 140ms ease-out,
			background-color 140ms ease-out;
	}
	.ghost button {
		color: inherit;
		opacity: 0.62;
	}
	button:hover {
		color: var(--label-1);
	}
	.ghost button:hover {
		color: inherit;
		opacity: 0.85;
	}
	button.on {
		background: var(--bg-elevated);
		color: var(--label-1);
		box-shadow: var(--shadow-chip);
	}
	.ghost button.on {
		background: color-mix(in srgb, currentColor 18%, transparent);
		color: inherit;
		opacity: 1;
		box-shadow: none;
	}
</style>
