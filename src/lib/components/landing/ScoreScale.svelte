<script lang="ts">
	/**
	 * Skala peluang seperti yang dipakai peta: satu rona, dari muda ke tua.
	 * Diperlihatkan di sini supaya legenda peta sudah dikenali sebelum pengguna
	 * sampai ke petanya. Warna "belum terdata" sengaja keluar dari skala — ia
	 * bukan nilai kecil, ia bukan nilai.
	 */
	const STEPS = [0, 1, 2, 3, 4, 5, 6];
</script>

<div class="scale">
	<div class="bar" role="img" aria-label="Skala skor peluang, dari 0 (kecil) sampai 100 (besar)">
		{#each STEPS as s (s)}
			<span style:background={`var(--ramp-${s})`}></span>
		{/each}
	</div>
	<div class="ends">
		<span>0 — peluang kecil</span>
		<span>100 — peluang besar</span>
	</div>
	<div class="nd">
		<span class="sw" aria-hidden="true"></span>
		belum terdata — tidak diberi nilai sama sekali
	</div>
</div>

<style>
	.scale {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
	}
	.bar {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		height: 0.5rem;
	}
	.bar span {
		border-radius: 1px;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		color: var(--label-3);
	}
	.nd {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.6875rem;
		color: var(--label-3);
	}
	.sw {
		width: 0.75rem;
		height: 0.5rem;
		border-radius: 1px;
		border: 1px solid var(--label-4);
	}
</style>
