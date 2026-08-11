<script lang="ts">
	/**
	 * Profil 24 jam kawasan transit: berapa struk tiap jam, dijumlahkan dari
	 * seluruh petak yang sudah ada datanya.
	 *
	 * Satu deret, satu rona — tingginya yang membawa besaran, warna tidak membawa
	 * apa-apa selain "ini datanya". Hanya jam puncak yang diberi label; memberi
	 * angka pada 24 batang membuat tidak satu pun terbaca. Angka lengkapnya ada
	 * di tabel yang dilipat di bawahnya, jadi bacaan ini tidak pernah jadi
	 * satu-satunya jalan ke datanya.
	 */
	const H = 24;

	let { jam, caption }: { jam: number[]; caption?: string } = $props();

	const peak = $derived(Math.max(1, ...jam));
	const peakHour = $derived(jam.indexOf(Math.max(...jam)));
	const total = $derived(jam.reduce((a, b) => a + b, 0));
	const ticks = $derived([0, 6, 12, 18].filter((h) => Math.abs(h - peakHour) > 1.5));

	let hover = $state<number | null>(null);

	const fmt = (n: number) => n.toLocaleString('id-ID');
	const hh = (h: number) => `${String(h).padStart(2, '0')}.00`;
</script>

<div class="prof">
	<figure>
		<div
			class="plot"
			role="img"
			aria-label={`Profil transaksi 24 jam: total ${fmt(total)} struk, paling ramai pukul ${hh(
				peakHour
			)} dengan ${fmt(peak)} struk.`}
			onpointerleave={() => (hover = null)}
		>
			{#each jam as v, h (h)}
				<button
					type="button"
					class="col"
					class:on={h === peakHour}
					class:hot={hover === h}
					aria-label={`Pukul ${hh(h)}: ${fmt(v)} struk`}
					onpointerenter={() => (hover = h)}
					onfocus={() => (hover = h)}
					onblur={() => (hover = null)}
				>
					<span class="bar" style:height={`${Math.max(1.5, (v / peak) * 100)}%`}></span>
				</button>
			{/each}

			{#if hover !== null}
				<span class="tip" style:left={`${((hover + 0.5) / H) * 100}%`}>
					<b>{fmt(jam[hover])}</b> struk · {hh(hover)}
				</span>
			{/if}
		</div>

		<div class="axis" aria-hidden="true">
			<!-- Tanda jam yang jatuh tepat di bawah label puncak dilewati; dua label
			     yang bertumpuk lebih buruk daripada satu tanda yang hilang. -->
			{#each ticks as h (h)}
				<span style:left={`${((h + 0.5) / H) * 100}%`}>{hh(h)}</span>
			{/each}
			<span class="peak" style:left={`${((peakHour + 0.5) / H) * 100}%`}>
				puncak {hh(peakHour)}
			</span>
		</div>

		<figcaption>
			{caption ?? 'Transaksi per jam, seluruh kawasan terdata.'}
			<span class="tag mock">MOCK</span>
		</figcaption>
	</figure>

	<details>
		<summary>Angka per jamnya</summary>
		<table>
			<caption class="sr">Jumlah struk per jam</caption>
			<thead>
				<tr><th scope="col">Jam</th><th scope="col">Struk</th></tr>
			</thead>
			<tbody>
				{#each jam as v, h (h)}
					<tr><th scope="row">{hh(h)}</th><td>{fmt(v)}</td></tr>
				{/each}
			</tbody>
		</table>
	</details>
</div>

<style>
	.prof,
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.plot {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: clamp(6rem, 14vh, 9.5rem);
		border-bottom: 1px solid var(--paper-line);
	}
	.col {
		flex: 1;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: flex-end;
		background: none;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.bar {
		display: block;
		width: 100%;
		/* Ujung data dibulatkan, pangkalnya tetap menempel pada garis dasar. */
		border-radius: 3px 3px 0 0;
		background: color-mix(in srgb, var(--accent) 42%, transparent);
		transition: background-color 140ms ease-out;
	}
	.col.on .bar {
		background: var(--accent);
	}
	.col.hot .bar {
		background: color-mix(in srgb, var(--accent) 78%, transparent);
	}
	.col.on.hot .bar {
		background: var(--accent);
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 0.375rem);
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 0.6875rem;
		color: var(--label-2);
		background: var(--bg-elevated);
		border: 1px solid var(--separator);
		border-radius: var(--r-xs);
		padding: 0.125rem 0.375rem;
		pointer-events: none;
		box-shadow: var(--shadow-chip);
	}
	.tip b {
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}

	.axis {
		position: relative;
		height: 1.6rem;
		font-size: 0.625rem;
		color: var(--label-3);
	}
	.axis span {
		position: absolute;
		top: 0.25rem;
		transform: translateX(-50%);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.axis .peak {
		top: 0.25rem;
		color: var(--accent);
		font-weight: 600;
	}

	figcaption {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	details {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.5rem;
	}
	summary {
		font-size: 0.6875rem;
		color: var(--label-3);
		cursor: pointer;
	}
	summary:hover {
		color: var(--label-2);
	}
	table {
		margin-top: 0.5rem;
		border-collapse: collapse;
		font-size: 0.6875rem;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		text-align: left;
		padding: 0.125rem 1.25rem 0.125rem 0;
		font-weight: 400;
		color: var(--label-2);
	}
	thead th {
		color: var(--label-3);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	/* Batang setipis 2 px pada layar sempit tidak terbaca; label jamnya pun beradu. */
	@media (max-width: 520px) {
		.plot {
			gap: 1px;
		}
	}
</style>
