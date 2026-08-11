<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import TapakPanel from '$lib/components/app/TapakPanel.svelte';
	import AttributeTable from '$lib/components/app/AttributeTable.svelte';
	import ControlPanel from '$lib/components/app/ControlPanel.svelte';
	import CatchmentDiorama from '$lib/components/app/CatchmentDiorama.svelte';
	import DetailPanel from '$lib/components/app/DetailPanel.svelte';
	import MapLegend from '$lib/components/app/MapLegend.svelte';
	import MapView from '$lib/components/app/MapView.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import TopBar from '$lib/components/app/TopBar.svelte';
	import { setAppState } from '$lib/state/app.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Data awal sengaja diambil sekali; status selanjutnya hidup di AppState.
	const app = setAppState(untrack(() => data.catchments));

	/** Tata letak ringkas memakai sheet yang bisa diseret; lebar memakai panel mengambang. */
	let compact = $state(false);
	/** Laci pengaturan teknis — tertutup sampai pengguna memintanya. */
	let advanced = $state(false);
	let sheetIndex = $state(1);

	onMount(() => {
		const stopTheme = app.initTheme();
		const mq = window.matchMedia('(max-width: 1023px)');
		compact = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (compact = e.matches);
		mq.addEventListener('change', onChange);

		// Yang menyambut pengguna sekarang sapaan Tapak, bukan satu pilihan dan satu
		// pertanyaan yang dijalankan diam-diam di belakang layar.

		return () => {
			stopTheme();
			mq.removeEventListener('change', onChange);
		};
	});
</script>

<svelte:head>
	<title>SpotOn — Peta rekomendasi site-selection kawasan transit Jakarta</title>
</svelte:head>

<div class="app">
	<MapView />
	<TopBar bind:advanced />
	<MapLegend />

	{#if compact}
		<Sheet bind:index={sheetIndex} detents={[0.14, 0.5, 0.92]}>
			{#snippet header()}
				<Segmented
					label="Panel"
					bind:value={app.sheetTab}
					options={[
						{ value: 'rekomendasi', label: 'Tapak' },
						{ value: 'detail', label: 'Kawasan' },
						{ value: 'tabel', label: 'Tabel' },
						{ value: 'kontrol', label: 'Lanjutan' }
					]}
				/>
			{/snippet}
			{#if app.sheetTab === 'rekomendasi'}
				<TapakPanel />
			{:else if app.sheetTab === 'detail'}
				<CatchmentDiorama />
				<DetailPanel />
			{:else if app.sheetTab === 'tabel'}
				<AttributeTable />
			{:else}
				<ControlPanel />
			{/if}
		</Sheet>
	{:else}
		{#if advanced}
			<aside class="rail left scroll" aria-label="Pengaturan lanjutan">
				<section class="card material">
					<h2 class="eyebrow head">Pengaturan lanjutan</h2>
					<div class="body"><ControlPanel /></div>
				</section>
			</aside>
		{/if}

		<aside class="rail right scroll" aria-label="Tapak dan detail kawasan">
			<section class="card material">
				<h2 class="eyebrow head">Tapak <span class="muted">— pemandu Anda</span></h2>
				<div class="body"><TapakPanel /></div>
			</section>
			<section class="card material">
				<h2 class="eyebrow head">Suasana kawasan</h2>
				<div class="body"><CatchmentDiorama /></div>
			</section>
			<section class="card material">
				<details>
					<summary class="eyebrow head">Angka lengkap kawasan</summary>
					<div class="body"><DetailPanel /></div>
				</details>
			</section>
		</aside>

		<div class="table-dock" class:open={app.tableOpen}>
			<button
				type="button"
				class="table-toggle btn"
				onclick={() => (app.tableOpen = !app.tableOpen)}
				aria-expanded={app.tableOpen}
			>
				{app.tableOpen ? 'Sembunyikan tabel atribut' : 'Tabel atribut'}
			</button>
			{#if app.tableOpen}
				<section class="card material table-panel">
					<h2 class="eyebrow head">
						Tabel atribut <span class="muted">— klik judul kolom untuk mengurutkan</span>
					</h2>
					<AttributeTable />
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}

	.rail {
		position: fixed;
		top: 3.25rem;
		bottom: 0.75rem;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.625rem 0.25rem 0.625rem 0;
	}
	.rail.left {
		left: 0.75rem;
		width: 17rem;
		/* Legenda duduk di kiri bawah; rail berhenti di atasnya, tidak menimpanya. */
		bottom: 9.5rem;
	}
	.rail.right {
		right: 0.75rem;
		width: 23rem;
	}

	.card {
		position: relative;
		border-radius: var(--r-lg);
		overflow: hidden;
		flex: none;
	}
	.head {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--separator);
	}
	.head .muted {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.body {
		padding: 0.75rem;
	}

	.table-dock {
		position: fixed;
		left: 50%;
		bottom: 1rem;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: min(58rem, calc(100vw - 44rem));
	}
	.table-toggle {
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-regular);
		backdrop-filter: var(--blur-regular);
		box-shadow: var(--shadow-panel);
	}
	.table-panel {
		width: 100%;
		max-height: 55vh;
		display: flex;
		flex-direction: column;
		/* Muncul dari arah tombolnya, bukan dari titik netral. */
		transform-origin: bottom center;
		animation: rise 260ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.table-panel {
			animation: none;
		}
	}
</style>
