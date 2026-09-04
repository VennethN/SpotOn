<script lang="ts">
	/**
	 * Apa yang benar-benar terdata, per moda dan per jenis usaha.
	 *
	 * Sengaja bukan satu batang bertumpuk empat warna: TransJakarta memegang
	 * hampir sembilan persepuluh simpul, jadi tiga moda lainnya akan mengecil
	 * jadi sliver tak terbaca. Empat baris berlabel jujur soal timpangnya, dan
	 * tidak menuntut mata membedakan empat warna berdampingan.
	 */
	interface Row {
		nm: string;
		v: number;
		note?: string;
	}
	let { rows, unit }: { rows: Row[]; unit: string } = $props();

	const max = $derived(Math.max(1, ...rows.map((r) => r.v)));
	const fmt = (n: number) => n.toLocaleString('id-ID');
</script>

<ul class="bars">
	{#each rows as r (r.nm)}
		<li>
			<span class="nm">{r.nm}</span>
			<span class="track"><span class="fill" style:width={`${(r.v / max) * 100}%`}></span></span>
			<span class="v">{fmt(r.v)}</span>
			{#if r.note}<span class="note">{r.note}</span>{/if}
		</li>
	{/each}
</ul>
<p class="unit">{unit}</p>

<style>
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) 4rem;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
	}
	.nm {
		color: var(--label-1);
	}
	.track {
		height: 0.3125rem;
		border-radius: 999px;
		background: var(--fill-1);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background-image: var(--lift-bar);
	}
	.v {
		text-align: right;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.note {
		grid-column: 2 / -1;
		font-size: 0.6875rem;
		color: var(--label-3);
	}
	.unit {
		margin-top: 0.625rem;
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	@media (max-width: 520px) {
		li {
			grid-template-columns: 5.5rem minmax(0, 1fr) 3.25rem;
			gap: 0.5rem;
		}
	}
</style>
