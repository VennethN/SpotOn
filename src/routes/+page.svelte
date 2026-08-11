<script lang="ts">
	import StreetStage from '$lib/components/landing/StreetStage.svelte';
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import Reveal from '$lib/components/landing/Reveal.svelte';

	const STATS = [
		{ v: '13', l: 'kawasan stasiun MRT' },
		{ v: '5', l: 'jenis usaha dinilai' },
		{ v: '168', l: 'pesaing nyata terdata' },
		{ v: '800 m', l: 'sejauh jalan kaki' }
	];

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

	const STEPS = [
		{
			n: '1',
			t: 'Kawasan sejauh jalan kaki',
			d: 'Lingkaran 400–800 m ditarik mengelilingi tiap stasiun MRT, LRT, dan TransJakarta — sejauh yang benar-benar sanggup ditempuh orang dengan berjalan kaki.'
		},
		{
			n: '2',
			t: 'Tiga sinyal disatukan',
			d: 'Data belanja, data pesaing, dan data ruang yang disewakan dicocokkan ke kawasan stasiun terdekat, lalu diringkas jadi tiga hal: seberapa banyak yang belanja, seberapa ramai pesaingnya, dan ada tidaknya tempat kosong.'
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
	];

	const AUDIENCE = [
		{ t: 'Pemodal ritel & kuliner', d: 'Memilih lokasi cabang baru dari data, bukan dari firasat.' },
		{ t: 'UMKM bermodal pas-pasan', d: 'Menemukan lokasi bagus yang sewanya masih masuk akal.' },
		{ t: 'Calon wirausaha rumahan', d: '“Usaha apa yang masuk akal di sekitar sini?” — dijawab beserta alasannya.' },
		{ t: 'Tim pembukaan cabang', d: 'Menyaring dan mengurutkan calon lokasi di sepanjang jalur transit.' },
		{ t: 'Pemilik & agen properti', d: 'Tahu tempatnya cocok untuk usaha apa, dan siapa penyewa yang tepat.' }
	];
</script>

<svelte:head>
	<title>SpotOn — Jangan tebak lokasi usaha. Tanya petanya.</title>
	<meta
		name="description"
		content="SpotOn menyatukan permintaan, persaingan, dan ketersediaan ruang usaha di setiap catchment stasiun transit Jakarta, lalu merekomendasikan di mana membuka usaha — dan mengapa."
	/>
</svelte:head>

<LandingNav />

<StreetStage />

<!-- Halaman di bawah panggung memakai bahasa yang sama dengan maketnya: lembar
     gambar. Garis rambut, label menggantung di kolom kiri, angka besar bertipis —
     bukan kartu berbayang. Yang membentuk halaman ini garis dan ruang, bukan kotak. -->
<main id="top" class="sheet">
	<Reveal as="section">
		<ul class="titleblock">
			{#each STATS as s (s.l)}
				<li>
					<span class="v">{s.v}</span>
					<span class="l">{s.l}</span>
				</li>
			{/each}
		</ul>
	</Reveal>

	<!-- ── masalah ──────────────────────────────────────────────────────── -->
	<section id="masalah" class="band">
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
	</section>

	<!-- ── cara kerja ───────────────────────────────────────────────────── -->
	<section id="cara-kerja" class="band">
		<Reveal>
			<h2>Dari data mentah jadi satu angka yang bisa dipertanggungjawabkan.</h2>
		</Reveal>

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
		<div class="split">
			<Reveal>
				<div>
					<h2>Tanya petanya pakai bahasa sehari-hari.</h2>
					<p class="body">
						Tidak ada rumus yang harus Anda isi dan tidak ada istilah yang harus dihafal. Tulis
						pertanyaannya seperti Anda menanyakannya ke teman yang hafal daerah itu.
					</p>
					<p class="body">
						Sebelum menjawab, peta menunjukkan dulu apa yang ia tangkap dari pertanyaan Anda — jadi
						kalau ada yang salah tangkap, Anda langsung tahu. Jawabannya selalu disertai alasan dan
						berapa banyak data yang jadi dasarnya. Kalau datanya tipis, Anda berhak tahu.
					</p>
				</div>
			</Reveal>

			<Reveal delay={100}>
				<div class="demo">
					<p class="asked">“Di mana buka kedai kopi modal kecil dekat MRT?”</p>

					<!-- Yang dulu ditampilkan sebagai query JSON. Isinya sama persis — pengguna
					     tetap bisa memeriksa apa yang ditangkap peta — tapi ditulis dengan kata
					     yang dipakai orang, bukan dengan sintaks yang cuma terbaca oleh programmer. -->
					<div class="understood">
						<p class="cap">Yang ditangkap peta</p>
						<ul>
							<li>kedai kopi</li>
							<li>dalam 800 m jalan kaki dari stasiun</li>
							<li>ada ruang yang disewakan</li>
							<li>sewa kelas bawah</li>
						</ul>
					</div>

					<article class="answer">
						<header>
							<span class="nm">Lebak Bulus Bank Syariah Indonesia</span>
							<span class="sc">79</span>
						</header>
						<p>
							<b>Kenapa di sini?</b> Orang di sekitar sini banyak jajan — ramainya paling tinggi
							sekitar pukul 7 malam. Kedai kopi lain baru ada satu dalam radius jalan kaki, dan
							itu pun sepi. Ada 3 tempat yang sedang disewakan dan cocok untuk kedai.
						</p>
						<span class="n">Dihitung dari 43 titik data di kawasan ini · 1 pesaing terdata (OSM)</span>
					</article>
				</div>
			</Reveal>
		</div>
	</section>

	<!-- ── kejujuran data ───────────────────────────────────────────────── -->
	<section id="data" class="band">
		<Reveal>
			<h2>Kawasan yang datanya belum ada ditampilkan apa adanya — bukan ditebak.</h2>
			<p class="body wide">
				Kalau di satu kawasan datanya belum ada, SpotOn tidak mengarang angka penggantinya. Kawasan
				itu ditandai kosong dan masuk antrean untuk disurvei lebih dulu. Setiap angka juga menyebut
				berapa banyak data di baliknya, supaya Anda bisa menilai sendiri seberapa kuat dasarnya.
			</p>
		</Reveal>

		<ul class="rows">
			<Reveal as="li">
				<h3><span class="tag real">OSM</span> Nyata</h3>
				<p>
					Koordinat dan nama 13 stasiun MRT lin Utara–Selatan, geometri jalur, serta jumlah POI
					pesaing per radius — diambil langsung dari OpenStreetMap via Overpass API (ODbL).
				</p>
			</Reveal>
			<Reveal as="li" delay={80}>
				<h3><span class="tag mock">MOCK</span> Contoh</h3>
				<p>
					Atribut khas dataset misi MAPID — Struk Go, Menu Go, Properti Go — masih berupa contoh
					karena datanya belum publik. Strukturnya mengikuti kolom asli, jadi tinggal ditukar
					begitu API MAPID tersedia.
				</p>
			</Reveal>
		</ul>
	</section>

	<!-- ── untuk siapa ──────────────────────────────────────────────────── -->
	<section class="band">
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
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
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
	}
	.titleblock .l {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--label-3);
		max-width: 14ch;
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

	.statement {
		font-family: var(--font-display);
		font-size: clamp(1.125rem, 2.1vw, 1.625rem);
		line-height: 1.32;
		letter-spacing: -0.02em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 40ch;
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

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: 2.5rem;
		align-items: start;
	}
	.demo {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--paper-line);
	}
	.asked {
		padding: 0.875rem 1rem;
		font-size: 0.875rem;
		color: var(--label-1);
		border-bottom: 1px solid var(--paper-line);
	}
	/* Apa yang ditangkap peta, ditulis sebagai potongan kata — bisa diperiksa
	   sekilas tanpa harus bisa membaca kode. */
	.understood {
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--paper-line);
	}
	.understood .cap {
		font-size: 0.75rem;
		color: var(--label-3);
		margin-bottom: 0.5rem;
	}
	.understood ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.understood li {
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--label-1);
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		padding: 0.1875rem 0.625rem;
	}
	.answer {
		padding: 0.875rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
	}
	.answer header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.answer .nm {
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.answer .sc {
		margin-left: auto;
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 300;
		letter-spacing: -0.025em;
		line-height: 1;
	}
	.answer p {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	.answer .n {
		font-size: 0.625rem;
		color: var(--label-3);
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
