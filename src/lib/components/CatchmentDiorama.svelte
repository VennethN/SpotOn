<script lang="ts">
	/**
	 * Maket kawasan terpilih, di dalam aplikasi.
	 *
	 * Bukan denah sebenarnya — ini skema. Yang diambil dari data adalah isinya:
	 * berapa orang di jalan pada jam yang dipilih (profil 24 jam), berapa gerai
	 * pesaing sejenis (OSM), dan berapa petak yang benar-benar sedang disewakan
	 * (Properti Go). Kawasan tanpa data ditampilkan kosong, bukan diisi contoh.
	 *
	 * Bahasanya sengaja bahasa orang: "seramai apa", bukan "indeks permintaan".
	 * Angka lengkapnya tetap ada, satu klik di bawah.
	 */
	import StreetScene from '$lib/components/StreetScene.svelte';
	import { daylightAt, formatHour, localHour } from '$lib/three/daylight';
	import { getAppState } from '$lib/state.svelte';
	import { pct } from '$lib/scoring';

	const app = getAppState();
	const row = $derived(app.selected);
	const def = $derived(app.definition);

	// Dibuka pada jam mesin pengguna, lalu bertahan saat pindah kawasan — supaya dua
	// kawasan bisa dibandingkan pada jam yang sama, bukan direset diam-diam.
	let hour = $state(localHour());

	const jam = $derived(row?.jam ?? []);
	const peak = $derived(jam.length ? Math.max(...jam) : 0);

	function at(h: number): number {
		if (!jam.length) return 0;
		const i = Math.floor(((h % 24) + 24) % 24);
		const f = h - Math.floor(h);
		return jam[i] * (1 - f) + jam[(i + 1) % 24] * f;
	}

	const day = $derived(daylightAt(hour));
	const nowCount = $derived(Math.round(at(hour)));
	const density = $derived(peak > 0 ? at(hour) / peak : 0);
	const busiest = $derived(jam.length ? jam.indexOf(peak) : -1);

	/** Seramai apa, dalam kata — bukan persentase yang harus ditafsirkan sendiri. */
	const busyWord = $derived(
		density >= 0.8
			? 'paling ramai'
			: density >= 0.5
				? 'cukup ramai'
				: density >= 0.2
					? 'agak sepi'
					: 'sepi'
	);
</script>

{#if !row}
	<p class="empty">Pilih satu kawasan di peta untuk melihat suasananya.</p>
{:else}
	<div class="dio">
		<div class="stage" style:--sky={day.skyHorizon}>
			<StreetScene
				{hour}
				{density}
				category={app.category}
				cameraT={0.62}
				nodata={row.nodata}
				rivals={row.osm}
				vacancies={row.listings}
				label={`Skema kawasan ${row.name} pukul ${formatHour(hour)}. ${
					row.nodata
						? 'Belum ada data untuk kawasan ini, jadi jalannya ditampilkan kosong.'
						: `Sekitar ${nowCount} transaksi pada jam ini, ${row.osm} ${def.name.toLowerCase()} pesaing, dan ${row.listings} tempat yang sedang disewakan.`
				}`}
			/>
			<span class="mark">skema · bukan denah sebenarnya</span>
		</div>

		<label class="clock">
			<span class="lbl">Jam</span>
			<input
				type="range"
				min="0"
				max="23.5"
				step="0.5"
				bind:value={hour}
				aria-label="Geser untuk melihat kawasan ini pada jam lain"
			/>
			<span class="now">{formatHour(hour)}</span>
		</label>

		{#if row.nodata}
			<p class="read">
				Kawasan ini <strong>belum ada datanya</strong>, jadi jalannya sengaja dibiarkan kosong —
				bukan berarti benar-benar sepi.
			</p>
		{:else}
			<p class="read">
				Pukul {formatHour(hour)} di sini <strong>{busyWord}</strong>.
				{#if busiest >= 0}
					Paling ramai sekitar pukul {formatHour(busiest)}.
				{/if}
				Ada <strong>{row.osm}</strong> {def.name.toLowerCase()} lain di sekitarnya, dan
				{#if row.listings > 0}
					<strong>{row.listings}</strong> tempat yang sedang disewakan.
				{:else}
					<strong>tidak ada</strong> tempat yang sedang disewakan.
				{/if}
			</p>

			<details class="numbers">
				<summary>Lihat angka lengkapnya</summary>
				<dl>
					<div><dt>Skor peluang</dt><dd>{pct(row.score)}</dd></div>
					<div><dt>Permintaan</dt><dd>{pct(row.demand)}</dd></div>
					<div><dt>Penawaran efektif</dt><dd>{pct(row.supply)}</dd></div>
					<div><dt>Transaksi jam ini</dt><dd>{nowCount}</dd></div>
					<div><dt>Puncak harian</dt><dd>{peak} · pukul {formatHour(busiest)}</dd></div>
					<div><dt>Pesaing (OSM)</dt><dd>{row.osm}</dd></div>
					<div><dt>Pesaing ramai</dt><dd>{pct(row.ramai)}%</dd></div>
					<div><dt>Ruang disewakan</dt><dd>{row.listings} dari {row.nProp}</dd></div>
					<div><dt>Titik data</dt><dd>{row.nTot}</dd></div>
				</dl>
				<p class="prov">
					Transaksi &amp; ruang usaha: data contoh MAPID. Pesaing &amp; lokasi stasiun: OSM.
				</p>
			</details>
		{/if}
	</div>
{/if}

<style>
	.empty {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.dio {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.stage {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--sky);
		border: 1px solid var(--separator);
	}
	/* Penanda permanen: adegan ini skema, dan tidak boleh dikira peta bangunan asli. */
	.mark {
		position: absolute;
		left: 0.5rem;
		bottom: 0.5rem;
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		color: rgba(255, 255, 255, 0.82);
		background: rgba(0, 0, 0, 0.42);
		border-radius: 3px;
		padding: 0.1rem 0.35rem;
	}

	.clock {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.clock .lbl {
		font-size: 0.75rem;
		color: var(--label-3);
	}
	.clock input {
		flex: 1;
		accent-color: var(--accent);
		min-width: 0;
	}
	.clock .now {
		font-size: 0.8125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		min-width: 3.2em;
		text-align: right;
	}

	.read {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	.read strong {
		color: var(--label-1);
		font-weight: 600;
	}

	.numbers summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
	}
	.numbers summary:hover {
		color: var(--label-2);
	}
	.numbers dl {
		margin: 0.625rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.numbers dl :global(div) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3125rem 0;
		border-bottom: 1px solid var(--separator);
		font-size: 0.75rem;
	}
	.numbers dt {
		color: var(--label-3);
	}
	.numbers dd {
		margin: 0;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.prov {
		margin-top: 0.5rem;
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}
</style>
