<script lang="ts">
	/**
	 * The business type, as a row of marks over the map.
	 *
	 * The map always has a business type in force, because a score is meaningless
	 * without one: 83 for a coffee shop is not 83 for a laundry. Tapak sets it when
	 * the conversation names one, and this is the other way in, for a reader who
	 * already knows what they want to open and would rather point at it than type it.
	 *
	 * Marks rather than a rank of thirteen words: thirteen labels across the top read
	 * as a menu of everything the product does, which is the thing the launcher was
	 * built to avoid. An icon row is a control, and only the one in force says its
	 * name, so the row states what is being scored right now instead of listing what
	 * could be.
	 *
	 * The glyphs live here and not in `domain/categories`, which is where their names
	 * and data sources live: the domain layer describes what a category IS, and a path
	 * on a 24-unit grid is a decision about how it looks on screen.
	 */
	import { CATEGORIES } from '$lib/domain/categories';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { CategoryKey } from '$lib/types';

	const app = getAppState();
	const c = $derived(copy());

	/** One stroked glyph per business type, drawn on a 24 × 24 grid. */
	const ICONS: Record<CategoryKey, string[]> = {
		// a cup and its saucer
		kopi: ['M6 8.5h9.5V13a4.75 4.75 0 0 1-9.5 0z', 'M15.5 9.5h1.75a2.25 2.25 0 0 1 0 4.5H15.5', 'M4.5 19.5h13'],
		// a tapered cup with a straw
		minuman: ['M7 8.5h10l-1.1 10a1.2 1.2 0 0 1-1.2 1.1H9.3a1.2 1.2 0 0 1-1.2-1.1z', 'M13.5 8.5 15.5 4'],
		// a loaf, scored twice
		roti: ['M4.5 14c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5v1.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z', 'M9.5 11.5 8 14.5', 'M13.5 11.5 12 14.5'],
		// a rice bowl, steaming
		warteg: ['M4.5 12h15a7.5 7.5 0 0 1-15 0z', 'M7 19.5h10', 'M10 9V6.5', 'M14 9V6.5'],
		// a burger
		cepatsaji: ['M5 11a7 3.5 0 0 1 14 0z', 'M5.5 13.5h13', 'M5 16h14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z'],
		// noodles in a bowl, with a chopstick through them. The stick is what keeps this
		// apart from `warteg` at 17px: two bowls differing only in what floats above
		// them read as the same mark, and a diagonal breaks the silhouette.
		mie: [
			'M4.5 13h15a7.5 7.5 0 0 1-15 0z',
			'M7.5 10c1-1.6 2-1.6 3 0s2 1.6 3 0 2-1.6 3 0',
			'M14 10 19.5 4.5'
		],
		// a fish
		seafood: ['M3.5 12c3-4.2 8-4.2 11 0-3 4.2-8 4.2-11 0z', 'M14.5 12 20 8.5v7z', 'M7 11h.01'],
		// a fork and a knife
		restoasing: ['M8 4.5v4.5a2 2 0 0 0 4 0V4.5', 'M10 9v10.5', 'M16.5 4.5c1.6 1.6 1.6 5.4 0 7v8'],
		// a shopfront under an awning
		minimarket: ['M5 9.5h14l-1 10H6z', 'M3.5 9.5 5.5 5h13l2 4.5z', 'M10 19.5v-5.5h4v5.5'],
		// a basket
		kelontong: ['M4 9.5h16l-1.6 9.5a1 1 0 0 1-1 .5H6.6a1 1 0 0 1-1-.5z', 'M9 9.5V7a3 3 0 0 1 6 0v2.5'],
		// a washing machine
		laundry: ['M5 4.5h14v15H5z', 'M12 13.5m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M8 8h.01'],
		// a spanner
		bengkel: ['M17.5 4.6a4.6 4.6 0 0 0-6 6l-6.9 6.9 2 2 6.9-6.9a4.6 4.6 0 0 0 6-6l-2.9 2.9-2.4-.7-.7-2.4z'],
		// a cross
		apotek: ['M10 4.5h4V10h5.5v4H14v5.5h-4V14H4.5v-4H10z']
	};

	let rail = $state<HTMLDivElement | null>(null);

	/* Only a few marks fit on a phone, so the row scrolls. Whichever is in force is
	   brought into view when it changes, otherwise the conversation can set a business
	   type whose mark is sitting off the edge of its own control. */
	$effect(() => {
		const active = app.category;
		const el = rail?.querySelector<HTMLElement>(`[data-key="${active}"]`);
		if (!el || !rail) return;
		el.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'nearest',
			inline: 'nearest'
		});
	});
</script>

<div
	class="cats material"
	bind:this={rail}
	role="radiogroup"
	aria-label={c.app.categoryLabel}
	tabindex="-1"
>
	{#each CATEGORIES as def (def.key)}
		{@const on = def.key === app.category}
		<button
			type="button"
			data-key={def.key}
			class:on
			role="radio"
			aria-checked={on}
			title={c.category[def.key].name}
			aria-label={c.category[def.key].name}
			onclick={() => app.setCategory(def.key)}
		>
			<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
				{#each ICONS[def.key] as d (d)}
					<path
						{d}
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				{/each}
			</svg>
			<!-- Only the one in force is spelled out. The row is then a statement about
			     what the map is showing, rather than a list of everything it could. -->
			{#if on}<span class="lbl">{c.category[def.key].short}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.cats {
		position: fixed;
		top: 0.75rem;
		left: 50%;
		z-index: 8;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.125rem;
		max-width: calc(100vw - 16rem);
		padding: 0.25rem;
		border-radius: 999px;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}
	.cats::-webkit-scrollbar {
		display: none;
	}

	button {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		height: 1.875rem;
		padding: 0 0.4375rem;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--label-3);
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out,
			transform 100ms ease-out;
	}
	button:hover {
		color: var(--label-1);
		background: var(--fill-1);
	}
	/* Feedback on the press, not on the release. */
	button:active {
		transform: scale(0.94);
	}
	button.on {
		background: var(--accent);
		color: var(--accent-ink);
		padding-right: 0.625rem;
	}
	button.on:hover {
		color: var(--accent-ink);
		background: var(--accent);
	}
	.lbl {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.006em;
		white-space: nowrap;
	}

	/* Between the brand and the tools, which is all the room there is on a phone. A
	   row of its own would land on the legend, and the map is what both are for.
	   17rem is those two plus a gap either side, measured rather than guessed. */
	@media (max-width: 1023px) {
		.cats {
			max-width: calc(100vw - 17rem);
		}
	}
</style>
