<script lang="ts">
	import { SpringValue, prefersReducedMotion } from '$lib/motion.svelte';

	/** Koridor stilir: posisi & skor contoh, dipakai murni sebagai bahasa visual. */
	const STOPS = [
		{ x: 128, y: 452, r: 62, ramp: 5, label: 'Lebak Bulus', score: 79 },
		{ x: 212, y: 392, r: 58, ramp: 4, label: null, score: null },
		{ x: 268, y: 318, r: 54, ramp: 3, label: null, score: null },
		{ x: 316, y: 246, r: 60, ramp: 6, label: 'Blok M', score: 84 },
		{ x: 372, y: 176, r: 50, ramp: 2, label: null, score: null },
		{ x: 424, y: 112, r: 46, ramp: 1, label: null, score: null },
		{ x: 470, y: 52, r: 44, ramp: 0, label: null, score: null }
	];

	const CORRIDOR = 'M 108 476 L 214 396 L 268 318 L 316 246 L 372 176 L 424 112 L 486 40';

	// Parallax halus: dua pegas kritis, bukan mengikuti kursor mentah — gerak mentah
	// terasa gugup, pegas membuatnya terasa punya massa.
	const px = new SpringValue(0, { damping: 1, response: 0.55 });
	const py = new SpringValue(0, { damping: 1, response: 0.55 });
	let host = $state<HTMLDivElement | null>(null);

	function onMove(e: PointerEvent) {
		if (prefersReducedMotion() || e.pointerType !== 'mouse' || !host) return;
		const b = host.getBoundingClientRect();
		px.to(((e.clientX - b.left) / b.width - 0.5) * 2);
		py.to(((e.clientY - b.top) / b.height - 0.5) * 2);
	}

	function onLeave() {
		px.to(0);
		py.to(0);
	}

	const shift = (depth: number) =>
		`translate3d(${px.current * depth}px, ${py.current * depth}px, 0)`;
</script>

<div
	class="hero-visual"
	bind:this={host}
	onpointermove={onMove}
	onpointerleave={onLeave}
	role="img"
	aria-label="Ilustrasi koridor transit dengan catchment berjalan kaki yang diberi skor peluang usaha"
>
	<div class="glow" aria-hidden="true"></div>

	<svg viewBox="0 0 600 520" fill="none" xmlns="http://www.w3.org/2000/svg">
		<!-- jaringan jalan sebagai konteks, sengaja nyaris tak terlihat -->
		<g class="grid" style:transform={shift(-3)}>
			{#each [60, 140, 220, 300, 380, 460] as y (y)}
				<path d={`M -20 ${y + 40} L 620 ${y - 60}`} />
			{/each}
			{#each [80, 200, 320, 440, 560] as x (x)}
				<path d={`M ${x} -20 L ${x - 60} 540`} />
			{/each}
		</g>

		<g style:transform={shift(4)}>
			<path class="corridor-halo" d={CORRIDOR} />
			<path class="corridor" d={CORRIDOR} />
		</g>

		<g style:transform={shift(8)}>
			{#each STOPS as s, i (s.x)}
				<g class="stop" style:--i={i}>
					<circle class="catch" cx={s.x} cy={s.y} r={s.r} fill={`var(--ramp-${s.ramp})`} />
					<circle class="ring" cx={s.x} cy={s.y} r={s.r} />
					<circle class="node" cx={s.x} cy={s.y} r="5.5" />
				</g>
			{/each}
			<!-- satu catchment belum terdata: ditampilkan apa adanya, bukan diisi angka -->
			<g class="stop nodata" style:--i={7}>
				<circle class="catch-empty" cx="238" cy="150" r="52" />
				<circle class="node" cx="238" cy="150" r="5.5" />
			</g>
		</g>
	</svg>

	<div class="card material" style:transform={`${shift(12)}`}>
		<span class="eyebrow">Blok M · catchment 800 m</span>
		<span class="score">84<span class="unit">skor kedai kopi</span></span>
		<span class="why">
			Permintaan <b>72</b> · penawaran <b>31</b> — 4 pesaing dalam radius 800 m, mayoritas sepi.
			Tersedia <b>3 listing</b> Coffee Shop.
		</span>
		<span class="n">N misi = 45 · pesaing OSM = 4</span>
	</div>

	<div class="chip material" style:transform={`${shift(-6)}`}>
		<span class="dot"></span>Belum terdata — masuk antrean survei
	</div>
</div>

<style>
	.hero-visual {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 520;
		max-width: 40rem;
		margin-inline: auto;
	}
	svg {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	svg g {
		will-change: transform;
	}

	.glow {
		position: absolute;
		inset: 8% 12% 16% 4%;
		background: radial-gradient(
			55% 55% at 45% 55%,
			color-mix(in srgb, var(--accent) 26%, transparent),
			transparent 72%
		);
		filter: blur(28px);
		opacity: 0.75;
	}

	.grid path {
		stroke: var(--separator);
		stroke-width: 1;
	}

	.corridor {
		stroke: var(--warn);
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.corridor-halo {
		stroke: color-mix(in srgb, var(--warn) 28%, transparent);
		stroke-width: 11;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.catch {
		opacity: 0.55;
	}
	.ring {
		fill: none;
		stroke: var(--separator-strong);
		stroke-width: 1;
	}
	.catch-empty {
		fill: color-mix(in srgb, var(--nodata) 18%, transparent);
		stroke: var(--nodata);
		stroke-width: 1.5;
		stroke-dasharray: 5 5;
	}
	.node {
		fill: var(--bg-elevated);
		stroke: var(--label-2);
		stroke-width: 2;
	}

	/* Masuk berurutan mengikuti arah koridor: gerak antara harus menunjuk ke hasilnya. */
	.stop {
		transform-box: fill-box;
		transform-origin: center;
		animation: pop 620ms cubic-bezier(0.22, 0.61, 0.24, 1) backwards;
		animation-delay: calc(var(--i) * 70ms + 120ms);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.72);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.card {
		position: absolute;
		left: 46%;
		top: 30%;
		width: 15rem;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
		padding: 0.75rem 0.875rem;
		border-radius: var(--r-lg);
		animation: rise 700ms cubic-bezier(0.22, 0.61, 0.24, 1) 520ms backwards;
		will-change: transform;
	}
	.score {
		font-size: 2.25rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1;
		color: var(--accent);
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.unit {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--label-3);
	}
	.why {
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-2);
	}
	.why b {
		color: var(--label-1);
	}
	.n {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.5625rem;
		color: var(--label-3);
	}

	.chip {
		position: absolute;
		left: 2%;
		top: 16%;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		color: var(--label-2);
		animation: rise 700ms cubic-bezier(0.22, 0.61, 0.24, 1) 700ms backwards;
		will-change: transform;
	}
	.chip .dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 99px;
		border: 1.5px dashed var(--nodata);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translate3d(0, 16px, 0);
		}
	}

	@media (max-width: 720px) {
		.card {
			left: 38%;
			width: 12.5rem;
		}
		/* Di layar sempit kartu skor turun menutupi chip — chip dipindah ke bawah. */
		.chip {
			top: auto;
			bottom: 4%;
			font-size: 0.625rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stop,
		.card,
		.chip {
			animation: none;
		}
	}
</style>
