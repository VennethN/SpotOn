<script lang="ts">
	import CoverageGrid from '$lib/components/landing/CoverageGrid.svelte';
	import HourProfile from '$lib/components/landing/HourProfile.svelte';
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import Reveal from '$lib/components/ui/Reveal.svelte';
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import SectionMark from '$lib/components/landing/SectionMark.svelte';
	import SignalFlow from '$lib/components/landing/SignalFlow.svelte';
	import SourceBars from '$lib/components/landing/SourceBars.svelte';
	import StreetStage from '$lib/components/landing/StreetStage.svelte';
	import TapakDemo from '$lib/components/landing/TapakDemo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const n = (v: number) => v.toLocaleString('id-ID');
	const k = $derived(data.kisi);

	// Angka blok judul dibaca dari kisi, tidak ditulis tangan. Versi tulis tangan
	// halaman ini pernah menyebut "13 kawasan MRT" jauh setelah kisinya tumbuh
	// jadi 558 petak empat moda — persis kesalahan yang tidak boleh terulang.
	const STATS = $derived([
		{ v: n(k.hexes), l: 'petak kawasan dinilai', s: `heksagon H3 · ${k.walkRadius} m jalan kaki` },
		{ v: n(k.stops), l: 'simpul transit terdata', s: 'MRT · KRL · LRT · TransJakarta' },
		{ v: n(k.pois), l: 'pesaing nyata terdata', s: 'OpenStreetMap (ODbL)' },
		{ v: n(k.kategori), l: 'jenis usaha dinilai', s: 'kopi · warung · minimarket · laundry · apotek' }
	]);

	const MODES = $derived([
		{ nm: 'TransJakarta', v: k.stopsByMode.brt ?? 0 },
		{ nm: 'KRL', v: k.stopsByMode.krl ?? 0 },
		{ nm: 'LRT', v: k.stopsByMode.lrt ?? 0 },
		{ nm: 'MRT', v: k.stopsByMode.mrt ?? 0 }
	]);

	const POIS = $derived([
		{ nm: 'Warung makan', v: k.poisByCategory.warung ?? 0 },
		{ nm: 'Minimarket', v: k.poisByCategory.minimarket ?? 0 },
		{ nm: 'Kedai kopi', v: k.poisByCategory.kopi ?? 0 },
		{ nm: 'Apotek', v: k.poisByCategory.apotek ?? 0 },
		{ nm: 'Laundry', v: k.poisByCategory.laundry ?? 0 }
	]);

	const PROBLEMS = [
		{
			t: 'Permintaan tidak terukur',
			d: 'Kebiasaan belanja warga di sekitar stasiun terekam di jutaan struk, tapi tidak pernah dikumpulkan per lokasi. Akibatnya tidak ada yang tahu kawasan mana yang sebenarnya masih kekurangan satu jenis usaha.'
		},
		{
			t: 'Persaingan tidak terpetakan',
			d: 'Buka kedai kopi di tempat yang kedai kopinya sudah berjubel adalah resep bangkrut. Tapi tidak ada peta yang menunjukkan di mana usaha sejenis menumpuk, dan seramai apa mereka.'
		},
		{
			t: 'Ruang usaha tidak terpetakan',
			d: 'Peluang baru berarti kalau ada tempatnya. Tapi ruko, kios, dan tempat yang disewakan tidak pernah dihubungkan dengan ramai-sepinya pembeli maupun pesaing di sekitarnya.'
		}
	];

	const STEPS = $derived([
		{
			n: '1',
			t: 'Kawasan sejauh jalan kaki',
			d: `Jakarta ditutup kisi heksagon selebar ratusan meter, lalu hanya petak yang punya simpul transit dalam ${k.walkRadius} m jalan kaki yang dinilai — ${n(k.hexes)} petak. Kisi dipakai supaya kawasan yang bertumpuk tidak menghitung pembeli yang sama dua kali.`
		},
		{
			n: '2',
			t: 'Tiga sinyal disatukan',
			d: 'Data belanja, data pesaing, dan data ruang yang disewakan dicocokkan ke petak tempatnya berada, lalu diringkas jadi tiga hal: seberapa banyak yang belanja, seberapa ramai pesaingnya, dan ada tidaknya tempat kosong.'
		},
		{
			n: '3',
			t: 'Opportunity Score per jenis usaha',
			d: 'Selisih antara yang membelanjakan dan yang sudah dilayani dihitung untuk tiap jenis usaha, dengan pesaing yang ramai dihitung lebih berat, lalu disyaratkan ada tempat yang bisa disewa.'
		},
		{
			n: '4',
			t: 'Urutan, dan alasannya',
			d: 'Kawasan diurutkan per jenis usaha dan diberi keterangan: masih kurang dilayani, sudah bersaing ketat, sudah terlalu penuh, atau ramai tapi tempatnya susah dicari — lengkap dengan alasannya.'
		}
	]);

	const AUDIENCE = [
		{ t: 'Pemodal ritel & kuliner', d: 'Memilih lokasi cabang baru dari data, bukan dari firasat.' },
		{ t: 'UMKM bermodal pas-pasan', d: 'Menemukan lokasi bagus yang sewanya masih masuk akal.' },
		{ t: 'Calon wirausaha rumahan', d: '“Usaha apa yang masuk akal di sekitar sini?” — dijawab beserta alasannya.' },
		{ t: 'Tim pembukaan cabang', d: 'Menyaring dan mengurutkan calon lokasi di sepanjang jalur transit.' },
		{ t: 'Pemilik & agen properti', d: 'Tahu tempatnya cocok untuk usaha apa, dan siapa penyewa yang tepat.' }
	];

	const SAPAAN = $derived(`Halo. Saya Tapak. Saya sudah keliling ${n(
		k.hexes
	)} petak kawasan di sekitar MRT, KRL, LRT, dan koridor TransJakarta — ${n(
		k.terdata
	)} di antaranya sudah ada datanya. Anda lagi kepikiran buka usaha apa?`);
</script>

<svelte:head>
	<title>SpotOn — Jangan tebak lokasi usaha. Tanya petanya.</title>
	<meta
		name="description"
		content="SpotOn menyatukan permintaan, persaingan, dan ketersediaan ruang usaha di setiap kawasan berjalan kaki di sekitar simpul transit Jakarta, lalu merekomendasikan di mana membuka usaha — dan mengapa."
	/>
</svelte:head>

<LandingNav />

<StreetStage />

<!-- Halaman di bawah panggung memakai bahasa yang sama dengan maketnya: lembar
     gambar. Garis rambut, label menggantung di kolom kiri, angka besar bertipis —
     bukan kartu berbayang. Yang membentuk halaman ini garis dan ruang, bukan kotak.
     Warna hanya muncul di tempat yang benar-benar membawa data. -->
<main id="top" class="sheet">
	<Reveal as="section">
		<ul class="titleblock">
			{#each STATS as s (s.l)}
				<li>
					<span class="v">{s.v}</span>
					<span class="l">{s.l}</span>
					<span class="s">{s.s}</span>
				</li>
			{/each}
		</ul>
		<p class="cover-note">
			<b>{n(k.terdata)}</b> dari {n(k.hexes)} petak sudah ada datanya. Sisanya
			<b>{n(k.nodata)}</b> ditandai belum terdata — tidak ditebak, tidak dinilai.
		</p>
	</Reveal>

	<!-- ── masalah ──────────────────────────────────────────────────────── -->
	<section id="masalah" class="band">
		<Reveal><SectionMark n="01" label="Masalah" /></Reveal>
		<Reveal>
			<h2>Tiga hal menentukan lokasi usaha berhasil atau tidak. Ketiganya tidak pernah dibaca bersamaan.</h2>
		</Reveal>

		<ul class="rows">
			{#each PROBLEMS as p, i (p.t)}
				<Reveal as="li" delay={i * 80}>
					<h3>{p.t}</h3>
					<p>{p.d}</p>
				</Reveal>
			{/each}
		</ul>

		<Reveal delay={120}>
			<p class="statement">
				Kawasan sekitar stasiun adalah tempat berdagang paling padat di Jakarta. Tapi keputusan
				mau buka di mana masih diambil dari firasat — dan salah pilih lokasi dibayar dengan
				modal yang hangus.
			</p>
		</Reveal>

		<!-- Grafik pertama halaman ini sekaligus jawaban atas "permintaan tidak
		     terukur": bentuknya nyata, dan kesimpulannya bisa dibaca dalam sedetik. -->
		<Reveal>
			<div class="split wide-left">
				<div>
					<h3 class="lede">Satu lokasi bukan satu angka. Ia berubah sepanjang hari.</h3>
					<p class="body">
						Trotoar yang sepi pukul 10 pagi bisa penuh pukul 7 malam. Sewa dibayar untuk 24 jam,
						jadi jam mana yang ramai ikut menentukan usaha apa yang masuk akal di sana. Inilah
						profil yang menggerakkan maket di atas — dan yang dipakai peta di dalam aplikasi.
					</p>
				</div>
				<HourProfile jam={data.jam} />
			</div>
		</Reveal>
	</section>

	<!-- ── cara kerja ───────────────────────────────────────────────────── -->
	<section id="cara-kerja" class="band">
		<Reveal><SectionMark n="02" label="Cara kerja" /></Reveal>
		<Reveal>
			<h2>Dari data mentah jadi satu angka yang bisa dipertanggungjawabkan.</h2>
		</Reveal>

		<Reveal><SignalFlow /></Reveal>

		<!-- Nomor dipertahankan di sini karena urutannya memang membawa informasi:
		     langkah 3 tidak mungkin dijalankan sebelum langkah 2. -->
		<ol class="rows steps">
			{#each STEPS as s, i (s.n)}
				<Reveal as="li" delay={i * 80}>
					<h3><span class="n">{s.n}</span>{s.t}</h3>
					<p>{s.d}</p>
				</Reveal>
			{/each}
		</ol>

		<Reveal delay={120}>
			<!-- Kalimat biasa yang memimpin; rumusnya tetap ada, tapi dilipat. Pembaca yang
			     dituju halaman ini tidak sedang mencari notasi — juri yang mau memeriksanya
			     tinggal membuka satu baris. -->
			<div class="plate">
				<p class="plain">
					Peluang = seberapa banyak orang di sana membelanjakan uangnya, dikurangi seberapa
					ramai pesaing sejenis — lalu dikunci satu syarat: harus ada tempat yang benar-benar
					bisa disewa.
				</p>
				<p class="note">
					Pesaing tidak cuma dihitung jumlahnya. Kedai sebelah yang selalu penuh menekan peluang
					Anda jauh lebih keras daripada kedai yang sepi, jadi keduanya tidak dihitung sama.
					Dan sebagus apa pun angkanya, kalau tidak ada ruang yang bisa disewa, peluang itu tidak
					bisa dieksekusi — karena itu ketersediaan tempat jadi syarat, bukan bonus. Seberapa
					besar Anda ingin menimbang permintaan atau persaingan bisa Anda geser sendiri.
				</p>
				<div class="scale-slot">
					<span class="cap">Hasilnya satu skala, dan itu juga legenda petanya</span>
					<ScoreRamp nodata="belum terdata — tidak diberi nilai sama sekali" />
				</div>
				<details>
					<summary>Rumus persisnya</summary>
					<code class="mono"
						>Gap = (w<sub>d</sub> · Permintaan − w<sub>s</sub> · Penawaran) / (w<sub>d</sub> +
						w<sub>s</sub>)</code
					>
				</details>
			</div>
		</Reveal>
	</section>

	<!-- ── AI ───────────────────────────────────────────────────────────── -->
	<section id="ai" class="band">
		<Reveal><SectionMark n="03" label="Tanya petanya" /></Reveal>
		<div class="split">
			<Reveal>
				<div>
					<h2>Tanya petanya pakai bahasa sehari-hari.</h2>
					<p class="body">
						Tidak ada rumus yang harus Anda isi dan tidak ada istilah yang harus dihafal. Tapak
						yang memulai: ia bertanya dulu, menyodorkan pilihan yang tinggal ditekan, lalu
						menjawab dengan daftar tempat beserta alasannya.
					</p>
					<p class="body">
						Sebelum menjawab, peta menunjukkan apa yang ia tangkap dari pertanyaan Anda — jadi
						kalau ada yang salah tangkap, Anda langsung tahu. Jawabannya selalu disertai alasan
						dan berapa banyak data yang jadi dasarnya. Kalau datanya tipis, Anda berhak tahu.
					</p>
					<p class="body">
						Percakapan di sebelah berjalan sendiri, dan pertanyaannya memang sudah ditentukan.
						Angkanya tidak: setiap nama dan setiap nilai di situ dihitung mesin skor yang sama
						dengan yang dipakai peta. Tekan jenis usaha untuk melompat ke percakapan lain.
					</p>
				</div>
			</Reveal>

			<Reveal delay={100}>
				<TapakDemo sets={data.percakapan} sapaan={SAPAAN} />
			</Reveal>
		</div>
	</section>

	<!-- ── kejujuran data ───────────────────────────────────────────────── -->
	<section id="data" class="band">
		<Reveal><SectionMark n="04" label="Data" /></Reveal>
		<Reveal>
			<h2>Kawasan yang datanya belum ada ditampilkan apa adanya — bukan ditebak.</h2>
			<p class="body wide">
				Kalau di satu kawasan datanya belum ada, SpotOn tidak mengarang angka penggantinya. Kawasan
				itu ditandai kosong dan masuk antrean untuk disurvei lebih dulu. Setiap angka juga menyebut
				berapa banyak data di baliknya, supaya Anda bisa menilai sendiri seberapa kuat dasarnya.
			</p>
		</Reveal>

		<Reveal delay={80}>
			<CoverageGrid mask={data.cakupan} terdata={k.terdata} nodata={k.nodata} />
		</Reveal>

		<div class="split">
			<Reveal>
				<div>
					<h3 class="lede"><span class="tag real">OSM</span> Yang nyata</h3>
					<SourceBars
						rows={MODES}
						unit={`${n(k.stops)} simpul transit empat moda, beserta geometri jalurnya — OpenStreetMap via Overpass API (ODbL). Akses transit tiap petak dihitung dari sini.`}
					/>
				</div>
			</Reveal>
			<Reveal delay={80}>
				<div>
					<h3 class="lede">Pesaing terdata, per jenis usaha</h3>
					<SourceBars
						rows={POIS}
						unit={`${n(k.pois)} titik usaha sejenis, juga dari OpenStreetMap. Inilah angka pesaing yang dipakai mesin skor — bukan perkiraan.`}
					/>
				</div>
			</Reveal>
		</div>

		<Reveal delay={80}>
			<div class="plate mock-plate">
				<h3><span class="tag mock">MOCK</span> Yang masih contoh</h3>
				<p class="note">
					Atribut khas dataset misi MAPID — Struk Go, Menu Go, Properti Go, termasuk profil 24 jam
					dan jumlah ruang yang disewakan — masih berupa contoh karena datanya baru dibuka untuk 50
					tim terkurasi. Strukturnya mengikuti kolom asli dan seluruh akses data lewat satu modul,
					jadi penggantian ke API MAPID tidak menyentuh satu baris pun kode antarmuka. Sampai itu
					terjadi, penanda <span class="tag mock">MOCK</span> ikut ke mana pun angkanya tampil.
				</p>
			</div>
		</Reveal>
	</section>

	<!-- ── untuk siapa ──────────────────────────────────────────────────── -->
	<section class="band">
		<Reveal><SectionMark n="05" label="Untuk siapa" /></Reveal>
		<Reveal>
			<h2>Satu peta, lima jenis keputusan.</h2>
		</Reveal>
		<ul class="rows tight">
			{#each AUDIENCE as a, i (a.t)}
				<Reveal as="li" delay={i * 60}>
					<h3>{a.t}</h3>
					<p>{a.d}</p>
				</Reveal>
			{/each}
		</ul>
	</section>

	<!-- ── penutup ──────────────────────────────────────────────────────── -->
	<section class="band closing">
		<Reveal>
			<h2 class="big">Peta yang menjawab, bukan sekadar menampilkan.</h2>
			<div class="cta">
				<a class="go" href="/app">Buka SpotOn</a>
				<a class="ghost" href="#cara-kerja">Lihat cara kerjanya</a>
			</div>
		</Reveal>
	</section>
</main>

<footer class="foot">
	<div class="foot-inner">
		<div>
			<p class="brand-line">SpotOn</p>
			<p>WebGIS rekomendasi <em>site-selection</em> berbasis AI untuk ritel &amp; F&amp;B di kawasan transit Jakarta.</p>
		</div>
		<div>
			<p class="fl">Tim Triple T</p>
			<p>Valent Nathanael · Farhan Aulianda · Anthony Gilles Rudolfo</p>
			<p class="muted">Universitas Bina Nusantara</p>
		</div>
		<div>
			<p class="fl">Data</p>
			<p class="muted">
				Geometri &amp; POI © OpenStreetMap contributors (ODbL). Atribut misi MAPID masih contoh.
				Basemap wajib pada produk final: MAPID MAPS.
			</p>
		</div>
	</div>
</footer>

<style>
	:global(html) {
		scroll-behavior: smooth;
		scroll-padding-top: 5rem;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
	}

	/* Lembar gambar: alas kertas, dan garis rambut di tepi atas sebagai sambungan
	   dari pelat maket yang baru saja lewat. */
	.sheet {
		position: relative;
		background: var(--paper);
		border-top: 1px solid var(--paper-line);
	}
	.sheet > :global(*) {
		max-width: 68rem;
		margin-inline: auto;
		padding-inline: max(1rem, 5vw);
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3vw, 2.5rem);
		line-height: 1.08;
		letter-spacing: -0.028em;
		font-weight: 600;
		max-width: 26ch;
		text-wrap: balance;
	}
	h3 {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		line-height: 1.3;
		letter-spacing: -0.012em;
		font-weight: 600;
	}
	/* Judul kecil yang memimpin satu grafik, bukan satu baris tabel. */
	h3.lede {
		font-size: clamp(1.125rem, 1.8vw, 1.375rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
		margin-bottom: 0.75rem;
		max-width: 22ch;
		text-wrap: balance;
	}
	.body {
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--label-2);
		max-width: 46ch;
	}
	.body + .body {
		margin-top: 0.875rem;
	}
	/* Judul dan paragraf pertamanya satu kelompok, tapi tetap butuh jarak; tanpa ini
	   barisnya beradu. Jaraknya lebih kecil daripada jarak di atas judul. */
	h2 + .body {
		margin-top: 1rem;
	}
	.body.wide {
		max-width: 58ch;
	}

	/* Blok judul, seperti pada sudut lembar gambar teknik. */
	.titleblock {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		border-bottom: 1px solid var(--paper-line);
	}
	.titleblock li {
		padding: 1.5rem 1.25rem 1.5rem 0;
		border-left: 1px solid var(--paper-line);
		padding-left: 1.25rem;
	}
	.titleblock li:first-child {
		border-left: 0;
		padding-left: 0;
	}
	.titleblock .v {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3.2vw, 2.5rem);
		font-weight: 300;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.titleblock .l {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--label-1);
		max-width: 16ch;
	}
	.titleblock .s {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--label-3);
		max-width: 20ch;
	}
	.cover-note {
		padding-block: 1rem;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
		border-bottom: 1px solid var(--paper-line);
	}
	.cover-note b {
		color: var(--label-1);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.band {
		padding-block: clamp(4rem, 11vh, 7.5rem);
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}

	/* Baris bergaris: label menggantung di kolom kiri, prosa di kanan. Ini yang
	   menggantikan petak kartu — halaman dibentuk garis, bukan kotak. */
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--paper-line);
	}
	.rows :global(li) {
		display: grid;
		grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
		gap: 1rem 2.5rem;
		padding-block: 1.75rem;
		border-bottom: 1px solid var(--paper-line);
	}
	.rows.tight :global(li) {
		padding-block: 1.125rem;
	}
	.rows p {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--label-2);
		max-width: 62ch;
	}
	/* Angka langkah: besar dan bertipis, seperti penomoran pada gambar kerja. */
	.steps :global(li h3) {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.steps .n {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 200;
		line-height: 0.9;
		letter-spacing: -0.02em;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}

	/* Kalimat kunci: satu-satunya tempat garis tegak berwarna dipakai di halaman
	   teks ini, dan hanya sekali per bagian. */
	.statement {
		font-family: var(--font-display);
		font-size: clamp(1.125rem, 2.1vw, 1.625rem);
		line-height: 1.32;
		letter-spacing: -0.02em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 40ch;
		border-left: 2px solid var(--accent);
		padding-left: 1.25rem;
	}

	/* Plat rumus: satu bidang bergaris rambut, tanpa bayangan. */
	.plate {
		margin: 0;
		padding: 1.75rem;
		border: 1px solid var(--paper-line);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.plate .plain {
		font-family: var(--font-display);
		font-size: clamp(1.0625rem, 1.9vw, 1.4375rem);
		line-height: 1.36;
		letter-spacing: -0.018em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 44ch;
	}
	.plate .note {
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--label-2);
		max-width: 62ch;
	}
	.plate details {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.875rem;
	}
	.plate summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
	}
	.plate summary:hover {
		color: var(--label-2);
	}
	.plate details code {
		display: block;
		margin-top: 0.75rem;
		color: var(--label-2);
		letter-spacing: 0;
	}
	.scale-slot {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.875rem;
		max-width: 30rem;
	}
	.scale-slot .cap {
		display: block;
		font-size: 0.6875rem;
		color: var(--label-3);
		margin-bottom: 0.5rem;
	}
	.mock-plate h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: 2.5rem;
		align-items: start;
	}
	.split.wide-left {
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
	}
	@media (max-width: 780px) {
		.split.wide-left {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.closing {
		align-items: center;
		text-align: center;
		padding-block: clamp(5rem, 14vh, 9rem);
		border-top: 1px solid var(--paper-line);
	}
	.closing h2 {
		max-width: 20ch;
		font-size: clamp(1.875rem, 4.2vw, 3.25rem);
		font-weight: 500;
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		justify-content: center;
		margin-top: 1.75rem;
	}
	.go,
	.ghost {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.5625rem 1.375rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.008em;
		text-decoration: none;
		transition:
			transform 120ms cubic-bezier(0.22, 0.61, 0.24, 1),
			background-color 180ms ease-out;
	}
	.go {
		background: var(--label-1);
		color: var(--paper);
	}
	.go:hover {
		transform: translateY(-1px);
	}
	.ghost {
		color: var(--label-1);
		border: 1px solid var(--separator-strong);
	}
	.ghost:hover {
		background: var(--fill-1);
	}
	.go:active,
	.ghost:active {
		transform: scale(0.97);
	}

	.foot {
		border-top: 1px solid var(--paper-line);
		background: var(--paper);
	}
	.foot-inner {
		max-width: 68rem;
		margin-inline: auto;
		padding: 2.5rem max(1rem, 5vw) 3rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1.75rem;
		font-size: 0.75rem;
		line-height: 1.6;
		color: var(--label-2);
	}
	.brand-line {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--label-1);
		margin-bottom: 0.375rem;
	}
	/* Label kaki: dibedakan berat dan warnanya, bukan huruf kapital bertracking. */
	.fl {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--label-1);
		margin-bottom: 0.375rem;
	}

	@media (max-width: 720px) {
		.rows :global(li) {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.5rem;
		}
		.titleblock li {
			padding-inline: 0;
			border-left: 0;
		}
	}
</style>
