<script lang="ts">
	/**
	 * Profil 24 jam kawasan transit — bagannya sendiri dipakai bersama panel
	 * detail aplikasi (`ui/HourBars`); yang khas halaman depan cuma keterangan
	 * sumbernya dan tabel angka yang dilipat di bawahnya, supaya bacaan ini tidak
	 * pernah jadi satu-satunya jalan ke datanya.
	 */
	import HourBars from '$lib/components/ui/HourBars.svelte';
	import { formatHour, num } from '$lib/utils/format';

	let { jam, caption }: { jam: number[]; caption?: string } = $props();
</script>

<div class="prof">
	<figure>
		<HourBars {jam} unit="struk" />
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
					<tr><th scope="row">{formatHour(h)}</th><td>{num(v)}</td></tr>
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
</style>
