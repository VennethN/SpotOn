<script lang="ts">
	/**
	 * One tier's allowance, drawn against the largest tier's.
	 *
	 * The ladder is the whole argument this page makes, and three tiers read as three
	 * prices and six numbers is arithmetic the reader has to do to see it. Six bars on one
	 * scale is the same fact without the arithmetic.
	 *
	 * LINEAR, AND THE FREE TIER LOOKS AS SMALL AS IT IS. A scale bent to flatter the
	 * bottom of the ladder would be a picture disagreeing with the numbers printed
	 * beside it, and the numbers are printed beside it precisely so the bar never has to
	 * carry the reading alone. It is the supplement, so it is hidden from the reading
	 * order rather than announced twice.
	 *
	 * One hue for every bar. They are one measure at three sizes, not three things to
	 * tell apart, and the tier a reader is on is said by the card around it.
	 */
	let { value, peak }: { value: number; peak: number } = $props();

	/* A floor, so the smallest tier is a mark rather than nothing. Two percent of a
	   fourteen-rem card rounds to less than a pixel, and a bar that disappears reads as a
	   bar that failed to draw. */
	const MIN = 0.03;
	const part = $derived(peak > 0 ? Math.max(MIN, Math.min(1, value / peak)) : 0);
</script>

<div class="track" aria-hidden="true">
	<div class="fill" style:width={`${part * 100}%`}></div>
</div>

<style>
	.track {
		height: 4px;
		margin: 0.1875rem 0 0.5rem;
		border-radius: 2px;
		background: var(--fill-1);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 2px;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}
</style>
