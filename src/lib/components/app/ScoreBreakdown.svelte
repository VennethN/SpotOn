<script lang="ts">
	/**
	 * Where the selected cell's score came from.
	 *
	 * The panel above states one number. This states the four things that made it,
	 * in the order the engine applied them, with the running total after each — so a
	 * reader who distrusts the figure can follow it instead of taking it.
	 *
	 * TRANSIT LEADS, and not for decoration. It is the only input here computed from
	 * real data (OSM stops) rather than from MAPID sample attributes, it is the one
	 * thing a non-technical reader already has intuitions about, and reaching several
	 * lines at once is the whole reason this grid exists rather than per-stop
	 * catchments. So the count of nodes in range is set large at the top, its share of
	 * the score is stated in points, and the arithmetic follows underneath.
	 *
	 * Every figure on screen comes from `domain/composition`, which rebuilds the steps
	 * from the engine's own constants. Nothing here does arithmetic of its own beyond
	 * turning a share into a percentage.
	 */
	import {
		ACCESS_DIVISOR,
		ACCESS_FLOOR,
		ACCESS_SPAN,
		MODE_WEIGHT,
		modeShares,
		railTotal,
		stopTotal,
		stopsByMode,
		type Mode
	} from '$lib/domain/transit';
	import { composeScore, type CompositionStep } from '$lib/domain/composition';
	import { getAppState } from '$lib/state/app.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { rampIndex } from '$lib/utils/format';

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/* The grid's cell, not the scored row: its transit counts are what access was
	   computed from, and they are here from the first frame. */
	const cell = $derived(app.selectedCell);
	const comp = $derived(row ? composeScore(row, app.weights) : null);

	const transit = $derived(cell?.transit ?? null);
	const total = $derived(transit ? stopTotal(transit) : 0);
	const rail = $derived(transit ? railTotal(transit) : 0);
	/* Both read from the cell rather than from the composition: the access index and
	   its multiplier exist for every cell, including the ones the active source has
	   not surveyed and which therefore have no score to take apart. */
	const access = $derived(cell?.access ?? 0);
	const accessFactor = $derived(ACCESS_FLOOR + ACCESS_SPAN * access);
	const shares = $derived(transit ? modeShares(transit) : []);
	const groups = $derived(transit ? stopsByMode(transit, app.selectedStops) : []);
	/** The stop list is fetched on first selection; until it lands, only counts exist.
	    A fetch that FAILED is not waiting — that branch falls back instead. */
	const waiting = $derived(app.stops === null && !app.stopsFailed);

	/**
	 * Is there a score left to split into "kept" and "added by transit"?
	 *
	 * A cell can be scored down to zero — a saturated one with the demand weight slid
	 * to nothing — and at zero the split bar has three segments of nothing to show.
	 * Drawn anyway they come out as three equal blocks, which reads as thirds of
	 * something. The sentence underneath still says it in words.
	 */
	const hasSplit = $derived(comp !== null && comp.withoutTransit + comp.transitCeiling > 0);

	/** Widest step in the waterfall — every bar is drawn against this one, so the
	    lengths compare with each other rather than each filling its own row. */
	const widest = $derived(
		comp ? Math.max(1, ...comp.steps.filter((s) => s.key !== 'start').map((s) => Math.abs(s.delta))) : 1
	);

	const colour = (m: Mode) => `var(--route-${m})`;
	/* A real minus sign, not a hyphen: this column is read as arithmetic and sits in
	   tabular figures, where the two are visibly different widths. */
	const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

	function note(s: CompositionStep): string {
		const n = c.breakdown.notes;
		switch (s.key) {
			case 'start':
				return n.start;
			case 'demand':
				return n.demand(app.weights.wd, Math.round((row?.demand ?? 0) * 100));
			case 'supply':
				return n.supply(app.weights.ws, Math.round((row?.supply ?? 0) * 100));
			case 'clamp':
				return n.clamp;
			case 'gate':
				if (!app.weights.gate) return n.gateOff;
				return s.factor === 1 ? n.gatePass(row?.listings ?? 0) : n.gateBlock(s.factor ?? 1);
			case 'access':
				return n.access(s.factor ?? 1, access);
		}
	}
</script>

<!--
	Rendered from the CELL, not from the composition. A cell whose category the active
	source has not surveyed has no steps to show — but its transit access is OSM data
	and is as real as ever, and that is the half of this panel worth reading when the
	other half cannot be computed.
-->
{#if cell}
	<section class="bd">
		<h3 class="eyebrow">{c.breakdown.title}</h3>
		<p class="lead">{comp ? c.breakdown.lead : c.breakdown.noScore}</p>

		<!-- ── Transit, first and largest ──────────────────────────────────── -->
		<div class="transit">
			<!-- Not `tag`: that class is the global MOCK/REAL provenance badge, and it
			     would both draw a box here and claim something about the data. -->
			<p class="eyebrow lead-in">{c.breakdown.transitLead}</p>

			{#if total === 0}
				<p class="none">{c.breakdown.none}</p>
			{:else}
				<p class="count">
					<span class="n">{total}</span>
					<span class="unit">
						{c.breakdown.stopsUnit(total)}
						<span class="sub">{c.breakdown.stopsSub(app.weights.radius)}</span>
					</span>
				</p>
				<p class="split-txt">{c.breakdown.stopsSplit(rail, transit?.brt ?? 0)}</p>

				<ul class="chips">
					{#each shares as s (s.mode)}
						<li style:--dot={colour(s.mode)}>
							<span class="dot" aria-hidden="true"></span>
							<span class="cn">{s.n}</span>
							<span class="cl">{c.mood.transitModes[s.mode]}</span>
						</li>
					{/each}
				</ul>

				{#if comp && hasSplit}
					<!-- The final score split into the part any cell keeps and the part these
					     stations bought. Exact arithmetic: the two add up to the score. -->
					<div
						class="split"
						role="img"
						aria-label={c.breakdown.splitAria(comp.withoutTransit, comp.transitPoints, comp.score)}
					>
						<span class="base" style:flex={String(Math.max(0.0001, comp.withoutTransit))}></span>
						<span class="add" style:flex={String(Math.max(0.0001, comp.transitPoints))}></span>
						<span
							class="head"
							style:flex={String(Math.max(0.0001, comp.transitCeiling - comp.transitPoints))}
						></span>
					</div>
					<ul class="key">
						<li><span class="sw base" aria-hidden="true"></span>{c.breakdown.splitBase}</li>
						<li><span class="sw add" aria-hidden="true"></span>{c.breakdown.splitTransit}</li>
					</ul>
				{/if}

				{#if comp}
					<p class="claim">
						<strong>{c.breakdown.contributes(comp.transitPoints, comp.score)}</strong>
						{c.breakdown.without(comp.withoutTransit)}
					</p>
					<p class="ceil">{c.breakdown.ceiling(comp.transitCeiling)}</p>
				{/if}
			{/if}
		</div>

		<!-- ── The waterfall ───────────────────────────────────────────────── -->
		{#if comp}
			<h4 class="eyebrow sub">{c.breakdown.stepsTitle}</h4>
			<ol class="steps">
				{#each comp.steps as s (s.key)}
					<li class:transit-step={s.key === 'access'}>
						<span class="bar" aria-hidden="true">
							{#if s.key !== 'start'}
								<span
									class="fill"
									class:down={s.delta < 0}
									style:width={`${(Math.abs(s.delta) / widest) * 100}%`}
								></span>
							{/if}
						</span>
						<span class="txt">
							<span class="lbl">{c.breakdown.rows[s.key]}</span>
							<span class="hint">{note(s)}</span>
						</span>
						<span
							class="delta"
							class:start={s.key === 'start'}
							class:down={s.delta < 0}
							class:zero={s.delta === 0 && s.key !== 'start'}
						>
							{s.key === 'start' ? s.after : signed(s.delta)}
							<span class="vh">{s.key === 'start' ? '' : c.breakdown.deltaAria(s.delta)}</span>
						</span>
						<span class="run">{s.after}</span>
					</li>
				{/each}
				<li class="sum">
					<span class="bar" aria-hidden="true"></span>
					<span class="txt"><span class="lbl">{c.breakdown.total}</span></span>
					<!-- A ramp swatch rather than the number in a ramp colour: the low end
					     of the ramp is a pale blue that all but disappears against the
					     panel, and the one figure this whole section builds to cannot be
					     the one that is hard to read. -->
					<span
						class="swatch"
						style:background={`var(--ramp-${rampIndex(row?.score ?? 0)})`}
						aria-hidden="true"
					></span>
					<span class="run">{comp.score}</span>
				</li>
			</ol>
		{/if}

		{#if total > 0}
			<!-- ── What the access index itself is made of ──────────────────── -->
			<h4 class="eyebrow sub">{c.breakdown.accessTitle}</h4>
			<ul class="access">
				{#each shares as s (s.mode)}
					<li style:--dot={colour(s.mode)}>
						<p class="top">
							<span class="dot" aria-hidden="true"></span>
							<span class="nm">{c.mood.transitModes[s.mode]}</span>
							<span class="calc">{c.breakdown.accessRow(s.n, MODE_WEIGHT[s.mode])}</span>
							<span class="share">{c.breakdown.accessShare(Math.round(s.share * 100))}</span>
						</p>
						<span class="track" aria-hidden="true">
							<span class="fill" style:width={`${s.share * 100}%`}></span>
						</span>
					</li>
				{/each}
			</ul>
			<p class="index">{c.breakdown.accessIndex(access, accessFactor)}</p>
			<p class="formula">{c.breakdown.accessFormula(ACCESS_DIVISOR)}</p>

			<!-- ── Every node, named ────────────────────────────────────────── -->
			<h4 class="eyebrow sub">{c.breakdown.stationsTitle}</h4>
			{#if waiting}
				<p class="formula">{c.breakdown.stationsLoading}</p>
			{:else if app.stopsFailed}
				<!-- The names are gone, the arithmetic is not: everything above this line
				     came from the grid, and says so. -->
				<p class="formula">{c.breakdown.stationsFailed}</p>
			{:else}
				<div class="stations">
					{#each groups as g (g.mode)}
						<div class="grp" style:--dot={colour(g.mode)}>
							<p class="grp-head">
								<span class="dot" aria-hidden="true"></span>
								{c.breakdown.modeGroup(c.mood.transitModes[g.mode], g.nodes)}
							</p>
							<ul>
								{#each g.named as s (s.name)}
									<li>
										<span class="nm">{s.name}</span>
										<span class="dist">{c.mood.transitWalk(Math.round(s.distance))}</span>
									</li>
								{/each}
								{#if g.unnamed > 0}
									<li class="rest">{c.breakdown.unnamed(g.unnamed)}</li>
								{/if}
							</ul>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</section>
{/if}

<style>
	.bd {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.lead,
	.none {
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.sub {
		color: var(--label-3);
		margin-top: 0.25rem;
	}

	/* ── transit block ───────────────────────────────────────────────────── */
	.transit {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
		padding: 0.625rem;
		border: 1px solid var(--separator);
		border-left: 2px solid var(--accent);
		border-radius: 0 var(--r-md) var(--r-md) 0;
		background: var(--fill-1);
	}
	.lead-in {
		color: var(--accent);
	}
	.count {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.count .n {
		font-size: 2.25rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
	}
	.count .unit {
		font-size: 0.8125rem;
		line-height: 1.3;
		color: var(--label-2);
	}
	.count .sub {
		display: block;
		font-size: 0.625rem;
		color: var(--label-3);
		margin-top: 0.0625rem;
	}
	.split-txt {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--label-1);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--dot);
		flex: none;
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3125rem;
	}
	.chips li {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		border: 1px solid var(--separator);
		border-radius: 999px;
		padding: 0.125rem 0.5rem 0.125rem 0.4375rem;
		background: var(--bg-elevated);
	}
	.chips .cn {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.chips .cl {
		font-size: 0.625rem;
		color: var(--label-2);
	}

	/* The score as two lengths: what any cell keeps, and what the stations added.
	   The third segment is the headroom left — drawn as an outline, since it is not
	   part of the score. */
	.split {
		display: flex;
		height: 0.5rem;
		gap: 2px;
		margin-top: 0.125rem;
	}
	.split span {
		border-radius: 2px;
	}
	.split .base {
		background: color-mix(in srgb, var(--label-2) 45%, transparent);
	}
	.split .add {
		background: var(--accent);
	}
	.split .head {
		border: 1px dashed var(--separator-strong);
	}
	.key {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 0.75rem;
		font-size: 0.625rem;
		color: var(--label-3);
	}
	.key li {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
	}
	.sw {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 2px;
		flex: none;
	}
	.sw.base {
		background: color-mix(in srgb, var(--label-2) 45%, transparent);
	}
	.sw.add {
		background: var(--accent);
	}

	.claim {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	.claim strong {
		color: var(--label-1);
	}
	.ceil {
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}

	/* ── the waterfall ───────────────────────────────────────────────────── */
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.steps li {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 2.25rem 2.25rem;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3125rem 0.25rem;
		border-bottom: 1px solid var(--separator);
	}
	/* The bar sits BEHIND the row rather than in a column of its own: at this width a
	   fourth column would leave the labels wrapping every other line. */
	.steps .bar {
		position: absolute;
		inset: 0.125rem 0 0.125rem 0;
		display: block;
		border-radius: var(--r-xs);
		overflow: hidden;
		pointer-events: none;
	}
	.steps .bar .fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		display: block;
		background: var(--accent-soft);
		border-radius: var(--r-xs);
	}
	.steps .bar .fill.down {
		background: color-mix(in srgb, var(--critical) 12%, transparent);
	}
	.steps .txt {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.steps .lbl {
		font-size: 0.75rem;
		color: var(--label-1);
	}
	.steps .hint {
		font-size: 0.625rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.steps .delta,
	.steps .run {
		position: relative;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.steps .delta {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--good);
	}
	.steps .delta.down {
		color: var(--critical);
	}
	.steps .delta.zero {
		color: var(--label-3);
	}
	/* The opening 50 is a starting position, not a gain — green would read as +50. */
	.steps .delta.start {
		color: var(--label-2);
	}
	.steps .run {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--label-2);
	}
	.steps .transit-step .lbl {
		font-weight: 600;
	}
	.steps .sum {
		border-bottom: 0;
		padding-top: 0.4375rem;
	}
	.steps .swatch {
		position: relative;
		justify-self: end;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 3px;
		border: 1px solid var(--separator);
	}
	.steps .sum .lbl {
		font-weight: 700;
	}
	.steps .sum .run {
		font-size: 1.125rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	/* ── access index ────────────────────────────────────────────────────── */
	.access {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.access li {
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
		font-size: 0.6875rem;
	}
	.access .top {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
	}
	.access .dot {
		align-self: center;
	}
	.access .nm {
		color: var(--label-1);
		font-weight: 600;
		white-space: nowrap;
	}
	.access .calc {
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
		margin-right: auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.access .track {
		height: 0.25rem;
		margin-left: 0.9375rem;
		border-radius: 99px;
		background: var(--fill-2);
		overflow: hidden;
	}
	.access .track .fill {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: var(--dot);
	}
	.access .share {
		color: var(--label-2);
		font-variant-numeric: tabular-nums;
		flex: none;
	}
	.index {
		font-size: 0.6875rem;
		color: var(--label-2);
		font-variant-numeric: tabular-nums;
	}
	.formula {
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}

	/* ── the node list ───────────────────────────────────────────────────── */
	.stations {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.grp-head {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--label-2);
	}
	.stations ul {
		list-style: none;
		margin: 0.1875rem 0 0;
		padding: 0 0 0 0.9375rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.stations li {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
		font-size: 0.75rem;
	}
	.stations .nm {
		color: var(--label-1);
		margin-right: auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stations .dist {
		font-size: 0.6875rem;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
		flex: none;
	}
	.stations .rest {
		font-size: 0.625rem;
		line-height: 1.4;
		color: var(--label-3);
	}

	/* Announced to a screen reader, not drawn. */
	.vh {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
