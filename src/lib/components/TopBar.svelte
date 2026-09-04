<script lang="ts">
	import Segmented from './Segmented.svelte';
	import { CATEGORIES } from '$lib/categories';
	import { getAppState } from '$lib/state.svelte';
	import type { CategoryKey } from '$lib/types';

	const app = getAppState();
	const coverage = $derived(app.coverage);

	const themeLabel = $derived(
		app.theme === 'system' ? 'Tema sistem' : app.theme === 'dark' ? 'Tema gelap' : 'Tema terang'
	);

	function cycleTheme() {
		app.setTheme(app.theme === 'system' ? 'light' : app.theme === 'light' ? 'dark' : 'system');
	}
</script>

<header class="bar material">
	<div class="brand">
		<span class="mark" aria-hidden="true"></span>
		<span class="name">SpotOn</span>
		<span class="tagline">Rekomendasi <em>site-selection</em> kawasan transit Jakarta</span>
	</div>

	<div class="cats">
		<Segmented
			label="Jenis usaha"
			value={app.category}
			onchange={(v: CategoryKey) => app.setCategory(v)}
			options={CATEGORIES.map((c) => ({ value: c.key, label: c.short, hint: c.name }))}
		/>
	</div>

	<div class="right">
		<span class="pill" title="Petak yang sudah ada datanya, dan jumlah pesaing sejenis yang terdata di OpenStreetMap">
			{coverage.terdata}/{coverage.total} petak · {coverage.poi} pesaing terdata
		</span>
		<button type="button" class="btn" onclick={cycleTheme} aria-label={themeLabel} title={themeLabel}>
			{app.theme === 'system' ? '◐' : app.theme === 'dark' ? '☾' : '☀'}
		</button>
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
