<script lang="ts">
	/**
	 * The street diorama, wrapped in the shared scene host.
	 *
	 * Only two things are specific to this scene: the sky at the same hour as a
	 * backdrop before WebGL is ready (and if WebGL fails), and the narrow focal
	 * plane that makes the eye read it as a model on a table.
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
		/** Competitors of the same kind in this area. */
		rivals?: number;
		/** Commercial space currently up for rent. */
		vacancies?: number;
		/** A description of the scene for screen readers — required, this scene carries meaning. */
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
			<!-- Tilt-shift: a narrow focal plane down the middle. This single cue is what
			     makes the eye read the scene as a model on a table, not a real city. -->
			<div class="tilt" aria-hidden="true"></div>
		{/snippet}
	</SceneCanvas>
</div>

<style>
	.street {
		position: absolute;
		inset: 0;
		/* The sky at the same hour, visible before WebGL is ready and if WebGL fails. */
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
	/* A backdrop blur is expensive on weak GPUs, and a user who has opted out of
	   transparency is not asking for a lens effect. */
	@media (prefers-reduced-transparency: reduce) {
		.tilt {
			display: none;
		}
	}
</style>
