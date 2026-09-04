<script lang="ts">
	let {
		label,
		value = $bindable(),
		id,
		hint
	}: { label: string; value: number; id: string; hint?: string } = $props();

	let track = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);

	const clamp = (v: number) => Math.max(0, Math.min(1, v));

	/**
	 * Nilai mengikuti jari 1:1 sepanjang gestur — tidak ada easing di jalur masukan.
	 * Menekan track langsung melompat ke posisi tekan, lalu meneruskan seretan dari
	 * sana, sehingga satu gerakan cukup untuk menyetel.
	 */
	function valueAt(clientX: number): number {
		if (!track) return value;
		const box = track.getBoundingClientRect();
		return clamp((clientX - box.left) / box.width);
	}

	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
		value = valueAt(e.clientX);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		value = valueAt(e.clientX);
	}

	function onPointerUp(e: PointerEvent) {
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		dragging = false;
	}

	function onKeydown(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.1 : 0.05;
		const map: Record<string, number> = {
			ArrowRight: value + step,
			ArrowUp: value + step,
			ArrowLeft: value - step,
			ArrowDown: value - step,
			Home: 0,
			End: 1
		};
		if (!(e.key in map)) return;
		e.preventDefault();
		value = clamp(map[e.key]);
	}
</script>

<div class="slider">
	<div class="head">
		<label for={id}>{label}</label>
		<output for={id}>{Math.round(value * 100)}%</output>
	</div>
	<!-- Track sekaligus kontrolnya: satu elemen menangani pointer dan papan tik,
	     sehingga menekan di mana pun langsung mengunci nilai di titik itu. -->
	<div
		{id}
		class="track"
		bind:this={track}
		role="slider"
		tabindex="0"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(value * 100)}
		aria-valuetext={`${Math.round(value * 100)} persen`}
		aria-describedby={hint ? `${id}-hint` : undefined}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onKeydown}
	>
		<div class="fill" style:width={`${value * 100}%`} class:live={dragging}></div>
		<span class="knob" class:live={dragging} style:left={`${value * 100}%`}></span>
	</div>
	{#if hint}
		<p class="hint" id={`${id}-hint`}>{hint}</p>
	{/if}
</div>

<style>
	.slider {
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	label {
		font-size: 0.75rem;
		color: var(--label-2);
	}
	output {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--label-1);
	}
	.track {
		position: relative;
		height: 1.25rem;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
	}
	.track::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		height: 4px;
		border-radius: 99px;
		background: var(--fill-2);
	}
	.fill {
		position: absolute;
		left: 0;
		height: 4px;
		border-radius: 99px;
		background: var(--accent);
		transition: height 120ms ease-out;
	}
	.fill.live {
		height: 6px;
	}
	.track:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
		border-radius: 99px;
	}
	.knob {
		position: absolute;
		top: 50%;
		width: 1rem;
		height: 1rem;
		margin-left: -0.5rem;
		border-radius: 999px;
		background: var(--bg-elevated);
		box-shadow:
			0 0 0 1px var(--separator-strong),
			var(--shadow-chip);
		pointer-events: none;
		/* Umpan balik saat ditekan, bukan saat dilepas. */
		transform: translate(0, -50%) scale(1);
		transition: transform 120ms ease-out;
	}
	.knob.live {
		transform: translate(0, -50%) scale(1.25);
	}
	.track:active {
		cursor: grabbing;
	}
	.hint {
		font-size: 0.6875rem;
		color: var(--label-3);
		line-height: 1.35;
	}
</style>
