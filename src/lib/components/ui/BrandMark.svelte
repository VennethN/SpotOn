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
</script>

<span class="mark" style:--size={`${size}px`} aria-hidden="true"></span>

<style>
	.mark {
		display: block;
		flex: none;
		width: var(--size);
		height: var(--size);
		border: 1.5px solid currentColor;
		border-radius: 3px;
		clip-path: polygon(0 0, 100% 0, 100% 62%, 62% 100%, 0 100%);
	}
</style>
