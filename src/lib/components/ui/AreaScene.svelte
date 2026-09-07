<script lang="ts">
	/**
	 * The model of an area, wrapped in the shared scene host.
	 *
	 * The sibling of `StreetScene`, which hosts the landing page's showcase block. That
	 * one is composed and stands for the product. This one is read off the basemap and
	 * stands for one place: see `scene/area` for what is drawn and `domain/basemap` for
	 * where it comes from. The chores they share, loading three.js, pausing off screen,
	 * following the container, belong to `SceneCanvas` and are written once there.
	 *
	 * Only two things are specific to this scene: the sky at the same hour as a backdrop
	 * before WebGL is ready (and if WebGL fails), and the narrow focal plane that makes
	 * the eye read it as a model on a table rather than as a photograph of a city.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import { daylightAt } from '$lib/scene/daylight';
	import type { AreaGeometry, AreaMarks } from '$lib/types';

	const NO_MARKS: AreaMarks = { boundary: [], stops: [], rivals: [], units: [], field: [], doors: [] };

	interface Props {
		/** 0..24, the hour the light and the doors are drawn at. */
		hour?: number;
		/** 0..6, Monday first: the day the doors follow. */
		day?: number;
		cameraT?: number;
		/** A cell whose city the catalogue has not read: the ground is hatched. */
		nodata?: boolean;
		/** The walking radius, in metres: the size of the disc. */
		radius: number;
		/** What the basemap holds inside it, or null while that is still on its way. */
		geometry: AreaGeometry | null;
		/** The map's marks, in metres from the same point. */
		marks: AreaMarks | null;
		/** A description of the scene for screen readers. Required: this scene carries meaning. */
		label: string;
	}

	let {
		hour = 12,
		day = 0,
		cameraT = 0,
		nodata = false,
		radius,
		geometry,
		marks,
		label
	}: Props = $props();

	const light = $derived(daylightAt(hour));
	const m = $derived(marks ?? NO_MARKS);

	const load = async () => {
		const { AreaWorld } = await import('$lib/scene/area');
		return (canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean }) =>
			new AreaWorld(canvas, opts);
	};
</script>

<div class="area" style:--sky-top={light.skyTop} style:--sky-horizon={light.skyHorizon}>
	<SceneCanvas
		{load}
		{label}
		state={{
			hour,
			day,
			cameraT,
			nodata,
			radius,
			geometry,
			boundary: m.boundary,
			stops: m.stops,
			rivals: m.rivals,
			units: m.units,
			field: m.field,
			doors: m.doors
		}}
	>
		{#snippet overlay()}
			<!-- Tilt-shift: a narrow focal plane down the middle. This single cue is what
			     makes the eye read the scene as a model on a table, not a real city. -->
			<div class="tilt" aria-hidden="true"></div>
		{/snippet}
	</SceneCanvas>
</div>

<style>
	.area {
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
