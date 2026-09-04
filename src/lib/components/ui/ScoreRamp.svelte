<script lang="ts">
	/**
	 * Skala peluang tujuh langkah — satu rona, muda ke tua.
	 *
	 * Sebelumnya pita yang sama ditulis ulang di tiga tempat (legenda peta, panel
	 * lanjutan, halaman depan). Tiga salinan berarti tiga kesempatan untuk berbeda
	 * dari warna yang benar-benar dipakai peta, dan legenda yang berbeda dari
	 * petanya lebih buruk daripada tidak ada legenda.
	 *
	 * Warna "belum terdata" sengaja di luar skala: ia bukan nilai kecil, ia bukan
	 * nilai — jadi ditandai kotak berlubang, bukan langkah paling pucat.
	 */
	import { copy } from '$lib/state/lang.svelte';

	interface Props {
		/** Teks di kedua ujung. Kosongkan bila konteksnya sudah menjelaskan. */
		ends?: [string, string] | null;
		/** Baris "belum terdata" beserta keterangannya. */
		nodata?: string | null;
		/** Pita tipis untuk panel sempit. */
		dense?: boolean;
	}
	let { ends, nodata = null, dense = false }: Props = $props();

	const c = $derived(copy());
	const labels = $derived(ends === null ? null : (ends ?? [c.scale.low, c.scale.high]));

	const STEPS = [0, 1, 2, 3, 4, 5, 6];
</script>

<div class="ramp-wrap" class:dense>
	<div class="ramp" aria-hidden="true">
		{#each STEPS as s (s)}
			<span style:background={`var(--ramp-${s})`}></span>
		{/each}
	</div>
	{#if labels}
		<div class="ends">
			<span>{labels[0]}</span>
			<span>{labels[1]}</span>
		</div>
	{/if}
	{#if nodata}
		<p class="nd">
			<span class="key" aria-hidden="true"></span>
			{nodata}
		</p>
	{/if}
</div>

<style>
	.ramp-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
	}
	.ramp {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		height: 0.5rem;
	}
	.dense .ramp {
		height: 0.4375rem;
	}
	.ramp span {
		border-radius: 1px;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.dense .ends {
		font-size: 0.5625rem;
	}
	.nd {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.6875rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.dense .nd {
		font-size: 0.625rem;
		color: var(--label-2);
	}
	/* Arsir yang sama persis dengan yang dipakai peta untuk petak tanpa data. */
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
</style>
