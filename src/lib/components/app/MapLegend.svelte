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

	const app = getAppState();
	const coverage = $derived(app.coverage);

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
		<span class="cat">{app.definition.name}</span>
		<span class="lbl">skor peluang</span>
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
			<ScoreRamp dense nodata={`${coverage.belumTerdata} petak belum terdata — tidak dinilai`} />
		</div>
	{/if}
</div>

<style>
	.legend {
		position: fixed;
		left: 0.75rem;
		bottom: 2.75rem;
		z-index: 6;
		width: 12.5rem;
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
