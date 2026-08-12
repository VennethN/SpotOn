<script lang="ts">
	/**
	 * Percakapan dengan Tapak, dimainkan sendiri di halaman depan.
	 *
	 * Pertanyaannya sudah ditentukan — tapi jawabannya tidak. Setiap daftar tempat
	 * dan setiap kalimat di sini dihitung `runQuery` di server dari data yang sama
	 * dengan yang dipakai aplikasi, lewat modul narasi yang sama pula. Jadi yang
	 * ditonton pengunjung memang yang akan ia temui, bukan iklan yang dikarang.
	 *
	 * Tiga hal yang membuatnya tidak menjengkelkan:
	 *
	 * - **Bisa dipegang.** Menekan jenis usaha memindahkan percakapan ke situ
	 *   seketika; ada tombol jeda; dan gulir tidak pernah dibajak.
	 * - **Diam saat tidak dilihat.** Di luar layar atau di tab lain, pemutarnya
	 *   berhenti — halaman ini dibuka di ponsel kelas menengah dengan kuota.
	 * - **Tidak memaksa gerak.** Dengan `prefers-reduced-motion`, seluruh
	 *   percakapan tampil sekaligus dan tidak ada yang berjalan sendiri.
	 */
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import { pct } from '$lib/utils/format';
	import type { CategoryKey } from '$lib/types';

	export interface DemoResult {
		name: string;
		value: number | null;
	}
	export interface DemoSet {
		id: string;
		kategori: CategoryKey;
		pilih: string;
		chip: string;
		tanya: string;
		jawab: string;
		preface: string;
		tangkap: string[];
		kalimat: string;
		hasil: DemoResult[];
		sisa: number;
	}

	let { sets, sapaan }: { sets: DemoSet[]; sapaan: string } = $props();

	const c = $derived(copy());

	/* Langkah percakapan. Nol berarti baru sapaan; enam berarti jawabannya sudah
	   lengkap dan tinggal ditahan sebentar sebelum pindah. */
	const LAST = 6;
	/** Jeda per langkah, ms. Langkah terakhir ditahan lebih lama untuk dibaca. */
	const BEAT = [1500, 1100, 1500, 1100, 1200, 6500];

	const reduced = prefersReducedMotion();

	let i = $state(0);
	let step = $state(reduced ? LAST : 0);
	let playing = $state(!reduced);
	let onScreen = $state(false);
	let host = $state<HTMLElement | null>(null);

	const set = $derived(sets[i] ?? sets[0]);

	function jumpTo(n: number) {
		if (n === i) return;
		i = n;
		step = reduced ? LAST : 0;
	}

	// Pemutar: satu timer bergilir, bukan interval yang berjalan terus. Timer-nya
	// dipasang ulang tiap langkah supaya tiap langkah bisa punya temponya sendiri.
	$effect(() => {
		if (!playing || !onScreen || reduced) return;
		const wait = BEAT[Math.min(step, BEAT.length - 1)];
		const t = setTimeout(() => {
			if (step < LAST) step += 1;
			else {
				i = (i + 1) % sets.length;
				step = 0;
			}
		}, wait);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (!host || reduced) return;
		const el = host;
		const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), {
			threshold: 0.25
		});
		io.observe(el);
		const onVis = () => (onScreen = !document.hidden && onScreen);
		document.addEventListener('visibilitychange', onVis);
		return () => {
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>

<div class="demo" bind:this={host}>
	<div class="bar">
		<span class="who"><TapakFigure size={18} walking={false} /> {c.app.tapak}</span>
		<ul class="jump">
			{#each sets as s, n (s.id)}
				<li>
					<button
						type="button"
						class:on={n === i}
						aria-current={n === i}
						onclick={() => jumpTo(n)}
					>
						{s.chip}
					</button>
				</li>
			{/each}
		</ul>
		{#if !reduced}
			<button
				type="button"
				class="pp"
				onclick={() => (playing = !playing)}
				aria-label={playing ? c.ai.pause : c.ai.play}
			>
				{#if playing}
					<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"
						><rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" /><rect
							x="7"
							y="1.5"
							width="3"
							height="9"
							rx="1"
							fill="currentColor"
						/></svg
					>
				{:else}
					<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"
						><path d="M3 1.5 10.5 6 3 10.5Z" fill="currentColor" /></svg
					>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Perubahan diumumkan sopan: pembaca layar tidak boleh diinterupsi tiap
	     1,5 detik, jadi hanya giliran yang benar-benar baru yang dibacakan. -->
	<div class="log" aria-live="polite" aria-atomic="false">
		<div class="turn tapak">
			<span class="av"><TapakFigure size={22} walking={false} /></span>
			<p class="bub">{sapaan}</p>
		</div>

		{#if step >= 1}
			<div class="turn mine"><p class="bub said">{set.pilih}</p></div>
		{/if}
		{#if step >= 2}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<p class="bub">{set.tanya}</p>
			</div>
		{/if}
		{#if step >= 3}
			<div class="turn mine"><p class="bub said">{set.jawab}</p></div>
		{/if}
		{#if step >= 4}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<div class="bub">
					<p>{set.preface}</p>
					<!-- Apa yang ditangkap peta, sebelum satu angka pun dihitung. Ini yang
					     membuat salah tangkap ketahuan oleh penanya, bukan disembunyikan. -->
					<div class="caught">
						<span class="cap">{c.ai.caught}</span>
						<ul>
							{#each set.tangkap as t (t)}
								<li>{t}</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		{/if}
		{#if step === 5}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<p class="bub think">{c.ai.thinking}</p>
			</div>
		{/if}
		{#if step >= LAST}
			<div class="turn tapak">
				<span class="av"><TapakFigure size={22} walking={false} /></span>
				<div class="bub">
					<p>{set.kalimat}</p>
					{#if set.hasil.length}
						<ol class="places">
							{#each set.hasil as r, k (r.name)}
								<li>
									<span class="rank">{k + 1}</span>
									<span class="nm">{r.name}</span>
									{#if r.value != null}
										<span class="sc">{pct(r.value)}</span>
									{:else}
										<span class="sc none">—</span>
									{/if}
								</li>
							{/each}
						</ol>
						{#if set.sisa > 0}
							<p class="more">{c.ai.more(set.sisa)}</p>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<p class="foot">
		{c.ai.foot}
		<span class="tag mock">MOCK</span>
		{c.ai.footMock}
	</p>
</div>

<style>
	/* Tingginya dipatok. Dibiarkan mengikuti isi, panjang percakapan yang
	   berbeda-beda membuat seluruh halaman di bawahnya naik-turun tiap belasan
	   detik — dan itu jauh lebih mengganggu daripada satu giliran lama yang
	   terpotong di atas. */
	.demo {
		border: 1px solid var(--paper-line);
		background-image: var(--lift-panel);
		box-shadow: inset 0 1px 0 var(--lift-edge);
		display: flex;
		flex-direction: column;
		height: clamp(29rem, 66vh, 36rem);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--paper-line);
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		flex: none;
	}
	.jump {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0 auto 0 0;
		padding: 0;
	}
	.jump button {
		border: 1px solid transparent;
		background: none;
		color: var(--label-3);
		border-radius: 999px;
		padding: 0.125rem 0.5rem;
		font-size: 0.6875rem;
		cursor: pointer;
		transition:
			color 140ms ease-out,
			border-color 140ms ease-out;
	}
	.jump button:hover {
		color: var(--label-1);
	}
	.jump button.on {
		color: var(--label-1);
		border-color: var(--separator-strong);
	}
	.pp {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		border: 1px solid var(--separator-strong);
		background: none;
		color: var(--label-2);
		border-radius: 999px;
		cursor: pointer;
	}
	.pp:hover {
		color: var(--label-1);
	}

	/* Percakapan ditumpuk dari bawah seperti kotak pesan: kalau ditumpuk dari atas,
	   tiap giliran baru mendorong yang lama dan seluruh blok ikut bergoyang. */
	.log {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		/* Giliran lama yang tergeser ke atas dipudarkan, bukan dipotong rata —
		   potongan lurus di tengah kalimat terbaca sebagai tata letak yang rusak. */
		mask-image: linear-gradient(to bottom, transparent 0, #000 2.75rem);
		-webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 2.75rem);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.turn {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		/* Giliran baru masuk dari bawah, seperti pesan yang baru tiba. */
		animation: enter 320ms cubic-bezier(0.22, 0.61, 0.24, 1) both;
	}
	.turn.mine {
		justify-content: flex-end;
	}
	.av {
		flex: none;
		margin-top: 0.125rem;
	}

	.bub {
		border: 1px solid var(--paper-line);
		border-radius: var(--r-md);
		padding: 0.5rem 0.6875rem;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
		max-width: 34ch;
	}
	.bub.said {
		background: var(--label-1);
		color: var(--paper);
		border-color: transparent;
	}
	.bub.think {
		color: var(--label-3);
	}
	.bub p + .caught {
		margin-top: 0.5rem;
	}

	.caught .cap {
		display: block;
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--label-3);
		margin-bottom: 0.3125rem;
	}
	.caught ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.caught li {
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--label-2);
		border: 1px solid var(--separator-strong);
		border-radius: 999px;
		padding: 0.0625rem 0.5rem;
	}

	.places {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.places li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		border-top: 1px solid var(--paper-line);
		padding-top: 0.3125rem;
	}
	.rank {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}
	.nm {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.sc {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.sc.none {
		color: var(--label-3);
	}
	.more {
		margin-top: 0.4375rem;
		font-size: 0.6875rem;
		color: var(--label-3);
	}

	.foot {
		border-top: 1px solid var(--paper-line);
		padding: 0.5rem 0.75rem;
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translate3d(0, 6px, 0);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.turn {
			animation: none;
		}
	}
</style>
