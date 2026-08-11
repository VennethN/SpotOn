<script lang="ts">
	/**
	 * Satu heksagon untuk satu petak H3 — 558 buah, urut seperti pada kisi.
	 *
	 * Petak yang belum ada datanya digambar kosong, bukan diberi warna paling
	 * pucat: warna paling pucat tetap terbaca sebagai "nilainya kecil", dan itu
	 * bukan yang terjadi. Yang terjadi adalah tidak tahu.
	 */
	interface Props {
		/** Satu karakter per petak, '1' = belum terdata. */
		mask: string;
		terdata: number;
		nodata: number;
	}
	let { mask, terdata, nodata }: Props = $props();

	const COLS = 31;
	const W = 12;
	const HH = W * 1.1547; // tinggi heksagon runcing-atas
	/* Jarak antar petak sedikit lebih lebar daripada petaknya sendiri. Tanpa sela,
	   558 heksagon yang berhimpit melebur jadi satu bidang biru dan yang justru
	   terbaca malah lubang-lubangnya — kebalikan dari yang dimaksud. */
	const PITCH_X = W + 1.1;
	const PITCH_Y = HH * 0.75 + 0.95;

	const rows = $derived(Math.ceil(mask.length / COLS));
	const cells = $derived(
		Array.from(mask, (c, i) => {
			const r = Math.floor(i / COLS);
			const q = i % COLS;
			return {
				x: q * PITCH_X + (r % 2 ? PITCH_X / 2 : 0),
				y: r * PITCH_Y,
				kosong: c === '1'
			};
		})
	);
</script>

<figure class="cov">
	<svg
		viewBox={`-1 -1 ${(COLS - 1) * PITCH_X + PITCH_X / 2 + W + 2} ${
			(rows - 1) * PITCH_Y + HH + 2
		}`}
		role="img"
		aria-label={`Kisi ${mask.length} petak: ${terdata} sudah ada datanya, ${nodata} belum.`}
	>
		<defs>
			<path
				id="hx"
				d={`M ${W / 2} 0 L ${W} ${HH * 0.25} L ${W} ${HH * 0.75} L ${W / 2} ${HH} L 0 ${
					HH * 0.75
				} L 0 ${HH * 0.25} Z`}
			/>
		</defs>
		{#each cells as c, i (i)}
			<use href="#hx" x={c.x} y={c.y} class={c.kosong ? 'kosong' : 'ada'} />
		{/each}
	</svg>

	<figcaption>
		<span class="key">
			<span class="sw ada" aria-hidden="true"></span>
			<b>{terdata}</b> petak sudah ada datanya
		</span>
		<span class="key">
			<span class="sw kosong" aria-hidden="true"></span>
			<b>{nodata}</b> belum terdata — tidak dinilai, masuk antrean survei
		</span>
	</figcaption>
</figure>

<style>
	.cov {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		/* Ini diagram, bukan mural: dibiarkan selebar halaman, ia menelan bagiannya. */
		max-width: 34rem;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
	}
	/* Satu rona rata: yang dibedakan di sini cuma ada/tidak ada data. Kalau
	   petaknya diberi gradasi, mata langsung mengira warnanya membawa nilai. */
	.ada {
		fill: color-mix(in srgb, var(--accent) 48%, transparent);
	}
	.kosong {
		fill: none;
		stroke: var(--label-3);
		stroke-width: 1;
	}

	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 1.25rem;
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.key {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.key b {
		color: var(--label-1);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.sw {
		width: 0.625rem;
		height: 0.6875rem;
		flex: none;
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
	}
	.sw.ada {
		background: color-mix(in srgb, var(--accent) 48%, transparent);
	}
	/* Kotak berlubang, bukan heksagon berlubang: pada ukuran sekecil ini garis
	   heksagonnya saling menempel dan bentuknya tidak terbaca lagi. */
	.sw.kosong {
		clip-path: none;
		border-radius: 1px;
		background: transparent;
		border: 1px solid var(--label-4);
	}
</style>
