<script lang="ts">
	/**
	 * The canvas host for a 3D scene.
	 *
	 * three.js is loaded dynamically — the page's initial bundle does not swell,
	 * and the page can still be server-rendered. Until the module arrives (or if
	 * WebGL is unavailable), what shows is whatever the caller passed in through
	 * the `fallback` snippet — not an empty box.
	 *
	 * Every scene shares the same chores: pausing when scrolled past or when its
	 * tab is hidden, following its container's size, and cleaning up on the way out.
	 * Written once here, rather than once per scene.
	 */
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { SceneWorld, WorldFactory } from '$lib/scene/world';

	interface Props {
		/** The dynamic import that returns the scene's factory. */
		load: () => Promise<WorldFactory>;
		/** The scene's state; every change is passed straight through. */
		state: Record<string, unknown>;
		/** A description of the scene for screen readers — required, this scene carries meaning. */
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
				console.error('[SpotOn] scene failed to load', e);
				failed = true;
			}
		})();

		return () => {
			disposed = true;
			instance?.dispose();
			world = null;
		};
	});

	// Reading `sceneState` here makes this effect re-run every time one of its
	// fields changes.
	$effect(() => {
		world?.applyState({ ...sceneState });
	});

	// Only runs while genuinely visible — another tab or scrolled past = idle.
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
