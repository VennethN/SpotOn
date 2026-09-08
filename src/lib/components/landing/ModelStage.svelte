<script lang="ts">
	/**
	 * Real catchments as models, one at a time, turning slowly: the landing page's look
	 * inside.
	 *
	 * The two stages above it are composed. The street block at the top stands for the
	 * product and the grid stands for how to read one, and each says so in its mark.
	 * This one is a place: a handful of cells the server chose by name, drawn from the
	 * basemap's own tiles by the same reader the app uses, with the stops each reaches
	 * standing on it where they stand. A pair of arrows pages through them, and the
	 * model is read for a cell the first time the reader arrives at it, then kept.
	 *
	 * It is shown WHOLE: the round disc on its base, the page around it, and not a
	 * window onto a block of it. A block cut square is a picture of a city, and a disc
	 * with an edge is a thing, which is what this section says a catchment can be.
	 *
	 * It turns while it is looked at. The rate eases in when the section comes into view
	 * and eases out when it leaves, and a hand on it turns it one to one and throws it,
	 * which is what `Spinner` is for. Nothing else on this page moves on its own, and
	 * this does because a model seen from one side only is a picture, and from all
	 * sides is an object. Paging does not stop the turn: the next place arrives already
	 * turning, on the same base, as if the disc had been swapped on a turntable.
	 *
	 * The only words on it are the place's name and, for a screen reader, what the
	 * arrows do. The app's model wears a mark saying where it came from, and this one
	 * does not: on the front page the section's lead has already said so, and a sentence
	 * on the object would be read instead of it.
	 *
	 * It reads the basemap the PUBLIC configuration allows: MAPID's when a public key is
	 * set, the open one otherwise. The Map Service key the app is handed on sign-in is
	 * not baked into a static page anybody can read.
	 */
	import { base } from '$app/paths';
	import AreaScene from '$lib/components/ui/AreaScene.svelte';
	import { jakartaHour, jakartaNow } from '$lib/domain/activity';
	import { areaKeyOf, parseRoutes, type RouteLine } from '$lib/domain/basemap';
	import { capturedStops, parseStops, type Stop } from '$lib/domain/transit';
	import { basemapTilesFor } from '$lib/map/basemap';
	import { AreaReader } from '$lib/state/area';
	import { copy } from '$lib/state/lang.svelte';
	import { localMetres } from '$lib/utils/geo';
	import { Spinner } from '$lib/utils/motion.svelte';
	import type { AreaGeometry, AreaMarks, BasemapTiles } from '$lib/types';

	/** A cell on show: where it is, and its own boundary. */
	interface Cell {
		name: string;
		lat: number;
		lon: number;
		boundary: [number, number][];
	}

	interface Props {
		/** The cells, in the order the arrows go through them. The first is what opens. */
		cells: Cell[];
		/** The walking radius the grid was built with, in metres. */
		radius: number;
	}
	let { cells, radius }: Props = $props();
	const c = $derived(copy());

	/** The far end of the camera track: the whole disc, edge and base and all. */
	const CAMERA_T = 0;
	/** One turn every forty seconds: slow enough to be looked at, fast enough to be seen moving. */
	const DRIFT = -(Math.PI * 2) / 40;

	let host = $state<HTMLElement | null>(null);
	let index = $state(0);
	const cell = $derived(cells[index]);
	const centre = $derived({ lat: cell.lat, lon: cell.lon });
	let geometry = $state.raw<AreaGeometry | null>(null);
	let stops = $state.raw<Omit<Stop, 'distance'>[]>([]);
	/** Whether the section has come near enough for anything to be fetched at all. */
	let near = $state(false);

	/* Jakarta's clock as the page opened, read once. A landing page is read top to
	   bottom in a few minutes, and a light that moved under the reader would be motion
	   with nothing to say. */
	const hour = jakartaHour();
	const day = jakartaNow().day;

	const spinner = new Spinner(0);
	$effect(() => () => spinner.destroy());

	const marks = $derived<AreaMarks>({
		boundary: cell.boundary.map(([lon, lat]) => localMetres(lat, lon, centre)),
		stops: capturedStops(centre, stops, radius).map((s) => ({
			...localMetres(s.lat, s.lon, centre),
			mode: s.mode
		})),
		rivals: [],
		units: [],
		field: [],
		doors: []
	});

	/* ── reading ─────────────────────────────────────────────────────────────
	   The basemap's tile sources, the corridors and the stop file are fetched once for
	   every cell, and each cell's model is read once and kept, so paging back to a place
	   is instant. A read that fails leaves its cell blank rather than being retried on
	   every arrow press. */
	const reader = new AreaReader();
	const models = new Map<string, Promise<AreaGeometry | null>>();
	let shared: Promise<{ basemap: BasemapTiles | null; routes: RouteLine[] }> | null = null;

	function common() {
		if (shared) return shared;
		const json = (path: string) =>
			fetch(`${base}${path}`)
				.then((res) => (res.ok ? res.json() : null))
				.catch(() => null);
		shared = Promise.all([basemapTilesFor('light'), json('/data/routes.json'), json('/data/stops.json')]).then(
			([basemap, routes, stopFile]) => {
				if (stopFile) stops = parseStops(stopFile);
				return { basemap, routes: routes ? parseRoutes(routes) : [] };
			}
		);
		return shared;
	}

	function model(of: Cell): Promise<AreaGeometry | null> {
		const held = models.get(of.name);
		if (held) return held;
		const at = { lat: of.lat, lon: of.lon };
		const read = common()
			.then(({ basemap, routes }) =>
				basemap ? reader.read(basemap, at, radius, routes, areaKeyOf(at, radius, basemap)) : null
			)
			.catch(() => null);
		models.set(of.name, read);
		return read;
	}

	/* The cell on show is read as soon as the section is near, and again whenever the
	   arrows move. The one after it is read in the background once this one is here, so
	   the next press does not wait. A result is only shown if it is still the cell on
	   show: a reader who presses twice quickly gets the second place, not the first. */
	$effect(() => {
		if (!near) return;
		const shown = cell;
		const following = cells[(index + 1) % cells.length];
		let live = true;
		geometry = null;
		model(shown).then((g) => {
			if (!live) return;
			geometry = g;
			if (following !== shown) void model(following);
		});
		return () => {
			live = false;
		};
	});

	function step(by: number) {
		index = (index + by + cells.length) % cells.length;
	}

	$effect(() => {
		if (!host) return;
		const el = host;
		// Two watchers with two jobs: one reads early, a screen ahead, so the model is
		// there by the time the section is. The other turns it while it is actually on
		// screen, and lets it come to rest when it is not.
		const soon = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) near = true;
			},
			{ rootMargin: '600px 0px' }
		);
		const seen = new IntersectionObserver(
			([entry]) => spinner.drift(entry.isIntersecting ? DRIFT : 0),
			{ threshold: 0.2 }
		);
		soon.observe(el);
		seen.observe(el);
		return () => {
			soon.disconnect();
			seen.disconnect();
			spinner.drift(0);
		};
	});
</script>

<div class="model-stage" bind:this={host}>
	<div class="frame">
		<AreaScene
			{hour}
			{day}
			cameraT={CAMERA_T}
			{radius}
			{geometry}
			{marks}
			{spinner}
			label={c.model.label(cell.name)}
		/>
		<h3 class="title">{cell.name}</h3>
		{#if cells.length > 1}
			<div class="pager">
				<button type="button" class="arrow" onclick={() => step(-1)} aria-label={c.model.prev}>
					<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
						<path d="M8.6 2.6L4.2 7l4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
				<span class="dots" aria-hidden="true">
					{#each cells as _, i (i)}
						<i class:on={i === index}></i>
					{/each}
				</span>
				<button type="button" class="arrow" onclick={() => step(1)} aria-label={c.model.next}>
					<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
						<path d="M5.4 2.6L9.8 7l-4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* No frame of its own, unlike the grid above it: the grid is a drawing and wants a
	   recessed ground, and this is an object, which wants the panel it stands on and
	   nothing drawn around it. The box only gives the model its room, squarer than the
	   grid's because a disc is round. */
	.frame {
		position: relative;
		aspect-ratio: 3 / 2;
	}
	/* The place's name, where a title goes. Over the model's empty top corner, which
	   the framing keeps clear on every screen. */
	.title {
		position: absolute;
		top: 0;
		left: 0;
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.125rem, 2.2vw, 1.5rem);
		font-weight: 620;
		letter-spacing: -0.02em;
		line-height: 1.1;
		color: var(--label-1);
		pointer-events: none;
	}
	.pager {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 999px;
		background: var(--fill-1);
		color: var(--label-1);
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			background-color 140ms ease-out;
	}
	.arrow:hover {
		background: var(--fill-2);
	}
	.arrow:active {
		transform: scale(0.94);
	}
	/* Which of the places is on show, without a word: one dot per place. */
	.dots {
		display: flex;
		gap: 0.3125rem;
	}
	.dots i {
		width: 0.3125rem;
		height: 0.3125rem;
		border-radius: 999px;
		background: var(--label-3);
		transition: background-color 140ms ease-out;
	}
	.dots i.on {
		background: var(--label-1);
	}
	@media (max-width: 720px) {
		.frame {
			aspect-ratio: 1;
		}
	}
</style>
