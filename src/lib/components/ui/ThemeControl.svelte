<script lang="ts">
	/**
	 * The theme button, wired to where the choice is kept.
	 *
	 * `ThemeToggle` draws the control and reports a press. This is the half that reads the
	 * stored choice on the way in and writes it on the way out, and it exists so that half
	 * is written once. `state/theme` already records why: two copies of the same rule over
	 * the same storage is the easiest way to get two pages disagreeing about which theme
	 * the reader picked, and there are now four surfaces carrying this button.
	 *
	 * Nothing here applies the theme on load. `app.html` does that in a blocking script
	 * before the first paint, because a theme applied from a component runs after one, and
	 * a reader on dark would watch the page arrive white.
	 */
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { browser } from '$app/environment';
	import { applyTheme, storedTheme, type Theme } from '$lib/state/theme.svelte';

	/** Landing-bar styling: follows the ink of the sky behind it. */
	let { ghost = false }: { ghost?: boolean } = $props();

	/* Starts at `system` and is corrected on mount rather than read at init, because the
	   server has no storage to read and a value read there would be the server's. */
	let theme = $state<Theme>('system');
	$effect(() => {
		if (browser) theme = storedTheme();
	});
</script>

<ThemeToggle
	{theme}
	{ghost}
	onchange={(next: Theme) => {
		theme = next;
		applyTheme(next);
	}}
/>
