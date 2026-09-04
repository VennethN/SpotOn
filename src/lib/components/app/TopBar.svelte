<script lang="ts">
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { CATEGORIES } from '$lib/domain/categories';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import type { CategoryKey, PoiSource } from '$lib/types';

	const app = getAppState();
	const c = $derived(copy());
	const coverage = $derived(app.coverage);

	/* Laci pengaturan lanjutan dibuka dari sini, bukan dari tombol mengambang di
	   pojok kiri bawah — di sana ia menumpuk dengan skala peta dan legenda. */
	let { advanced = $bindable(false) }: { advanced?: boolean } = $props();

</script>

<header class="bar material">
	<div class="brand">
		<span class="mark" aria-hidden="true"></span>
		<span class="name">{c.brand.name}</span>
		<span class="tagline">{c.brand.appTagline}</span>
	</div>

	<div class="cats">
		<Segmented
			label={c.app.categoryLabel}
			value={app.category}
			onchange={(v: CategoryKey) => app.setCategory(v)}
			options={CATEGORIES.map((def) => ({
				value: def.key,
				label: c.category[def.key].short,
				hint: c.category[def.key].name
			}))}
		/>
	</div>

	<div class="source">
		<Segmented
			label={c.app.sourceLabel}
			value={app.weights.source}
			onchange={(v: PoiSource) => app.setSource(v)}
			options={[
				{ value: 'osm', label: 'OSM', hint: c.app.sourceOsm },
				{ value: 'mapid', label: 'MAPID', hint: c.app.sourceMapid }
			]}
		/>
	</div>

	<div class="right">
		<span class="pill" title={c.app.coverageTitle}>
			{c.app.coverage(coverage.terdata, coverage.total, coverage.poi)}
		</span>
		<button
			type="button"
			class="btn adv"
			class:on={advanced}
			onclick={() => (advanced = !advanced)}
			aria-expanded={advanced}
		>
			<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
				<g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none">
					<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
				</g>
				<g fill="currentColor">
					<circle cx="6" cy="4.5" r="1.7" />
					<circle cx="10.5" cy="8" r="1.7" />
					<circle cx="5" cy="11.5" r="1.7" />
				</g>
			</svg>
			<span class="adv-text">{advanced ? c.app.advancedClose : c.app.advanced}</span>
		</button>
		<LangToggle />
		<ThemeToggle theme={app.theme} onchange={(t) => app.setTheme(t)} />
	</div>
</header>

<style>
	.bar {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-inline: 0;
		border-top: 0;
		border-radius: 0;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		box-shadow: 0 1px 0 var(--separator);
	}
	.brand {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.mark {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 4px;
		background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 82%, white), var(--accent));
		box-shadow: var(--shadow-chip);
		align-self: center;
	}
	.name {
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.015em;
	}
	.tagline {
		font-size: 0.6875rem;
		color: var(--label-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cats {
		margin-inline: auto;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.adv.on {
		background: var(--fill-3);
	}
	/* Pada tata letak ringkas, pengaturan lanjutan sudah punya tabnya sendiri di
	   dalam sheet — tombol ini di sana hanya akan jadi tombol yang tidak berbuat apa-apa. */
	@media (max-width: 1023px) {
		.adv {
			display: none;
		}
	}
	.adv svg {
		flex: none;
	}
	.pill {
		font-size: 0.6875rem;
		color: var(--label-2);
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.1875rem 0.5rem;
		white-space: nowrap;
	}

	@media (max-width: 900px) {
		.tagline,
		.pill {
			display: none;
		}
		.cats {
			margin-inline: 0 auto;
			min-width: 0;
			overflow-x: auto;
		}
	}
</style>
