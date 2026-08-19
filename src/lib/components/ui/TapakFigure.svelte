<script lang="ts">
	/**
	 * Tapak's figure: a single white scale figure, drawn in the same visual grammar
	 * as the figures in the diorama — round head, capsule body, legs one stride apart.
	 * Drawn as SVG rather than a second WebGL scene: one small icon is not worth the
	 * cost of a GL context of its own.
	 */
	interface Props {
		size?: number;
		/** Walking: legs apart. Still: legs together. */
		walking?: boolean;
		/**
		 * Thinking about it: the figure walks a few steps one way, turns, and walks
		 * back, the way somebody works a question out on their feet.
		 *
		 * This is the whole waiting state. A spinner says the machine is busy; a figure
		 * pacing says the person you asked is still thinking, which is what is actually
		 * happening, and it is the same figure that will answer.
		 *
		 * Every turn is eased at both ends, so the figure slows to a stop before it
		 * comes back rather than snapping around. A pace that changes direction on one
		 * frame reads as a glitch, not as somebody turning.
		 */
		pacing?: boolean;
	}
	let { size = 34, walking = true, pacing = false }: Props = $props();
</script>

<svg
	width={size}
	height={size * 1.32}
	viewBox="0 0 26 34"
	aria-hidden="true"
	class:walking
	class:pacing
>
	<g class="pace">
		<!-- contact shadow: a model figure always sits on its base -->
		<ellipse cx="13" cy="32.4" rx="7.5" ry="1.5" class="shadow" />
		<g class="body">
			<!-- legs -->
			<rect class="limb" x="10.6" y="20" width="2.5" height="11.6" rx="1.2" />
			<rect class="limb back" x="13" y="20" width="2.5" height="11.6" rx="1.2" />
			<!-- arms -->
			<rect class="limb arm" x="7.6" y="11.6" width="2.1" height="8.4" rx="1" />
			<rect class="limb arm back" x="16.3" y="11.6" width="2.1" height="8.4" rx="1" />
			<!-- body -->
			<rect class="torso" x="9" y="9.4" width="8" height="12.4" rx="4" />
			<!-- head -->
			<circle class="head" cx="13" cy="5.4" r="3.6" />
		</g>
	</g>
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.shadow {
		fill: rgba(15, 20, 30, 0.18);
	}
	.torso,
	.head,
	.limb {
		fill: #f2f0ec;
		stroke: rgba(20, 24, 32, 0.22);
		stroke-width: 0.6;
	}
	.head {
		fill: #eae7e1;
	}
	.limb {
		fill: #e4e1db;
	}
	/* The far-side limbs are dimmed — that is what gives depth without a shadow. */
	.limb.back {
		fill: #d3d0ca;
	}
	.arm {
		fill: #edeae5;
	}

	/* A one-stride pose, frozen like the figures in the diorama. */
	.walking .limb:not(.arm) {
		transform-origin: 50% 20px;
	}
	.walking .limb:nth-of-type(1) {
		transform: rotate(11deg);
	}
	.walking .limb:nth-of-type(2) {
		transform: rotate(-13deg);
	}
	.walking .arm {
		transform-origin: 50% 12px;
	}
	.walking .arm:nth-of-type(3) {
		transform: rotate(-9deg);
	}
	.walking .arm:nth-of-type(4) {
		transform: rotate(10deg);
	}

	/* ── pacing ───────────────────────────────────────────────────────────
	   Four movements on one clock. The traverse takes 2.64s, a stride 0.88s, so
	   three strides land on each leg of the walk and the figure never turns
	   mid-step.

	   The travel and the lean are one animation on one element on purpose: two
	   animations writing `transform` on the same element do not compose, the
	   second simply wins, and the lean would have eaten the walk. */
	@keyframes pace {
		0% {
			transform: translateX(-3.4px) rotate(-1.8deg);
		}
		50% {
			transform: translateX(3.4px) rotate(1.8deg);
		}
		100% {
			transform: translateX(-3.4px) rotate(-1.8deg);
		}
	}
	/* One rise per step, so the walk has a footfall rather than gliding. */
	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-0.55px);
		}
	}
	@keyframes stride {
		0% {
			transform: rotate(14deg);
		}
		50% {
			transform: rotate(-14deg);
		}
		100% {
			transform: rotate(14deg);
		}
	}
	@keyframes swing {
		0% {
			transform: rotate(-10deg);
		}
		50% {
			transform: rotate(11deg);
		}
		100% {
			transform: rotate(-10deg);
		}
	}
	/* The contact shadow tightens as the weight comes down, which is what stops the
	   bob from looking like the figure is floating. */
	@keyframes tread {
		0%,
		100% {
			opacity: 0.75;
			transform: scaleX(1);
		}
		50% {
			opacity: 1;
			transform: scaleX(0.9);
		}
	}

	/* The pivot is the feet, not the middle: leaning from the waist would slide the
	   whole figure sideways on every tilt. */
	.pacing .pace {
		transform-origin: 13px 31.4px;
		animation: pace 2.64s ease-in-out infinite;
	}
	.pacing .body {
		animation: bob 0.44s ease-in-out infinite;
	}
	.pacing .shadow {
		transform-origin: 13px 32.4px;
		animation: tread 0.44s ease-in-out infinite;
	}
	/**
	 * The far side of the body runs half a cycle behind the near side. That offset is
	 * the whole difference between a walk and a hop, and it is carried by a custom
	 * property rather than by an `animation-delay` rule of its own.
	 *
	 * It has to be. `animation` is a shorthand, so it resets `animation-delay` to zero
	 * along with everything else it does not mention, and the selector carrying the
	 * offset is the weaker of the two: `.pacing .back` never beats
	 * `.pacing .limb:not(.arm)`. Written that way the legs both ran at zero and swung
	 * as one, stuck together like a single thick limb, while the arms — matched by a
	 * selector of equal weight — offset correctly and hid how it had gone wrong.
	 *
	 * A custom property does not take part in that reset, so the offset lands wherever
	 * it is set and the shorthand simply reads it.
	 */
	.pacing .limb {
		--phase: 0s;
	}
	.pacing .back {
		--phase: -0.44s;
	}
	.pacing .limb:not(.arm) {
		transform-origin: 50% 20px;
		animation: stride 0.88s ease-in-out var(--phase, 0s) infinite;
	}
	/* Within one side the arm already opposes the leg, because `swing` starts where
	   `stride` ends, so the two share a phase. */
	.pacing .arm {
		transform-origin: 50% 12px;
		animation: swing 0.88s ease-in-out var(--phase, 0s) infinite;
	}

	/* Reduced motion keeps the figure, and keeps it whole: the frozen one-stride pose
	   still reads as somebody mid-walk. Only the walking goes. */
	@media (prefers-reduced-motion: reduce) {
		.pacing .pace,
		.pacing .body,
		.pacing .shadow,
		.pacing .limb {
			animation: none;
		}
	}

	@media (prefers-color-scheme: dark) {
		.torso,
		.head,
		.limb {
			stroke: rgba(255, 255, 255, 0.18);
		}
		.shadow {
			fill: rgba(0, 0, 0, 0.4);
		}
	}
</style>
