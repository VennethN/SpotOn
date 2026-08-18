<script lang="ts">
	/**
	 * What the map is currently scoring, as chips over it.
	 *
	 * WHAT THIS REPLACED, AND WHY
	 *
	 * A row of thirteen marks, one per business type, exactly one of them lit. It was
	 * the only way to change what the map scored, which made the question box beside it
	 * decoration: a reader who typed "kedai kopi dan toko roti" watched the map colour
	 * itself for coffee and had to go and press a button to fix it. If asking cannot set
	 * what is on screen, there is no reason to ask.
	 *
	 * So this is a READ-OUT FIRST. It says what the last answer covered, in the answer's
	 * own words, and each type can be dropped from it. Adding one is done by saying so,
	 * which is what the box is for — the "+" is an escape hatch for a reader who arrived
	 * knowing what they want to open, not the way the product is meant to be driven.
	 *
	 * The full list is the same icon row it always was, folded away until asked for.
	 * Thirteen labels across the top of a map read as a menu of everything the product
	 * does; open only on request, they read as a control.
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

	let open = $state(false);
	let rail = $state<HTMLDivElement | null>(null);

	const active = $derived(app.categories);
	/* The last type standing cannot be dropped. An empty set has no rivals to count,
	   and the engine reads no rivals as no competition — the whole map would go green
	   for a question nobody asked. Said in the tooltip rather than silently ignored. */
	const canDrop = $derived(active.length > 1);

	/* An answer closes the list. The reader asked, the map moved, and leaving a picker
	   open across it hides the thing they asked to see.

	   Keyed on the ANSWER and not on the set, though the set is what the picker changes.
	   Closing on the set would shut the list on its own first click, which makes picking
	   a second type a matter of reopening it — and picking several is the one thing this
	   list is better at than typing. */
	$effect(() => {
		void app.ai;
		open = false;
	});

	/* Only a few chips fit on a phone, so the bar scrolls. Whatever was just added is
	   brought into view, otherwise a question can add a type whose chip is sitting off
	   the edge of the bar that is supposed to be reporting it. */
	$effect(() => {
		const last = active[active.length - 1];
		const el = rail?.querySelector<HTMLElement>(`[data-key="${last}"]`);
		if (!el || !rail) return;
		el.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'nearest',
			inline: 'nearest'
		});
	});

	function toggle(key: CategoryKey) {
		if (active.includes(key)) app.removeCategory(key);
		else app.setCategories([...active, key]);
	}
</script>

<div class="wrap">
	<div class="cats material" bind:this={rail} aria-label={c.app.categoryLabel} role="group">
		{#each active as key (key)}
			<span class="chip">
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					{#each ICONS[key] as d (d)}
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
				<span class="lbl">{c.category[key].short}</span>
				<button
					type="button"
					class="x"
					disabled={!canDrop}
					title={canDrop ? c.app.catRemove(c.category[key].name) : c.app.catOnlyOne}
					aria-label={c.app.catRemove(c.category[key].name)}
					onclick={() => app.removeCategory(key)}
				>
					<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
						<path
							d="M6 6 18 18M18 6 6 18"
							fill="none"
							stroke="currentColor"
							stroke-width="2.4"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</span>
		{/each}

		<button
			type="button"
			class="more"
			class:on={open}
			aria-expanded={open}
			title={open ? c.app.catAddClose : c.app.catAdd}
			aria-label={open ? c.app.catAddClose : c.app.catAdd}
			onclick={() => (open = !open)}
		>
			<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
				<path
					d={open ? 'M6 6 18 18M18 6 6 18' : 'M12 5v14M5 12h14'}
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>

	{#if open}
		<div class="picker material">
			<p class="hint">{c.app.catAskInstead}</p>
			<div class="grid" role="group" aria-label={c.app.categoryLabel}>
				{#each CATEGORIES as def (def.key)}
					{@const on = active.includes(def.key)}
					<button
						type="button"
						class="opt"
						class:on
						aria-pressed={on}
						disabled={on && !canDrop}
						onclick={() => toggle(def.key)}
					>
						<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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
						<span>{c.category[def.key].name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: fixed;
		top: 0.75rem;
		left: 50%;
		z-index: 8;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		max-width: calc(100vw - 16rem);
	}

	.cats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 100%;
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

	/* A chip is a statement, not a button: the map IS scoring this. Only the cross
	   inside it is pressable, which is why the chip itself carries no hover. */
	.chip {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		height: 1.875rem;
		padding: 0 0.3125rem 0 0.5rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.lbl {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.006em;
		white-space: nowrap;
	}
	.x {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.125rem;
		height: 1.125rem;
		flex: none;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: inherit;
		opacity: 0.62;
		cursor: pointer;
		transition:
			opacity 140ms ease-out,
			background-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.x:hover:not(:disabled) {
		opacity: 1;
		background: color-mix(in srgb, var(--accent-ink) 20%, transparent);
	}
	/* Feedback on the press, not on the release. */
	.x:active:not(:disabled) {
		transform: scale(0.88);
	}
	/* The last one standing. Dimmed rather than removed, so the chip does not change
	   shape as the set shrinks and the reason is in the tooltip. */
	.x:disabled {
		opacity: 0.25;
		cursor: default;
	}

	.more {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		padding: 0;
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
	.more:hover,
	.more.on {
		color: var(--label-1);
		background: var(--fill-1);
	}
	.more:active {
		transform: scale(0.9);
	}

	.picker {
		width: min(26rem, calc(100vw - 1.5rem));
		max-height: min(24rem, calc(100vh - 6rem));
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.75rem;
		border-radius: var(--r-xl);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
	}
	/* Says what this list is second best to. The picker exists for a reader who already
	   knows what they want to open; everyone else is better served by saying it. */
	.hint {
		margin: 0 0 0.625rem;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--label-3);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
		gap: 0.25rem;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		min-height: 2rem;
		padding: 0.25rem 0.5rem;
		border: 0;
		border-radius: 0.5rem;
		background: none;
		color: var(--label-2);
		font-size: 0.75rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			color 140ms ease-out,
			transform 100ms ease-out;
	}
	.opt svg {
		flex: none;
	}
	.opt:hover:not(:disabled) {
		color: var(--label-1);
		background: var(--fill-1);
	}
	.opt:active:not(:disabled) {
		transform: scale(0.97);
	}
	.opt.on {
		color: var(--accent-ink);
		background: var(--accent);
	}
	.opt.on:hover:not(:disabled) {
		color: var(--accent-ink);
		background: var(--accent);
	}
	.opt:disabled {
		cursor: default;
	}

	/* Between the brand and the tools, which is all the room there is on a phone. A
	   row of its own would land on the legend, and the map is what both are for.
	   17rem is those two plus a gap either side, measured rather than guessed. */
	@media (max-width: 1023px) {
		.wrap {
			max-width: calc(100vw - 17rem);
		}
	}
</style>
