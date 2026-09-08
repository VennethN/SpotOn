<script lang="ts">
	/**
	 * One real catchment as a model, turning slowly: the landing page's look inside.
	 *
	 * The two stages above it are composed. The street block at the top stands for the
	 * product and the grid stands for how to read one, and each says so in its mark.
	 * This one is a place: a catchment in the business district, chosen for its towers
	 * (`+page.server` says why), drawn from the basemap's own tiles by the same reader
	 * the app uses, with the stops it reaches standing on it where they stand and the
	 * point the range is measured from marked at its centre, as in the app. The mark on
	 * it is the app's own, because the four things it can say are the same four.
	 *
	 * It is shown WHOLE: the round disc on its base, the page around it, and not a
	 * window onto a block of it. A block cut square is a picture of a city, and a disc
	 * with an edge is a thing, which is what this section says a catchment can be.
	 *
	 * It turns while it is looked at. The rate eases in when the section comes into view
	 * and eases out when it leaves, and a hand on it turns it one to one and throws it,
	 * which is what `Spinner` is for. Nothing else on this page moves on its own, and
	 * this does because a model seen from one side only is a picture, and from all
	 * sides is an object.
	 *
	 * It reads the basemap the PUBLIC configuration allows: MAPID's when a public key is
	 * set, the open one otherwise. The Map Service key the app is handed on sign-in is
	 * not baked into a static page anybody can read.
	 */
	import { base } from '$app/paths';
	import AreaScene from '$lib/components/ui/AreaScene.svelte';
	import { jakartaHour, jakartaNow } from '$lib/domain/activity';
	import { areaKeyOf, parseRoutes } from '$lib/domain/basemap';
	import { capturedStops, parseStops, type Stop } from '$lib/domain/transit';
	import { basemapTilesFor } from '$lib/map/basemap';
	import { AreaReader } from '$lib/state/area';
	import { copy } from '$lib/state/lang.svelte';
	import { localMetres } from '$lib/utils/geo';
	import { Spinner } from '$lib/utils/motion.svelte';
	import type { AreaGeometry, AreaMarks } from '$lib/types';

	interface Props {
		/** The cell on show: where it is, its own boundary, and the count it is captioned with. */
		cell: {
			name: string;
			lat: number;
			lon: number;
			boundary: [number, number][];
			businesses: number;
		};
		/** The walking radius the grid was built with, in metres. */
		radius: number;
	}
	let { cell, radius }: Props = $props();
	const c = $derived(copy());

	/** The far end of the camera track: the whole disc, edge and base and all. */
	const CAMERA_T = 0;
	/** One turn every forty seconds: slow enough to be looked at, fast enough to be seen moving. */
	const DRIFT = -(Math.PI * 2) / 40;

	let host = $state<HTMLElement | null>(null);
	let geometry = $state.raw<AreaGeometry | null>(null);
	let status = $state<'reading' | 'ready' | 'failed' | 'none'>('reading');
	let stops = $state.raw<Omit<Stop, 'distance'>[]>([]);
	let asked = false;

	const centre = $derived({ lat: cell.lat, lon: cell.lon });
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

	/**
	 * Read when the section comes near, and not before: a few tiles and the stop file are
	 * nothing to ask of a reader who scrolled this far, and everything to ask of one who
	 * did not. Once, whatever the outcome, so a failure is said rather than retried.
	 */
	async function read() {
		if (asked) return;
		asked = true;
		try {
			const json = (path: string) =>
				fetch(`${base}${path}`)
					.then((res) => (res.ok ? res.json() : null))
					.catch(() => null);
			const [basemap, routes, stopFile] = await Promise.all([
				basemapTilesFor('light'),
				json('/data/routes.json'),
				json('/data/stops.json')
			]);
			if (stopFile) stops = parseStops(stopFile);
			if (!basemap) {
				status = 'none';
				return;
			}
			geometry = await new AreaReader().read(
				basemap,
				centre,
				radius,
				routes ? parseRoutes(routes) : [],
				areaKeyOf(centre, radius, basemap)
			);
			status = 'ready';
		} catch {
			status = 'failed';
		}
	}

	$effect(() => {
		if (!host) return;
		const el = host;
		// Two watchers with two jobs: one reads early, a screen ahead, so the model is
		// there by the time the section is. The other turns it while it is actually on
		// screen, and lets it come to rest when it is not.
		const near = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) void read();
			},
			{ rootMargin: '600px 0px' }
		);
		const seen = new IntersectionObserver(
			([entry]) => spinner.drift(entry.isIntersecting ? DRIFT : 0),
			{ threshold: 0.2 }
		);
		near.observe(el);
		seen.observe(el);
		return () => {
			near.disconnect();
			seen.disconnect();
			spinner.drift(0);
		};
	});
</script>

<figure class="model-stage" bind:this={host}>
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
		<span class="mark">{c.app.model[status]}</span>
		<span class="hint" aria-hidden="true">{c.model.hint}</span>
	</div>
	<figcaption>
		<p>{c.model.caption(cell.name, cell.businesses)}</p>
	</figcaption>
</figure>

<style>
	.model-stage {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	/* No frame of its own, unlike the grid above it: the grid is a drawing and wants a
	   recessed ground, and this is an object, which wants the panel it stands on and
	   nothing drawn around it. The box only gives the model its room, squarer than the
	   grid's because a disc is round. */
	.frame {
		position: relative;
		aspect-ratio: 3 / 2;
	}
	/* The same mark the model wears in the app: where it came from, or why it is not
	   here yet. In the panel's own quiet ink, because they stand on the panel and not on
	   the model. */
	.mark,
	.hint {
		position: absolute;
		bottom: 0;
		font-size: 0.625rem;
		letter-spacing: 0.04em;
		color: var(--label-3);
	}
	.mark {
		left: 0;
	}
	.hint {
		right: 0;
	}
	figcaption {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--label-2);
	}
	figcaption p {
		margin: 0;
	}
	@media (max-width: 720px) {
		.frame {
			aspect-ratio: 1;
		}
	}
</style>
