<script lang="ts">
	/**
	 * The grid as an object, standing in the head of the page.
	 *
	 * The same scene the landing page scrolls through, driven differently. There it is
	 * pulled by the reader's scroll, because the section around it is an argument being
	 * made a step at a time. Here there is no argument and no scroll to hijack, so it
	 * simply arrives: one spring from flat to scored when the page opens, and then it
	 * stands.
	 *
	 * IT ARRIVES ONCE AND THEN HOLDS. Nothing loops. A field whose columns rose and fell
	 * on a timer would be a picture of values changing, and these values do not change:
	 * they are the trade standing around ninety-one cells, sampled evenly across the
	 * whole grid. An entrance reveals a fixed reading. An idle animation would invent a
	 * moving one.
	 *
	 * The page's ONE three-dimensional object. The landing page settled that rule the
	 * hard way, and it holds here: the catchment field further down is deliberately flat,
	 * because a second slab competing with this one made both look like decoration.
	 *
	 * Marked as schematic, in the corner, permanently. The heights are real readings but
	 * the arrangement is not a map, and a five-ring hexagon of Jakarta-coloured columns
	 * is close enough to one to need saying.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { SpringValue, prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { WorldFactory } from '$lib/scene/world';

	/** A sample of the grid's own trade readings. Null = the catalogue never reached it. */
	let { model = [] }: { model?: Array<number | null> } = $props();

	const c = $derived(copy());

	const reduced = prefersReducedMotion();
	/* Slow on purpose. This is furniture arriving, not a control responding to a press,
	   and the field has to be legible on the way up rather than snapping into place. */
	const rise = new SpringValue(reduced ? 1 : 0, { damping: 1, response: 0.95 });
	$effect(() => {
		rise.to(1);
	});

	const load = async (): Promise<WorldFactory> => {
		const { GridWorld } = await import('$lib/scene/grid');
		return (canvas, opts) => new GridWorld(canvas, { ...opts, field: model });
	};

	/* The scene's colours are the page's own tokens rather than values pinned inside it:
	   its ramp has to be exactly the ramp the flat field below uses, and the paper can be
	   light or dark. Re-read whenever the theme moves, by either route it can move. */
	let ink = $state('#1c1a16');
	let accent = $state('#0071e3');
	let ramp = $state<string[]>([]);
	let nodata = $state('#9aa2ad');

	$effect(() => {
		const read = () => {
			const cs = getComputedStyle(document.documentElement);
			ink = cs.getPropertyValue('--label-1').trim() || ink;
			accent = cs.getPropertyValue('--accent').trim() || accent;
			nodata = cs.getPropertyValue('--nodata').trim() || nodata;
			ramp = [0, 1, 2, 3, 4, 5, 6].map((i) => cs.getPropertyValue(`--ramp-${i}`).trim());
		};
		read();
		const mo = new MutationObserver(read);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', read);
		return () => {
			mo.disconnect();
			mq.removeEventListener('change', read);
		};
	});
</script>

<div class="frame">
	<!-- No fallback snippet on purpose. `SceneCanvas` draws one BEHIND the canvas rather
	     than instead of it, and the canvas is transparent, so anything passed here shows
	     through for good. A second hexagon texture at a second scale behind a model made
	     of hexagons is two grids arguing. What stands in when there is no WebGL is the
	     recessed ground below, which is what the landing page's own grid stage does. -->
	<SceneCanvas
		{load}
		state={{ progress: rise.current, ink, accent, ramp, nodata }}
		label={c.account.modelLabel}
	/>
	<span class="mark">{c.account.modelMark}</span>
</div>

<style>
	.frame {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--r-md);
		overflow: hidden;
		/* A recessed ground rather than a second outline. This stands on a card already,
		   and a framed frame reads as two objects where there is one. */
		background: var(--fill-1);
	}

	.mark {
		position: absolute;
		left: 0.625rem;
		bottom: 0.5rem;
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--label-3);
		pointer-events: none;
	}

	@media (max-width: 46rem) {
		.frame {
			aspect-ratio: 16 / 9;
		}
	}
</style>
