<script lang="ts">
	import HourBars from '$lib/components/ui/HourBars.svelte';
	import { CATEGORY_MAP } from '$lib/domain/categories';
	import { supplyPhrase } from '$lib/domain/narrate';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { formatHour, pct, rampIndex } from '$lib/utils/format';

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	const def = $derived(CATEGORY_MAP[app.category]);
	const name = $derived(c.category[app.category].name);
	const across = $derived(app.selectedAcrossCategories);

	/**
	 * The per-format comparison is the one place that needs EVERY category at once,
	 * so it is the one place that asks for them all — thirteen slices, and everywhere
	 * else in the app works from the single active one.
	 *
	 * Asked for when the chart is ON SCREEN, not when a cell is selected. On the wide
	 * layout this panel sits inside a `<details>` that starts closed, so selecting a
	 * cell would otherwise fetch every category for a chart the user has not opened
	 * and may never open — the exact cost this whole arrangement exists to avoid. An
	 * IntersectionObserver covers both layouts at once: a closed `<details>` gives its
	 * contents no box, so the chart simply never intersects until it is opened.
	 */
	let compareEl = $state<HTMLElement | null>(null);

	$effect(() => {
		const el = compareEl;
		if (!el) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) void app.loadAllCategories();
			},
			// Primed before it is actually read, not at the moment it appears. The rail
			// and the sheet both scroll, so without this the chart arrives on screen
			// holding a single bar and the other twelve drop in under the reader's eyes.
			{ rootMargin: '300px' }
		);
		io.observe(el);
		return () => io.disconnect();
	});
</script>

{#if !row}
	<p class="empty">{c.detail.empty}</p>
{:else}
	<div class="detail">
		<header>
			<h2>{row.name}</h2>
			<p class="coords mono">
				{row.lat.toFixed(5)}, {row.lon.toFixed(5)} · {c.detail.catchment(app.weights.radius)}
			</p>
		</header>

		{#if row.nodata}
			<div class="note warn">
				{c.detail.nodata(row.osm, name.toLowerCase(), app.weights.radius)}
			</div>
		{:else}
			<div class="tiles">
				<div class="tile">
					<span class="eyebrow">{c.detail.score(name)}</span>
					<span class="val" style:color={`var(--ramp-${rampIndex(row.score ?? 0)})`}>
						{pct(row.score)}
					</span>
					<span class="sub">{c.typology[row.typology]}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">{c.detail.demand} <span class="tag mock">MOCK</span></span>
					<span class="val">{pct(row.demand)}</span>
					<span class="sub">{c.detail.nStruk(row.nStruk)}</span>
				</div>
				<div class="tile">
					<!-- The source label follows the switch rather than being hardcoded
					     to "OSM". Since the default moved to MAPID, the old version
					     labelled figures that came from MAPID as OSM — misnaming where
					     a figure came from, in a product whose whole promise is that. -->
					<span class="eyebrow">
						{c.detail.rivals}
						<span class="tag real">{row.source === 'mapid' ? 'MAPID' : 'OSM'}</span>
					</span>
					<span class="val">{row.osm}</span>
					<span class="sub mono">{row.source === 'mapid' ? def.mapidSet : def.osmTag}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">{c.detail.supplyEff}</span>
					<span class="val">{pct(row.supply)}</span>
					<span class="sub">{c.detail.busyPct(pct(row.busy))}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">{c.detail.space} <span class="tag mock">MOCK</span></span>
					<span class="val">{row.listings}</span>
					<span class="sub">{c.detail.listingOf(row.nProp)}</span>
				</div>
				<div class="tile">
					<span class="eyebrow">{c.detail.cashless} <span class="tag mock">MOCK</span></span>
					<span class="val">{pct(row.cashless)}%</span>
					<span class="sub">{c.detail.cashlessSub}</span>
				</div>
			</div>

			<section>
				<h3 class="eyebrow">
					{c.detail.hourTitle(row.nStruk)}
					<span class="tag mock">MOCK</span>
				</h3>
				<HourBars hourly={row.hourly} dense />
			</section>

			<section bind:this={compareEl}>
				<h3 class="eyebrow">{c.detail.acrossTitle}</h3>
				<div class="bars">
					{#each across as item (item.key)}
						<div class="hbar" class:active={item.key === app.category}>
							<span class="lbl">{c.category[item.key].name}</span>
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
				<strong>{c.detail.summaryLead}</strong>
				{c.detail.summary(
					formatHour(row.peakHour),
					name,
					row.osm,
					app.weights.radius,
					supplyPhrase(row, c),
					row.listings,
					def.propertyCategory
				)}
				<span class="muted">{c.detail.summaryNote}</span>
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
		background-color: var(--bg-elevated);
		background-image: var(--lift-surface);
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
