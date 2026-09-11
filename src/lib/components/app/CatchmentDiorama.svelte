<script lang="ts">
	/**
	 * The selected area, in one screen: a model of it, one sentence, and six figures.
	 *
	 * WHAT CHANGED, AND WHY
	 *
	 * This card used to be the whole account of a catchment stacked in one column: three
	 * tiles, a sentence, a fold holding every figure and the score's arithmetic, then a
	 * competitor switch, a chart of the week over seven day tabs, a price with its rank
	 * and every unit behind it, a transit list, and four field surveys with a photograph
	 * strip. Every one of those earns its place. All of them at once is a scroll nobody
	 * reads, and a reader comparing two streets was made to read a chart before they
	 * could find out what space costs.
	 *
	 * So the card answers the first question only: what is here. Six rows, each a glyph,
	 * a name and one figure, which is what somebody sizing up a place actually reads.
	 * The section in full is one tap away and takes the whole panel when it opens
	 * (`PanelDetail`), which is the same move the field records already made — a receipt
	 * covers the panel rather than expanding a list under the reader's thumb.
	 *
	 * NOTHING WAS DELETED IN THE MOVE
	 *
	 * The sections are the same components, unchanged, with their own headings, their own
	 * map switches and their own fine print. What went is the three tiles, whose figures
	 * are now in the sentence and in the rows, and the "full figures" fold, which became
	 * `ScorePanel` so the score has a section like everything else.
	 *
	 * EVERY FIGURE IN A ROW IS READ THE WAY ITS SECTION READS IT
	 *
	 * The summary calls the same domain functions the panels call — `readHours`,
	 * `readCost`, `stopTotal` — rather than counting anything for itself. A summary that
	 * did its own arithmetic would be a second opinion about the same street, and the
	 * day the two disagreed there would be no way to tell which was right.
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
	 * so, wherever those were not counted.
	 */
	import ActivityPanel from '$lib/components/app/ActivityPanel.svelte';
	import FieldPanel from '$lib/components/app/FieldPanel.svelte';
	import Glyph, { type GlyphName } from '$lib/components/ui/Glyph.svelte';
	import PanelDetail from '$lib/components/ui/PanelDetail.svelte';
	import PropertyPanel from '$lib/components/app/PropertyPanel.svelte';
	import RivalsPanel from '$lib/components/app/RivalsPanel.svelte';
	import ScorePanel from '$lib/components/app/ScorePanel.svelte';
	import CatchmentScene from '$lib/components/ui/CatchmentScene.svelte';
	import TransitPanel from '$lib/components/app/TransitPanel.svelte';
	import { jakartaNow, weekProfile } from '$lib/domain/activity';
	import { readCost } from '$lib/domain/cost';
	import { lastRecorded, totalRecorded } from '$lib/domain/field';
	import { countStops, railTotal, stopTotal } from '$lib/domain/transit';
	import { daylightAt, localHour } from '$lib/scene/daylight';
	import { getAppState } from '$lib/state/app.svelte';
	import { tick } from 'svelte';
	import { categoryNames } from '$lib/domain/narrate';
	import { copy } from '$lib/state/lang.svelte';
	import { num } from '$lib/utils/format';
	import { scrollerOf } from '$lib/utils/dom';

	/**
	 * This panel is far smaller than the landing page's stage, so its camera is
	 * pulled in: at a frame ±340 px wide, the full span shrinks the cafe and the
	 * rental lot until neither of them reads.
	 */
	const CAMERA_T = 0.88;

	/** Which sections the card can open. The order is the order of the rows. */
	type SectionKey = 'score' | 'rivals' | 'hours' | 'cost' | 'transit' | 'field';

	interface SummaryRow {
		key: SectionKey;
		icon: GlyphName;
		/** The name of the section, which is the SAME string its own heading carries.
		    A row that opened a section called something else would be a different
		    promise from the one it kept. */
		title: string;
		/** The one figure, or none where the section has nothing counted to lead with. */
		value: string | null;
		/** What the figure is of, in the fewest words that still say it. */
		caption: string;
	}

	const app = getAppState();
	const c = $derived(copy());
	const row = $derived(app.selected);
	/* The grid's cell rather than the scored row. What space costs, when the doors open,
	   what the place reaches and who has walked it are all counted without anybody
	   naming a business type, so they are here on the first frame and on cells the
	   active category has no score for. */
	const cell = $derived(app.selectedCell);
	const radius = $derived(app.weights.radius);
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
	 * The card still has plenty to say — how busy it is, what it captures, what is on
	 * the market — and one thing it must not say, which is a score. The competitor row
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

	/* ── what each row leads with ──────────────────────────────────────────────
	   Every one of these is read through the same function its section reads it
	   through, so the summary and the section cannot come apart. */

	/** What was counted about opening hours around the point the range is measured
	    from. Taken from the app so this row, the section it opens and the model behind
	    it quote the same denominator. */
	const hours = $derived(app.hoursReading);
	/** The range is measured from a place, so the rows lead with that place's figures
	    wherever there is one to lead with. */
	const fromPlace = $derived(app.reachIsPlace);
	const minReadable = $derived(app.meta?.hours?.minReadable ?? 0);
	/**
	 * Jakarta's clock, ticking, because the row it feeds is a claim about right now.
	 *
	 * Read once at mount it would be right for a minute and then quietly wrong for as
	 * long as the tab stayed open. `ActivityPanel` keeps its own for the same reason:
	 * the two are never on screen together, since opening that section covers this one.
	 */
	let clock = $state(new Date());
	$effect(() => {
		const tick = setInterval(() => (clock = new Date()), 60_000);
		return () => clearInterval(tick);
	});
	const jakarta = $derived(jakartaNow(clock));
	/* The week the section draws, kept apart from the clock so a minute passing reads a
	   number out of it rather than rebuilding it. */
	const profile = $derived(weekProfile(app.selectedOpen));
	/** How many of the doors counted here are open in Jakarta at this minute. */
	const openNow = $derived(profile[jakarta.day]?.[jakarta.hour] ?? 0);

	const cost = $derived(cell ? readCost(cell, app.priceLadder, radius) : null);

	/**
	 * The competitor figure this row leads with, which is the one its section leads with.
	 *
	 * The dots on the map wherever there are dots, because the row is called "competitors
	 * on the map" and `RivalsPanel` counts exactly that. It used to lead with the scored
	 * row's `osm` instead, and the two agreed closely enough to go unnoticed while both
	 * were counted from the cell centre. They do not agree once the range is measured
	 * from a place: the count that moved the score was taken over the catchment, the dots
	 * were captured around the doorway, and the card would have printed one of them
	 * directly under a map badge showing the other.
	 *
	 * The grid's count is the fallback, and it is the right one in every case that
	 * reaches it: with no positions to draw (OSM, or a point file that failed) the
	 * section explains the absence and the count in the card is the only figure either
	 * of them has, and while the file is still in the air an empty capture is not a
	 * finding. The score's own competitor count is stated in the score section, where it
	 * is labelled as the score's.
	 */
	const rivals = $derived(
		app.poisUnavailable || app.poisLoading ? (row?.osm ?? 0) : app.selectedPois.length
	);

	/* The same counts the transit section leads with, read the same way: off the grid
	   while the range is the cell's, off the captured list once it is a place's. A row
	   that opened a section showing a different number would be the summary doing its
	   own arithmetic, which is the one thing this card does not do. */
	const transit = $derived(
		fromPlace ? countStops(app.selectedStops) : (cell?.transit ?? { mrt: 0, krl: 0, lrt: 0, brt: 0 })
	);
	const nodes = $derived(stopTotal(transit));
	const rail = $derived(railTotal(transit));
	const bus = $derived(transit.brt);

	const fieldStats = $derived(cell?.field ?? null);
	const fieldLast = $derived(lastRecorded(app.selectedField));

	/**
	 * The rows, in the order the card used to stack the sections in.
	 *
	 * A section that renders nothing gets no row: the hours section draws nothing at all
	 * on a grid that has never been through `join-hours.mjs`, and a row leading into an
	 * empty room is worse than no row. Everything else keeps its row even when the answer
	 * is "nothing here", because "nobody has walked this street" is worth knowing and a
	 * section that silently disappears reads as a card that failed.
	 */
	const rows = $derived.by<SummaryRow[]>(() => {
		if (!row || !cell) return [];
		const out: SummaryRow[] = [];

		if (!blank) {
			out.push({
				key: 'score',
				icon: 'score',
				title: c.mood.rows.score,
				// No figure: the card's own header already sets the score in full, and the
				// same number twice on one screen is what this redesign is removing.
				value: null,
				caption: noType ? c.panel.scoreAsk : c.panel.scoreCap
			});
			if (!noType) {
				out.push({
					key: 'rivals',
					icon: 'rivals',
					title: c.mood.rivalsOnMap,
					value: num(rivals),
					caption: c.panel.rivalsCap(catMany)
				});
			}
		}

		if (hours) {
			/* Waiting comes first once the range is measured from a place: nothing has
			   been counted there until `hours.json` lands, so an empty capture below the
			   threshold would report a thin street rather than a request in flight. */
			const waiting = app.hoursLoading || app.openPlacesFailed;
			const thin = !waiting && hours.readable < minReadable;
			out.push({
				key: 'hours',
				icon: 'hours',
				title: fromPlace ? c.activity.titlePlace : c.activity.title,
				value: thin || waiting ? null : num(openNow),
				caption: app.hoursLoading
					? c.panel.loading
					: app.openPlacesFailed
						? c.panel.failed
						: thin
							? c.panel.hoursThin
							: c.panel.hoursNow(hours.readable)
			});
		}

		if (cost) {
			out.push({
				key: 'cost',
				icon: 'price',
				title: c.property.title,
				value: cost.price === null ? null : c.property.priceValue(cost.price),
				// The silences told apart, as the section itself tells them apart. A city
				// the catalogue has never read is not a street with nothing on it.
				caption:
					cost.price !== null
						? c.panel.costCap(cost.units)
						: cost.absence === 'uncovered'
							? c.panel.costUnread
							: cost.units > 0
								? c.panel.costUnits(cost.units)
								: c.panel.costNone
			});
		}

		/* Measured from a place there is nothing to count until `stops.json` lands, and a
		   zero captioned "none within walking range" would report an empty street made
		   out of a request still in flight. On a cell the counts are on the grid, so
		   neither state is reachable and the row reads exactly as it always did. */
		const stopsWaiting = fromPlace && app.stops === null && !app.stopsFailed;
		const stopsLost = fromPlace && app.stopsFailed;
		out.push({
			key: 'transit',
			icon: 'transit',
			title: fromPlace ? c.mood.transitPlace : c.mood.transit,
			value: stopsWaiting || stopsLost ? null : num(nodes),
			caption: stopsWaiting
				? c.panel.loading
				: stopsLost
					? c.panel.failed
					: nodes > 0
						? c.mood.transitCountSplit(rail, bus)
						: c.panel.transitNone
		});

		/* The records are fetched, the counts are not. While the list is in the air, or
		   after it failed, the figure comes off the grid instead of off an empty array,
		   which is the same fallback the section itself makes and the difference between
		   "nobody has been here" and "the list has not arrived". */
		const settled = fieldStats && !app.fieldFailed && !app.fieldLoading;
		out.push({
			key: 'field',
			icon: 'field',
			title: c.field.title,
			value: !fieldStats
				? null
				: num(settled ? app.selectedField.length : totalRecorded(fieldStats)),
			caption: !fieldStats
				? c.panel.fieldNone
				: app.fieldFailed
					? c.panel.failed
					: app.fieldLoading
						? c.panel.loading
						: fieldLast
							? c.field.last(c.field.day(fieldLast))
							: c.panel.fieldNone
		});

		return out;
	});

	/** The section standing under the model, or none. */
	let opened = $state<SectionKey | null>(null);

	/**
	 * WHETHER THERE IS ROOM, not whether a section is open.
	 *
	 * The model gives ground for a section so the section does not start below the
	 * fold. Tied to "a section is open" alone it gave ground on a tall panel too, where
	 * the whole section already fitted underneath a full sized model, and every tap on
	 * a row was answered by the picture jumping to a third of its height for no gain.
	 *
	 * So the panel is measured. The model letterboxes only when a 4:3 one would take
	 * more of the visible panel than `MODEL_SHARE`, which is about where the rows below
	 * it start being pushed out of sight.
	 */
	const MODEL_SHARE = 0.42;
	let dio = $state<HTMLElement | null>(null);
	let room = $state(0);
	let stageWidth = $state(0);

	/**
	 * How much of the panel can actually be seen, which is not how tall it is.
	 *
	 * The sheet on a narrow screen is a full height box slid down the viewport, so its
	 * own height is the whole screen at every detent and reads the same whether a
	 * third of it is showing or all of it. What is left inside the viewport is the
	 * figure that decides whether a section has room, so that is what is measured.
	 */
	function measure() {
		const el = dio;
		if (!el) return;
		const box = scrollerOf(el);
		const r = (box ?? el).getBoundingClientRect();
		room = box
			? Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
			: window.innerHeight;
		stageWidth = el.clientWidth;
	}

	$effect(() => {
		const el = dio;
		if (!el) return;
		measure();
		/* `el` is observed for its width. Its height changes when the model resizes and
		   nothing below reads that height, so this cannot chase its own tail. */
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		const box = scrollerOf(el);
		if (box) ro.observe(box);
		window.addEventListener('resize', measure);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

	/* The sheet moves by transform, and a transform is not a resize: dragging it to
	   another detent tells the observer above nothing. Opening a section is the moment
	   the figure is needed, so it is taken again then. */
	$effect(() => {
		void opened;
		measure();
	});

	/** A full sized model would crowd the section standing under it. */
	const cramped = $derived(room > 0 && stageWidth * 0.75 > room * MODEL_SHARE);
	const openedTitle = $derived(rows.find((r) => r.key === opened)?.title ?? '');

	/**
	 * The rows themselves, so closing a section can hand focus back to the one that
	 * opened it.
	 *
	 * Held by key rather than as the clicked element. The section stands WHERE the rows
	 * stood, so the row that was clicked is gone by the time there is anything to go
	 * back to, and focusing a detached button drops focus to the document instead. These
	 * are the rows that come back.
	 */
	let rowEls = $state<Partial<Record<SectionKey, HTMLButtonElement>>>({});

	function open(key: SectionKey) {
		opened = key;
	}
	async function close() {
		const was = opened;
		opened = null;
		await tick();
		if (was) rowEls[was]?.focus({ preventScroll: true });
	}

	/* A section belongs to the cell it was opened from. Left standing across a change of
	   selection it would show one street's chart under another street's name.

	   Keyed on the id, not on the row object. Loading a business type's columns rebuilds
	   every row on the grid, so the selected cell arrives as a new object with the same
	   id, and watching the object shut the open section every time somebody asked Tapak
	   a question. */
	$effect(() => {
		void app.selectedId;
		opened = null;
	});

	/* And it belongs to a row. Naming a business type mid-read can take the competitor
	   row away while its section is open, and a section with no way back to the row that
	   opened it is a room with the door bricked up.

	   Only ever on a list that HAS rows. Loading a business type's columns empties the
	   scored row for a frame, which empties this list, and without the guard that frame
	   shut every open section the moment anybody asked Tapak anything. */
	$effect(() => {
		if (opened && rows.length > 0 && !rows.some((r) => r.key === opened)) close();
	});
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
	<div class="dio" bind:this={dio}>
		<!-- The model stays put while a section is read, and gives ground for it WHEN the
		     ground is needed. On a phone the sheet can be about half the screen and a 4:3
		     model fills most of that, so a section opened underneath one would start below
		     the fold. Letterboxed it is still the place, still tappable into, and no longer
		     the whole panel. On a panel with the height to hold both it does not move at
		     all: see `cramped`. -->
		<div
			class="stage"
			class:reading={opened !== null && cramped}
			style:--sky={day.skyHorizon}
		>
			<CatchmentScene
				{hour}
				density={busyness}
				category={app.categories[0]}
				cameraT={CAMERA_T}
				nodata={blank}
				rivals={row.osm}
				vacancies={row.units}
				transit={cell?.transit}
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

		<!-- Everything under the model is one of two things: the summary, or the one
		     section the reader opened from it. The model and the head above stay put
		     through both, so the card never stops saying which place this is, and on a
		     phone the sheet's grip is never covered by what it opened. -->
		{#if opened}
			<PanelDetail title={openedTitle} onclose={close}>
				{#if opened === 'score'}
					<ScorePanel />
				{:else if opened === 'rivals'}
					<RivalsPanel />
				{:else if opened === 'hours'}
					<ActivityPanel />
				{:else if opened === 'cost'}
					<PropertyPanel />
				{:else if opened === 'transit'}
					<TransitPanel />
				{:else}
					<FieldPanel />
				{/if}
			</PanelDetail>
		{:else}
			<!-- The one sentence. It carries the count of trade standing here and the word
			     for how busy that makes it, which is the reading every row below is detail
			     underneath. On an unsurveyed cell it is replaced rather than filled in. -->
			<p class="read">{blank ? c.mood.nodata : c.mood.reading(row.density, busyWord)}</p>

			<!-- ── the six figures ────────────────────────────────────────────────
			     One row per section: the glyph for finding it again, the name, the figure,
			     and what the figure is of. Each opens its section in the space below. -->
			<ul class="rows">
				{#each rows as r (r.key)}
					<li>
						<!-- No aria-label on the row. One would replace everything inside it,
						     which is the name, the figure and what the figure is of, with a
						     single phrase saying only that the row opens. A button announces
						     that much by being a button. -->
						<button
						bind:this={rowEls[r.key]}
						type="button"
						class="row"
						onclick={() => open(r.key)}
					>
							<span class="ico"><Glyph icon={r.icon} size={17} /></span>
							<span class="txt">
								<!-- The name and the figure share the top line, and the line under
								     them runs the full width of the row. The figure used to stand in
								     a column of its own, which left the name about a hundred and
								     thirty pixels: "Harga tempat usaha" broke across two lines and
								     its caption across three, and that one row stood twice as tall
								     as the five around it. -->
								<span class="top">
									<span class="lbl">{r.title}</span>
									{#if r.value !== null}
										<span class="val">{r.value}</span>
									{/if}
								</span>
								<span class="cap">{r.caption}</span>
							</span>
							<span class="chev" aria-hidden="true"><Glyph icon="chevron" size={14} /></span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
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
		gap: 0.75rem;
	}

	.stage {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: var(--r-md);
		overflow: hidden;
		background: var(--sky);
		border: 1px solid var(--separator);
	}
	/* Not animated on purpose: the scene inside redraws on every resize, and running
	   that down a 300 ms curve costs more than the move is worth. */
	.stage.reading {
		aspect-ratio: 16 / 5;
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

	/* ── the rows ────────────────────────────────────────────────────────── */
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		/* A hairline between rows rather than a gap: six separate cards in a column read
		   as six things, and this is one list of one place. */
		gap: 0;
	}
	.rows li + li {
		border-top: 1px solid var(--separator);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border: 0;
		border-radius: var(--r-sm);
		padding: 0.5rem 0.375rem;
		background: transparent;
		font: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
		transition: background-color 140ms ease-out;
	}
	.row:hover {
		background: var(--fill-1);
	}
	.row:active {
		background: var(--fill-2);
	}
	.row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	/* The same tile the section headings wear, so the row and the heading it leads to
	   are visibly one mark.

	   Drawn at a size that survives a glance. The whole point of a glyph here is that
	   the second visit to this card is navigation rather than reading, and a mark small
	   enough to have to be looked at is doing the job of a label without the words. */
	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--r-sm);
		background: var(--fill-1);
		color: var(--label-1);
	}
	.row:hover .ico {
		background: var(--fill-2);
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.top {
		display: flex;
		align-items: baseline;
		/* Tight, because the longest pairing in the panel is a hair over the width it
		   has: "Harga tempat usaha" beside "Rp 51,9 jt" at 21 rem. It fits, and a wider
		   gap here is what put the name on two lines. A name that does wrap still reads,
		   so this is a fit worth having rather than one worth truncating a heading for. */
		gap: 0.4375rem;
	}
	.lbl {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		font-weight: 550;
		letter-spacing: -0.005em;
		color: var(--label-1);
	}
	/* What the figure is of. One step under the name and no further: at ten pixels the
	   quietest grey is not a caption, it is a smudge. */
	.cap {
		font-size: 0.6875rem;
		line-height: 1.35;
		color: var(--label-3);
	}
	.val {
		flex: none;
		font-size: 0.9375rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--label-1);
		white-space: nowrap;
	}
	.chev {
		flex: none;
		display: grid;
		place-items: center;
		color: var(--label-3);
		transition: transform 140ms ease-out;
	}
	.row:hover .chev {
		transform: translateX(2px);
		color: var(--label-2);
	}
</style>
