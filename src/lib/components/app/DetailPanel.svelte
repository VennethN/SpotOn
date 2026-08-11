<script lang="ts">
	import HourBars from '$lib/components/ui/HourBars.svelte';
	import { CATEGORY_MAP } from '$lib/domain/categories';
	import { supplyPhrase } from '$lib/domain/narrate';
	import { formatHour, pct, rampIndex } from '$lib/utils/format';
	import { getAppState } from '$lib/state/app.svelte';

	const app = getAppState();
	const row = $derived(app.selected);
	const def = $derived(app.definition);
	const across = $derived(app.selectedAcrossCategories);
</script>

{#if !row}
	<p class="empty">
		Pilih satu catchment di peta atau pada tabel atribut untuk melihat permintaan, persaingan, dan
		ketersediaan ruang usahanya.
	</p>
{:else}
	<div class="detail">
		<header>
			<h2>{row.name}</h2>
			<p class="coords mono">
				{row.lat.toFixed(5)}, {row.lon.toFixed(5)} · catchment {app.weights.radius} m
			</p>
		</header>

		{#if row.nodata}
			<div class="note warn">
				<strong>Data misi MAPID belum tersedia (N = 0).</strong> Tidak ada titik Struk Go, Menu Go,
				maupun Properti Go di dalam catchment ini. Skor <strong>tidak diinterpolasi</strong> —
				kawasan ditampilkan apa adanya dan masuk daftar prioritas
				<em>survey activities</em>. Ketiadaan data bukan bukti ketiadaan usaha: OSM mencatat
				<strong>{row.osm}</strong> {def.name.toLowerCase()} di radius {app.weights.radius} m.
			</div>
		{:else}
			<div class="tiles">
				<div class="tile">
					<span class="eyebrow">Skor {def.name}</span>
					<span class="val" style:color={`var(--ramp-${rampIndex(row.score ?? 0)})`}>
						{pct(row.score)}
					</span>
					<span class="sub">{row.typology}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">Permintaan <span class="tag mock">MOCK</span></span>
					<span class="val">{pct(row.demand)}</span>
					<span class="sub">N struk = {row.nStruk}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">Pesaing <span class="tag real">OSM</span></span>
					<span class="val">{row.osm}</span>
					<span class="sub mono">{def.osmTag}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">Penawaran efektif</span>
					<span class="val">{pct(row.supply)}</span>
					<span class="sub">{pct(row.ramai)}% ramai</span>
				</div>
				<div class="tile">
					<span class="eyebrow">Ruang usaha <span class="tag mock">MOCK</span></span>
					<span class="val">{row.listings}</span>
					<span class="sub">listing dari {row.nProp}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">Non-tunai <span class="tag mock">MOCK</span></span>
					<span class="val">{pct(row.nontunai)}%</span>
					<span class="sub">proksi daya beli</span>
				</div>
			</div>

			<section>
				<h3 class="eyebrow">
					Profil jam transaksi — Struk Go · <code>Waktu Transaksi</code> · N = {row.nStruk}
					<span class="tag mock">MOCK</span>
				</h3>
				<HourBars jam={row.jam} dense />
			</section>

			<section>
				<h3 class="eyebrow">Peluang per jenis usaha — bobot saat ini</h3>
				<div class="bars">
					{#each across as item (item.key)}
						<div class="hbar" class:active={item.key === app.category}>
							<span class="lbl">{CATEGORY_MAP[item.key].name}</span>
							<span class="track">
								<span
									class="fill"
									style:width={`${(item.score ?? 0) * 100}%`}
									style:background={`var(--ramp-${rampIndex(item.score ?? 0)})`}
								></span>
							</span>
							<span class="num">{pct(item.score)}</span>
						</div>
					{/each}
				</div>
			</section>

			<div class="note">
				<strong>Ringkasan AI.</strong> Hex memuncak pukul <strong>{formatHour(row.puncak)}</strong>.
				Untuk <strong>{def.name}</strong>, OSM mencatat <strong>{row.osm} pesaing</strong> dalam
				radius {app.weights.radius} m — {supplyPhrase(row)}; tersedia
				<strong>{row.listings} listing</strong> berkategori {def.propKat}.
				<span class="muted">
					Angka pesaing berasal dari OSM (nyata); atribut misi MAPID masih contoh. N ditampilkan agar
					dapat diaudit.
				</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.empty {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	header h2 {
		font-size: 1rem;
		letter-spacing: -0.014em;
	}
	.coords {
		color: var(--label-3);
		margin-top: 0.125rem;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
		gap: 1px;
		background: var(--separator);
		border: 1px solid var(--separator);
		border-radius: var(--r-md);
		overflow: hidden;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		padding: 0.5rem 0.625rem;
		background: var(--bg-elevated);
	}
	.val {
		font-size: 1.375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.sub {
		font-size: 0.625rem;
		color: var(--label-3);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	section h3 code {
		color: var(--label-2);
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.hbar {
		display: grid;
		grid-template-columns: 5.75rem 1fr 2rem;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.75rem;
		color: var(--label-2);
	}
	.hbar.active .lbl {
		color: var(--label-1);
		font-weight: 600;
	}
	.hbar .track {
		height: 0.4375rem;
		border-radius: 99px;
		background: var(--fill-2);
		overflow: hidden;
	}
	.hbar .fill {
		display: block;
		height: 100%;
		border-radius: 99px;
		transition: width 260ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.hbar .num {
		text-align: right;
		font-size: 0.6875rem;
	}

	.note {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
		background: var(--fill-1);
		border-left: 2px solid var(--accent);
		border-radius: 0 var(--r-sm) var(--r-sm) 0;
		padding: 0.5rem 0.625rem;
	}
	.note.warn {
		border-left-color: var(--warn);
	}
	.note strong {
		color: var(--label-1);
	}
	.note .muted {
		display: block;
		margin-top: 0.25rem;
	}
</style>
