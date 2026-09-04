<script lang="ts">
	/**
	 * A model of the selected area, inside the app.
	 *
	 * Not an actual plan — this is a schematic. What comes from the data is its
	 * contents: how much trade stands in walking range (counted businesses), how many
	 * competing outlets there are, and how many units are genuinely on the market. An
	 * area whose city has not been surveyed shows empty, not filled in.
	 *
	 * THE CLOCK IS NOT ON THIS PANEL. It used to be the centre of it: a slider from
	 * midnight to midnight, a crowd that thickened towards noon, a sentence reading "at
	 * 20.06 it is fairly busy here, busiest around 12.00". Every one of those figures
	 * came out of a random number generator seeded with the cell id. So the hour came
	 * off, and what is left here is the reader's own clock lighting the model, which is
	 * a fact about them rather than a claim about the place.
	 *
	 * The hour is now a room of its own, one tap away, and it is a different thing from
	 * the one that was removed: `CatchmentZoom` scrubs the day over a crowd driven by
	 * the opening hours counted from OpenStreetMap, and holds the crowd still, saying
	 * so, wherever those were not counted. It is behind a button rather than in this
	 * card because a panel this size cannot hold a slider, a clock and a reading and
	 * still be the thumbnail the rest of the card reads against.
	 *
	 * The wording is deliberately plain: "how busy", not "demand index". The full
	 * figures are still there, one click below.
	 */
	import ActivityPanel from '$lib/components/app/ActivityPanel.svelte';
	import FieldPanel from '$lib/components/app/FieldPanel.svelte';
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

			<!-- Over the model rather than under it, because the model IS the thing it
			     opens: the same block, the whole screen, and the hour on a slider. -->
			<button type="button" class="enter" onclick={() => (app.zoomed = true)}>
				<svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true">
					<path
						d="M1.6 5.2V1.6h3.6M12.4 8.8v3.6H8.8M8.8 1.6h3.6v3.6M5.2 12.4H1.6V8.8"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>{c.zoom.open}</span>
			</button>
		</div>

		{#if blank}
			<p class="read">{c.mood.nodata}</p>
		{:else if noType}
			<!-- Every figure here is counted and none of them needs a business type. The
			     one sentence that would is left out rather than filled in with a blank. -->
			<p class="read">
				{c.mood.reading(row.density, busyWord)}
				{#if row.units > 0}
					{c.mood.listings(row.units)}
				{:else}
					{c.mood.noListings}
				{/if}
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
			<p class="read">
				{c.mood.reading(row.density, busyWord)}
				{c.mood.rivals(row.osm, catMany)}
				{#if row.units > 0}
					{c.mood.listings(row.units)}
				{:else}
					{c.mood.noListings}
				{/if}
			</p>

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
		gap: 0.625rem;
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

	/* Light on a dark scrim, like the schematic mark opposite it: the sky behind runs
	   from black to white with the reader's own hour, and a token from the theme would
	   be invisible at one end of it. */
	.enter {
		position: absolute;
		/* The opposite corner from the schematic mark. Side by side at the width of this
		   card the two overlap, and the one that loses is the mark saying this is not a
		   real site plan. */
		right: 0.5rem;
		top: 0.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.25rem 0.5rem;
		border: 0;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.42);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: rgba(255, 255, 255, 0.92);
		font: inherit;
		font-size: 0.6875rem;
		font-weight: 550;
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out;
	}
	.enter:hover {
		background: rgba(0, 0, 0, 0.62);
	}
	.enter:active {
		transform: scale(0.96);
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
