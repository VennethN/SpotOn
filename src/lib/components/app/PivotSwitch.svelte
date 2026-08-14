<script lang="ts">
	/**
	 * What the map is a list of: areas, or the places standing in them.
	 *
	 * Sits above the panel rather than in the legend, because it is not a layer. A layer
	 * shows or hides something on top of the same map; this changes what a ROW is, and
	 * with it what the ranking means, what the panel describes and what a mark on the map
	 * stands for. A control that changes the noun belongs at the top of the thing it
	 * changes the noun of.
	 *
	 * Two words and a line of explanation. The words alone read as a filter, and the
	 * difference between the two modes is the whole point of having them.
	 */
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { Pivot } from '$lib/state/app.svelte';

	const app = getAppState();
	const c = $derived(copy());
</script>

<div class="pivot">
	<Segmented
		label={c.units.pivotHint}
		value={app.pivot}
		onchange={(v: Pivot) => app.setPivot(v)}
		options={[
			{ value: 'cell', label: c.units.pivotCell },
			{ value: 'unit', label: c.units.pivotUnit }
		]}
	/>
</div>

<style>
	.pivot {
		/* Full width and flush with the panel's own padding, so it reads as the panel's
		   heading rather than as a control floating inside it. */
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-bottom: 0.5rem;
		margin-bottom: 0.125rem;
		border-bottom: 1px solid var(--separator);
	}
</style>
