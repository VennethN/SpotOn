<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SpringValue, VelocityTracker, project, rubberband } from '$lib/motion.svelte';

	let {
		detents = [0.16, 0.52, 0.92],
		index = $bindable(1),
		children,
		header
	}: {
		/** Tinggi tampak sebagai fraksi tinggi layar, dari terkecil ke terbesar. */
		detents?: number[];
		index?: number;
		children: Snippet;
		header?: Snippet;
	} = $props();

	let viewportH = $state(800);
	let sheet = $state<HTMLElement | null>(null);
	let dragging = $state(false);

	// y = jarak dari puncak layar. Detent besar → y kecil.
	const y = new SpringValue(0, { damping: 1, response: 0.36 });
	const tracker = new VelocityTracker();
	const yFor = (i: number) => viewportH * (1 - detents[i]);

	let grabOffset = 0;
	let started = false;

	$effect(() => {
		// Detent berubah dari luar (mis. tombol) → pegas menuju ke sana.
		const target = yFor(index);
		if (!dragging) y.to(target);
	});

	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
		started = false;
		// Hormati titik pegang: sheet tidak boleh melompat ke bawah jari.
		grabOffset = e.clientY - y.current;
		tracker.reset();
		tracker.add(e.clientY, e.timeStamp);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		tracker.add(e.clientY, e.timeStamp);
		const raw = e.clientY - grabOffset;
		// Histeresis kecil sebelum gestur dianggap seretan.
		if (!started && Math.abs(raw - y.current) < 6) return;
		started = true;

		const min = yFor(detents.length - 1);
		const max = yFor(0);
		let next = raw;
		// Batas lunak: makin jauh melewati batas, makin berat — bukan berhenti mendadak.
		if (raw < min) next = min - rubberband(min - raw, viewportH);
		else if (raw > max) next = max + rubberband(raw - max, viewportH);
		y.snap(next);
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		dragging = false;
		const velocity = tracker.velocity();
		// Mendarat ke arah lemparan, bukan ke titik lepas.
		const projected = y.current + project(velocity);
		let best = 0;
		let bestDist = Infinity;
		detents.forEach((_, i) => {
			const d = Math.abs(yFor(i) - projected);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		});
		index = best;
		// Sedikit lonjakan hanya karena gestur ini memang membawa momentum.
		y.configure({ damping: Math.abs(velocity) > 120 ? 0.82 : 1, response: 0.34 });
		y.to(yFor(best), velocity);
	}

	function cycle() {
		index = index >= detents.length - 1 ? 0 : index + 1;
	}
</script>

<svelte:window bind:innerHeight={viewportH} />

<section
	class="sheet material"
	bind:this={sheet}
	style:transform={`translate3d(0, ${y.current}px, 0)`}
	style:height={`${viewportH}px`}
	aria-label="Panel informasi"
>
	<!-- Seluruh area pegangan menerima seretan; tombol di dalamnya tetap dapat difokus
	     dan menggilir tinggi panel bagi pengguna papan tik. -->
	<div
		class="grab"
		role="presentation"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<button
			type="button"
			class="handle"
			onclick={cycle}
			aria-label="Ubah tinggi panel"
			aria-expanded={index === detents.length - 1}
		></button>
		{#if header}
			<div class="header">{@render header()}</div>
		{/if}
	</div>
	<div class="content scroll" class:locked={dragging}>
		{@render children()}
	</div>
</section>

<style>
	.sheet {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-xl) var(--r-xl) 0 0;
		border-bottom: 0;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		box-shadow: var(--shadow-sheet);
		will-change: transform;
		touch-action: none;
	}
	.grab {
		flex: none;
		padding: 0.375rem 0.875rem 0.5rem;
		touch-action: none;
		cursor: grab;
	}
	.grab:active {
		cursor: grabbing;
	}
	.handle {
		display: block;
		width: 2.25rem;
		height: 0.3125rem;
		margin: 0 auto 0.5rem;
		border: 0;
		padding: 0;
		border-radius: 99px;
		background: var(--fill-3);
		cursor: pointer;
		transition: transform 120ms ease-out;
	}
	.grab:active .handle {
		transform: scaleX(1.15);
	}
	.content {
		flex: 1;
		min-height: 0;
		padding: 0 0.875rem 6rem;
		-webkit-overflow-scrolling: touch;
	}
	.content.locked {
		overflow: hidden;
	}
</style>
