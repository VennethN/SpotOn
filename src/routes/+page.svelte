<script lang="ts">
	import CoverageGrid from '$lib/components/landing/CoverageGrid.svelte';
	import GridStage from '$lib/components/landing/GridStage.svelte';
	import DensityProfile from '$lib/components/landing/DensityProfile.svelte';
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
		{ nm: c.category.minimarket.name, v: k.poisByCategory.minimarket ?? 0 },
		{ nm: c.category.kopi.name, v: k.poisByCategory.kopi ?? 0 },
		{ nm: c.category.cepatsaji.name, v: k.poisByCategory.cepatsaji ?? 0 },
		{ nm: c.category.apotek.name, v: k.poisByCategory.apotek ?? 0 },
		{ nm: c.category.roti.name, v: k.poisByCategory.roti ?? 0 }
	]);
</script>

<svelte:head>
	<title>{c.meta.title}</title>
	<meta name="description" content={c.meta.description} />
</svelte:head>

<LandingNav />

<StreetStage cell={data.stage} />

<!-- The page below the stage speaks the same language as the model: a drawing
     sheet. Hairlines, labels hanging in the left column, large thin numerals —
     not shadowed cards. What shapes this page is line and space, not boxes.
     Colour appears only where it genuinely carries data. -->
<main id="top" class="sheet">
	<!-- The title block, like the corner of a drawing sheet. Four figures, four equal
	     columns, and each one reads top to bottom: the number, what it counts, where it
	     came from. They are staggered a beat apart so the row assembles left to right
	     rather than appearing as one slab. -->
	<section class="titles">
		<ul class="titleblock">
			{#each STATS as s, i (s.l)}
				<Reveal as="li" delay={i * 55} distance={10}>
					<span class="v">{s.v}</span>
					<span class="l">{s.l}</span>
					<span class="s">{s.s}</span>
				</Reveal>
			{/each}
		</ul>
		<Reveal delay={220} distance={8}>
			<p class="cover-note">{c.stats.coverNote(n(k.surveyed), n(k.hexes), n(k.unsurveyed))}</p>
		</Reveal>
	</section>

	<!-- ── the problem ──────────────────────────────────────────────────── -->
	<section id="masalah" class="band">
		<!-- Mark, heading and opening line arrive as ONE group, because that is what they
		     are. Revealed separately they crossed each other in the air. -->
		<Reveal distance={16}>
			<header class="sec-head">
				<SectionMark n="01" label={c.problem.mark} />
				<h2>{c.problem.title}</h2>
			</header>
		</Reveal>

		<ul class="rows">
			{#each c.problem.rows as p, i (p.t)}
				<Reveal as="li" delay={i * 70} distance={10}>
					<h3>{p.t}</h3>
					<p>{p.d}</p>
				</Reveal>
			{/each}
		</ul>

		<Reveal delay={80} distance={14}>
			<p class="statement">{c.problem.statement}</p>
		</Reveal>

		<!-- This page's first chart is also the answer to "how busy is never counted":
		     its shape is real, and the conclusion reads in a second. -->
		<Reveal distance={14}>
			<div class="split wide-left">
				<div>
					<h3 class="lede">{c.problem.chartTitle}</h3>
					<p class="body">{c.problem.chartBody}</p>
				</div>
				<DensityProfile bands={data.spread} />
			</div>
		</Reveal>
	</section>

	<!-- ── how it works ─────────────────────────────────────────────────── -->
	<section id="cara-kerja" class="band">
		<Reveal distance={16}>
			<header class="sec-head">
				<SectionMark n="02" label={c.how.mark} />
				<h2>{c.how.title}</h2>
			</header>
		</Reveal>

		<!-- The grid is the formal decision hardest to explain in a sentence, so it is
		     shown instead: a second model, scroll-driven like the street model above
		     it, with the measuring marks a working drawing uses. -->
		<Reveal distance={14}><GridStage field={data.field} /></Reveal>

		<Reveal distance={14}><SignalFlow /></Reveal>

		<!-- The numbering is kept here because the order genuinely carries information:
		     step 3 cannot run before step 2. -->
		<ol class="rows steps">
			{#each c.how.steps as s, i (s.t)}
				<Reveal as="li" delay={i * 70} distance={10}>
					<h3><span class="n">{i + 1}</span>{s.t}</h3>
					<p>{typeof s.d === 'function' ? s.d(k.walkRadius, n(k.hexes)) : s.d}</p>
				</Reveal>
			{/each}
		</ol>

		<Reveal delay={80} distance={14}>
			<!-- The plain sentence leads, and the formula is still there but folded away. The
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
		<Reveal distance={16}>
			<header class="sec-head">
				<SectionMark n="03" label={c.ai.mark} />
				<h2>{c.ai.title}</h2>
			</header>
		</Reveal>
		<div class="split">
			<Reveal distance={12}>
				<div class="prose">
					<p class="body">{c.ai.p1}</p>
					<p class="body">{c.ai.p2}</p>
					<p class="body">{c.ai.p3}</p>
				</div>
			</Reveal>

			<Reveal delay={90} distance={12}>
				<TapakDemo
					sets={data.conversation[lang()]}
					greeting={c.tapak.greet(k.hexes, k.surveyed)}
				/>
			</Reveal>
		</div>
	</section>

	<!-- ── data honesty ─────────────────────────────────────────────────── -->
	<section id="data" class="band">
		<Reveal distance={16}>
			<header class="sec-head">
				<SectionMark n="04" label={c.data.mark} />
				<h2>{c.data.title}</h2>
				<p class="body wide">{c.data.body}</p>
			</header>
		</Reveal>

		<Reveal delay={60} distance={12}>
			<CoverageGrid mask={data.coverageMask} surveyed={k.surveyed} unsurveyed={k.unsurveyed} />
		</Reveal>

		<div class="split">
			<Reveal distance={12}>
				<div>
					<h3 class="lede"><span class="tag real">OSM</span> {c.data.realTitle}</h3>
					<SourceBars rows={MODES} unit={c.data.realUnit(n(k.stops))} />
				</div>
			</Reveal>
			<Reveal delay={70} distance={12}>
				<div>
					<h3 class="lede">{c.data.poiTitle}</h3>
					<SourceBars rows={POIS} unit={c.data.poiUnit(n(k.pois))} />
				</div>
			</Reveal>
		</div>

		<Reveal delay={60} distance={12}>
			<!-- The MOCK badge is gone from this plate because there is nothing left to
			     badge. What the plate says now is what the product deliberately does NOT
			     show, which is the more useful half of the same honesty. -->
			<div class="plate">
				<h3>{c.data.mockTitle}</h3>
				<p class="note">{c.data.mockNote}</p>
			</div>
		</Reveal>
	</section>

	<!-- ── who it is for ────────────────────────────────────────────────── -->
	<section class="band">
		<Reveal distance={16}>
			<header class="sec-head">
				<SectionMark n="05" label={c.audience.mark} />
				<h2>{c.audience.title}</h2>
			</header>
		</Reveal>
		<ul class="rows tight">
			{#each c.audience.rows as a, i (a.t)}
				<Reveal as="li" delay={i * 55} distance={9}>
					<h3>{a.t}</h3>
					<p>{a.d}</p>
				</Reveal>
			{/each}
		</ul>
	</section>

	<!-- ── closing ──────────────────────────────────────────────────────── -->
	<section class="band closing">
		<Reveal distance={18}>
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
	/* An in-page link should glide rather than jump, and land clear of the floating
	   nav rather than under it. Off entirely when motion is reduced: a smooth scroll
	   is a full-viewport movement the reader did not ask to watch. */
	:global(html) {
		scroll-behavior: smooth;
		scroll-padding-top: 5.5rem;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
	}

	/* ── The sheet ─────────────────────────────────────────────────────────
	   Everything below the scroll stage is one drawing sheet: a paper ground,
	   hairlines rather than boxes, labels hanging in a left column. The scale
	   below is the whole of it. Every spacing, size and tracking value on this
	   page comes from these tokens, so the page has one rhythm instead of a
	   dozen numbers that happened to look right on the day they were typed. */
	.sheet {
		/* Spacing. A four-step ratio, not a continuum: within a group, between
		   groups, between blocks, between sections. */
		--s-tight: 0.5rem;
		--s-group: 1rem;
		--s-block: 1.75rem;
		--s-wide: clamp(2.25rem, 4vw, 3.5rem);
		--s-band: clamp(4.5rem, 9vw, 7.5rem);
		/* The sheet's own width and its gutter, so nothing sets its own margin. */
		--sheet-w: 68rem;
		--gutter: max(1.25rem, 5vw);

		position: relative;
		background: var(--paper);
		background-image: var(--lift-paper);
		/* The joint to the model slab that has just passed. What makes this read as
		   an object rather than as a hole beneath the scene. */
		border-top: 1px solid var(--paper-line);
	}
	.sheet > :global(*) {
		max-width: var(--sheet-w);
		margin-inline: auto;
		padding-inline: var(--gutter);
	}

	/* ── Type ──────────────────────────────────────────────────────────────
	   Tracking is size-specific, never one value for everything: display sizes
	   are tightened because letters read further apart as they grow, body text
	   sits at zero, and the small tracked-out labels are the only positive
	   tracking on the page. Leading runs the other way, tight above and loose
	   below. */
	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3.1vw, 2.625rem);
		line-height: 1.07;
		letter-spacing: -0.03em;
		font-weight: 600;
		/* Wider than it was. At 26ch this heading broke into four short lines and
		   read as a stack of fragments rather than as a sentence. */
		max-width: 30ch;
		text-wrap: balance;
	}
	h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.35;
		letter-spacing: -0.012em;
		font-weight: 600;
	}
	/* A small heading leading one chart, not one row of a table. */
	h3.lede {
		font-size: clamp(1.0625rem, 1.6vw, 1.3125rem);
		line-height: 1.24;
		letter-spacing: -0.02em;
		margin-bottom: var(--s-group);
		max-width: 24ch;
		text-wrap: balance;
	}
	.body {
		font-size: clamp(0.9375rem, 0.6vw + 0.8rem, 1.0625rem);
		line-height: 1.62;
		color: var(--label-2);
		max-width: 46ch;
	}
	.body + .body {
		margin-top: var(--s-group);
	}
	.body.wide {
		max-width: 58ch;
	}
	.prose {
		display: flex;
		flex-direction: column;
		gap: var(--s-group);
	}

	/* ── Section header ────────────────────────────────────────────────────
	   Mark, heading and opening line are one group and are spaced as one. The
	   air that separates them from the section's content is the block step, so
	   the eye can tell "this belongs to that" from spacing alone. */
	.sec-head {
		display: flex;
		flex-direction: column;
		gap: var(--s-group);
	}
	.sec-head h2 {
		margin-top: var(--s-tight);
	}
	.sec-head .body {
		margin-top: var(--s-tight);
	}

	/* ── Title block ───────────────────────────────────────────────────────
	   Four figures in four columns, held at four across until there is genuinely
	   no room, then two, then one. `auto-fit` was letting the last column drop to
	   a row of its own at middle widths, which made one figure look like a
	   conclusion drawn from the other three. */
	.titles {
		padding-top: var(--s-wide);
	}
	.titleblock {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-bottom: 1px solid var(--paper-line);
	}
	.titleblock :global(li) {
		padding: var(--s-block) var(--s-group) var(--s-block) var(--s-group);
		border-left: 1px solid var(--paper-line);
	}
	.titleblock :global(li:first-child) {
		border-left: 0;
		padding-left: 0;
	}
	.titleblock .v {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3.4vw, 2.75rem);
		/* Light, but not thin: at 300 the numerals went spindly against the labels
		   under them and the row lost its top line. */
		font-weight: 350;
		letter-spacing: -0.035em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.titleblock .l {
		display: block;
		margin-top: 0.625rem;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--label-1);
		max-width: 15ch;
	}
	.titleblock .s {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-3);
		max-width: 20ch;
	}
	.cover-note {
		padding-block: var(--s-group);
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--label-2);
		max-width: 68ch;
		border-bottom: 1px solid var(--paper-line);
	}

	/* Half a band above and half below, so the space BETWEEN two sections is one band
	   rather than two stacked. At full width the doubled version put a quarter of a
	   screen of nothing between every section, which reads as the page having ended. */
	.band {
		padding-block: calc(var(--s-band) / 2);
		display: flex;
		flex-direction: column;
		gap: var(--s-wide);
	}
	/* The first section carries the full step, because above it is the title block
	   rather than another section's air. */
	.band:first-of-type {
		padding-top: var(--s-band);
	}

	/* ── Ruled rows ────────────────────────────────────────────────────────
	   The label hangs in the left column, the prose sits right. This is what
	   replaces a grid of cards: the page is shaped by lines, not boxes. The two
	   columns are aligned on their first baselines rather than their boxes, so a
	   two-line label does not push its paragraph down with it. */
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--paper-line);
	}
	.rows :global(li) {
		display: grid;
		grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
		gap: var(--s-tight) var(--s-wide);
		align-items: baseline;
		padding-block: var(--s-block);
		border-bottom: 1px solid var(--paper-line);
	}
	.rows.tight :global(li) {
		padding-block: 1.25rem;
	}
	.rows p {
		font-size: 0.9375rem;
		line-height: 1.62;
		color: var(--label-2);
		max-width: 58ch;
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
		font-size: clamp(1.1875rem, 2vw, 1.625rem);
		line-height: 1.34;
		letter-spacing: -0.022em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 38ch;
		border-left: 2px solid var(--accent);
		padding-left: 1.25rem;
	}

	/* ── Plates ────────────────────────────────────────────────────────────
	   One hairline-ruled field with a light line along its top edge, so it reads
	   as catching the light rather than as merely being framed. No shadow: this
	   is a sheet, and a shadow would lift it off the paper. */
	.plate {
		margin: 0;
		padding: var(--s-wide);
		border: 1px solid var(--paper-line);
		background-image: var(--lift-panel);
		box-shadow: inset 0 1px 0 var(--lift-edge);
		display: flex;
		flex-direction: column;
		gap: var(--s-group);
	}
	.plate h3 {
		font-size: 1.0625rem;
		letter-spacing: -0.016em;
	}
	.plate .plain {
		font-family: var(--font-display);
		font-size: clamp(1.0625rem, 1.8vw, 1.4375rem);
		line-height: 1.38;
		letter-spacing: -0.018em;
		font-weight: 400;
		color: var(--label-1);
		max-width: 42ch;
	}
	.plate .note {
		font-size: 0.9375rem;
		line-height: 1.65;
		color: var(--label-2);
		max-width: 58ch;
	}
	.plate details {
		border-top: 1px solid var(--paper-line);
		padding-top: var(--s-group);
	}
	.plate summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
		transition: color 140ms ease-out;
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
		padding-top: var(--s-group);
		max-width: 30rem;
	}
	.scale-slot .cap {
		display: block;
		font-size: 0.6875rem;
		color: var(--label-3);
		margin-bottom: 0.5rem;
	}

	/* Two columns that hold until the narrower one would stop being readable.
	   `auto-fit` collapsed both halves at once at an arbitrary width; this keeps
	   the pairing until 62rem and then stacks it deliberately. */
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--s-wide);
		align-items: start;
	}
	.split.wide-left {
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
	}
	@media (max-width: 62rem) {
		.split,
		.split.wide-left {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-block);
		}
	}

	/* ── Closing ───────────────────────────────────────────────────────────
	   The last thing on the sheet, so it is allowed the most air and the largest
	   type on the page after the hero. */
	.closing {
		align-items: center;
		text-align: center;
		padding-block: clamp(4.5rem, 11vh, 7.5rem);
		border-top: 1px solid var(--paper-line);
	}
	.closing h2 {
		/* Two lines, not three. At 18ch this broke after "bukan", which puts the hinge
		   of the sentence at the end of a line. */
		max-width: 22ch;
		font-size: clamp(1.875rem, 4vw, 3.125rem);
		line-height: 1.06;
		letter-spacing: -0.032em;
		font-weight: 500;
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		justify-content: center;
		margin-top: var(--s-block);
	}
	/* The same metrics as the button on the stage above, so the page opens and
	   closes with the same object rather than with two that resemble each other. */
	.go,
	.ghost {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.625rem 1.5rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.008em;
		text-decoration: none;
		/* Press feedback is instant and the release is what settles. */
		transition:
			transform 110ms cubic-bezier(0.32, 0.72, 0, 1),
			background-color 180ms ease-out,
			border-color 180ms ease-out;
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
		border-color: var(--label-3);
	}
	.go:active,
	.ghost:active {
		transform: scale(0.97);
	}
	@media (prefers-reduced-motion: reduce) {
		.go,
		.ghost {
			transition: background-color 180ms ease-out;
		}
		.go:hover,
		.go:active,
		.ghost:active {
			transform: none;
		}
	}

	.foot {
		border-top: 1px solid var(--paper-line);
		background: var(--paper);
	}
	.foot-inner {
		max-width: 68rem;
		margin-inline: auto;
		padding: var(--s-wide) max(1.25rem, 5vw) 3rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--s-block);
		font-size: 0.8125rem;
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

	/* ── Narrow ────────────────────────────────────────────────────────────
	   Two steps rather than one. At 46rem the title block goes from four columns
	   to two, which keeps the figures paired instead of dropping them into a
	   single tall list the moment the window is not wide. */
	@media (max-width: 46rem) {
		.titleblock {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.titleblock :global(li:nth-child(3)) {
			border-left: 0;
			padding-left: 0;
		}
		.titleblock :global(li:nth-child(n + 3)) {
			border-top: 1px solid var(--paper-line);
		}
	}
	@media (max-width: 30rem) {
		.titleblock {
			grid-template-columns: minmax(0, 1fr);
		}
		.titleblock :global(li) {
			padding-inline: 0;
			border-left: 0;
			border-top: 1px solid var(--paper-line);
		}
		.titleblock :global(li:first-child) {
			border-top: 0;
		}
	}
	@media (max-width: 45rem) {
		.rows :global(li) {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.5rem;
		}
	}
</style>
