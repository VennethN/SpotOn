<script lang="ts">
	/**
	 * A block standing where something has not arrived yet.
	 *
	 * The shape of what is coming, at the size it will be, so nothing jumps when the
	 * real thing lands. That is the whole job, and it is why every call site gives a
	 * size rather than dropping in a generic grey card: a placeholder of the wrong size
	 * moves the page twice, once to appear and once to be replaced.
	 *
	 * UNIFORM, and that is a rule here rather than a look. Every block is one flat fill
	 * at one weight, with no part of it darker than another. A placeholder carrying a
	 * partial fill would be a figure nobody has measured yet, and it would be the very
	 * mark this product already spends on a real balance. It is the same reason
	 * `HexField` is a lattice with no cell darker than its neighbour.
	 *
	 * The sheen travels across the block rather than the block pulsing. A shape fading
	 * in and out reads as something switching on and off, and one crossed by a sheen
	 * reads as one thing still on its way. Under reduced motion the sheen goes and the
	 * block holds, which still says "not here yet", because the block is not the
	 * content and was never mistakable for it.
	 */
	interface Props {
		/** CSS width, given by the caller because only the caller knows what is coming. */
		w?: string;
		/** CSS height, same reason. */
		h?: string;
		radius?: string;
		/** How long to hold this block's sheen back, so a stack of them reads as a stack
		    rather than as one surface flashing. */
		delay?: number;
	}
	let { w = '100%', h = '0.75rem', radius = 'var(--r-xs)', delay = 0 }: Props = $props();
</script>

<span
	class="sk"
	style:width={w}
	style:height={h}
	style:border-radius={radius}
	style:--hold="{delay}ms"
	aria-hidden="true"
></span>

<style>
	.sk {
		position: relative;
		display: block;
		flex: none;
		overflow: hidden;
		background: var(--fill-1);
	}
	/* The sheen is a band of the next fill up, not white and not the accent. Brighter
	   than the surface it crosses and nothing more: a placeholder that glints is a
	   placeholder competing with the content it is standing in for. */
	.sk::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(100deg, transparent 36%, var(--fill-2) 50%, transparent 64%);
		animation: sheen 1500ms ease-in-out var(--hold, 0ms) infinite;
	}

	@keyframes sheen {
		to {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sk::after {
			display: none;
		}
	}
</style>
