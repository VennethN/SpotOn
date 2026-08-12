<script lang="ts">
	/**
	 * Kisi heksagon yang dinilai sambil digulir.
	 *
	 * Gerakannya sama dengan panggung maket di atas — digerakkan posisi gulir,
	 * bukan waktu — tapi ia tidak menempel (sticky) dan tidak menambah tinggi
	 * halaman. Lintasannya dibaca dari posisi elemen ini sendiri di layar: nol
	 * saat baru muncul dari bawah, satu saat hampir lewat di atas. Dengan begitu
	 * pembaca tidak pernah merasa gulirnya dibajak untuk kedua kalinya.
	 *
	 * Isinya sengaja tidak akurat, dan dikatakan begitu di layarnya: yang
	 * ditunjukkan cara membaca kisi, bukan kawasan tertentu.
	 */
	import SceneCanvas from '$lib/components/ui/SceneCanvas.svelte';
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { SpringValue, prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { WorldFactory } from '$lib/scene/world';

	const c = $derived(copy());
	let host = $state<HTMLElement | null>(null);
	let ink = $state('#1c1a16');
	let accent = $state('#0071e3');
	let ramp = $state<string[]>([]);
	let nodata = $state('#9aa2ad');

	const reduced = prefersReducedMotion();
	// Pegas: gulir mentah terasa gugup, pegas memberi massa pada kisinya.
	const spring = new SpringValue(reduced ? 0.75 : 0, { damping: 1, response: 0.7 });

	const load = async (): Promise<WorldFactory> => {
		const { GridWorld } = await import('$lib/scene/grid');
		return (canvas, opts) => new GridWorld(canvas, opts);
	};

	$effect(() => {
		if (!host || reduced) return;
		const el = host;

		const onScroll = () => {
			const rect = el.getBoundingClientRect();
			// Nol saat tepi atasnya baru menyentuh dasar layar, satu saat tepi
			// bawahnya sudah melewati sepertiga atas.
			const span = window.innerHeight + rect.height * 0.55;
			const seen = window.innerHeight - rect.top;
			spring.to(Math.max(0, Math.min(1, seen / span)));
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	// Warna adegan diambil dari token tema, bukan dipatok di dalam adegan: skala
	// peluangnya harus persis skala yang dipakai peta, dan kertasnya bisa terang
	// atau gelap. Dibaca ulang saat temanya berganti.
	$effect(() => {
		const read = () => {
			const cs = getComputedStyle(document.documentElement);
			ink = cs.getPropertyValue('--label-1').trim() || ink;
			accent = cs.getPropertyValue('--accent').trim() || accent;
			nodata = cs.getPropertyValue('--nodata').trim() || nodata;
			ramp = [0, 1, 2, 3, 4, 5, 6].map((i) =>
				cs.getPropertyValue(`--ramp-${i}`).trim()
			);
		};
		read();
		const mo = new MutationObserver(read);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		mq.addEventListener('change', read);
		return () => {
			mo.disconnect();
			mq.removeEventListener('change', read);
		};
	});
</script>

<figure class="grid-stage" bind:this={host}>
	<div class="frame">
		<SceneCanvas
			{load}
			state={{ progress: spring.current, ink, accent, ramp, nodata }}
			label={c.grid.label}
		/>
		<span class="mark">{c.grid.mark}</span>
	</div>
	<figcaption>
		<p>
			{c.grid.caption.lead}
			<strong>{c.grid.caption.strong}</strong>{c.grid.caption.rest}
		</p>
		<!-- Legendanya duduk tepat di bawah bidang yang memakainya: kalau skala harus
		     dicari di tempat lain, warnanya berhenti jadi keterangan. -->
		<div class="legend"><ScoreRamp dense nodata={c.grid.outOfScale} /></div>
	</figcaption>
</figure>

<style>
	.grid-stage {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.frame {
		position: relative;
		aspect-ratio: 16 / 7;
		border: 1px solid var(--paper-line);
		border-radius: var(--r-md);
		overflow: hidden;
		/* Alas yang sedikit terangkat di tepi atas — cahaya yang sama dengan
		   yang menyinari maketnya, bukan bidang rata. */
		background: var(--lift-panel, var(--paper));
	}
	/* Penanda permanen: adegan ini skema, dan tidak boleh dikira peta. */
	.mark {
		position: absolute;
		left: 0.625rem;
		bottom: 0.5rem;
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		color: var(--label-3);
	}
	figcaption {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(9rem, 13rem);
		gap: 0.75rem 2rem;
		align-items: start;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--label-2);
	}
	figcaption p {
		max-width: 54ch;
	}
	figcaption strong {
		color: var(--label-1);
		font-weight: 600;
	}

	@media (max-width: 720px) {
		.frame {
			aspect-ratio: 4 / 3;
		}
		figcaption {
			grid-template-columns: minmax(0, 1fr);
		}
		.legend {
			max-width: 16rem;
		}
	}
</style>
