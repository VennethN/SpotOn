<script lang="ts">
	/**
	 * Wadah kanvas untuk adegan tiga dimensi.
	 *
	 * three.js dimuat dinamis — bundel awal halaman tidak ikut membengkak, dan
	 * halaman tetap bisa dirender di server. Selama modulnya belum tiba (atau
	 * WebGL tidak tersedia), yang tampil adalah apa pun yang dititipkan pemanggil
	 * lewat snippet `fallback` — bukan kotak kosong.
	 *
	 * Semua adegan berbagi urusan yang sama: berhenti saat digulir lewat atau saat
	 * tabnya disembunyikan, ikut ukuran wadahnya, dan dibersihkan saat pergi.
	 * Ditulis sekali di sini, bukan sekali per adegan.
	 */
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { SceneWorld, WorldFactory } from '$lib/scene/world';

	interface Props {
		/** Impor dinamis yang mengembalikan pabrik adegannya. */
		load: () => Promise<WorldFactory>;
		/** Keadaan adegan; tiap perubahan diteruskan apa adanya. */
		state: Record<string, unknown>;
		/** Deskripsi adegan untuk pembaca layar — wajib, adegan ini membawa makna. */
		label: string;
		fallback?: Snippet;
		overlay?: Snippet;
	}
	let { load, state: sceneState, label, fallback, overlay }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);
	let world = $state<SceneWorld | null>(null);
	let failed = $state(false);

	$effect(() => {
		if (!canvas) return;
		let disposed = false;
		let instance: SceneWorld | null = null;

		(async () => {
			try {
				const create = await load();
				if (disposed || !canvas) return;
				instance = create(canvas, { reducedMotion: prefersReducedMotion() });
				world = instance;
			} catch (e) {
				console.error('[SpotOn] adegan gagal dimuat', e);
				failed = true;
			}
		})();

		return () => {
			disposed = true;
			instance?.dispose();
			world = null;
		};
	});

	// Membaca `sceneState` di sini membuat efek ini ikut berjalan setiap kali
	// salah satu isinya berubah.
	$effect(() => {
		world?.applyState({ ...sceneState });
	});

	// Hanya berjalan saat benar-benar terlihat — tab lain atau digulir lewat = diam.
	$effect(() => {
		if (!world || !host) return;
		const w = world;
		let onScreen = false;

		const sync = () => {
			if (onScreen && !document.hidden) w.start();
			else w.stop();
		};

		const io = new IntersectionObserver(
			([entry]) => {
				onScreen = entry.isIntersecting;
				sync();
			},
			{ threshold: 0.01 }
		);
		io.observe(host);

		const ro = new ResizeObserver(() => w.resize());
		ro.observe(host);

		document.addEventListener('visibilitychange', sync);
		return () => {
			io.disconnect();
			ro.disconnect();
			document.removeEventListener('visibilitychange', sync);
			w.stop();
		};
	});
</script>

<div class="scene" bind:this={host} role="img" aria-label={label}>
	{#if fallback}{@render fallback()}{/if}
	<canvas bind:this={canvas} class:hidden={failed}></canvas>
	{#if overlay}{@render overlay()}{/if}
</div>

<style>
	.scene {
		position: absolute;
		inset: 0;
	}
	canvas {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
	}
	canvas.hidden {
		display: none;
	}
</style>
