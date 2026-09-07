<script lang="ts">
	/**
	 * The catchment diorama, wrapped in the shared scene host.
	 *
	 * The sibling of `StreetScene`, which hosts the landing page's showcase block. They
	 * are two scenes on purpose: that one stands for the product and is composed, this
	 * one stands for one cell and is counted. The chores they share — loading three.js,
	 * pausing off screen, following the container — belong to `SceneCanvas` and are
	 * written once there.
	 *
	 * Only two things are specific to this scene: the sky at the same hour as a backdrop
	 * before WebGL is ready (and if WebGL fails), and the narrow focal plane that makes
	 * the eye read it as a model on a table.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import type { SceneTransit } from '$lib/scene/catchment';
	import { daylightAt } from '$lib/scene/daylight';
	import type { CategoryKey } from '$lib/types';

	const NO_TRANSIT: SceneTransit = { mrt: 0, krl: 0, lrt: 0, brt: 0 };

	interface Props {
		hour?: number;
		density?: number;
		category?: CategoryKey;
		cameraT?: number;
		/** A cell whose city the catalogue has not read: the block is emptied. */
		nodata?: boolean;
		/** Competitors of the same kind in this area, one shopfront bay each. */
		rivals?: number;
		/** Commercial space currently up for rent, one pad each. */
		vacancies?: number;
		/** Transit nodes in range, by mode. Drawn as the stops themselves. */
		transit?: SceneTransit;
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
		transit = NO_TRANSIT,
		label
	}: Props = $props();

	const day = $derived(daylightAt(hour));

	const load = async () => {
		const { CatchmentWorld } = await import('$lib/scene/catchment');
		return (canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean }) =>
			new CatchmentWorld(canvas, opts);
	};
</script>

<div class="street" style:--sky-top={day.skyTop} style:--sky-horizon={day.skyHorizon}>
	<SceneCanvas
		{load}
		{label}
		state={{ hour, density, category, cameraT, nodata, rivals, vacancies, transit }}
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
