<script lang="ts">
	/**
	 * Pembungkus adegan jalan. three.js dimuat dinamis — bundel awal halaman tidak
	 * ikut membengkak, dan halaman tetap bisa dirender di server.
	 *
	 * Selama modul belum tiba (atau WebGL tidak tersedia), yang tampil adalah
	 * gradien langit pada jam yang sama — bukan kotak kosong.
	 */
	import { daylightAt, type DaylightSample } from '$lib/three/daylight';
	import type { StreetWorld } from '$lib/three/street';
	import type { CategoryKey } from '$lib/types';
	import { prefersReducedMotion } from '$lib/motion.svelte';

	interface Props {
		hour?: number;
		density?: number;
		category?: CategoryKey;
		cameraT?: number;
		nodata?: boolean;
		/** Pesaing sejenis di kawasan ini. */
		rivals?: number;
		/** Ruang usaha yang sedang disewakan. */
		vacancies?: number;
		/** Deskripsi adegan untuk pembaca layar — wajib, adegan ini membawa makna. */
		label: string;
		onready?: (day: DaylightSample) => void;
	}

	let {
		hour = 12,
		density = 0.5,
		category = 'kopi' as CategoryKey,
		cameraT = 0,
		nodata = false,
		rivals = 0,
		vacancies = 1,
		label,
		onready
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);
	let world = $state<StreetWorld | null>(null);
	let failed = $state(false);

	const day = $derived(daylightAt(hour));

	$effect(() => {
		if (!canvas) return;
		let disposed = false;
		let instance: StreetWorld | null = null;

		(async () => {
			try {
				const { StreetWorld: W } = await import('$lib/three/street');
				if (disposed || !canvas) return;
				instance = new W(canvas, { reducedMotion: prefersReducedMotion() });
				world = instance;
				onready?.(daylightAt(hour));
			} catch (e) {
				console.error('[SpotOn] adegan jalan gagal dimuat', e);
				failed = true;
			}
		})();

		return () => {
			disposed = true;
			instance?.dispose();
			world = null;
		};
	});

	// Perubahan keadaan diteruskan ke adegan; membaca prop di sini membuat efek
	// ini ikut berjalan setiap kali salah satunya berubah.
	$effect(() => {
		world?.applyState({ hour, density, category, cameraT, nodata, rivals, vacancies });
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

<div
	class="street"
	bind:this={host}
	style:--sky-top={day.skyTop}
	style:--sky-horizon={day.skyHorizon}
	role="img"
	aria-label={label}
>
	<canvas bind:this={canvas} class:hidden={failed}></canvas>
	<!-- Tilt-shift: bidang fokus sempit di tengah. Satu isyarat inilah yang membuat
	     mata membaca adegan sebagai maket di atas meja, bukan kota sungguhan. -->
	<div class="tilt" aria-hidden="true"></div>
</div>

<style>
	.street {
		position: absolute;
		inset: 0;
		/* Langit pada jam yang sama, terlihat sebelum WebGL siap dan bila WebGL gagal. */
		background: linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-horizon) 78%);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	canvas.hidden {
		display: none;
	}

	.tilt {
		position: absolute;
		inset: 0;
		pointer-events: none;
		backdrop-filter: blur(3.5px);
		-webkit-backdrop-filter: blur(3.5px);
		mask-image: linear-gradient(
			to bottom,
			#000 0%,
			rgba(0, 0, 0, 0.45) 16%,
			transparent 34%,
			transparent 58%,
			rgba(0, 0, 0, 0.5) 82%,
			#000 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			#000 0%,
			rgba(0, 0, 0, 0.45) 16%,
			transparent 34%,
			transparent 58%,
			rgba(0, 0, 0, 0.5) 82%,
			#000 100%
		);
	}
	/* Blur latar mahal di GPU lemah, dan pengguna yang menolak transparansi
	   tidak sedang meminta efek lensa. */
	@media (prefers-reduced-transparency: reduce) {
		.tilt {
			display: none;
		}
	}
</style>
