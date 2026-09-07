<script lang="ts">
	/**
	 * The SpotOn mark: a lot with its corner clipped.
	 *
	 * It is the shape of a rental lot in the model at the top of the landing page, which
	 * is the one thing this product is about: a plot of ground you could take.
	 *
	 * ONE DEFINITION, and that is why this exists. The mark was drawn three different
	 * ways — an outlined clipped square on the landing page, a filled blue gradient
	 * square in the app, and a target of concentric circles in the favicon. Three marks
	 * is no mark, and the tab, the header and the page were each showing a different
	 * company. The landing one wins; the other two were the copies.
	 *
	 * KEPT AS A CLIPPED BORDER, NOT REDRAWN AS A PATH. A stroked SVG polygon looks like
	 * the same idea and is not the same shape: `clip-path` cuts the border away along
	 * the diagonal, so that edge is open, while a polygon draws a line across it. The
	 * corner is supposed to be missing, not chamfered.
	 */
	interface Props {
		/** Rendered size in px. */
		size?: number;
	}
	let { size = 13 }: Props = $props();

	// The stroke and the corner ride the size rather than sitting at 1.5px and 3px
	// forever. At 13px those constants are the mark; at 34px they are a hairline
	// around a nearly square box, which is a different drawing. The ratios below are
	// the 13px mark's own, so the header and the app keep exactly what they had.
	const stroke = $derived(Math.max(1.5, size * 0.115));
	const radius = $derived(Math.max(3, size * 0.23));
</script>

<span
	class="mark"
	style:--size={`${size}px`}
	style:--stroke={`${stroke}px`}
	style:--radius={`${radius}px`}
	aria-hidden="true"
></span>

<style>
	.mark {
		display: block;
		flex: none;
		width: var(--size);
		height: var(--size);
		border: var(--stroke) solid currentColor;
		border-radius: var(--radius);
		clip-path: polygon(0 0, 100% 0, 100% 62%, 62% 100%, 0 100%);
	}
</style>
