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
	import { getAppState } from '$lib/state.svelte';

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
			<div class="ramp" aria-hidden="true">
				{#each [0, 1, 2, 3, 4, 5, 6] as i (i)}
					<span style:background={`var(--ramp-${i})`}></span>
				{/each}
			</div>
			<div class="ends">
				<span>0 · kecil</span>
				<span>100 · besar</span>
			</div>
			<p class="nd">
				<span class="key" aria-hidden="true"></span>
				{coverage.belumTerdata} petak belum terdata — tidak dinilai
			</p>
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
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
	}
	.ramp {
		display: flex;
		height: 0.4375rem;
		border-radius: 99px;
		overflow: hidden;
	}
	.ramp span {
		flex: 1;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 0.5625rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.nd {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.625rem;
		line-height: 1.35;
		color: var(--label-2);
	}
	/* Arsir yang sama dengan yang dipakai peta — bukan kotak abu-abu polos, supaya
	   yang di legenda dan yang di peta benar-benar benda yang sama. */
	.key {
		width: 0.6875rem;
		height: 0.6875rem;
		flex: none;
		border-radius: 2px;
		border: 1px solid var(--separator);
		background: repeating-linear-gradient(
			45deg,
			var(--fill-1) 0 2px,
			color-mix(in srgb, var(--nodata) 55%, transparent) 2px 4px
		);
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
