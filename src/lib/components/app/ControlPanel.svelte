<script lang="ts">
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import WeightSlider from '$lib/components/ui/WeightSlider.svelte';
	import { getAppState, type LayerKey } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const app = getAppState();
	const c = $derived(copy());
	const coverage = $derived(app.coverage);

	const layerRows: Array<{ key: LayerKey; swatch: string }> = [
		{ key: 'score', swatch: 'var(--ramp-4)' },
		{ key: 'routes', swatch: 'var(--route-mrt)' },
		{ key: 'poi', swatch: 'var(--good)' },
		{ key: 'nodata', swatch: 'var(--nodata)' },
		{ key: 'label', swatch: 'transparent' }
	];
</script>

<div class="stack">
	<section>
		<h2 class="eyebrow">{c.control.weights}</h2>
		<WeightSlider
			id="w-demand"
			label={c.control.demand}
			bind:value={app.weights.wd}
			hint={c.control.demandHint}
		/>
		<WeightSlider
			id="w-supply"
			label={c.control.supply}
			bind:value={app.weights.ws}
			hint={c.control.supplyHint}
		/>
	</section>

	<section>
		<h2 class="eyebrow">{c.control.gate}</h2>
		<label class="switch">
			<input type="checkbox" bind:checked={app.weights.gate} />
			<span class="track" aria-hidden="true"><span class="thumb"></span></span>
			<span class="switch-text">
				{c.control.gateLabel}
				<span class="sub">{c.control.gateSub}</span>
			</span>
		</label>
	</section>

	<!-- The radius picker was removed when the model moved to a hexagon grid.
	     Competitor counts and transit access are computed once at an 800 m radius when
	     the grid is built, so a 400 m button would only rescale figures that are already
	     final — the result looks plausible while resting on nothing. A control that
	     quietly fails to do what it says is worse than no control at all. -->
	<section>
		<h2 class="eyebrow">{c.control.walk}</h2>
		<p class="note">{c.control.walkNote(app.weights.radius)}</p>
	</section>

	<section>
		<h2 class="eyebrow">{c.control.layers}</h2>
		<div class="layers">
			{#each layerRows as row (row.key)}
				<label class="layer">
					<input type="checkbox" bind:checked={app.layers[row.key]} />
					<span class="swatch" style:background={row.swatch}></span>
					<span>{c.control.layerNames[row.key]}</span>
				</label>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="eyebrow">{c.control.legend}</h2>
		<ScoreRamp ends={[c.control.legendLow, c.control.legendHigh]} />
		<ul class="legend">
			<li><span class="key nodata"></span>{c.control.keyNodata}</li>
			<li><span class="key jenuh"></span>{c.control.keySaturated}</li>
			<li><span class="key dot"></span>{c.control.keyDot}</li>
		</ul>
	</section>

	<section>
		<h2 class="eyebrow">{c.control.honesty}</h2>
		<p class="prose">
			{c.control.honesty1(coverage.withData, coverage.total, coverage.missionPoints)}
			{c.control.honesty2(coverage.poi, app.weights.radius)}
		</p>
		<p class="prose">{c.control.honesty3}</p>
	</section>

	<section>
		<h2 class="eyebrow">{c.control.prov}</h2>
		<p class="prose"><span class="tag real">OSM</span> {c.control.provReal}</p>
		<p class="prose"><span class="tag mock">MOCK</span> {c.control.provMock}</p>
		<p class="prose muted">{c.control.provBasemap}</p>
	</section>
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.switch {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		cursor: pointer;
	}
	.switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.switch .track {
		flex: none;
		width: 2.375rem;
		height: 1.4375rem;
		border-radius: 999px;
		background: var(--fill-2);
		padding: 2px;
		transition: background-color 180ms ease-out;
	}
	.switch input:checked + .track {
		background: var(--accent);
	}
	.switch input:focus-visible + .track {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.switch .thumb {
		display: block;
		width: 1.1875rem;
		height: 1.1875rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: var(--shadow-chip);
		transform: translateX(0);
		transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.switch input:checked + .track .thumb {
		transform: translateX(0.9375rem);
	}
	.switch-text {
		font-size: 0.75rem;
		color: var(--label-1);
		line-height: 1.35;
	}
	.switch-text .sub {
		display: block;
		color: var(--label-3);
		font-size: 0.6875rem;
	}

	.note {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.layers {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.layer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.75rem;
		color: var(--label-2);
		cursor: pointer;
	}
	.layer:hover {
		color: var(--label-1);
	}
	.layer input {
		accent-color: var(--accent);
		width: 0.875rem;
		height: 0.875rem;
		margin: 0;
	}
	.swatch {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 3px;
		border: 1px solid var(--separator);
		flex: none;
	}

	.legend {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3125rem;
		font-size: 0.6875rem;
		color: var(--label-2);
	}
	.legend li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.key {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 3px;
		flex: none;
	}
	.key.nodata {
		background: repeating-linear-gradient(
			45deg,
			var(--fill-1) 0 2px,
			color-mix(in srgb, var(--nodata) 55%, transparent) 2px 4px
		);
	}
	.key.jenuh {
		border: 2px solid var(--critical);
	}
	.key.dot {
		border-radius: 99px;
		background: var(--bg-elevated);
		border: 2px solid var(--label-2);
	}

	.prose {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
	}
</style>
