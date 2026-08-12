<script lang="ts">
	import CoverageGrid from '$lib/components/landing/CoverageGrid.svelte';
	import GridStage from '$lib/components/landing/GridStage.svelte';
	import HourProfile from '$lib/components/landing/HourProfile.svelte';
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import SectionMark from '$lib/components/landing/SectionMark.svelte';
	import SignalFlow from '$lib/components/landing/SignalFlow.svelte';
	import SourceBars from '$lib/components/landing/SourceBars.svelte';
	import StreetStage from '$lib/components/landing/StreetStage.svelte';
	import TapakDemo from '$lib/components/landing/TapakDemo.svelte';
	import Reveal from '$lib/components/ui/Reveal.svelte';
	import ScoreRamp from '$lib/components/ui/ScoreRamp.svelte';
	import { copy, lang } from '$lib/state/lang.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const c = $derived(copy());
	const n = (v: number) => v.toLocaleString(lang() === 'en' ? 'en-GB' : 'id-ID');
	const k = $derived(data.grid);

	// The title-block figures are read from the grid, not written by hand. A
	// hand-written version of this page once said "13 MRT areas" long after the grid
	// had grown to 558 cells across four modes — exactly the mistake not to repeat.
	const STATS = $derived([
		{ v: n(k.hexes), l: c.stats.hexes.label, s: c.stats.hexes.sub(k.walkRadius) },
		{ v: n(k.stops), l: c.stats.stops.label, s: c.stats.stops.sub },
		{ v: n(k.pois), l: c.stats.pois.label, s: c.stats.pois.sub },
		{ v: n(k.categories), l: c.stats.cats.label, s: c.stats.cats.sub }
	]);

	const MODES = $derived([
		{ nm: 'TransJakarta', v: k.stopsByMode.brt ?? 0 },
		{ nm: 'KRL', v: k.stopsByMode.krl ?? 0 },
		{ nm: 'LRT', v: k.stopsByMode.lrt ?? 0 },
		{ nm: 'MRT', v: k.stopsByMode.mrt ?? 0 }
	]);

	const POIS = $derived([
		{ nm: c.category.warung.name, v: k.poisByCategory.warung ?? 0 },
		{ nm: c.category.minimarket.name, v: k.poisByCategory.minimarket ?? 0 },
		{ nm: c.category.kopi.name, v: k.poisByCategory.kopi ?? 0 },
		{ nm: c.category.apotek.name, v: k.poisByCategory.apotek ?? 0 },
		{ nm: c.category.laundry.name, v: k.poisByCategory.laundry ?? 0 }
	]);
</script>

<svelte:head>
	<title>{c.meta.title}</title>
	<meta name="description" content={c.meta.description} />
</svelte:head>

<LandingNav />

<StreetStage />

<!-- The page below the stage speaks the same language as the model: a drawing
     sheet. Hairlines, labels hanging in the left column, large thin numerals —
     not shadowed cards. What shapes this page is line and space, not boxes.
     Colour appears only where it genuinely carries data. -->
<main id="top" class="sheet">
	<Reveal as="section">
		<ul class="titleblock">
			{#each STATS as s (s.l)}
				<li>
					<span class="v">{s.v}</span>
					<span class="l">{s.l}</span>
					<span class="s">{s.s}</span>
				</li>
			{/each}
		</ul>
		<p class="cover-note">{c.stats.coverNote(n(k.withData), n(k.hexes), n(k.nodata))}</p>
	</Reveal>

	<!-- ── the problem ──────────────────────────────────────────────────── -->
	<section id="masalah" class="band">
		<Reveal><SectionMark n="01" label={c.problem.mark} /></Reveal>
		<Reveal><h2>{c.problem.title}</h2></Reveal>

		<ul class="rows">
			{#each c.problem.rows as p, i (p.t)}
				<Reveal as="li" delay={i * 80}>
					<h3>{p.t}</h3>
					<p>{p.d}</p>
				</Reveal>
			{/each}
		</ul>

		<Reveal delay={120}>
			<p class="statement">{c.problem.statement}</p>
		</Reveal>

		<!-- This page's first chart is also the answer to "demand is not measured":
		     its shape is real, and the conclusion reads in a second. -->
		<Reveal>
			<div class="split wide-left">
				<div>
					<h3 class="lede">{c.problem.chartTitle}</h3>
					<p class="body">{c.problem.chartBody}</p>
				</div>
				<HourProfile hourly={data.hourly} />
			</div>
		</Reveal>
	</section>

	<!-- ── how it works ─────────────────────────────────────────────────── -->
	<section id="cara-kerja" class="band">
		<Reveal><SectionMark n="02" label={c.how.mark} /></Reveal>
		<Reveal><h2>{c.how.title}</h2></Reveal>

		<!-- The grid is the formal decision hardest to explain in a sentence, so it is
		     shown instead: a second model, scroll-driven like the street model above
		     it, with the measuring marks a working drawing uses. -->
		<Reveal><GridStage /></Reveal>

		<Reveal><SignalFlow /></Reveal>

		<!-- The numbering is kept here because the order genuinely carries information:
		     step 3 cannot run before step 2. -->
		<ol class="rows steps">
			{#each c.how.steps as s, i (s.t)}
				<Reveal as="li" delay={i * 80}>
					<h3><span class="n">{i + 1}</span>{s.t}</h3>
					<p>{typeof s.d === 'function' ? s.d(k.walkRadius, n(k.hexes)) : s.d}</p>
				</Reveal>
			{/each}
		</ol>

		<Reveal delay={120}>
			<!-- The plain sentence leads; the formula is still there, but folded away. The
			     reader this page is for is not looking for notation — a judge who wants to
			     check it need only open one line. -->
			<div class="plate">
				<p class="plain">{c.how.plain}</p>
				<p class="note">{c.how.note}</p>
				<div class="scale-slot">
					<span class="cap">{c.how.scaleCap}</span>
					<ScoreRamp nodata={c.scale.nodata} />
				</div>
				<details>
					<summary>{c.how.formulaSummary}</summary>
					<code class="mono"
						>Gap = (w<sub>d</sub> · {c.signal.demand.nm} − w<sub>s</sub> · {c.signal.supply.nm}) / (w<sub
							>d</sub
						> + w<sub>s</sub>)</code
					>
				</details>
			</div>
		</Reveal>
	</section>

	<!-- ── AI ───────────────────────────────────────────────────────────── -->
	<section id="ai" class="band">
		<Reveal><SectionMark n="03" label={c.ai.mark} /></Reveal>
		<div class="split">
			<Reveal>
				<div>
					<h2>{c.ai.title}</h2>
					<p class="body">{c.ai.p1}</p>
					<p class="body">{c.ai.p2}</p>
					<p class="body">{c.ai.p3}</p>
				</div>
			</Reveal>

			<Reveal delay={100}>
				<TapakDemo
					sets={data.conversation[lang()]}
					greeting={c.tapak.greet(k.hexes, k.withData)}
				/>
			</Reveal>
		</div>
	</section>

	<!-- ── data honesty ─────────────────────────────────────────────────── -->
	<section id="data" class="band">
		<Reveal><SectionMark n="04" label={c.data.mark} /></Reveal>
		<Reveal>
			<h2>{c.data.title}</h2>
			<p class="body wide">{c.data.body}</p>
		</Reveal>

		<Reveal delay={80}>
			<CoverageGrid mask={data.coverageMask} withData={k.withData} nodata={k.nodata} />
		</Reveal>

		<div class="split">
			<Reveal>
				<div>
					<h3 class="lede"><span class="tag real">OSM</span> {c.data.realTitle}</h3>
					<SourceBars rows={MODES} unit={c.data.realUnit(n(k.stops))} />
				</div>
			</Reveal>
			<Reveal delay={80}>
				<div>
					<h3 class="lede">{c.data.poiTitle}</h3>
					<SourceBars rows={POIS} unit={c.data.poiUnit(n(k.pois))} />
				</div>
			</Reveal>
		</div>

		<Reveal delay={80}>
			<div class="plate mock-plate">
				<h3><span class="tag mock">MOCK</span> {c.data.mockTitle}</h3>
				<p class="note">{c.data.mockNote}</p>
			</div>
		</Reveal>
	</section>

	<!-- ── who it is for ────────────────────────────────────────────────── -->
	<section class="band">
		<Reveal><SectionMark n="05" label={c.audience.mark} /></Reveal>
		<Reveal><h2>{c.audience.title}</h2></Reveal>
		<ul class="rows tight">
			{#each c.audience.rows as a, i (a.t)}
				<Reveal as="li" delay={i * 60}>
					<h3>{a.t}</h3>
					<p>{a.d}</p>
				</Reveal>
			{/each}
		</ul>
	</section>

	<!-- ── closing ──────────────────────────────────────────────────────── -->
	<section class="band closing">
		<Reveal>
			<h2 class="big">{c.closing.title}</h2>
			<div class="cta">
				<a class="go" href="/app">{c.closing.cta}</a>
				<a class="ghost" href="#cara-kerja">{c.closing.ghost}</a>
			</div>
		</Reveal>
	</section>
</main>

<footer class="foot">
	<div class="foot-inner">
		<div>
			<p class="brand-line">{c.brand.name}</p>
			<p>{c.footer.desc}</p>
		</div>
		<div>
			<p class="fl">{c.footer.teamLabel}</p>
			<p>{c.footer.team}</p>
			<p class="muted">{c.footer.campus}</p>
		</div>
		<div>
			<p class="fl">{c.footer.dataLabel}</p>
			<p class="muted">{c.footer.dataNote}</p>
		</div>
	</div>
</footer>

<style>
	:global(html) {
		scroll-behavior: smooth;
		scroll-padding-top: 5rem;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
	}

	/* A drawing sheet: a paper ground, with a hairline along the top edge as the
	   joint to the model slab that has just passed. */
	/* The paper lifts slightly at its top edge — the joint to the model slab just
	   passed, and what makes this sheet read as an object rather than as a hole
	   beneath the scene. The difference is only a few per cent. */
	.sheet {
		position: relative;
		background: var(--paper);
		background-image: var(--lift-paper);
		border-top: 1px solid var(--paper-line);
	}
	.sheet > :global(*) {
		max-width: 68rem;
		margin-inline: auto;
		padding-inline: max(1rem, 5vw);
	}

	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3vw, 2.5rem);
		line-height: 1.08;
		letter-spacing: -0.028em;
		font-weight: 600;
		max-width: 26ch;
		text-wrap: balance;
	}
	h3 {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		line-height: 1.3;
		letter-spacing: -0.012em;
		font-weight: 600;
	}
	/* A small heading leading one chart, not one row of a table. */
	h3.lede {
		font-size: clamp(1.125rem, 1.8vw, 1.375rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
		margin-bottom: 0.75rem;
		max-width: 22ch;
		text-wrap: balance;
	}
	.body {
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--label-2);
		max-width: 46ch;
	}
	.body + .body {
		margin-top: 0.875rem;
	}
	/* A heading and its first paragraph are one group, but still need space; without
	   this their lines collide. That space is smaller than the space above the heading. */
	h2 + .body {
		margin-top: 1rem;
	}
	.body.wide {
		max-width: 58ch;
	}

	/* A title block, like the corner of a technical drawing sheet. */
	.titleblock {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		border-bottom: 1px solid var(--paper-line);
	}
	.titleblock li {
		padding: 1.5rem 1.25rem 1.5rem 0;
		border-left: 1px solid var(--paper-line);
		padding-left: 1.25rem;
	}
	.titleblock li:first-child {
		border-left: 0;
		padding-left: 0;
	}
	.titleblock .v {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3.2vw, 2.5rem);
		font-weight: 300;
		letter-spacing: -0.03em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.titleblock .l {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--label-1);
		max-width: 16ch;
	}
	.titleblock .s {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.4;
		color: var(--label-3);
		max-width: 20ch;
	}
	.cover-note {
		padding-block: 1rem;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
		border-bottom: 1px solid var(--paper-line);
	}

	.band {
		padding-block: clamp(4rem, 11vh, 7.5rem);
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}

	/* Ruled rows: the label hangs in the left column, the prose sits right. This is
	   what replaces a grid of cards — the page is shaped by lines, not boxes. */
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--paper-line);
	}
	.rows :global(li) {
		display: grid;
		grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
		gap: 1rem 2.5rem;
		padding-block: 1.75rem;
		border-bottom: 1px solid var(--paper-line);
	}
	.rows.tight :global(li) {
		padding-block: 1.125rem;
	}
	.rows p {
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--label-2);
		max-width: 62ch;
	}
	/* Step numbers: large and thin, like the numbering on a working drawing. */
	.steps :global(li h3) {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.steps .n {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 200;
		line-height: 0.9;
		letter-spacing: -0.02em;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
	}

	/* The key sentence: the only place a coloured vertical rule is used on this page
	   of text, and only once per section. */
	.statement {
		font-family: var(--font-display);
		font-size: clamp(1.125rem, 2.1vw, 1.625rem);
		line-height: 1.32;
		letter-spacing: -0.02em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 40ch;
		border-left: 2px solid var(--accent);
		padding-left: 1.25rem;
	}

	/* The formula plate: one hairline-ruled field, no shadow. */
	.plate {
		margin: 0;
		padding: 1.75rem;
		border: 1px solid var(--paper-line);
		background-image: var(--lift-panel);
		/* A one-pixel light line along the top edge: this field catches the light
		   rather than merely being framed. */
		box-shadow: inset 0 1px 0 var(--lift-edge);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.plate .plain {
		font-family: var(--font-display);
		font-size: clamp(1.0625rem, 1.9vw, 1.4375rem);
		line-height: 1.36;
		letter-spacing: -0.018em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 44ch;
	}
	.plate .note {
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--label-2);
		max-width: 62ch;
	}
	.plate details {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.875rem;
	}
	.plate summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
	}
	.plate summary:hover {
		color: var(--label-2);
	}
	.plate details code {
		display: block;
		margin-top: 0.75rem;
		color: var(--label-2);
		letter-spacing: 0;
	}
	.scale-slot {
		border-top: 1px solid var(--paper-line);
		padding-top: 0.875rem;
		max-width: 30rem;
	}
	.scale-slot .cap {
		display: block;
		font-size: 0.6875rem;
		color: var(--label-3);
		margin-bottom: 0.5rem;
	}
	.mock-plate h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: 2.5rem;
		align-items: start;
	}
	.split.wide-left {
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
	}
	@media (max-width: 780px) {
		.split.wide-left {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.closing {
		align-items: center;
		text-align: center;
		padding-block: clamp(5rem, 14vh, 9rem);
		border-top: 1px solid var(--paper-line);
	}
	.closing h2 {
		max-width: 20ch;
		font-size: clamp(1.875rem, 4.2vw, 3.25rem);
		font-weight: 500;
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		justify-content: center;
		margin-top: 1.75rem;
	}
	.go,
	.ghost {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.5625rem 1.375rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.008em;
		text-decoration: none;
		transition:
			transform 120ms cubic-bezier(0.22, 0.61, 0.24, 1),
			background-color 180ms ease-out;
	}
	.go {
		background-color: var(--label-1);
		background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 60%);
		color: var(--paper);
	}
	.go:hover {
		transform: translateY(-1px);
	}
	.ghost {
		color: var(--label-1);
		border: 1px solid var(--separator-strong);
	}
	.ghost:hover {
		background: var(--fill-1);
	}
	.go:active,
	.ghost:active {
		transform: scale(0.97);
	}

	.foot {
		border-top: 1px solid var(--paper-line);
		background: var(--paper);
	}
	.foot-inner {
		max-width: 68rem;
		margin-inline: auto;
		padding: 2.5rem max(1rem, 5vw) 3rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1.75rem;
		font-size: 0.75rem;
		line-height: 1.6;
		color: var(--label-2);
	}
	.brand-line {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--label-1);
		margin-bottom: 0.375rem;
	}
	/* Footer labels: distinguished by weight and colour, not by tracked-out capitals. */
	.fl {
		font-family: var(--font-display);
		font-weight: 600;
		color: var(--label-1);
		margin-bottom: 0.375rem;
	}

	@media (max-width: 720px) {
		.rows :global(li) {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.5rem;
		}
		.titleblock li {
			padding-inline: 0;
			border-left: 0;
		}
	}
</style>
