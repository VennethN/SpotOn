<script lang="ts">
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import WeightSlider from '$lib/components/ui/WeightSlider.svelte';
	import { getAppState, type LayerKey } from '$lib/state/app.svelte';

	const app = getAppState();

	const layerRows: Array<{ key: LayerKey; label: string; swatch: string }> = [
		{ key: 'score', label: 'Opportunity Score', swatch: 'var(--ramp-4)' },
		{ key: 'rute', label: 'Jalur angkutan', swatch: 'var(--route-mrt)' },
		{ key: 'poi', label: 'Sebaran pesaing', swatch: 'var(--good)' },
		{ key: 'nodata', label: 'Hex belum terdata', swatch: 'var(--nodata)' },
		{ key: 'label', label: 'Label stasiun', swatch: 'transparent' }
	];

	const coverage = $derived(app.coverage);
</script>

<div class="stack">
	<section>
		<h2 class="eyebrow">Bobot peluang</h2>
		<WeightSlider
			id="w-demand"
			label="Permintaan"
			bind:value={app.weights.wd}
			hint="Struk Go: jumlah transaksi, mix kategori, profil jam, rasio non-tunai."
		/>
		<WeightSlider
			id="w-supply"
			label="Persaingan"
			bind:value={app.weights.ws}
			hint="Menu Go: kepadatan pesaing dibobot kondisi pembeli — pesaing ramai menekan peluang lebih keras."
		/>
	</section>

	<section>
		<h2 class="eyebrow">Gerbang ruang usaha</h2>
		<label class="switch">
			<input type="checkbox" bind:checked={app.weights.gate} />
			<span class="track" aria-hidden="true"><span class="thumb"></span></span>
			<span class="switch-text">
				Wajib ada listing
				<span class="sub">Tanpa ruang yang bisa ditempati, peluang tidak dapat dieksekusi.</span>
			</span>
		</label>
	</section>

	<!-- Pemilih radius dihapus saat model pindah ke kisi heksagon.
	     Cacah pesaing dan akses transit dihitung sekali pada radius 800 m ketika
	     kisinya dibangun, jadi tombol 400 m hanya akan menskalakan angka yang sudah
	     jadi — hasilnya tampak masuk akal padahal tidak berdasar. Kontrol yang
	     diam-diam tidak melakukan apa yang tertulis lebih buruk daripada tidak ada. -->
	<section>
		<h2 class="eyebrow">Jangkauan jalan kaki</h2>
		<p class="note">
			Tetap <strong>800 m</strong> (±10 menit jalan kaki) — dipakai saat kisi dibangun,
			untuk menghitung akses transit dan pesaing tiap petak.
		</p>
	</section>

	<section>
		<h2 class="eyebrow">Layer</h2>
		<div class="layers">
			{#each layerRows as row (row.key)}
				<label class="layer">
					<input type="checkbox" bind:checked={app.layers[row.key]} />
					<span class="swatch" style:background={row.swatch}></span>
					<span>{row.label}</span>
				</label>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="eyebrow">Legenda</h2>
		<ScoreRamp ends={['Rendah', 'Tinggi']} />
		<ul class="legend">
			<li><span class="key nodata"></span>Belum terdata (N = 0)</li>
			<li><span class="key jenuh"></span>Ditandai jenuh</li>
			<li><span class="key dot"></span>Titik stasiun · klik untuk detail</li>
		</ul>
	</section>

	<section>
		<h2 class="eyebrow">Kejujuran data</h2>
		<p class="prose">
			<strong>{coverage.terdata} dari {coverage.total}</strong> petak punya data misi
			({coverage.titikMisi} titik contoh). <strong>{coverage.poi}</strong> POI pesaing terhitung dari
			OSM pada radius {app.weights.radius} m.
		</p>
		<p class="prose">
			Petak tanpa data <strong>tidak diinterpolasi</strong> — ditandai arsir dan masuk daftar
			prioritas survei. Setiap skor disertai N pada tabel dan panel, sehingga pengguna dapat menilai
			sendiri seberapa tebal dasar angkanya.
		</p>
	</section>

	<section>
		<h2 class="eyebrow">Provenans</h2>
		<p class="prose">
			<strong>Nyata <span class="tag real">OSM</span></strong> — simpul transit empat moda (MRT, KRL,
			LRT, TransJakarta), geometri jalurnya, dan {coverage.poi} POI pesaing sejenis pada radius
			{app.weights.radius} m, dari Overpass API (ODbL). Akses transit tiap petak dihitung dari sini.
		</p>
		<p class="prose">
			<strong>Contoh <span class="tag mock">MOCK</span></strong> — atribut khas dataset misi MAPID
			(Struk Go, Menu Go, Properti Go) karena datanya belum publik. Strukturnya mengikuti kolom asli
			sehingga tinggal ditukar saat API MAPID tersedia.
		</p>
		<p class="prose muted">Basemap wajib pada produk final: MAPID MAPS.</p>
	</section>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.switch {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		cursor: pointer;
	}
	.switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.switch .track {
		flex: none;
		width: 2.375rem;
		height: 1.4375rem;
		border-radius: 999px;
		background: var(--fill-2);
		padding: 2px;
		transition: background-color 180ms ease-out;
	}
	.switch input:checked + .track {
		background: var(--accent);
	}
	.switch input:focus-visible + .track {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.switch .thumb {
		display: block;
		width: 1.1875rem;
		height: 1.1875rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: var(--shadow-chip);
		transform: translateX(0);
		transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.switch input:checked + .track .thumb {
		transform: translateX(0.9375rem);
	}
	.switch-text {
		font-size: 0.75rem;
		color: var(--label-1);
		line-height: 1.35;
	}
	.switch-text .sub {
		display: block;
		color: var(--label-3);
		font-size: 0.6875rem;
	}

	.note {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.note strong {
		color: var(--label-1);
		font-weight: 600;
	}
	.layers {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.layer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.75rem;
		color: var(--label-2);
		cursor: pointer;
	}
	.layer:hover {
		color: var(--label-1);
	}
	.layer input {
		accent-color: var(--accent);
		width: 0.875rem;
		height: 0.875rem;
		margin: 0;
	}
	.swatch {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 3px;
		border: 1px solid var(--separator);
		flex: none;
	}

	.legend {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
		font-size: 0.6875rem;
		color: var(--label-2);
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.key {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 3px;
		flex: none;
	}
	.key.nodata {
		background: repeating-linear-gradient(
			45deg,
			var(--fill-1) 0 2px,
			color-mix(in srgb, var(--nodata) 55%, transparent) 2px 4px
		);
	}
	.key.jenuh {
		border: 2px solid var(--critical);
	}
	.key.dot {
		border-radius: 99px;
		background: var(--bg-elevated);
		border: 2px solid var(--label-2);
	}

	.prose {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.prose strong {
		color: var(--label-1);
		font-weight: 600;
	}
</style>
