<script lang="ts">
	/**
	 * A full-bleed map with floating chrome.
	 *
	 * Two acts. First: one question box in the middle of the screen, the map dimmed
	 * behind it. Second: the moment something is asked, that box flies right and
	 * becomes the conversation panel, the dimming lifts, and the map takes over.
	 *
	 * The old dashboard layout — left rail, right rail, table dock, settings drawer,
	 * a bar of thirteen category buttons — is gone. Three surfaces remain: the map,
	 * Tapak, and a card for the selected area that only exists when an area is
	 * actually selected.
	 */
	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import AskLauncher from '$lib/components/app/AskLauncher.svelte';
	import CategoryChips from '$lib/components/app/CategoryChips.svelte';
	import MapChrome from '$lib/components/app/MapChrome.svelte';
	import MapLegend from '$lib/components/app/MapLegend.svelte';
	import MapView from '$lib/components/app/MapView.svelte';
	import MapControls from '$lib/components/app/MapControls.svelte';
	import SpotCard from '$lib/components/app/SpotCard.svelte';
	import UnitCard from '$lib/components/app/UnitCard.svelte';
	import UnitList from '$lib/components/app/UnitList.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import TapakPanel from '$lib/components/app/TapakPanel.svelte';
	import TapakToast from '$lib/components/app/TapakToast.svelte';
	import { setAppState } from '$lib/state/app.svelte';
	import { copy, lang } from '$lib/state/lang.svelte';
	import { Tapak } from '$lib/state/tapak.svelte';
	import { prefersReducedMotion } from '$lib/utils/motion.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The initial data is deliberately fetched once; all state after that lives in AppState.
	const app = setAppState(
		untrack(() => data.catchments),
		untrack(() => data.meta)
	);
	// Tapak is held by the page: the centre question box and the right-hand panel are
	// two forms of one conversation, not two conversations.
	const tapak = new Tapak(app);
	const c = $derived(copy());

	/**
	 * Act two begins as soon as there is any turn beyond the opening greeting: the
	 * user asked, or tapped one of the options.
	 *
	 * Or said they would rather not. Picking an area on the map used to start it too,
	 * back when doing that filed a turn, but the map is behind the scrim until this
	 * flips, so nobody could reach it that way in the first place. `skipped` is that
	 * door, and it is one-way: once the map is open, the question box has nothing left
	 * to do that the panel does not do better.
	 */
	let skipped = $state(false);
	const started = $derived(tapak.turns.length > 1 || skipped);

	/** The compact layout uses a draggable sheet. */
	let compact = $state(false);
	let sheetIndex = $state(1);

	onMount(() => {
		const stopTheme = app.initTheme();
		const mq = window.matchMedia('(max-width: 1023px)');
		compact = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (compact = e.matches);
		mq.addEventListener('change', onChange);
		tapak.greet();
		return () => {
			stopTheme();
			mq.removeEventListener('change', onChange);
		};
	});

	/* Each turn stores a finished sentence rather than a key, so an old conversation
	   does not switch language with it. Rather than leaving two languages in one
	   thread, the thread restarts: it is short, and the opening greeting is the same. */
	let lastLang = lang();
	$effect(() => {
		const now = lang();
		if (now === lastLang) return;
		lastLang = now;
		tapak.reset();
	});

	// Tapak turns to look when the user picks an area on the map themselves.
	$effect(() => {
		void app.selectedId;
		tapak.remarkOnSelection();
	});

	// On a compact screen, selecting an area raises the sheet to its middle detent:
	// the card lives inside the sheet, so leaving the sheet shut makes the user's
	// choice look like it did nothing.
	$effect(() => {
		if (app.selectedId && untrack(() => compact && sheetIndex === 0)) sheetIndex = 1;
	});

	/**
	 * The question box does not simply vanish: it leaves towards the right, towards
	 * where the panel is about to stand. The motion in between points at the
	 * destination, so the eye knows where to look before the panel gets there.
	 *
	 * Deliberately not a FLIP crossfade: the two surfaces are different widths, and
	 * scaling one to the size of the other scales its type with it — giant blurred
	 * letters halfway across. Each moves at its own size instead.
	 */
	function leaveForPanel(_node: Element) {
		const reduced = prefersReducedMotion();
		return {
			duration: reduced ? 120 : 340,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`opacity: ${t};` +
				(reduced ? '' : `transform: translate3d(${u * 120}px, 0, 0) scale(${1 - 0.06 * u});`)
		};
	}

	/** Arrives from the direction the question box left in, anchored on its own corner. */
	function arriveFromCentre(_node: Element) {
		const reduced = prefersReducedMotion();
		return {
			duration: reduced ? 120 : 400,
			delay: reduced ? 0 : 140,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`transform-origin: top right;` +
				`opacity: ${t};` +
				(reduced ? '' : `transform: translate3d(${-u * 56}px, 0, 0) scale(${0.96 + 0.04 * t});`)
		};
	}

	/** Enters from the corner it belongs to, and leaves the same way. */
	function materialize(_node: Element, { origin = 'bottom left' } = {}) {
		const reduced = prefersReducedMotion();
		return {
			duration: reduced ? 120 : 380,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`transform-origin: ${origin};` +
				`opacity: ${t};` +
				(reduced ? '' : `transform: translate3d(0, ${u * 14}px, 0) scale(${0.94 + 0.06 * t});`)
		};
	}
</script>

<svelte:head>
	<title>{c.meta.appTitle}</title>
</svelte:head>

<div class="app">
	<MapView />
	<MapChrome />
	<!-- Both wait for the map to be reachable, and the chips wait for the same reason
	     the controls do: until something has been asked there is no answer for them to
	     report, and a chip reading "Kopi" over an unasked question claims the map has
	     scored a business type nobody named. Once the launcher has gone the map really
	     is scoring one, whether it was answered or simply skipped past, and then saying
	     which is the honest thing. -->
	{#if started}
		<CategoryChips />
		<MapControls />
	{/if}

	{#if !started}
		<!-- A thin dimming: the map is pushed back while the first question is still
		     unasked, then released the moment the conversation starts. Not a barrier,
		     just depth. -->
		<div class="scrim" transition:fade={{ duration: 320 }} aria-hidden="true"></div>
		<div class="stage" out:leaveForPanel>
			<AskLauncher {tapak} meta={data.meta} onskip={() => (skipped = true)} />
		</div>
	{:else if compact}
		<!-- Same rule as the wide layout below: the legend explains the colours, and
		     once an area is picked the answer about that area is the more specific
		     reply to the same question. Here it also clears the top-left corner, which
		     is where Tapak's remark about that area arrives. -->
		{#if !app.selectedId && app.pivot === 'cell'}
			<MapLegend />
		{/if}
		<!-- One sheet, always holding the conversation, with whatever the map is currently
		     pointing at stacked above it. Tapak does not take turns with the pivot: it is
		     the thing that can change the pivot, so a layout where choosing "per tempat"
		     closes the chat takes away the control that got you there. -->
		<Sheet bind:index={sheetIndex} detents={[0.12, 0.55, 0.94]}>
			{#if app.pivot === 'unit'}
				<div class="spot-inline" transition:materialize={{ origin: 'top center' }}>
					{#if app.selectedUnitId}
						<UnitCard />
					{:else}
						<UnitList />
					{/if}
				</div>
			{:else if app.selectedId}
				<div class="spot-inline" transition:materialize={{ origin: 'top center' }}>
					<SpotCard />
				</div>
			{/if}
			<TapakPanel {tapak} />
		</Sheet>
	{:else}
		<!-- Tapak is here in BOTH pivots. It is not a mode of the map; it is the thing
		     that can change the mode, so a control that replaced it would take away the
		     thing operating it. The pivot switch lives on the map, in `MapControls`. -->
		<aside class="guide material" aria-label={c.app.tapak} in:arriveFromCentre>
			<TapakPanel {tapak} />
		</aside>

		{#if app.pivot === 'unit'}
			<aside class="spot material" aria-label={c.units.title} transition:materialize>
				{#if app.selectedUnitId}
					<UnitCard />
				{:else}
					<UnitList />
				{/if}
			</aside>
		{:else if app.selectedId}
			<aside class="spot material" aria-label={c.app.mood} transition:materialize>
				<SpotCard />
			</aside>
		{:else}
			<MapLegend />
		{/if}
	{/if}

	<!-- Outside the three branches: what Tapak says about a picked area belongs to
	     the map, not to whichever surface happens to be open. It can only appear once
	     the map is reachable, which is after the launcher has gone. -->
	{#if started}
		<TapakToast {tapak} />
	{/if}
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: 6;
		background: color-mix(in srgb, var(--bg-base) 34%, transparent);
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
	}

	/* The question box sits slightly above the geometric centre: the eye reads the
	   middle of a screen as being a little higher than it actually is. */
	.stage {
		position: fixed;
		inset: 0;
		z-index: 7;
		display: grid;
		place-items: center;
		padding: 1.5rem 0.75rem calc(1.5rem + 6vh);
		pointer-events: none;
	}
	.stage > :global(*) {
		pointer-events: auto;
	}

	/* Tapak floats on the right and the map flows underneath. No scrim: this panel
	   runs alongside the map rather than blocking it.

	   Its height follows its contents rather than filling the column. A conversation
	   one greeting long must not leave a screen-tall empty box; the panel grows with
	   the thread up to the edge of the screen, and then the thread scrolls. */
	.guide {
		position: fixed;
		right: 0.75rem;
		top: 3.5rem;
		z-index: 6;
		width: 23rem;
		max-height: calc(100vh - 4.25rem);
		display: flex;
		flex-direction: column;
		padding: 0.875rem;
		border-radius: var(--r-xl);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
	}

	/* The area card takes the bottom-left corner, which is where the legend sits.
	   They are shown one at a time rather than stacked: the legend explains the
	   colours, and once a cell is picked the card is the more specific answer to the
	   same question. */
	.spot {
		position: fixed;
		left: 0.75rem;
		bottom: 2.25rem;
		z-index: 6;
		width: 21rem;
		max-height: calc(100vh - 6rem);
		overflow: auto;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem;
		border-radius: var(--r-xl);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		will-change: transform, opacity;
	}

	.spot-inline {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-bottom: 1rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--separator);
	}
</style>
