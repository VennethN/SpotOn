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
	import StreetScene from '$lib/components/ui/StreetScene.svelte';
	import { daylightAt, localHour } from '$lib/scene/daylight';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { formatHour, pct } from '$lib/utils/format';

	/**
	 * Panel ini jauh lebih kecil daripada panggung halaman depan, jadi kameranya
	 * dirapatkan: pada bingkai selebar ±340 px, bentang penuh membuat kafe dan
	 * petak sewa mengecil sampai tidak ada yang terbaca.
	 */
	const CAMERA_T = 0.88;

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	const catName = $derived(c.category[app.category].name);
	const catMany = $derived(c.category[app.category].many);

	/** Petak dengan skor tertinggi pada kategori aktif — untuk tombol "pilihkan saja". */
	const best = $derived(
		app.rows
			.filter((r) => !r.nodata)
			.reduce<(typeof app.rows)[number] | null>(
				(a, r) => (a === null || (r.score ?? 0) > (a.score ?? 0) ? r : a),
				null
			)
	);

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
			? c.mood.busiest
			: density >= 0.5
				? c.mood.busy
				: density >= 0.2
					? c.mood.quiet
					: c.mood.empty
	);
</script>

{#if !row}
	<!-- Keadaan kosong yang bisa ditindaklanjuti. Kalimat "silakan pilih di peta"
	     saja menyerahkan pekerjaan kembali ke pengguna yang justru belum tahu
	     petak mana yang layak dilihat. -->
	<div class="empty">
		<p>{c.app.emptyMood}</p>
		{#if best}
			<button type="button" class="btn" onclick={() => app.select(best.id)}>
				{c.app.pickBest(catName.toLowerCase())}
			</button>
		{/if}
	</div>
{:else}
	<div class="dio">
		<div class="stage" style:--sky={day.skyHorizon}>
			<StreetScene
				{hour}
				{density}
				category={app.category}
				cameraT={CAMERA_T}
				nodata={row.nodata}
				rivals={row.osm}
				vacancies={row.listings}
				label={c.mood.sceneLabel(
					row.name,
					formatHour(hour),
					row.nodata
						? c.mood.sceneNodata
						: c.mood.sceneBody(nowCount, row.osm, catMany, row.listings)
				)}
			/>
			<span class="mark">{c.app.schema}</span>
		</div>

		<label class="clock">
			<span class="lbl">{c.app.clock}</span>
			<input
				type="range"
				min="0"
				max="23.5"
				step="0.5"
				bind:value={hour}
				aria-label={c.app.clockAria}
			/>
			<span class="now">{formatHour(hour)}</span>
		</label>

		{#if row.nodata}
			<p class="read">{c.mood.nodata}</p>
		{:else}
			<p class="read">
				{c.mood.reading(formatHour(hour), busyWord)}
				{#if busiest >= 0}
					{c.mood.peakAt(formatHour(busiest))}
				{/if}
				{c.mood.rivals(row.osm, catMany)}
				{#if row.listings > 0}
					{c.mood.listings(row.listings)}
				{:else}
					{c.mood.noListings}
				{/if}
			</p>

			<details class="numbers">
				<summary>{c.app.fullNumbers}</summary>
				<dl>
					<div><dt>{c.mood.rows.score}</dt><dd>{pct(row.score)}</dd></div>
					<div><dt>{c.mood.rows.demand}</dt><dd>{pct(row.demand)}</dd></div>
					<div><dt>{c.mood.rows.supply}</dt><dd>{pct(row.supply)}</dd></div>
					<div><dt>{c.mood.rows.now}</dt><dd>{nowCount}</dd></div>
					<div><dt>{c.mood.rows.peak}</dt><dd>{peak} · {formatHour(busiest)}</dd></div>
					<div><dt>{c.mood.rows.rivals}</dt><dd>{row.osm}</dd></div>
					<div><dt>{c.mood.rows.busy}</dt><dd>{pct(row.ramai)}%</dd></div>
					<div><dt>{c.mood.rows.space}</dt><dd>{row.listings} / {row.nProp}</dd></div>
					<div><dt>{c.mood.rows.points}</dt><dd>{row.nTot}</dd></div>
				</dl>
				<p class="prov">{c.mood.prov}</p>
			</details>
		{/if}
	</div>
{/if}

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.625rem;
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
