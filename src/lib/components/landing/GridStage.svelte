<script lang="ts">
	/**
	 * The hexagon grid being scored as you scroll.
	 *
	 * It moves like the diorama stage above — driven by scroll position rather than
	 * by time — but it is not sticky and adds no height to the page. Its track is read
	 * from this element's own position on screen: zero as it first appears from below,
	 * one as it is about to pass out the top. That way the reader never feels their
	 * scroll has been hijacked a second time.
	 *
	 * Its contents are deliberately not accurate, and it says so on screen: what it
	 * shows is how to read a grid, not any particular area.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { SpringValue, prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { WorldFactory } from '$lib/scene/world';

	const c = $derived(copy());
	let host = $state<HTMLElement | null>(null);
	let ink = $state('#1c1a16');
	let accent = $state('#0071e3');
	let ramp = $state<string[]>([]);
	let nodata = $state('#9aa2ad');

	const reduced = prefersReducedMotion();
	// A spring: raw scroll feels jittery, and a spring gives the grid some mass.
	const spring = new SpringValue(reduced ? 0.75 : 0, { damping: 1, response: 0.7 });

	const load = async (): Promise<WorldFactory> => {
		const { GridWorld } = await import('$lib/scene/grid');
		return (canvas, opts) => new GridWorld(canvas, opts);
	};

	$effect(() => {
		if (!host || reduced) return;
		const el = host;

		const onScroll = () => {
			const rect = el.getBoundingClientRect();
			// Zero when its top edge first touches the bottom of the viewport, one when
			// its bottom edge has passed the top third.
			const span = window.innerHeight + rect.height * 0.55;
			const seen = window.innerHeight - rect.top;
			spring.to(Math.max(0, Math.min(1, seen / span)));
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	// The scene's colours come from theme tokens rather than being pinned inside the
	// scene: its opportunity ramp has to be exactly the map's ramp, and the paper can
	// be light or dark. Re-read whenever the theme changes.
	$effect(() => {
		const read = () => {
			const cs = getComputedStyle(document.documentElement);
			ink = cs.getPropertyValue('--label-1').trim() || ink;
			accent = cs.getPropertyValue('--accent').trim() || accent;
			nodata = cs.getPropertyValue('--nodata').trim() || nodata;
			ramp = [0, 1, 2, 3, 4, 5, 6].map((i) =>
				cs.getPropertyValue(`--ramp-${i}`).trim()
			);
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

<figure class="grid-stage" bind:this={host}>
	<div class="frame">
		<SceneCanvas
			{load}
			state={{ progress: spring.current, ink, accent, ramp, nodata }}
			label={c.grid.label}
		/>
		<span class="mark">{c.grid.mark}</span>
	</div>
	<figcaption>
		<p>
			{c.grid.caption.lead}
			<strong>{c.grid.caption.strong}</strong>{c.grid.caption.rest}
		</p>
		<!-- The legend sits directly under the field that uses it: if the ramp has to be
		     hunted down elsewhere, the colour stops being an explanation. -->
		<div class="legend"><ScoreRamp dense nodata={c.grid.outOfScale} /></div>
	</figcaption>
</figure>

<style>
	.grid-stage {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.frame {
		position: relative;
		aspect-ratio: 16 / 7;
		border: 1px solid var(--paper-line);
		border-radius: var(--r-md);
		overflow: hidden;
		/* A base lifted slightly at its top edge — the same light that falls on
		   the model, rather than a flat field. */
		background: var(--lift-panel, var(--paper));
	}
	/* A permanent marker: this scene is schematic and must not be taken for a map. */
	.mark {
		position: absolute;
		left: 0.625rem;
		bottom: 0.5rem;
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		color: var(--label-3);
	}
	figcaption {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(9rem, 13rem);
		gap: 0.75rem 2rem;
		align-items: start;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	figcaption p {
		max-width: 54ch;
	}
	figcaption strong {
		color: var(--label-1);
		font-weight: 600;
	}

	@media (max-width: 720px) {
		.frame {
			aspect-ratio: 4 / 3;
		}
		figcaption {
			grid-template-columns: minmax(0, 1fr);
		}
		.legend {
			max-width: 16rem;
		}
	}
</style>
