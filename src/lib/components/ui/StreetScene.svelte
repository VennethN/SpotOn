<script lang="ts">
	/**
	 * Maket jalan, dibungkus wadah adegan bersama.
	 *
	 * Yang khas adegan ini tinggal dua: langit pada jam yang sama sebagai alas
	 * sebelum WebGL siap (dan bila WebGL gagal), serta bidang fokus sempit yang
	 * membuat mata membacanya sebagai maket di atas meja.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import { daylightAt } from '$lib/scene/daylight';
	import type { CategoryKey } from '$lib/types';

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
	}

	let {
		hour = 12,
		density = 0.5,
		category = 'kopi' as CategoryKey,
		cameraT = 0,
		nodata = false,
		rivals = 0,
		vacancies = 1,
		label
	}: Props = $props();

	const day = $derived(daylightAt(hour));

	const load = async () => {
		const { StreetWorld } = await import('$lib/scene/street');
		return (canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean }) =>
			new StreetWorld(canvas, opts);
	};
</script>

<div class="street" style:--sky-top={day.skyTop} style:--sky-horizon={day.skyHorizon}>
	<SceneCanvas
		{load}
		{label}
		state={{ hour, density, category, cameraT, nodata, rivals, vacancies }}
	>
		{#snippet overlay()}
			<!-- Tilt-shift: bidang fokus sempit di tengah. Satu isyarat inilah yang membuat
			     mata membaca adegan sebagai maket di atas meja, bukan kota sungguhan. -->
			<div class="tilt" aria-hidden="true"></div>
		{/snippet}
	</SceneCanvas>
</div>

<style>
	.street {
		position: absolute;
		inset: 0;
		/* Langit pada jam yang sama, terlihat sebelum WebGL siap dan bila WebGL gagal. */
		background: linear-gradient(to bottom, var(--sky-top) 0%, var(--sky-horizon) 78%);
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
