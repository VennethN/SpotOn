<script lang="ts" module>
	/**
	 * Every glyph the app draws, on one grid, at one stroke.
	 *
	 * `SectionHead` used to own these outright, and said why: passed in as markup they
	 * drift, and a row of icons at three sizes and two stroke weights stops reading as a
	 * set. That reasoning held right up until something other than a section heading
	 * wanted the same shape — the figures under the model, which are the same three
	 * things the sections below them talk about, and have to be recognisably so.
	 *
	 * So the drawing moved here and the rule stayed. Nobody passes markup; callers name a
	 * glyph. The stroke is corrected for the size it is drawn at, because a 1.3 unit
	 * stroke in a 16 unit box is 1.06 px at 13 px and 1.46 px at 18, and a heading whose
	 * icon is visibly lighter than the tile below it reads as a different family of mark.
	 */
	export type GlyphName =
		| 'price'
		| 'market'
		| 'units'
		| 'rivals'
		| 'transit'
		| 'field'
		| 'hours'
		| 'sign'
		| 'info'
		| 'close';

	/** The size the stroke weight below was drawn for. Every other size is scaled to it. */
	const BASE = 13;
	const STROKE = 1.3;
</script>

<script lang="ts">
	let { icon, size = BASE }: { icon: GlyphName; size?: number } = $props();
</script>

<svg
	viewBox="0 0 16 16"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width={(STROKE * BASE) / size}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if icon === 'price'}
		<!-- A price tag: what the space costs. -->
		<path d="M8.4 1.9H14v5.6l-6.5 6.5a1 1 0 0 1-1.4 0l-4.2-4.2a1 1 0 0 1 0-1.4Z" />
		<circle cx="11.1" cy="4.9" r="1.05" />
	{:else if icon === 'market'}
		<!-- An awning over a shopfront: trade standing on the street. -->
		<path d="M2 6.2h12v7.3H2Z" />
		<path d="M1.4 3.1h13.2L14 6.2H2Z" />
		<path d="M6.4 13.5V9.4h3.2v4.1" />
	{:else if icon === 'hours'}
		<!-- A clock: the hours the doors around here are open. -->
		<circle cx="8" cy="8" r="6.1" />
		<path d="M8 4.3V8l2.6 1.6" />
	{:else if icon === 'units'}
		<!-- A list of rows: the units, one by one. -->
		<path d="M2.4 4.4h11.2M2.4 8h11.2M2.4 11.6h7.4" />
	{:else if icon === 'sign'}
		<!-- A board on a post: a unit with a banner on it, being offered. -->
		<path d="M2.3 2.6h11.4v6.1H2.3Z" />
		<path d="M8 8.7v4.7M5.6 13.4h4.8" />
		<path d="M4.7 5.6h6.6" />
	{:else if icon === 'field'}
		<!-- A pinned note: somebody stood here and wrote this down. -->
		<path d="M4.2 2.4h7.6v11.2H4.2Z" />
		<path d="M6.3 5.6h3.4M6.3 8h3.4M6.3 10.4h2" />
	{:else if icon === 'rivals'}
		<!-- Two marks side by side: the competitors already there. -->
		<rect x="2.2" y="2.2" width="5" height="5" rx="0.6" />
		<rect x="8.8" y="8.8" width="5" height="5" rx="0.6" />
		<path d="M8.8 4.7h5M2.2 11.3h5" />
	{:else if icon === 'info'}
		<!-- The mark on the fine print: how the figure above was arrived at. -->
		<circle cx="8" cy="8" r="6.1" />
		<path d="M8 7.4v3.6" />
		<circle cx="8" cy="5.1" r="0.45" fill="currentColor" stroke="none" />
	{:else if icon === 'close'}
		<!-- A dismissal: put the detail view back down. -->
		<path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" />
	{:else}
		<!-- A carriage on a line: what is reachable from here. -->
		<rect x="4" y="1.9" width="8" height="9.4" rx="2" />
		<path d="M4 7.1h8M6.2 14.1l-1.4 0M11.2 14.1l-1.4 0M6.4 11.3 4.8 14.1M9.6 11.3l1.6 2.8" />
		<circle cx="6.4" cy="9.2" r="0.5" fill="currentColor" stroke="none" />
		<circle cx="9.6" cy="9.2" r="0.5" fill="currentColor" stroke="none" />
	{/if}
</svg>

<style>
	svg {
		display: block;
	}
</style>
