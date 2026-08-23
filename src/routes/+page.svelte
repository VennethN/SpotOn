<script lang="ts">
	import CoverageGrid from '$lib/components/landing/CoverageGrid.svelte';
	import GridStage from '$lib/components/landing/GridStage.svelte';
	import DensityProfile from '$lib/components/landing/DensityProfile.svelte';
	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import Marquee from '$lib/components/landing/Marquee.svelte';
	import SectionMark from '$lib/components/landing/SectionMark.svelte';
	import StreetStage from '$lib/components/landing/StreetStage.svelte';
	import QueryMap from '$lib/components/landing/QueryMap.svelte';
	import TapakDemo from '$lib/components/landing/TapakDemo.svelte';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import Reveal from '$lib/components/ui/Reveal.svelte';
	import { CATEGORY_KEYS } from '$lib/domain/categories';
	import { copy, lang } from '$lib/state/lang.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const c = $derived(copy());
	const n = (v: number) => v.toLocaleString(lang() === 'en' ? 'en-GB' : 'id-ID');
	const k = $derived(data.grid);

	// The figures are read from the grid, not written by hand. A hand-written version of
	// this page once said "13 MRT areas" long after the grid had grown to 562 cells
	// across four modes — exactly the mistake not to repeat.
	const STATS = $derived([
		{ v: n(k.hexes), l: c.stats.hexes.label, s: c.stats.hexes.sub(k.walkRadius) },
		{ v: n(k.stops), l: c.stats.stops.label, s: c.stats.stops.sub },
		{ v: n(k.pois), l: c.stats.pois.label, s: c.stats.pois.sub },
		{ v: n(k.categories), l: c.stats.cats.label, s: c.stats.cats.sub }
	]);

	/**
	 * Which question the conversation is on, and whether its answer has landed.
	 *
	 * The conversation owns this clock and reports it, rather than the page driving
	 * both halves from a timer of its own. Two timers would drift, and the drift shows
	 * as a map that repaints a moment before or after the sentence explaining it.
	 */
	let demoStep = $state({ index: 0, answered: false });
	const demo = $derived({
		...(data.conversation[lang()][demoStep.index] ?? data.conversation[lang()][0]),
		answered: demoStep.answered
	});

	/* The thirteen types the engine scores, for the second rail. Read from the domain
	   rather than typed out, so a type added there appears here on its own. */
	const CATEGORY_NAMES = $derived(
		CATEGORY_KEYS.map((key) => ({ label: c.category[key].name, category: key }))
	);
</script>

<svelte:head>
	<title>{c.meta.title}</title>
	<meta name="description" content={c.meta.description} />
</svelte:head>

<LandingNav />

<StreetStage cell={data.stage} />

<!--
	THE SHEET

	What follows the scroll stage was a drawing sheet: hairlines, no surfaces, prose in
	one long left-hand column. It held together in daylight and fell apart in the dark,
	where the warm paper ground becomes near-black, the hairlines all but vanish, and the
	whole page reads as one grey wall of text with its right half empty.

	So it is rebuilt on two ideas instead.

	1. SURFACES CARRY THE STRUCTURE. Anything that is an OBJECT — a chart, a model, a
	   conversation, a set of counts — sits on a panel: a raised ground, a hairline, a
	   generous radius. Anything that is PROSE stays on the page ground with nothing round
	   it. That distinction survives both themes, because it is made of contrast rather
	   than of a hairline that dark mode swallows.

	2. EVERY SECTION OPENS THE SAME WAY. A mark and a heading on the left, the one
	   sentence that section is really about on the right, sharing a baseline. It fills
	   the width the old single column left empty, and it puts the argument in front of
	   the evidence every time.
-->
<main id="top" class="sheet">
	<!-- The four counts the product rests on, before any argument about them. Staggered
	     a beat apart so the row assembles left to right rather than landing as a slab. -->
	<section class="figures">
		<ul class="stats">
			{#each STATS as s, i (s.l)}
				<Reveal as="li" delay={i * 55} distance={10}>
					<span class="v">{s.v}</span>
					<span class="l">{s.l}</span>
					<span class="s">{s.s}</span>
				</Reveal>
			{/each}
		</ul>
	</section>

	<!-- ── the problem ──────────────────────────────────────────────────── -->
	<section id="masalah" class="band">
		<Reveal distance={16}>
			<header class="head">
				<div>
					<SectionMark n="01" label={c.problem.mark} />
					<h2>{c.problem.title}</h2>
				</div>
				<!-- The sentence that used to sit below the three rows as a pull quote. It is
				     the point of the section, so it leads it. -->
				<p class="lead">{c.problem.statement}</p>
			</header>
		</Reveal>

		<ul class="tri">
			{#each c.problem.rows as p, i (p.t)}
				<Reveal as="li" delay={i * 70} distance={10}>
					<h3>{p.t}</h3>
					<p>{p.d}</p>
				</Reveal>
			{/each}
		</ul>

		<Reveal distance={14}>
			<figure class="panel chart">
				<figcaption>
					<h3 class="lede">{c.problem.chartTitle}</h3>
					<p class="body">{c.problem.chartBody}</p>
				</figcaption>
				<DensityProfile bands={data.spread} />
			</figure>
		</Reveal>
	</section>

	<!-- ── data honesty ─────────────────────────────────────────────────── -->
	<section id="data" class="band">
		<Reveal distance={16}>
			<header class="head">
				<div>
					<SectionMark n="02" label={c.data.mark} />
					<h2>{c.data.title}</h2>
				</div>
				<p class="lead">{c.data.body}</p>
			</header>
		</Reveal>

		<Reveal delay={60} distance={12}>
			<div class="panel">
				<CoverageGrid map={data.coverage} surveyed={k.surveyed} unsurveyed={k.unsurveyed} />
			</div>
		</Reveal>

		<!-- The one thing on this page that is not a count of something: what somebody
		     wrote down while standing on the street. It sits here rather than in a band
		     of its own because it is a second kind of data, not a second claim, and a
		     whole section would promise more of it than 191 catchments can carry.

		     It disappears with the data. `fieldNotes` is null until the surveys have been
		     joined, and a sentence about photographs nobody can open would be the one
		     promise on this page the product could not keep. -->
		{#if k.fieldNotes}
			<Reveal delay={120} distance={10}>
				<div class="notes">
					<h3 class="lede">{c.data.notesTitle}</h3>
					<p>{c.data.notesBody(n(k.fieldNotes))}</p>
				</div>
			</Reveal>
		{/if}
	</section>

	<!-- ── how it works ─────────────────────────────────────────────────── -->
	<section id="cara-kerja" class="band">
		<Reveal distance={16}>
			<header class="head">
				<div>
					<SectionMark n="03" label={c.how.mark} />
					<h2>{c.how.title}</h2>
				</div>
				<p class="lead">{c.how.plain}</p>
			</header>
		</Reveal>

		<!-- The grid is the formal decision hardest to explain in a sentence, so it is
		     shown instead: a second model, scroll-driven like the street model above it,
		     with the measuring marks a working drawing uses. -->
		<Reveal distance={14}>
			<div class="panel model">
				<GridStage field={data.field} />
			</div>
		</Reveal>

		<!-- The numbering is kept because the order genuinely carries information: step 3
		     cannot run before step 2. Two columns rather than four rules across the full
		     width, where a four-word title left a hand's width of empty line beside it. -->
		<ol class="steps">
			{#each c.how.steps as s, i (s.t)}
				<Reveal as="li" delay={i * 60} distance={10}>
					<span class="n">{i + 1}</span>
					<h3>{s.t}</h3>
					<p>{typeof s.d === 'function' ? s.d(k.walkRadius, n(k.hexes)) : s.d}</p>
				</Reveal>
			{/each}
		</ol>

	</section>

	<!-- ── AI ───────────────────────────────────────────────────────────── -->
	<section id="ai" class="band">
		<Reveal distance={16}>
			<header class="head">
				<div>
					<SectionMark n="04" label={c.ai.mark} />
					<h2>{c.ai.title}</h2>
				</div>
				<p class="lead">{c.ai.p1}</p>
			</header>
		</Reveal>

		<!-- The map is the bigger half, and deliberately. This section makes one claim,
		     that asking repaints the map, and a chat box quoting place names asks the
		     reader to take that on trust. Here the whole city changes colour when the
		     business type does. -->
		<Reveal delay={60} distance={12}>
			<div class="panel ai-stage">
				<QueryMap
					map={data.coverage}
					data={data.queryMaps[demo.id]}
					label={demo.choice}
					answered={demo.answered}
				/>
				<TapakDemo
					sets={data.conversation[lang()]}
					greeting={c.tapak.greet(k.hexes)}
					onstep={(st) => (demoStep = st)}
				/>
			</div>
		</Reveal>

		<Reveal delay={90} distance={12}>
			<div class="prose two-up">
				<p class="body">{c.ai.p2}</p>
				<p class="body">{c.ai.p3}</p>
			</div>
		</Reveal>
	</section>

	<!-- ── who it is for ────────────────────────────────────────────────── -->
	<section class="band">
		<Reveal distance={16}>
			<!-- The one section with no sentence to carry it: the list below IS the
			     argument. So the head takes the full width rather than leaving half of
			     itself conspicuously empty. -->
			<header class="head solo">
				<div>
					<SectionMark n="05" label={c.audience.mark} />
					<h2>{c.audience.title}</h2>
				</div>
			</header>
		</Reveal>
		<!-- Names, not paragraphs. Who it is for on the way out, what it scores on the
		     way back, so the pair reads as one texture rather than as two tickers. -->
		<Reveal distance={12}>
			<div class="rails">
				<Marquee items={c.audience.rows} label={c.audience.mark} />
				<Marquee items={CATEGORY_NAMES} label={c.audience.typesLabel} reverse speed={54} />
			</div>
		</Reveal>
	</section>

	<!-- ── closing ──────────────────────────────────────────────────────── -->
	<section class="band closing">
		<Reveal distance={18}>
			<!-- The mark signs off the sheet: the same clipped lot the header opens with,
			     drawn once at reading size rather than a wordmark, because the word
			     "SpotOn" already sits in the button under it and again in the footer
			     below, and a third one would be shouting. -->
			<span class="sign"><BrandMark size={58} /></span>
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

	/* ── The system ────────────────────────────────────────────────────────
	   Five spacing steps, two inks, one surface. Every value below names one of
	   them, so the page has a rhythm rather than a dozen numbers that each
	   looked right on the day they were typed. */
	.sheet {
		--s-tight: 0.5rem;
		--s-group: 1rem;
		--s-block: 1.75rem;
		--s-wide: clamp(2rem, 3.6vw, 3.25rem);
		--s-band: clamp(4rem, 8vw, 6.5rem);
		--sheet-w: 72rem;
		--gutter: max(1.25rem, 5vw);

		/* Ink. Body copy is mixed from the primary label rather than taken from
		   `--label-2`: at 0.58 alpha on a near-black ground, paragraph after
		   paragraph of it turned to grey mist. Text over a dark surface wants MORE
		   contrast, not less. */
		--ink-2: color-mix(in srgb, var(--label-1) 70%, transparent);
		--ink-3: color-mix(in srgb, var(--label-1) 45%, transparent);

		/* The one surface. Raised off the ground in both themes: white on warm
		   paper, a lighter charcoal on near-black. */
		--panel: var(--bg-elevated);
		--panel-line: var(--separator);

		position: relative;
		background: var(--paper);
		background-image: var(--lift-paper);
		border-top: 1px solid var(--paper-line);
	}
	.sheet > :global(*) {
		max-width: var(--sheet-w);
		margin-inline: auto;
		padding-inline: var(--gutter);
	}

	/* ── Type ──────────────────────────────────────────────────────────────
	   Tracking is size-specific, never one value for everything: display sizes
	   tighten as they grow, body sits at zero, and the tracked-out capitals are
	   the only positive tracking on the page. Leading runs the other way. */
	h2 {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3vw, 2.5rem);
		line-height: 1.08;
		letter-spacing: -0.03em;
		font-weight: 600;
		/* 20ch, not 17: at 17 a five-word title fell into six lines and towered over
		   the sentence beside it. A display line wants to be long enough to read as a
		   line. */
		max-width: 20ch;
		text-wrap: balance;
	}
	h3 {
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.35;
		letter-spacing: -0.014em;
		font-weight: 600;
		color: var(--label-1);
	}
	h3.lede {
		font-size: clamp(1.0625rem, 1.5vw, 1.25rem);
		line-height: 1.26;
		letter-spacing: -0.02em;
		max-width: 26ch;
		text-wrap: balance;
	}
	.body {
		font-size: 0.9375rem;
		line-height: 1.62;
		color: var(--ink-2);
		max-width: 56ch;
	}

	/* ── Section head ──────────────────────────────────────────────────────
	   Heading left, the one sentence the section is about right, sharing a
	   baseline. The old single column left the right half of every section empty
	   and made the reader carry the argument down to the evidence. */
	.head {
		display: grid;
		/* The heading takes slightly more than half: it is the larger type, and an even
		   split left it wrapping a line earlier than the sentence beside it. */
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		gap: var(--s-wide);
		align-items: start;
	}
	.head h2 {
		margin-top: var(--s-group);
	}
	/* Roughly the height of the mark plus the gap under it, so the sentence starts
	   on the heading's first line rather than above it. Aligning the two boxes
	   instead — top or bottom — left one of them floating whenever the two ran to
	   different lengths, which is most of the time. */
	.head .lead {
		margin-top: 2rem;
	}
	.head.solo {
		grid-template-columns: minmax(0, 1fr);
	}
	.head.solo h2 {
		max-width: 26ch;
	}
	.lead {
		font-family: var(--font-display);
		font-size: clamp(1.0625rem, 1.5vw, 1.3125rem);
		line-height: 1.45;
		letter-spacing: -0.014em;
		font-weight: 400;
		color: var(--ink-2);
		max-width: 36ch;
		/* The accent rule is the only colour on a page of text, and it marks the
		   sentence that carries the section. */
		border-left: 2px solid var(--accent);
		padding-left: 1.125rem;
	}

	/* ── Figures ───────────────────────────────────────────────────────────
	   Four counts, four columns. No panel: these are the page's opening
	   statement, not an object. */
	/* Two rows travelling against each other. The gap is tight on purpose: they are one
	   texture rather than two lists, and spacing them apart makes them read as two. */
	.rails {
		display: grid;
		gap: 0.5rem;
	}

	.figures {
		padding-top: var(--s-wide);
	}
	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--s-wide);
		padding-bottom: var(--s-block);
		border-bottom: 1px solid var(--paper-line);
	}
	.stats .v {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 3.25rem);
		/* Light, but not thin: at 300 the numerals went spindly against the labels
		   under them and the row lost its top line. */
		font-weight: 350;
		letter-spacing: -0.04em;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
	}
	.stats .l {
		display: block;
		margin-top: 0.75rem;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--label-1);
	}
	.stats .s {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--ink-3);
	}

	/* Half a band above and half below, so the space BETWEEN two sections is one
	   band rather than two stacked. */
	/* Two lines under the coverage picture, indented off a quiet rule rather than the
	   accent one. The accent marks the sentence that carries a section, and this is an
	   aside to the section rather than the section itself. */
	.notes {
		/* Wide enough that the title holds one line and the sentence under it runs
		   three. At the narrower measure a `.lead` uses, the title broke in two and the
		   block read as a second heading for the section rather than a note under it. */
		max-width: 64ch;
		padding-left: 1.125rem;
		border-left: 2px solid var(--paper-line);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.notes h3 {
		max-width: none;
	}
	.notes p {
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--ink-2);
	}

	.band {
		padding-block: calc(var(--s-band) / 2);
		display: flex;
		flex-direction: column;
		gap: var(--s-wide);
	}
	.band:first-of-type {
		padding-top: var(--s-band);
	}

	/* ── Panels ────────────────────────────────────────────────────────────
	   The one surface. An object goes on a panel and prose does not, which is
	   what keeps the page from becoming a grid of cards: five things here are
	   objects, and the rest is argument. */
	.panel {
		background: var(--panel);
		border: 1px solid var(--panel-line);
		border-radius: var(--r-xl);
		padding: clamp(1.25rem, 2.6vw, 2rem);
		/* A bright hairline along the top edge, so the surface reads as catching the
		   light rather than as merely being outlined. It is what separates a panel from
		   the ground in the dark, where the fill difference alone is a few per cent and
		   a drop shadow is either invisible or a grey halo. */
		box-shadow:
			inset 0 1px 0 var(--lift-edge),
			var(--shadow-chip);
	}
	@media (prefers-color-scheme: dark) {
		.panel {
			box-shadow: inset 0 1px 0 var(--lift-edge);
		}
	}
	.panel.model {
		padding: clamp(0.75rem, 1.4vw, 1.125rem);
	}
	.chart {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-block);
	}
	.chart figcaption {
		display: flex;
		flex-direction: column;
		gap: var(--s-tight);
	}

	/* ── Columns of short things ───────────────────────────────────────────
	   The problem and the steps were two long lists of ruled rows, each one a short
	   title in a wide left column with a paragraph beside it. Read down the page they
	   were indistinguishable. Set in columns each becomes a shape, and each item is
	   short enough to take in at a glance. */
	.tri,
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-wide);
	}
	.tri {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.steps {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-block) var(--s-wide);
	}
	.tri :global(li),
	.steps :global(li) {
		border-top: 1px solid var(--paper-line);
		padding-top: var(--s-group);
	}
	.tri p,
	.steps p {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	/* Step numbers: large and thin, like the numbering on a working drawing, and
	   above the title rather than beside it so every title starts at the same left
	   edge. */
	.steps .n {
		display: block;
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
		margin-bottom: 0.375rem;
	}

	.prose {
		display: flex;
		flex-direction: column;
		gap: var(--s-group);
	}
	/* Two columns of body copy under the stage, because after the map has made the
	   point these two paragraphs are a footnote to it rather than a second act. */
	.prose.two-up {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-block);
		align-items: start;
	}

	/* The map takes the room and the conversation runs down its side, which is the
	   shape of the app itself. The map is given the wider share on purpose: it is the
	   thing being claimed, and the conversation is what provokes it. */
	.ai-stage {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
		gap: var(--s-block);
		align-items: center;
	}

	@media (max-width: 56rem) {
		.prose.two-up {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-group);
		}
		/* The map first, then the conversation under it. Stacked the other way the
		   reader scrolls past the question before the thing it changes. */
		.ai-stage {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* ── Closing ───────────────────────────────────────────────────────────
	   The last thing on the sheet, so it takes the most air and the largest type
	   on the page after the hero. */
	.closing {
		align-items: center;
		text-align: center;
		padding-block: clamp(4.5rem, 11vh, 7.5rem);
		border-top: 1px solid var(--paper-line);
	}
	/* Its own air above the line, and quieter ink than the headline: a signature under
	   the last sentence, not a second heading competing with it. */
	.sign {
		display: flex;
		justify-content: center;
		margin-bottom: var(--s-block);
		color: var(--ink-2);
	}
	.closing h2 {
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
		max-width: 72rem;
		margin-inline: auto;
		padding: clamp(2rem, 3.6vw, 3.25rem) max(1.25rem, 5vw) 3rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1.75rem;
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
	   One breakpoint for the page's structure, at the width where a two-column
	   section head stops having room for two columns. The figures get a second
	   step of their own: dropped straight from four to one, the opening of the
	   page becomes a tall list of numbers to scroll past. */
	@media (max-width: 56rem) {
		.head {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-block);
			align-items: start;
		}
		h2 {
			max-width: 22ch;
		}
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--s-block) var(--s-wide);
		}
		.tri,
		.steps {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-block);
		}
	}
	@media (max-width: 30rem) {
		.stats {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
