<script lang="ts">
	import '../app.css';
	import RouteSkeleton from '$lib/components/ui/RouteSkeleton.svelte';
	import { initLang } from '$lib/state/lang.svelte';

	let { children } = $props();

	// The language is restored once, before anything is redrawn.
	$effect(() => initLang());
</script>

{@render children()}

<!-- Here rather than on either page, because what it draws is the page being navigated
     TO and the page being navigated FROM is still the one on screen. Every route can
     reach the map and the account page, so every route needs the outline of them. -->
<RouteSkeleton />
