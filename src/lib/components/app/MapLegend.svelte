<script lang="ts">
	/**
	 * Kunci peta, selalu terlihat.
	 *
	 * Sebelumnya legenda hanya ada di dalam laci "Pengaturan lanjutan" yang
	 * tertutup — artinya pengguna pertama melihat peta berwarna tanpa satu pun
	 * keterangan warnanya. Untuk pengguna yang tidak pernah membaca choropleth,
	 * itu bukan peta, itu tebak-tebakan.
	 *
	 * Isinya sengaja tiga baris saja: skala, arti ujung-ujungnya, dan petak yang
	 * belum terdata. Sisanya tetap di laci lanjutan.
	 */
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());
	const coverage = $derived(app.coverage);

	/* Petak yang tidak dinilai karena sumber aktif belum mencakup kota +
	   kategori ini. Tanpa keterangannya, peta MAPID untuk kategori yang belum
	   diimpor terbaca sebagai "semua skornya nol" — kesimpulan yang persis
	   terbalik dari apa yang sebenarnya terjadi. */
	const uncovered = $derived(app.weights.source === 'mapid' ? coverage.belumTercakup : 0);
	const catName = $derived(c.category[app.category].name);

	let open = $state(true);
</script>

<div class="legend material" class:closed={!open}>
	<button
		type="button"
		class="head"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-controls="legend-body"
	>
		<span class="cat">{c.category[app.category].name}</span>
		<span class="lbl">{c.app.legendUnit}</span>
		<span class="chev" aria-hidden="true" class:up={open}>
			<svg viewBox="0 0 10 10" width="9" height="9">
				<path
					d="M2 6.5 5 3.5 8 6.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
	</button>

	{#if open}
		<div class="body" id="legend-body">
			<ScoreRamp dense nodata={c.app.legendNodata(coverage.belumTerdata)} />

			{#if uncovered > 0}
				<p class="uncovered" class:blocking={coverage.dinilai === 0}>
					{coverage.dinilai === 0
						? c.app.legendUncoveredAll(catName)
						: c.app.legendUncovered(uncovered, catName)}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.uncovered {
		margin-top: 0.5rem;
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-3);
		border-left: 2px dashed var(--nodata);
		padding-left: 0.5rem;
	}
	/* Kalau tidak ada satu pun petak yang bisa dinilai, ini bukan catatan kaki —
	   itu satu-satunya hal di panel ini yang perlu dibaca. */
	.uncovered.blocking {
		color: var(--label-1);
		border-left-color: var(--warn);
	}

	.legend {
		position: fixed;
		left: 0.75rem;
		bottom: 2.75rem;
		z-index: 6;
		width: 13.75rem;
		border-radius: var(--r-md);
		overflow: hidden;
	}
	.legend.closed {
		width: auto;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		width: 100%;
		background: none;
		border: 0;
		padding: 0.4375rem 0.5625rem;
		cursor: pointer;
		text-align: left;
	}
	.cat {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: -0.005em;
		color: var(--label-1);
	}
	.lbl {
		font-size: 0.625rem;
		color: var(--label-3);
		margin-right: auto;
	}
	.chev {
		display: grid;
		place-items: center;
		color: var(--label-3);
		transform: rotate(180deg);
		transition: transform 180ms ease-out;
		align-self: center;
	}
	.chev.up {
		transform: none;
	}

	.body {
		padding: 0 0.5625rem 0.5rem;
	}
	/* Di layar ringkas, sheet menempati bawah layar — legenda pindah ke atas kiri,
	   tepat di bawah bilah, dan menutup dirinya sendiri supaya peta tetap lapang. */
	@media (max-width: 1023px) {
		.legend {
			top: 3.25rem;
			bottom: auto;
			left: 0.5rem;
			width: 11rem;
		}
	}
</style>
