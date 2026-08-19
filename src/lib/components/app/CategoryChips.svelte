<script lang="ts">
	/**
	 * What the map is currently scoring. A read-out, and nothing else.
	 *
	 * WHAT THIS REPLACED, AND WHY
	 *
	 * A row of thirteen marks, one per business type, exactly one of them lit. It was
	 * the only way to change what the map scored, which made the question box beside it
	 * decoration: a reader who typed "kedai kopi dan toko roti" watched the map colour
	 * itself for coffee and had to go and press a button to fix it.
	 *
	 * The first pass at fixing that kept a picker behind a "+", on the argument that a
	 * reader who already knows what they want to open should not have to type a sentence
	 * about it. That argument is wrong here. The whole claim of this product is that you
	 * ask and the map answers, and a picker sitting on top of the map says the asking is
	 * not to be trusted — the reader reaches for the buttons, and the question box is
	 * back to being decoration by another route.
	 *
	 * So there are no controls left. These chips state what the last answer covered, in
	 * the answer's own words, and the only thing that changes them is asking. Nothing
	 * here is pressable, which is the point: there is one way in, and it is a sentence.
	 *
	 * The glyphs live here and not in `domain/categories`, which is where their names
	 * and data sources live: the domain layer describes what a category IS, and a path
	 * on a 24-unit grid is a decision about how it looks on screen.
	 */
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
		// apart from `warteg` at 16px: two bowls differing only in what floats above
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

	let rail = $state<HTMLUListElement | null>(null);
	const active = $derived(app.categories);

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
</script>

<!-- Nothing named, nothing to report. The map is open on the trade around each cell,
     which belongs to no business type, so an empty pill floating over it would be a
     label with nothing to label. -->
{#if active.length}
	<ul class="cats material" bind:this={rail} aria-label={c.app.categoryLabel}>
		{#each active as key (key)}
			<li class="chip" data-key={key}>
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
			</li>
		{/each}
	</ul>
{/if}

<style>
	.cats {
		position: fixed;
		top: 0.75rem;
		left: 50%;
		z-index: 8;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		list-style: none;
		margin: 0;
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

	/* A statement, not a button. No hover, no press, no cursor change: nothing about
	   this should invite a click, because a click here does nothing and the way to
	   change what it says is to ask. */
	.chip {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		height: 1.875rem;
		padding: 0 0.625rem 0 0.5rem;
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

	/* Between the brand and the tools, which is all the room there is on a phone. A
	   row of its own would land on the legend, and the map is what both are for.
	   17rem is those two plus a gap either side, measured rather than guessed. */
	@media (max-width: 1023px) {
		.cats {
			max-width: calc(100vw - 17rem);
		}
	}
</style>
