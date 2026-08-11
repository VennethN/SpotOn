<script lang="ts">
	/**
	 * Panggung gulir halaman depan.
	 *
	 * Kanvas menempel (sticky) selama beberapa layar, dan posisi gulir menggerakkan
	 * dua hal sekaligus: kamera menyusuri koridor, dan jam berjalan maju dari jam
	 * mesin pengunjung, satu putaran penuh, kembali ke jam yang sama. Kepadatan
	 * pejalan kaki tidak dikarang — angkanya profil 24 jam catchment Bundaran HI,
	 * dinormalisasi terhadap jam puncaknya sendiri.
	 *
	 * Dua hal yang diperbaiki dari versi sebelumnya, dan keduanya soal tempo:
	 *
	 * 1. **Sehari tidak lagi lewat dalam satu dorongan.** Dulu 18 jam dipadatkan ke
	 *    sepertiga lintasan yang hanya sepanjang 1,4 layar — satu sentakan jempol
	 *    dan matahari sudah terbenam. Sekarang satu hari mengambil hampir seluruh
	 *    lintasan pada panggung yang jauh lebih panjang.
	 * 2. **Harinya tidak berulang.** Dulu setelah tengah malam jamnya terus melaju
	 *    sampai tengah hari berikutnya, jadi matahari terbit dua kali dalam satu
	 *    gulir dan yang terbaca adalah pengulangan, bukan satu hari.
	 *
	 * Pemetaannya tetap tidak linear: ada bagian yang menahan supaya pembaca sempat
	 * membaca, ada bagian yang berjalan tenang.
	 */
	import StreetScene from '$lib/components/ui/StreetScene.svelte';
	import { daylightAt, localHour } from '$lib/scene/daylight';
	import { formatHour } from '$lib/utils/format';
	import { SpringValue, prefersReducedMotion } from '$lib/utils/motion.svelte';
	import stations from '$lib/data/stations.json';
	import type { CategoryKey } from '$lib/types';

	interface Props {
		category?: CategoryKey;
	}
	let { category = 'kopi' as CategoryKey }: Props = $props();

	const STATION = stations[0];
	/** Hex tanpa profil jam memang tidak punya data — bukan nol yang dikarang. */
	const JAM: number[] = STATION?.jam ?? [];
	const HAS_DATA = JAM.length === 24;
	const PEAK = HAS_DATA ? Math.max(...JAM) : 0;
	const PEAK_HOUR = HAS_DATA ? JAM.indexOf(PEAK) : 12;

	/** Kepadatan pada jam pecahan — diinterpolasi antar dua jam bulat. */
	function densityAt(h: number): number {
		if (!HAS_DATA || PEAK <= 0) return 0;
		const i = Math.floor(((h % 24) + 24) % 24);
		const f = h - Math.floor(h);
		const v = JAM[i] * (1 - f) + JAM[(i + 1) % 24] * f;
		return v / PEAK;
	}
	/** N struk pada jam itu. Diinterpolasi persis seperti kepadatan, supaya angka
	    dan persentase yang tampil berdampingan tidak pernah saling membantah. */
	function strukAt(h: number): number {
		if (!HAS_DATA) return 0;
		const i = Math.floor(((h % 24) + 24) % 24);
		const f = h - Math.floor(h);
		return Math.round(JAM[i] * (1 - f) + JAM[(i + 1) % 24] * f);
	}

	const START_HOUR = localHour();
	const reduced = prefersReducedMotion();

	/* Sehari penuh, sekali, maju terus. Berakhir di jam yang sama dengan saat
	   halaman dibuka — pengunjung kembali ke waktunya sendiri, dan petak di
	   sebelah kafe masih kosong. */
	const DAY = 24;

	let host = $state<HTMLElement | null>(null);
	let progress = $state(0);

	// Pegas: gulir mentah terasa gugup, pegas memberi massa pada kamera dan matahari.
	const hourSpring = new SpringValue(START_HOUR, { damping: 1, response: 0.75 });
	const camSpring = new SpringValue(0, { damping: 1, response: 0.85 });

	/* Peta gulir → (jam, kamera). Setiap segmen punya kecepatannya sendiri. */
	function mapProgress(p: number) {
		if (p < 0.1) {
			// menahan: jam mesin pengunjung, kamera diam
			return { hour: START_HOUR, cam: 0 };
		}
		if (p < 0.8) {
			// satu putaran penuh, tenang — inilah bagian terpanjang lintasan
			const t = (p - 0.1) / 0.7;
			return { hour: START_HOUR + t * DAY, cam: t * 0.78 };
		}
		// kembali ke jam semula; yang tersisa cuma kamera merapat ke petak kosong
		const t = (p - 0.8) / 0.2;
		return { hour: START_HOUR + DAY, cam: 0.78 + t * 0.22 };
	}

	$effect(() => {
		if (!host) return;
		const el = host;

		const onScroll = () => {
			const rect = el.getBoundingClientRect();
			const total = rect.height - window.innerHeight;
			const p = total <= 0 ? 0 : Math.max(0, Math.min(1, -rect.top / total));
			progress = p;
			const m = mapProgress(p);
			hourSpring.to(m.hour);
			camSpring.to(m.cam);
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	const hour = $derived(reduced ? PEAK_HOUR : hourSpring.current);
	const day = $derived(daylightAt(hour));
	const density = $derived(densityAt(hour));

	// Tinta jam ini disiarkan ke :root supaya chrome yang mengambang di atas adegan
	// (bilah navigasi) ikut berganti bersama langit, bukan memakai token tema yang
	// kebetulan gelap saat adegannya sedang terang benderang.
	$effect(() => {
		const el = document.documentElement;
		el.style.setProperty('--stage-ink', day.ink);
		el.style.setProperty('--stage-ink-muted', day.inkMuted);
		el.style.setProperty('--stage-ink-inverse', day.inkInverse);
		return () => {
			el.style.removeProperty('--stage-ink');
			el.style.removeProperty('--stage-ink-muted');
			el.style.removeProperty('--stage-ink-inverse');
		};
	});

	// Panel teks muncul dan pergi pada rentang gulir masing-masing.
	function band(p: number, a: number, b: number, fade = 0.06) {
		if (p < a - fade || p > b + fade) return 0;
		if (p < a) return (p - (a - fade)) / fade;
		if (p > b) return 1 - (p - b) / fade;
		return 1;
	}
	const showHero = $derived(band(progress, 0, 0.09));
	const showDay = $derived(band(progress, 0.18, 0.52));
	const showLot = $derived(band(progress, 0.66, 1));
</script>

<section class="stage" bind:this={host} style:--ink={day.ink} style:--ink-muted={day.inkMuted}>
	<div class="sticky">
		<StreetScene
			{hour}
			{density}
			{category}
			cameraT={camSpring.current}
			label={`Blok jalan di sekitar stasiun ${STATION.name} pada pukul ${formatHour(hour)}. Kepadatan pejalan kaki mengikuti profil transaksi 24 jam catchment ini: ${strukAt(hour)} struk pada jam tersebut.`}
		/>

		<div class="scrim" style:--scrim={day.scrim}></div>

		<!-- jam berjalan: satu-satunya elemen yang selalu ada, karena ia yang menjelaskan adegannya -->
		<div class="clock">
			<span class="time">{formatHour(hour)}</span>
			<span class="phase">{day.phase}</span>
			<span class="reading">
				{#if density > 0}
					{strukAt(hour)} struk · {Math.round(density * 100)}% dari jam puncak
				{:else}
					belum ada transaksi pada jam ini
				{/if}
			</span>
			<span class="tag">data contoh</span>
		</div>

		<div class="copy hero" style:opacity={showHero} aria-hidden={showHero < 0.5}>
			<h1>Tanya jalannya<br />sebelum Anda menyewa.</h1>
			<p>
				Satu blok di sekitar stasiun transit Jakarta, pada jam yang sedang berjalan. Ramai dan
				sepinya trotoar mengikuti profil transaksi 24 jam catchment — di halaman ini memakai
				data contoh. Angka sungguhan dihitung di dalam aplikasi.
			</p>
			<div class="cta">
				<a class="go" href="/app" style:--btn-ink={day.inkInverse}>Buka SpotOn</a>
				<span class="hint">gulir untuk melihat satu hari penuh</span>
			</div>
		</div>

		<div class="copy mid" style:opacity={showDay} aria-hidden={showDay < 0.5}>
			<h2>Satu lokasi bukan satu angka. Ia berubah sepanjang hari.</h2>
			<p>
				Trotoar yang sepi pukul 10 pagi bisa penuh pukul 7 malam. Sewa dibayar untuk 24 jam,
				jadi jam mana yang ramai menentukan usaha apa yang masuk akal di sana.
			</p>
		</div>

		<div class="copy mid" style:opacity={showLot} aria-hidden={showLot < 0.5}>
			<h2>Petak bergaris putih itu masih kosong.</h2>
			<p>
				Volume tembus pandang di atasnya bukan bangunan yang ada — itu usaha yang bisa Anda
				buka di sana. Permintaan tanpa ruang yang bisa ditempati bukan peluang, jadi SpotOn
				memperlakukan ketersediaan ruang sebagai gerbang, bukan nilai tambah.
			</p>
			<span class="prov">Struk Go, Menu Go, Properti Go: contoh · Stasiun &amp; pesaing: OSM</span>
		</div>
	</div>
</section>

<style>
	.stage {
		position: relative;
		/* Tinggi ini yang menentukan berapa lama sehari berlangsung. Pada 480vh,
		   24 jam lewat dalam ±1,4 layar; di sini tiap layar gulir kira-kira lima
		   jam, dan mataharinya sempat terlihat bergerak. */
		height: 760vh;
	}
	.sticky {
		position: sticky;
		top: 0;
		height: 100svh;
		overflow: hidden;
	}
	.scrim {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* Hanya sudut tempat teks duduk yang diredam; koridor di tengah dibiarkan terang. */
		background:
			linear-gradient(
				to top,
				rgba(0, 0, 0, calc(var(--scrim) * 1.05)) 0%,
				rgba(0, 0, 0, calc(var(--scrim) * 0.45)) 22%,
				transparent 46%
			),
			linear-gradient(to right, rgba(0, 0, 0, calc(var(--scrim) * 0.5)) 0%, transparent 34%),
			linear-gradient(to bottom, rgba(0, 0, 0, calc(var(--scrim) * 0.5)) 0%, transparent 16%),
			/* jam duduk di langit yang terang; tanpa ini angkanya putih di atas putih */
			radial-gradient(
				120% 70% at 100% 0%,
				rgba(0, 0, 0, calc(var(--scrim) * 0.92)) 0%,
				transparent 58%
			);
	}

	.clock {
		position: absolute;
		/* di bawah bilah navigasi, bukan di belakangnya */
		top: clamp(4.25rem, 9vh, 6rem);
		right: clamp(1rem, 4vw, 3rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
		color: var(--ink);
		text-align: right;
	}
	.time {
		font-family: var(--font-display);
		font-size: clamp(2rem, 4.4vw, 3.25rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 0.9;
		font-variant-numeric: tabular-nums;
	}
	.phase {
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.reading {
		margin-top: 0.35rem;
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--ink-muted);
		max-width: 16ch;
	}
	/* Penanda permanen: tidak ada angka di halaman ini yang boleh dikira data hidup. */
	.tag {
		margin-top: 0.4rem;
		font-family: var(--font-display);
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-muted);
		border: 1px solid currentColor;
		border-radius: 3px;
		padding: 0.05rem 0.3rem;
		/* Penanda ini harus terbaca di langit tengah hari yang terang, bukan sekadar
		   ada. Alas gelap tipis lebih jujur daripada menaikkan opasitas tinta. */
		background: rgba(0, 0, 0, 0.28);
	}

	.copy {
		position: absolute;
		left: clamp(1rem, 5vw, 4.5rem);
		bottom: clamp(2.5rem, 9vh, 5.5rem);
		max-width: min(30rem, 74vw);
		color: var(--ink);
		transition: opacity 220ms ease-out;
	}
	.copy p {
		margin-top: 0.75rem;
		font-size: clamp(0.875rem, 1.25vw, 1rem);
		line-height: 1.55;
		color: var(--ink-muted);
		max-width: 42ch;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(2.25rem, 5.6vw, 4.5rem);
		font-weight: 620;
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: balance;
		margin: 0;
	}
	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3.1vw, 2.5rem);
		font-weight: 600;
		line-height: 1.06;
		letter-spacing: -0.028em;
		text-wrap: balance;
		margin: 0;
		max-width: 20ch;
	}

	.cta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}
	.go {
		display: inline-flex;
		align-items: center;
		background: var(--ink);
		color: var(--btn-ink, #0e1118);
		border-radius: 999px;
		padding: 0.6rem 1.4rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 620;
		letter-spacing: -0.01em;
		text-decoration: none;
		transition:
			transform 120ms cubic-bezier(0.22, 0.61, 0.24, 1),
			filter 180ms ease-out;
	}
	.go:hover {
		transform: translateY(-1px);
		filter: brightness(1.08);
	}
	.go:active {
		transform: scale(0.97);
	}
	.hint {
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}
	.prov {
		display: block;
		margin-top: 1rem;
		font-size: 0.66rem;
		letter-spacing: 0.05em;
		color: var(--ink-muted);
	}

	@media (max-width: 720px) {
		.copy {
			max-width: none;
			right: clamp(1rem, 5vw, 4.5rem);
		}
		.clock .reading {
			display: none;
		}
		/* Teks di layar sempit menempati hampir separuh tinggi, jadi peredupnya harus
		   naik sejauh itu juga — kalau tidak, baris teratas duduk di atas alas terang. */
		.scrim {
			background:
				linear-gradient(
					to top,
					rgba(0, 0, 0, calc(var(--scrim) * 1.15)) 0%,
					rgba(0, 0, 0, calc(var(--scrim) * 0.85)) 34%,
					transparent 66%
				),
				linear-gradient(to bottom, rgba(0, 0, 0, calc(var(--scrim) * 0.7)) 0%, transparent 20%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage {
			height: auto;
		}
		.sticky {
			position: relative;
			height: 88svh;
		}
		.copy {
			position: relative;
			opacity: 1 !important;
			left: auto;
			bottom: auto;
		}
	}
</style>
