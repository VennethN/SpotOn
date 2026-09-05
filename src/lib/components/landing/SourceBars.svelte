<script lang="ts">
	/**
	 * What is actually on record, per mode and per business type.
	 *
	 * Deliberately not one bar stacked in four colours: TransJakarta holds almost
	 * nine tenths of the nodes, so the other three modes would shrink to unreadable
	 * slivers. Four labelled rows are honest about that imbalance, and do not demand
	 * that the eye separate four adjacent colours.
	 *
	 * The fills run out from the left as the block is scrolled to, top row first. Same
	 * curve and the same beat as the column chart above it, so the two charts on this
	 * page read as one family rather than as two components that happen to sit near each
	 * other.
	 */
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';

	interface Row {
		nm: string;
		v: number;
		note?: string;
	}
	let { rows, unit }: { rows: Row[]; unit: string } = $props();

	const max = $derived(Math.max(1, ...rows.map((r) => r.v)));
	const fmt = (n: number) => n.toLocaleString('id-ID');

	let host = $state<HTMLElement | null>(null);
	let grown = $state(false);

	$effect(() => {
		if (!host) return;
		if (prefersReducedMotion()) {
			grown = true;
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					grown = true;
					io.disconnect();
				}
			},
			{ threshold: 0.3 }
		);
		io.observe(host);
		return () => io.disconnect();
	});
</script>

<ul class="bars" class:grown bind:this={host}>
	{#each rows as r, i (r.nm)}
		<li>
			<span class="nm">{r.nm}</span>
			<span class="track"
				><span
					class="fill"
					style:width={`${(r.v / max) * 100}%`}
					style:--step={`${i * 60}ms`}
				></span></span
			>
			<span class="v">{fmt(r.v)}</span>
			{#if r.note}<span class="note">{r.note}</span>{/if}
		</li>
	{/each}
</ul>
<p class="unit">{unit}</p>

<style>
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) 4rem;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
	}
	.nm {
		color: var(--label-1);
	}
	.track {
		height: 0.3125rem;
		border-radius: 999px;
		background: var(--fill-1);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background-image: var(--lift-bar);
		/* Scaled from its left edge rather than animated on `width`, so the growth is a
		   compositor job and the row's layout is never recalculated mid-flight. */
		transform: scaleX(0);
		transform-origin: left;
	}
	.bars.grown .fill {
		transform: none;
		transition: transform 620ms cubic-bezier(0.32, 0.72, 0, 1) var(--step, 0ms);
	}
	@media (prefers-reduced-motion: reduce) {
		.fill,
		.bars.grown .fill {
			transform: none;
			transition: none;
		}
	}
	.v {
		text-align: right;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.note {
		grid-column: 2 / -1;
		font-size: 0.6875rem;
		color: var(--label-3);
	}
	.unit {
		margin-top: 0.75rem;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--ink-3, var(--label-3));
	}

	@media (max-width: 520px) {
		li {
			grid-template-columns: 5.5rem minmax(0, 1fr) 3.25rem;
			gap: 0.5rem;
		}
	}
</style>
