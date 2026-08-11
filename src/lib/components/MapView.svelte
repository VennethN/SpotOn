<script lang="ts">
	import { onMount } from 'svelte';
	import type { GeoJSONSource, Map as MapLibreMap, Marker, StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// Worker di-bundle terpisah oleh Vite; kalau dibiarkan dimuat sendiri oleh
	// maplibre, berkasnya disentuh dev server dan worker mati tanpa suara.
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { env } from '$env/dynamic/public';
	import { boundsOf, emptyFC, scatterPoints } from '$lib/geo';
	import { prefersReducedMotion } from '$lib/motion.svelte';
	import { pct, rampIndex } from '$lib/scoring';
	import { base } from '$app/paths';
	import { getAppState } from '$lib/state.svelte';
	import type { ScoredHex } from '$lib/types';
	import type { FeatureCollection } from 'geojson';

	const app = getAppState();

	let container: HTMLDivElement;
	let map = $state<MapLibreMap | null>(null);
	let ready = $state(false);
	let gl: typeof import('maplibre-gl') | null = null;
	let markers = new Map<string, { marker: Marker; el: HTMLButtonElement; rank: number }>();
	let labelFrame = 0;

	/** Jalur angkutan, digambar dari yang paling padat ke paling jarang supaya
	    rel yang sedikit tidak tertimbun koridor bus yang rapat. */
	const ROUTE_MODES = [
		{ key: 'brt', varName: '--route-brt', thin: 0.8, thick: 2.4, opacity: 0.5 },
		{ key: 'krl', varName: '--route-krl', thin: 1.3, thick: 3.4, opacity: 0.8 },
		{ key: 'lrt', varName: '--route-lrt', thin: 1.6, thick: 4, opacity: 0.9 },
		{ key: 'mrt', varName: '--route-mrt', thin: 2, thick: 5, opacity: 0.95 }
	] as const;
	let appliedTheme: 'light' | 'dark' | null = null;

	/** Tooltip mengikuti pointer; posisinya ditulis langsung ke DOM agar tidak ada frame tertinggal. */
	let tipEl: HTMLDivElement;
	let hovered = $state<ScoredHex | null>(null);

	const cssVar = (name: string) =>
		getComputedStyle(document.documentElement).getPropertyValue(name).trim();

	function basemapStyle(theme: 'light' | 'dark'): string | StyleSpecification {
		// MAPID MAPS adalah basemap wajib pada produk final; selama kunci gaya belum
		// tersedia, dipakai raster terbuka dengan atribusi yang sama-sama sah.
		if (env.PUBLIC_MAPID_STYLE_URL) return env.PUBLIC_MAPID_STYLE_URL;
		const variant = theme === 'dark' ? 'dark_all' : 'light_all';
		return {
			version: 8,
			sources: {
				base: {
					type: 'raster',
					tiles: [
						`https://a.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`,
						`https://b.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`,
						`https://c.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`
					],
					tileSize: 256,
					attribution:
						'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a> · basemap final: MAPID MAPS'
				}
			},
			layers: [{ id: 'base', type: 'raster', source: 'base' }]
		} satisfies StyleSpecification;
	}

	/** Arsir untuk catchment belum terdata — tanpa data tidak boleh terlihat seperti skor rendah. */
	function hatchImage(): ImageData {
		const size = 10;
		const c = document.createElement('canvas');
		c.width = c.height = size;
		const ctx = c.getContext('2d')!;
		ctx.fillStyle = cssVar('--fill-1') || 'rgba(120,128,140,0.1)';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = cssVar('--nodata');
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-size, size);
		ctx.lineTo(size, -size);
		ctx.moveTo(0, size * 2);
		ctx.lineTo(size * 2, 0);
		ctx.stroke();
		return ctx.getImageData(0, 0, size, size);
	}

	function catchmentFC(rows: ScoredHex[]): FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: rows
				.filter((r) => !r.nodata || app.layers.nodata)
				.map((r, i) => ({
					type: 'Feature' as const,
					// feature-state MapLibre butuh id numerik; indeks baris dipakai karena
					// id H3 berupa string heksadesimal yang tidak bisa dijadikan angka.
					id: i,
					geometry: {
						type: 'Polygon' as const,
						// Batas petak dihitung sekali saat build, jadi klien tidak perlu
						// memuat pustaka H3 sama sekali.
						coordinates: [[...r.boundary, r.boundary[0]]]
					},
					properties: {
						id: r.id,
						name: r.name,
						nodata: r.nodata,
						color: r.nodata
							? cssVar('--nodata')
							: app.layers.score
								? cssVar(`--ramp-${rampIndex(r.score ?? 0)}`)
								: cssVar('--fill-2'),
						jenuh: r.typology === 'Jenuh',
						selected: r.id === app.selectedId
					}
				}))
		};
	}

	function poiFC(rows: ScoredHex[]): FeatureCollection {
		if (!app.layers.poi) return emptyFC();
		return {
			type: 'FeatureCollection',
			features: rows
				.filter((r) => !r.nodata)
				.flatMap((r) => scatterPoints(r.lon, r.lat, 430, r.osm, { id: r.id }))
		};
	}

	function addLayers(m: MapLibreMap) {
		if (!m.hasImage('hatch')) m.addImage('hatch', hatchImage());

		m.addSource('catchments', { type: 'geojson', data: catchmentFC(app.rows) });
		m.addSource('poi', { type: 'geojson', data: poiFC(app.rows) });
		// Diambil lewat URL, bukan di-import: MapLibre mengambil GeoJSON sendiri,
		// jadi 441 KB geometri jalur tidak ikut membengkakkan bundel JS dan bisa
		// di-cache browser seperti aset biasa.
		m.addSource('routes', { type: 'geojson', data: `${base}/data/routes.json` });

		m.addLayer({
			id: 'catchment-fill',
			type: 'fill',
			source: 'catchments',
			filter: ['!', ['get', 'nodata']],
			paint: {
				'fill-color': ['get', 'color'],
				'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.68, 0.5]
			}
		});
		m.addLayer({
			id: 'catchment-nodata',
			type: 'fill',
			source: 'catchments',
			filter: ['get', 'nodata'],
			paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.85 }
		});
		m.addLayer({
			id: 'catchment-line',
			type: 'line',
			source: 'catchments',
			paint: {
				'line-color': [
					'case',
					['get', 'selected'],
					cssVar('--label-1'),
					['get', 'jenuh'],
					cssVar('--critical'),
					cssVar('--separator-strong')
				],
				'line-width': ['case', ['get', 'selected'], 2.4, ['get', 'jenuh'], 1.8, 1]
			}
		});
		m.addLayer({
			id: 'poi-dots',
			type: 'circle',
			source: 'poi',
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 15, 3.2],
				'circle-color': cssVar('--good'),
				'circle-opacity': 0.85
			}
		});
		// Satu layer per moda. Urutannya menentukan siapa di atas: TransJakarta
		// paling padat, jadi digambar lebih dulu supaya rel tidak tertimbun.
		for (const mode of ROUTE_MODES) {
			m.addLayer({
				id: `route-${mode.key}`,
				type: 'line',
				source: 'routes',
				filter: ['==', ['get', 'mode'], mode.key],
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': cssVar(mode.varName),
					'line-width': ['interpolate', ['linear'], ['zoom'], 10, mode.thin, 15, mode.thick],
					'line-opacity': mode.opacity
				}
			});
		}

		let hoverId: number | null = null;
		m.on('mousemove', 'catchment-fill', (e) => {
			m.getCanvas().style.cursor = 'pointer';
			const f = e.features?.[0];
			if (!f) return;
			if (hoverId !== null && hoverId !== f.id)
				m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: false });
			hoverId = f.id as number;
			m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: true });
			hovered = app.rows.find((r) => r.id === f.properties?.id) ?? null;
			positionTip(e.point.x, e.point.y);
		});
		m.on('mouseleave', 'catchment-fill', () => {
			m.getCanvas().style.cursor = '';
			if (hoverId !== null) m.setFeatureState({ source: 'catchments', id: hoverId }, { hover: false });
			hoverId = null;
			hovered = null;
		});
		m.on('click', 'catchment-fill', (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.select(id);
		});
		m.on('click', 'catchment-nodata', (e) => {
			const id = e.features?.[0]?.properties?.id;
			if (typeof id === 'string') app.select(id);
		});
	}

	function positionTip(x: number, y: number) {
		if (!tipEl) return;
		const w = tipEl.offsetWidth;
		const box = container.getBoundingClientRect();
		const left = Math.min(box.width - w - 12, x + 16);
		tipEl.style.transform = `translate3d(${Math.max(12, left)}px, ${y - 14}px, 0)`;
	}

	/** Berapa banyak petak yang diberi penanda. Kisi punya 558 petak — memberi
	    penanda pada semuanya menghasilkan tumpukan label yang tak terbaca sekaligus
	    ratusan simpul DOM. Yang ditandai hanya yang sedang berarti bagi pengguna. */
	const MAX_MARKERS = 14;

	/** Urutan penting: yang lebih depan menang saat dua label berebut tempat. */
	function markerSet(rows: ScoredHex[]): Set<string> {
		const keep = new Set<string>();
		if (app.selectedId) keep.add(app.selectedId);
		for (const id of app.highlight) keep.add(id);
		const top = rows
			.filter((r) => !r.nodata)
			.slice()
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
		for (const r of top) {
			if (keep.size >= MAX_MARKERS) break;
			keep.add(r.id);
		}
		return keep;
	}

	/** Penanda petak sebagai elemen HTML: tipografi & material yang sama dengan panel. */
	function syncMarkers(rows: ScoredHex[]) {
		if (!map || !gl) return;

		const keep = markerSet(rows);

		// Penanda yang tak lagi relevan dibuang, bukan disembunyikan — kalau hanya
		// di-display:none, simpulnya tetap menumpuk seiring pengguna berpindah pilihan.
		for (const [id, entry] of markers) {
			if (!keep.has(id)) {
				entry.marker.remove();
				markers.delete(id);
			}
		}

		for (const r of rows) {
			if (!keep.has(r.id)) continue;
			let entry = markers.get(r.id);
			if (!entry) {
				const el = document.createElement('button');
				el.type = 'button';
				el.className = 'stn';
				el.addEventListener('click', (ev) => {
					ev.stopPropagation();
					app.select(r.id);
				});
				el.addEventListener('pointerenter', () => (hovered = r));
				el.addEventListener('pointerleave', () => (hovered = null));
				const marker = new gl.Marker({ element: el, anchor: 'center' })
					.setLngLat([r.lon, r.lat])
					.addTo(map);
				entry = { marker, el, rank: 0 };
				markers.set(r.id, entry);
			}
			entry.rank = [...keep].indexOf(r.id);
			const rank = app.highlight.indexOf(r.id);
			const selected = app.selectedId === r.id;
			entry.el.className = `stn${selected ? ' is-selected' : ''}${r.nodata ? ' is-nodata' : ''}`;
			entry.el.setAttribute('aria-label', `${r.name}${r.nodata ? ' — belum terdata' : ''}`);
			entry.el.innerHTML =
				`<span class="stn-dot"></span>` +
				(rank > -1 ? `<span class="stn-rank">${rank + 1}</span>` : '') +
				(app.layers.label || selected ? `<span class="stn-label">${shortName(r.name)}</span>` : '');
			entry.el.style.display = r.nodata && !app.layers.nodata ? 'none' : '';
		}

		layoutLabels();
	}

	/**
	 * Label yang bertabrakan disembunyikan, bukan digambar bertindih.
	 *
	 * Empat belas petak teratas kerap berkerumun di satu koridor, dan nama-namanya
	 * lantas saling menimpa sampai tidak satu pun terbaca. Yang lebih penting —
	 * petak terpilih, lalu hasil berperingkat — mendapat tempat lebih dulu; sisanya
	 * mundur jadi titik saja. Titiknya tetap ada, jadi tidak ada petak yang hilang.
	 */
	function layoutLabels() {
		if (!map) return;
		const entries = [...markers.values()].sort((a, b) => a.rank - b.rank);
		const placed: DOMRect[] = [];

		for (const e of entries) {
			const label = e.el.querySelector<HTMLElement>('.stn-label');
			if (!label) continue;
			label.style.visibility = '';
		}
		for (const e of entries) {
			const label = e.el.querySelector<HTMLElement>('.stn-label');
			if (!label || e.el.style.display === 'none') continue;
			const box = label.getBoundingClientRect();
			const clash = placed.some(
				(q) =>
					box.left < q.right + 4 &&
					q.left < box.right + 4 &&
					box.top < q.bottom + 2 &&
					q.top < box.bottom + 2
			);
			if (clash) label.style.visibility = 'hidden';
			else placed.push(box);
		}
	}

	/** Digeser/di-zoom → tata ulang, sekali per bingkai. */
	function scheduleLabels() {
		if (labelFrame) return;
		labelFrame = requestAnimationFrame(() => {
			labelFrame = 0;
			layoutLabels();
		});
	}

	const shortName = (n: string) =>
		n.replace(
			/ (Bank Syariah Indonesia|Bank Jakarta|Mastercard|Indomaret|BCA|BNI|VISA|TUKU|Astra|Headquarters)$/,
			''
		);

	function fitAll(animate = true) {
		if (!map) return;
		map.fitBounds(boundsOf(app.rows), {
			padding: { top: 90, bottom: 120, left: 60, right: 60 },
			animate: animate && !prefersReducedMotion(),
			duration: 700
		});
	}

	onMount(() => {
		let disposed = false;
		(async () => {
			gl = await import('maplibre-gl');
			if (disposed) return;
			gl.setWorkerUrl(maplibreWorkerUrl);
			appliedTheme = app.resolvedTheme;
			const m = new gl.Map({
				container,
				style: basemapStyle(appliedTheme),
				bounds: boundsOf(app.rows),
				fitBoundsOptions: { padding: { top: 90, bottom: 120, left: 60, right: 60 } },
				attributionControl: false,
				// Gestur harus terasa langsung; rotasi tidak menambah makna pada peta ini.
				dragRotate: false,
				pitchWithRotate: false,
				touchZoomRotate: true
			});
			m.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
			m.addControl(new gl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-left');
			m.touchZoomRotate.disableRotation();
			// `load` menunggu bingkai pertama benar-benar tergambar — termasuk ubin
			// basemap. Kalau basemapnya lambat, diblokir, atau mati, peristiwa itu
			// tidak pernah datang dan seluruh lapisan rekomendasi ikut tidak pernah
			// dipasang, padahal geometri dan skornya lokal dan tidak butuh jaringan.
			// `styledata` datang begitu spesifikasi gayanya terbaca, jadi hasil
			// hitungan tetap tampil walau petanya sendiri kosong.
			m.once('styledata', () => {
				addLayers(m);
				ready = true;
			});
			m.on('move', scheduleLabels);
			m.on('zoom', scheduleLabels);
			map = m;
			if (import.meta.env.DEV) (window as unknown as { __map: MapLibreMap }).__map = m;
		})();
		return () => {
			disposed = true;
			if (labelFrame) cancelAnimationFrame(labelFrame);
			map?.remove();
			markers.clear();
		};
	});

	// Tema berganti → basemap dan seluruh warna layer ikut berganti. Tema yang sedang
	// terpasang disimpan di luar rune: kalau tidak, `ready` yang berubah di dalam efek
	// akan memicu efeknya sendiri dan gaya peta dimuat ulang tanpa henti.
	$effect(() => {
		const theme = app.resolvedTheme;
		const m = map;
		if (!m || appliedTheme === null || appliedTheme === theme) return;
		appliedTheme = theme;
		ready = false;
		m.setStyle(basemapStyle(theme));
		m.once('styledata', () => {
			addLayers(m);
			ready = true;
		});
	});

	// Sumber & warna disegarkan setiap kali skor, layer, atau pilihan berubah.
	$effect(() => {
		const rows = app.rows;
		const m = map;
		if (!m || !ready) return;
		(m.getSource('catchments') as GeoJSONSource | undefined)?.setData(catchmentFC(rows));
		(m.getSource('poi') as GeoJSONSource | undefined)?.setData(poiFC(rows));
		for (const mode of ROUTE_MODES) {
			m.setLayoutProperty(`route-${mode.key}`, 'visibility', app.layers.rute ? 'visible' : 'none');
		}
		m.setPaintProperty('catchment-line', 'line-color', [
			'case',
			['get', 'selected'],
			cssVar('--label-1'),
			['get', 'jenuh'],
			cssVar('--critical'),
			cssVar('--separator-strong')
		]);
		syncMarkers(rows);
	});

	// Memilih catchment menggeser peta ke sana — hubungan spasial antara panel dan peta harus terjaga.
	$effect(() => {
		const sel = app.selected;
		const m = map;
		if (!m || !ready || !sel) return;
		m.easeTo({
			center: [sel.lon, sel.lat],
			duration: prefersReducedMotion() ? 0 : 520,
			essential: true
		});
	});
</script>

<div class="map-root" bind:this={container}>
	{#if !ready}
		<div class="loading eyebrow">Memuat peta…</div>
	{/if}
</div>

<div class="zoom material">
	<button type="button" onclick={() => map?.zoomIn()} aria-label="Perbesar">+</button>
	<button type="button" onclick={() => map?.zoomOut()} aria-label="Perkecil">−</button>
	<button type="button" onclick={() => fitAll()} aria-label="Kembalikan tampilan awal">⤢</button>
</div>

<div class="tip material" bind:this={tipEl} class:show={!!hovered} aria-hidden="true">
	{#if hovered}
		<strong>{hovered.name}</strong>
		{#if hovered.nodata}
			<span class="tip-sub">Data misi MAPID: N = 0 · kandidat prioritas survei</span>
		{:else}
			<span class="tip-score" style:color={`var(--ramp-${rampIndex(hovered.score ?? 0)})`}>
				{pct(hovered.score)}
				<span class="tip-unit">skor {app.definition.name.toLowerCase()}</span>
			</span>
			<span class="tip-sub">
				Permintaan {pct(hovered.demand)} · penawaran {pct(hovered.supply)}<br />
				{hovered.osm} pesaing (OSM, r={app.weights.radius} m) · {hovered.listings} listing<br />
				N misi = {hovered.nTot} titik
			</span>
		{/if}
	{/if}
</div>

<style>
	.map-root {
		position: absolute;
		inset: 0;
		background: var(--bg-base);
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}

	.zoom {
		position: absolute;
		right: 0.75rem;
		top: 4.5rem;
		z-index: 4;
		display: flex;
		flex-direction: column;
		border-radius: var(--r-sm);
		overflow: hidden;
	}
	.zoom button {
		width: 2rem;
		height: 2rem;
		border: 0;
		border-bottom: 1px solid var(--separator);
		background: transparent;
		color: var(--label-2);
		font-size: 0.9375rem;
		line-height: 1;
		cursor: pointer;
		transition: transform 100ms ease-out;
	}
	.zoom button:last-child {
		border-bottom: 0;
		font-size: 0.75rem;
	}
	.zoom button:hover {
		background: var(--fill-1);
		color: var(--label-1);
	}
	.zoom button:active {
		transform: scale(0.9);
		background: var(--fill-2);
	}

	.tip {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 6;
		pointer-events: none;
		max-width: 15rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--r-sm);
		opacity: 0;
		transition: opacity 120ms ease-out;
		will-change: transform;
	}
	.tip.show {
		opacity: 1;
	}
	.tip strong {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.tip-score {
		display: block;
		font-size: 1.375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
		margin-top: 0.125rem;
	}
	.tip-unit {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--label-3);
	}
	.tip-sub {
		display: block;
		margin-top: 0.1875rem;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--label-2);
	}

	/* penanda stasiun (elemen dibuat imperatif oleh syncMarkers) */
	:global(.stn) {
		position: relative;
		display: block;
		width: 0;
		height: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	:global(.stn-dot) {
		position: absolute;
		left: -5px;
		top: -5px;
		width: 10px;
		height: 10px;
		border-radius: 99px;
		background: var(--bg-elevated);
		border: 2px solid var(--label-2);
		box-shadow: var(--shadow-chip);
		transition: transform 140ms ease-out;
	}
	:global(.stn:hover .stn-dot) {
		transform: scale(1.25);
	}
	:global(.stn.is-selected .stn-dot) {
		background: var(--accent);
		border-color: var(--bg-elevated);
		transform: scale(1.35);
	}
	:global(.stn.is-nodata .stn-dot) {
		border-style: dashed;
		border-color: var(--nodata);
	}
	:global(.stn-label) {
		position: absolute;
		left: 0.625rem;
		top: -0.6875rem;
		white-space: nowrap;
		font-size: 0.6875rem;
		font-weight: 500;
		letter-spacing: 0.005em;
		color: var(--label-1);
		background: var(--mat-thin);
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.0625rem 0.4375rem;
		box-shadow: var(--shadow-chip);
	}
	:global(.stn.is-selected .stn-label) {
		font-weight: 600;
		color: var(--label-1);
		background: var(--mat-thick);
	}
	:global(.stn-rank) {
		position: absolute;
		left: -1.5rem;
		top: -1.5rem;
		display: grid;
		place-items: center;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.625rem;
		font-weight: 700;
		box-shadow: var(--shadow-chip);
	}

	/* kontrol bawaan MapLibre dibuat mengikuti material panel */
	:global(.maplibregl-ctrl-attrib),
	:global(.maplibregl-ctrl-scale) {
		background: var(--mat-thin) !important;
		-webkit-backdrop-filter: var(--blur-thin);
		backdrop-filter: var(--blur-thin);
		color: var(--label-3) !important;
		font-size: 0.625rem !important;
		border-radius: var(--r-xs) !important;
	}
	:global(.maplibregl-ctrl-scale) {
		border: 1px solid var(--separator) !important;
		border-top: 0 !important;
	}
	:global(.maplibregl-ctrl-attrib a) {
		color: var(--label-2) !important;
	}
	:global(.maplibregl-ctrl-bottom-left),
	:global(.maplibregl-ctrl-bottom-right) {
		z-index: 3;
	}
</style>
