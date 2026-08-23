<script lang="ts">
	/**
	 * A model of the selected area, inside the app.
	 *
	 * Not an actual plan — this is a schematic. What comes from the data is its
	 * contents: how much trade stands in walking range (counted businesses), how many
	 * competing outlets there are, and how many units are genuinely on the market. An
	 * area whose city has not been surveyed shows empty, not filled in.
	 *
	 * THE CLOCK IS GONE. It used to be the centre of this panel: a slider from midnight
	 * to midnight, a crowd that thickened towards noon, a sentence reading "at 20.06 it
	 * is fairly busy here, busiest around 12.00". Every one of those figures came out of
	 * a random number generator seeded with the cell id. Nobody has counted an hour of
	 * anything in Jakarta, so there is no hour on screen. The daylight is the reader's
	 * own clock, which is a fact about them rather than a claim about the place.
	 *
	 * The wording is deliberately plain: "how busy", not "demand index". The full
	 * figures are still there, one click below.
	 */
	import ActivityPanel from '$lib/components/app/ActivityPanel.svelte';
	import FieldPanel from '$lib/components/app/FieldPanel.svelte';
	import Glyph from '$lib/components/ui/Glyph.svelte';
	import PropertyPanel from '$lib/components/app/PropertyPanel.svelte';
	import RivalsPanel from '$lib/components/app/RivalsPanel.svelte';
	import ScoreBreakdown from '$lib/components/app/ScoreBreakdown.svelte';
	import StreetScene from '$lib/components/ui/StreetScene.svelte';
	import TransitPanel from '$lib/components/app/TransitPanel.svelte';
	import { daylightAt, localHour } from '$lib/scene/daylight';
	import { getAppState } from '$lib/state/app.svelte';
	import { categoryNames } from '$lib/domain/narrate';
	import { copy } from '$lib/state/lang.svelte';
	import { pct } from '$lib/utils/format';

	/**
	 * This panel is far smaller than the landing page's stage, so its camera is
	 * pulled in: at a frame ±340 px wide, the full span shrinks the cafe and the
	 * rental lot until neither of them reads.
	 */
	const CAMERA_T = 0.88;

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	const catName = $derived(categoryNames(app.categories, c));
	const catMany = $derived(categoryNames(app.categories, c, 'many'));

	/** The highest-scoring cell in the active category — for the "just pick one" button. */
	const best = $derived(
		app.rows.reduce<(typeof app.rows)[number] | null>(
			(a, r) => (r.score !== null && (a === null || r.score > (a.score ?? 0)) ? r : a),
			null
		)
	);

	/** The reader's own hour, for the light. It says nothing about the place. */
	const hour = localHour();
	const day = $derived(daylightAt(hour));

	/**
	 * Nothing counted here: the catalogue has never read this cell's city.
	 *
	 * Read off `covered` rather than off a null score. The two used to agree, and they
	 * stopped agreeing the moment the map could be open with no business type named:
	 * there every score is null while every count is perfectly good, and this would
	 * have told the reader their cell had never been surveyed.
	 */
	const blank = $derived(row ? !row.covered : false);
	/**
	 * Counted, but nobody has said what they want to open yet.
	 *
	 * The panel still has plenty to say — how busy it is, what it captures, what is on
	 * the market — and one thing it must not say, which is a score. The rivals sentence
	 * goes too: rivals OF WHAT is the question that has not been asked.
	 */
	const noType = $derived(Boolean(row) && !blank && row!.score === null);
	/** How busy, 0..1 — the trade around the cell against the busiest cell on the grid. */
	const busyness = $derived(row?.demand ?? 0);

	/** How busy, in words — not a percentage the reader has to interpret themselves. */
	const busyWord = $derived(
		busyness >= 0.8
			? c.mood.busiest
			: busyness >= 0.5
				? c.mood.busy
				: busyness >= 0.2
					? c.mood.quiet
					: c.mood.empty
	);
</script>

{#if !row}
	<!-- An empty state that can be acted on. A bare "please pick one on the map"
	     hands the work straight back to a user who does not yet know which cell is
	     worth looking at. -->
	<div class="empty">
		<p>{c.app.emptyMood}</p>
		<!-- Only offered once there is a business type to be best FOR. Without one the
		     button would rank cells by a score that does not exist. -->
		{#if best && catName}
			<button type="button" class="btn" onclick={() => app.select(best.id)}>
				{c.app.pickBest(catName.toLowerCase())}
			</button>
		{/if}
	</div>
{:else}
	<div class="dio">
		<div class="stage" style:--sky={day.skyHorizon}>
			<StreetScene
				{hour}
				density={busyness}
				category={app.categories[0]}
				cameraT={CAMERA_T}
				nodata={blank}
				rivals={row.osm}
				vacancies={row.units}
				label={c.mood.sceneLabel(
					row.name,
					blank
						? c.mood.sceneNodata
						: noType
							? c.mood.sceneNoType(row.density, row.units)
							: c.mood.sceneBody(row.density, row.osm, catMany, row.units)
				)}
			/>
			<span class="mark">{c.app.schema}</span>
		</div>

		<!--
			THE THREE FIGURES, BEFORE ANY SENTENCE

			This card used to open with prose and put every number inside it, which asks a
			reader to parse a sentence before they know whether the place is worth the rest
			of the scroll. The counts are what someone comparing two sites reads first, and
			they are three plain integers, so they are set as three.

			The prose underneath kept the judgement and gave up the tally: it says the
			street is quiet, and no longer also says how many units are on the market, which
			the tile beside it already said. That is where the run-on came from — with no
			business type named there was no middle clause, and the sentence ran "jadi agak
			sepi. dan 12 unit sedang dipasarkan."

			Each glyph wears the colour its subject is drawn in on the map, so the tile and
			the dots it is counting are visibly the same thing. The first has no colour
			because it has no layer: nothing on the map draws all trade at once.

			Hidden on a cell whose city was never surveyed. Three zeroes there would be a
			finding about Jakarta rather than about the catalogue, which is the one mistake
			this panel exists to prevent.
		-->
		{#if !blank}
			<ul class="stats">
				<li>
					<span class="ico"><Glyph icon="market" size={14} /></span>
					<span class="n">{row.density}</span>
					<span class="l">{c.mood.tiles.around}</span>
				</li>
				{#if !noType}
					<li style:--tint="var(--critical)">
						<span class="ico"><Glyph icon="rivals" size={14} /></span>
						<span class="n">{row.osm}</span>
						<span class="l">{c.mood.tiles.rivals}</span>
					</li>
				{/if}
				<li style:--tint="var(--warn)">
					<span class="ico"><Glyph icon="sign" size={14} /></span>
					<span class="n">{row.units}</span>
					<span class="l">{c.mood.tiles.space}</span>
				</li>
			</ul>
		{/if}

		{#if blank}
			<p class="read">{c.mood.nodata}</p>
		{:else if noType}
			<!-- Every figure here is counted and none of them needs a business type. The
			     one sentence that would is left out rather than filled in with a blank. -->
			<p class="read">
				{c.mood.reading(row.density, busyWord)}
				{c.mood.askForScore}
			</p>

			<details class="numbers">
				<summary>{c.app.fullNumbers}</summary>
				<dl>
					<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
					<div><dt>{c.mood.rows.access}</dt><dd>{pct(row.access)}</dd></div>
					<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
				</dl>
				<p class="prov">{c.mood.prov}</p>
			</details>
		{:else}
			<p class="read">{c.mood.reading(row.density, busyWord)}</p>

			<details class="numbers">
				<summary>{c.app.fullNumbers}</summary>
				<dl>
					<div><dt>{c.mood.rows.score}</dt><dd>{pct(row.score)}</dd></div>
					<div><dt>{c.mood.rows.demand}</dt><dd>{pct(row.demand)}</dd></div>
					<div><dt>{c.mood.rows.supply}</dt><dd>{pct(row.supply)}</dd></div>
					<div><dt>{c.mood.rows.around}</dt><dd>{row.density}</dd></div>
					<div><dt>{c.mood.rows.rivals}</dt><dd>{row.osm}</dd></div>
					<div><dt>{c.mood.rows.access}</dt><dd>{pct(row.access)}</dd></div>
					<div><dt>{c.mood.rows.space}</dt><dd>{row.units}</dd></div>
				</dl>

				<!-- The rows above are the figures; this is what the engine did with them,
				     and it belongs behind the same fold. Someone who opens "the full
				     figures" is asking where the score came from, and a list of inputs
				     with no arithmetic between them only answers half of that. -->
				<ScoreBreakdown />

				<p class="prov">{c.mood.prov}</p>
			</details>

			<!-- Directly under the sentence that counts the competitors, because it is
			     what turns that count into something you can look at. Inside the blank
			     branch on purpose, unlike the transit panel below: an unsurveyed cell is
			     credited with no competitors either, so there would be nothing to switch
			     on. -->
			<RivalsPanel />
		{/if}

		<!-- All three of these sit OUTSIDE the blank branch on purpose. When the doors
		     around here open and how far the transit reaches are built from OSM, what
		     space costs is built from the MAPID property catalogue, and each survey has
		     its own coverage — so they are what this panel can still say about a cell
		     whose competitors nobody has counted, and for that cell they are the only
		     things there are to say.

		     The clock comes first of the three. It is the closest thing on this panel to
		     the sentence above it, which is about how much trade stands here: that one
		     counts the shops, this one says when they are open. -->
		<ActivityPanel />
		<PropertyPanel />
		<TransitPanel />

		<!-- Last, and outside the blank branch with the two above it. Everything before
		     this point is a catalogue's account of the place. This is the one section
		     built from somebody going there, and it is the only one that can still say
		     something about a catchment none of the catalogues has reached. -->
		<FieldPanel />
	</div>
{/if}

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.625rem;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.dio {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	/* THE SEAM BETWEEN SECTIONS
	   Five panels stacked in one column with an even gap between them read as one
	   scroll of text: the space inside a section was 8 px and the space between two of
	   them was 10, which is not a difference anybody sees. A rule is, and it costs a
	   pixel. Slightly more air above it than below, because the heading under it
	   belongs to what follows rather than to what it just ended.

	   Global because every one of these sections is another component's root element,
	   and drawn here rather than inside them because the seam is a fact about the
	   stack, not about any panel in it. */
	.dio > :global(section) {
		padding-top: 0.6875rem;
		border-top: 1px solid var(--separator);
	}

	/* ── the three figures ───────────────────────────────────────────────── */
	.stats {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 0.375rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.stats li {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		min-width: 0;
		padding: 0.4375rem 0.5rem 0.5rem;
		border-radius: var(--r-sm);
		background: var(--fill-1);
	}
	.stats .ico {
		/* The tint is the layer's colour on the map, where the subject has a layer.
		   Falling back to the label grey rather than to the accent: an untinted tile is
		   one with nothing to point at, not one being pointed at. */
		color: var(--tint, var(--label-2));
		margin-bottom: 0.125rem;
	}
	.stats .n {
		font-size: 1.125rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		line-height: 1.1;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	/* What the figure counts. A step under the figure and no further: at ten pixels the
	   quietest grey is not a caption, it is a smudge, and a number whose label cannot be
	   read is not a figure at all. */
	.stats .l {
		font-size: 0.625rem;
		line-height: 1.3;
		color: var(--label-2);
	}

	.stage {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--sky);
		border: 1px solid var(--separator);
	}
	/* A permanent marker: this scene is schematic, never a real building map. */
	.mark {
		position: absolute;
		left: 0.5rem;
		bottom: 0.5rem;
		font-size: 0.5625rem;
		letter-spacing: 0.04em;
		color: rgba(255, 255, 255, 0.82);
		background: rgba(0, 0, 0, 0.42);
		border-radius: 3px;
		padding: 0.1rem 0.35rem;
	}

	.read {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
	}

	.numbers summary {
		font-size: 0.75rem;
		color: var(--label-3);
		cursor: pointer;
	}
	.numbers summary:hover {
		color: var(--label-2);
	}
	.numbers dl {
		margin: 0.625rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.numbers dl :global(div) {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3125rem 0;
		border-bottom: 1px solid var(--separator);
		font-size: 0.75rem;
	}
	.numbers dt {
		color: var(--label-3);
	}
	.numbers dd {
		margin: 0;
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}
	.prov {
		margin-top: 0.5rem;
		font-size: 0.625rem;
		line-height: 1.45;
		color: var(--label-3);
	}
</style>
