<script lang="ts">
	/**
	 * The light around a box that is ready to be asked something.
	 *
	 * Two things at once. A halo that swells and settles, saying the box is live, and
	 * a few motes drifting in from outside and being absorbed at its edge, saying
	 * which way the attention runs. The motes point inwards on purpose: a ring of
	 * lights sitting still is decoration, and the same lights travelling towards the
	 * field are an instruction.
	 *
	 * Shared rather than written once per box. Both ask boxes are the same box at two
	 * moments of the same conversation, the one in the middle of the screen before
	 * anything has been asked and the one in the panel afterwards, so a difference
	 * between them would be a bug rather than a choice.
	 *
	 * Nothing here is a control. It takes no pointer, carries no label, and is hidden
	 * from assistive tech: what it says is already said by the field being enabled.
	 */
	interface Props {
		/** Lit, or fading out. Eased at both ends, so it never arrives on one frame. */
		on?: boolean;
		/**
		 * How far out the motes begin, as a multiple of the distances below.
		 *
		 * The panel's field is a third of the height of the launcher's, and motes that
		 * reach as far there would start up among the chips above it. So the caller
		 * says how much room it has rather than this guessing from the box.
		 */
		reach?: number;
	}
	let { on = false, reach = 1 }: Props = $props();

	/**
	 * Where each mote joins the box, and where it comes in from.
	 *
	 * `x` and `y` are the point on the box it is drawn to, in percent. `dx` and `dy`
	 * are where it starts, in pixels out from that point. Written down rather than
	 * generated: a random scatter differs between the server's render and the
	 * browser's, and every mote would jump once on hydration.
	 *
	 * They come mostly from the two ends, because that is where there is room. A pill
	 * on a panel has a few pixels above and below it and a whole margin either side.
	 */
	const MOTES = [
		{ x: 1, y: 50, dx: -30, dy: -2, size: 4.5, dur: 3.1, delay: -0.2 },
		{ x: 99, y: 50, dx: 30, dy: 2, size: 4.5, dur: 3.4, delay: -1.9 },
		{ x: 4, y: 22, dx: -24, dy: -15, size: 3, dur: 2.6, delay: -1.1 },
		{ x: 96, y: 78, dx: 24, dy: 15, size: 3, dur: 2.9, delay: -2.4 },
		{ x: 22, y: 0, dx: -9, dy: -20, size: 3.5, dur: 3.3, delay: -0.7 },
		{ x: 55, y: 0, dx: 5, dy: -23, size: 2.5, dur: 2.8, delay: -2.1 },
		{ x: 81, y: 0, dx: 12, dy: -18, size: 3, dur: 3.5, delay: -1.5 },
		{ x: 17, y: 100, dx: -11, dy: 19, size: 3, dur: 3, delay: -2.7 },
		{ x: 48, y: 100, dx: 3, dy: 22, size: 3.5, dur: 2.7, delay: -0.4 },
		{ x: 77, y: 100, dx: 13, dy: 18, size: 2.5, dur: 3.2, delay: -1.7 }
	];
</script>

<span class="glow" class:on aria-hidden="true" style="--reach: {reach}">
	<span class="pulse"></span>
	{#each MOTES as m, i (i)}
		<span
			class="mote"
			style="--x: {m.x}%; --y: {m.y}%; --dx: {m.dx}px; --dy: {m.dy}px; --size: {m.size}px; --dur: {m.dur}s; --delay: {m.delay}s"
		></span>
	{/each}
</span>

<style>
	/**
	 * Two nested elements carrying one light, and it has to be two.
	 *
	 * `opacity` cannot both run a keyframe animation and be transitioned on the same
	 * element: taking the animation away snaps the value rather than handing it to the
	 * transition, and the glow vanishes on a single frame. So the inner elements
	 * breathe and drift forever, and this one fades all of it in and out. The two
	 * multiply.
	 */
	.glow {
		position: absolute;
		inset: -1px;
		border-radius: 999px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 520ms ease-in-out;
	}
	.glow.on {
		opacity: 1;
	}

	/* Three shadows, not one: a tight ring that draws the edge, a wider one that gives
	   it a falloff, and a bloom that carries into the surface around it. A single
	   large blur at this strength reads as a smudge rather than as light. */
	.pulse {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent),
			0 0 0 7px color-mix(in srgb, var(--accent) 11%, transparent),
			0 0 26px 3px color-mix(in srgb, var(--accent) 46%, transparent);
		animation: breathe 3.2s ease-in-out infinite;
	}
	/* It never goes out, it only dips. A pulse that reaches zero reads as a fault
	   light rather than as something alive. */
	@keyframes breathe {
		0%,
		100% {
			opacity: 0.58;
		}
		50% {
			opacity: 1;
		}
	}

	.mote {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: var(--size);
		height: var(--size);
		margin-left: calc(var(--size) / -2);
		margin-top: calc(var(--size) / -2);
		border-radius: 999px;
		background: var(--accent);
		box-shadow: 0 0 7px 1px color-mix(in srgb, var(--accent) 55%, transparent);
		animation: drift var(--dur) ease-in-out var(--delay) infinite;
	}
	/**
	 * In from the outside, and gone at the edge.
	 *
	 * The delays are negative so every mote is already somewhere along its path on the
	 * first frame. Started at zero they would all set off together, which reads as a
	 * loading bar rather than as drift.
	 *
	 * It shrinks and fades as it lands instead of stopping. A mote that simply stops
	 * on the edge has arrived somewhere; one that fades into it has been taken in,
	 * which is the thing being said.
	 */
	@keyframes drift {
		0% {
			transform: translate3d(calc(var(--dx) * var(--reach)), calc(var(--dy) * var(--reach)), 0)
				scale(1);
			opacity: 0;
		}
		26% {
			opacity: 1;
		}
		74% {
			opacity: 0.85;
		}
		100% {
			transform: translate3d(0, 0, 0) scale(0.3);
			opacity: 0;
		}
	}

	/* Reduced motion keeps the halo and drops everything that moves. The halo alone
	   still says the box is ready; the motes only ever said it by travelling, so with
	   the travel gone there is nothing left for them to say. */
	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
			opacity: 0.85;
		}
		.mote {
			display: none;
		}
	}
</style>
