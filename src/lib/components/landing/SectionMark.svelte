<script lang="ts">
	/**
	 * A section marker, borrowed from the corner of a technical drawing sheet: number,
	 * name, then a hairline running out to the edge. The only colour on this page of
	 * text sits in the elbow of that line — enough to mark "a new section starts here",
	 * not enough to shout.
	 */
	let { n, label }: { n: string; label: string } = $props();
</script>

<div class="mark">
	<span class="tick" aria-hidden="true"></span>
	<span class="n">{n}</span>
	<span class="l">{label}</span>
	<span class="rule" aria-hidden="true"></span>
</div>

<style>
	.mark {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.tick {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 1px;
		background: var(--accent);
		flex: none;
	}
	.n {
		font-family: var(--font-display);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.l {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--label-3);
	}
	.rule {
		flex: 1;
		height: 1px;
		background: var(--paper-line);
	}
</style>
