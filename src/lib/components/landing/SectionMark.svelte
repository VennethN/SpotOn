<script lang="ts">
	/**
	 * Penanda bagian, dipinjam dari sudut lembar gambar teknik: nomor, nama, lalu
	 * garis rambut yang menerus sampai tepi. Satu-satunya warna di halaman teks
	 * ini duduk di siku garisnya — cukup untuk menandai "bagian baru dimulai",
	 * tidak sampai berteriak.
	 */
	let { n, label }: { n: string; label: string } = $props();
</script>

<div class="mark">
	<span class="tick" aria-hidden="true"></span>
	<span class="n">{n}</span>
	<span class="l">{label}</span>
	<span class="rule" aria-hidden="true"></span>
</div>

<style>
	.mark {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.tick {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 1px;
		background: var(--accent);
		flex: none;
	}
	.n {
		font-family: var(--font-display);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.l {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--label-3);
	}
	.rule {
		flex: 1;
		height: 1px;
		background: var(--paper-line);
	}
</style>
