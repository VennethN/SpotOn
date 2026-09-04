<script lang="ts">
	import '../app.css';
	import { initLang } from '$lib/state/lang.svelte';

	let { children } = $props();

	// Bahasa dipulihkan sekali, sebelum apa pun digambar ulang.
	$effect(() => initLang());
</script>

{@render children()}
