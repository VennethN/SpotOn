<script lang="ts">
	/**
	 * The theme button, one for both the landing page and the app.
	 *
	 * There used to be two: the landing one used an SVG icon in line with its
	 * typography, the app-bar one used Unicode glyphs (◐ ☾ ☀) that change shape —
	 * and sometimes colour — per platform. One button removes both the duplicated
	 * code and the difference in appearance.
	 */
	import { copy } from '$lib/state/lang.svelte';
	import { nextTheme, type Theme } from '$lib/state/theme.svelte';

	interface Props {
		theme: Theme;
		onchange: (t: Theme) => void;
		/** Landing-bar styling: no backing, following the ink of the sky behind it. */
		ghost?: boolean;
	}
	let { theme, onchange, ghost = false }: Props = $props();

	const label = $derived(copy().theme[theme]);
</script>

<button
	type="button"
	class={ghost ? 'ghost' : 'btn'}
	onclick={() => onchange(nextTheme(theme))}
	aria-label={label}
	title={label}
>
	<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
		{#if theme === 'dark'}
			<path
				d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linejoin="round"
			/>
		{:else if theme === 'light'}
			<circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4" />
			<g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
				<path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6" />
				<path d="M3.4 3.4 4.5 4.5M11.5 11.5l1.1 1.1M12.6 3.4 11.5 4.5M4.5 11.5l-1.1 1.1" />
			</g>
		{:else}
			<!-- Follow the system: a half-filled circle. -->
			<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />
			<path d="M8 2a6 6 0 0 0 0 12Z" fill="currentColor" />
		{/if}
	</svg>
</button>

<style>
	button {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		flex: none;
		border-radius: 999px;
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			color 160ms ease-out;
	}
	button:active {
		transform: scale(0.92);
	}
	.ghost {
		border: 1px solid currentColor;
		background: transparent;
		color: var(--stage-ink-muted, var(--label-2));
	}
	.ghost:hover {
		color: var(--stage-ink, var(--label-1));
	}
</style>
