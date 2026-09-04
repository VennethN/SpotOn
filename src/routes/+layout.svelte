<script lang="ts">
	import '../app.css';
	import { initLang } from '$lib/state/lang.svelte';

	let { children } = $props();

	// The language is restored once, before anything is redrawn.
	$effect(() => initLang());
</script>

{@render children()}
