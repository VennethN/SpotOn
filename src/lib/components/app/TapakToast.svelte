<script lang="ts">
	/**
	 * What Tapak says about the area you just picked.
	 *
	 * Same voice and same figure as the panel, deliberately not in it. The thread is
	 * for questions and answers; tapping a hexagon is neither, and a remark filed as a
	 * turn pushed the user's actual question up out of sight one tap at a time.
	 *
	 * So it arrives here instead: over the map, near the thing it is about, and gone
	 * again by itself. Nothing is lost by letting it go, because everything it says is
	 * still in the card on the left, in figures.
	 *
	 * It holds while the pointer is on it or the keyboard is in it, because a note
	 * that disappears mid-sentence is worse than no note.
	 */
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { Tapak } from '$lib/state/tapak.svelte';

	let { tapak }: { tapak: Tapak } = $props();

	const c = $derived(copy());

	/** Long enough to read two sentences without hurrying, short enough not to sit. */
	const LIFE_MS = 9000;

	let held = $state(false);

	/* The id is what the timer keys off, not the text: picking a second area with the
	   same reading would otherwise inherit the first one's remaining time. */
	$effect(() => {
		const note = tapak.remark;
		if (!note || held) return;
		const timer = setTimeout(() => {
			// Still the same remark? A newer one has its own timer.
			if (tapak.remark?.id === note.id) tapak.clearRemark();
		}, LIFE_MS);
		return () => clearTimeout(timer);
	});

	function fly(_node: Element) {
		const reduced = prefersReducedMotion();
		return {
			duration: reduced ? 120 : 320,
			css: (t: number, u: number) =>
				`opacity: ${t};` + (reduced ? '' : `transform: translate3d(0, ${u * 10}px, 0);`)
		};
	}
</script>

{#if tapak.remark}
	{#key tapak.remark.id}
		<div
			class="toast material"
			role="status"
			aria-live="polite"
			transition:fly
			onpointerenter={() => (held = true)}
			onpointerleave={() => (held = false)}
			onfocusin={() => (held = true)}
			onfocusout={() => (held = false)}
		>
			<span class="face" aria-hidden="true"><TapakFigure size={26} /></span>
			<p>{tapak.remark.text}</p>
			<button type="button" onclick={() => tapak.clearRemark()} aria-label={c.app.dismissRemark}>
				<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
					<path
						d="M4 4l8 8M12 4l-8 8"
						stroke="currentColor"
						stroke-width="1.7"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>
	{/key}
{/if}

<style>
	/* Bottom centre: the card owns the left, the thread owns the right, and the map
	   under the middle is where the user just tapped. */
	.toast {
		position: fixed;
		left: 50%;
		bottom: 2.5rem;
		z-index: 7;
		transform: translateX(-50%);
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		width: max-content;
		max-width: min(30rem, calc(100vw - 3rem));
		padding: 0.625rem 0.625rem 0.625rem 0.75rem;
		border-radius: var(--r-lg);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		box-shadow: var(--shadow-panel);
	}
	.face {
		flex: none;
		margin-top: -0.125rem;
	}
	p {
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--label-1);
	}
	button {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.0625rem;
		border: 0;
		border-radius: 999px;
		background: var(--fill-1);
		color: var(--label-3);
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out,
			color 140ms ease-out;
	}
	button:hover {
		background: var(--fill-2);
		color: var(--label-1);
	}
	button:active {
		transform: scale(0.9);
	}

	/* On a compact screen the sheet owns the bottom of the window, so the toast moves
	   to the top, under the chrome. */
	@media (max-width: 1023px) {
		.toast {
			top: 6.75rem;
			bottom: auto;
			max-width: calc(100vw - 1.5rem);
		}
	}
</style>
