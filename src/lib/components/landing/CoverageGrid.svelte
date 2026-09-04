<script lang="ts">
	/**
	 * Satu heksagon untuk satu petak H3 — 558 buah, urut seperti pada kisi.
	 *
	 * Digambar isometrik dan bertebal, bukan rata, karena maket di panggung atas
	 * sudah menetapkan bahasanya: benda putih dilihat dari atas-samping, dengan
	 * sisinya yang tampak. Kisi rata pada halaman yang sama akan terbaca sebagai
	 * gambar yang datang dari produk lain.
	 *
	 * Petak yang belum ada datanya digambar sebagai lubang — tepi saja, tanpa
	 * badan dan tanpa sisi. Bukan diberi warna paling pucat: warna paling pucat
	 * tetap terbaca sebagai "nilainya kecil", dan itu bukan yang terjadi. Yang
	 * terjadi adalah tidak tahu.
	 */
	interface Props {
		/** Satu karakter per petak, '1' = belum terdata. */
		mask: string;
		terdata: number;
		nodata: number;
	}
	let { mask, terdata, nodata }: Props = $props();

	const COLS = 31;
	/* Denah heksagon runcing-atas, dipipihkan ke proyeksi isometrik lalu diberi
	   tebal. Empat angka inilah sudut pandangnya. */
	const W = 15;
	const H_PLAN = W * 1.1547;
	const SQUASH = 0.54;
	const H = H_PLAN * SQUASH;
	const DEPTH = 3.4;
	const PITCH_X = W + 1.2;
	const PITCH_Y = H_PLAN * 0.75 * SQUASH + 1.1;

	/** Muka atas: heksagon yang sudah dipipihkan. */
	const FACE = `M ${W / 2} 0 L ${W} ${H * 0.25} L ${W} ${H * 0.75} L ${W / 2} ${H} L 0 ${
		H * 0.75
	} L 0 ${H * 0.25} Z`;
	/** Sisi: tiga tepi bawah heksagon, diturunkan setebal DEPTH. */
	const SIDE = `M 0 ${H * 0.75} L ${W / 2} ${H} L ${W} ${H * 0.75} L ${W} ${H * 0.75 + DEPTH} L ${
		W / 2
	} ${H + DEPTH} L 0 ${H * 0.75 + DEPTH} Z`;

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

	const w = $derived((COLS - 1) * PITCH_X + PITCH_X / 2 + W);
	const h = $derived((rows - 1) * PITCH_Y + H + DEPTH);
</script>

<figure class="cov">
	<svg
		viewBox={`-1 -1 ${w + 2} ${h + 2}`}
		role="img"
		aria-label={`Kisi ${mask.length} petak: ${terdata} sudah ada datanya, ${nodata} belum.`}
	>
		<defs>
			<!-- Satu gradasi untuk seluruh bidang, bukan satu per petak: cahaya
			     jatuh pada maketnya, bukan pada tiap ubin sendiri-sendiri. -->
			<linearGradient id="cov-lift" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
				<stop offset="0" class="g-top" />
				<stop offset="1" class="g-bot" />
			</linearGradient>
			<path id="cov-face" d={FACE} />
			<path id="cov-side" d={SIDE} />
		</defs>

		<!-- Baris demi baris dari belakang ke depan: sisi petak di baris depan
		     harus menutupi petak di belakangnya, bukan sebaliknya. -->
		{#each cells as c, i (i)}
			{#if c.kosong}
				<use href="#cov-face" x={c.x} y={c.y} class="hole" />
			{:else}
				<use href="#cov-side" x={c.x} y={c.y} class="side" />
				<use href="#cov-face" x={c.x} y={c.y} class="face" />
			{/if}
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

	/* Ubinnya benda putih yang disinari, bukan petak berwarna: rona birunya cuma
	   semburat pada permukaan terang, dan yang membedakan muka dari sisi adalah
	   terang-gelapnya. Dicat biru penuh, kisi ini jadi bidang paling berteriak di
	   halaman yang seluruhnya garis rambut. Alasnya `--bg-elevated`, yang pada
	   kedua tema selalu lebih terang daripada kertasnya. */
	.g-top {
		stop-color: color-mix(in srgb, var(--accent) 30%, var(--bg-elevated));
	}
	.g-bot {
		stop-color: color-mix(in srgb, var(--accent) 18%, var(--bg-elevated));
	}
	.face {
		fill: url(#cov-lift);
	}
	.side {
		fill: color-mix(in srgb, var(--accent) 34%, #05070c);
		fill-opacity: 0.5;
	}
	/* Lubang harus terbaca sebagai ceruk, bukan sebagai ubin berwarna lain. Tanpa
	   isian, kertas yang hangat muncul di antara ubin biru pucat dan matanya bisa
	   membalik gambar: lubangnya yang tampak menonjol. Bayangan tipis di dalamnya
	   mengunci bacaan itu, dan tintanya dipatok gelap supaya arahnya tetap sama
	   pada tema terang maupun gelap. */
	.hole {
		fill: #05070c;
		fill-opacity: 0.09;
		stroke: var(--label-3);
		stroke-width: 0.9;
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
		width: 0.6875rem;
		height: 0.5rem;
		flex: none;
		/* Heksagon pipih yang sama dengan yang di kisi, seukuran huruf. */
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
		background: color-mix(in srgb, var(--accent) 26%, var(--bg-elevated));
	}
	/* Kotak berlubang, bukan heksagon berlubang: pada ukuran sekecil ini garis
	   heksagonnya saling menempel dan bentuknya tidak terbaca lagi. */
	.sw.kosong {
		clip-path: none;
		border-radius: 1px;
		background: transparent;
		border: 1px solid var(--label-3);
	}
</style>
