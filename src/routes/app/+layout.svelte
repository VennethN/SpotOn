<script lang="ts">
	/**
	 * Who is signed in, put where the map can reach it.
	 *
	 * A layout rather than the page, so the account is in place before the page's own
	 * state is built: `AppState` is handed this as its wallet the moment it is created,
	 * and a map that existed for even one frame without one would be a map that could
	 * take a reading for nothing.
	 */
	import { untrack } from 'svelte';
	import { setAccountState } from '$lib/state/account.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Read once, like the grid the page below is handed. What happens to this account
	// after the page has loaded is this class's business, not the load function's.
	setAccountState(untrack(() => data.account));
</script>

{@render children()}
