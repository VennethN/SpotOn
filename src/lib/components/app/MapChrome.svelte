<script lang="ts">
	/**
	 * The floating chrome above the map.
	 *
	 * No bar eating a strip of the screen. Two pieces of translucent material float
	 * over the map and the map flows underneath: identity on the left, language and
	 * theme on the right.
	 *
	 * Between them sit the business types the map is currently scoring, as chips. They
	 * are a read-out before they are a control: the question box sets them, and what is
	 * on screen is what the last answer covered. The full list of thirteen is folded
	 * away behind a "+", because a permanent row of thirteen buttons makes the product
	 * read as a menu of everything it does rather than as a map answering a question.
	 *
	 * The coverage pill, the competitor-source switch and the advanced drawer button
	 * have all left: the first is a statistic nobody acts on mid-task, and the other
	 * two now sit next to what they actually change.
	 */
	import CategoryChips from '$lib/components/app/CategoryChips.svelte';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { base } from '$app/paths';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());
</script>

<a class="brand material" href="{base}/" aria-label={c.app.home}>
	<span class="mark" aria-hidden="true"></span>
	<span class="name">{c.brand.name}</span>
</a>

<CategoryChips />

<div class="tools material">
	<LangToggle />
	<span class="sep" aria-hidden="true"></span>
	<ThemeToggle theme={app.theme} onchange={(t) => app.setTheme(t)} />
</div>

<style>
	.brand,
	.tools {
		position: fixed;
		top: 0.75rem;
		z-index: 8;
		border-radius: 999px;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
	}

	.brand {
		left: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.875rem 0.375rem 0.625rem;
		text-decoration: none;
		color: var(--label-1);
		transition: transform 100ms ease-out;
	}
	/* Feedback on the press, not on the release. */
	.brand:active {
		transform: scale(0.97);
	}
	.mark {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 4px;
		background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 82%, white), var(--accent));
		box-shadow: var(--shadow-chip);
	}
	.name {
		/* Size up, tracking in. */
		font-size: 0.9375rem;
		font-weight: 650;
		letter-spacing: -0.018em;
		line-height: 1.2;
	}

	.tools {
		right: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.4375rem;
	}
	.sep {
		width: 1px;
		height: 1rem;
		background: var(--separator);
	}
</style>
