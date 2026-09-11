<script lang="ts">
	/**
	 * The shape of the page you are on your way to, while it is still on its way.
	 *
	 * Two destinations here are slow enough to need one, and both are slow for the same
	 * honest reason rather than through neglect. `/app` fetches the base grid before it
	 * can paint a single cell. `/account` reads that same grid on the server, projects
	 * all 562 catchments onto the page and counts the trade around each one. Neither is
	 * work that can be skipped, and until now neither was reported: a client-side
	 * navigation leaves the OLD page on screen with nothing moving, which for a second
	 * or two is indistinguishable from a link that did not take.
	 *
	 * So the destination's own layout is drawn in blocks, at the sizes the real thing
	 * will occupy, and the page arrives INTO its own outline rather than replacing a
	 * screen that belonged to somewhere else.
	 *
	 * WHAT IT DOES NOT DO. It is not a progress bar and it carries no percentage,
	 * because nothing here could honestly be one: the grid either has arrived or has
	 * not. That is the rule the answer stream already follows, applied to a navigation.
	 * It also draws no figure and no fill, so there is nothing on it a reader could
	 * take for a reading.
	 *
	 * It is held back for a moment before appearing. A navigation that resolves in
	 * eighty milliseconds is not a wait, and flashing an outline of the page in front
	 * of somebody is worse than the instant they would otherwise have had. The hold is
	 * the one timer here, and it decides only whether to speak, never what to say.
	 */
	import { fade } from 'svelte/transition';
	import { base } from '$app/paths';
	import { navigating } from '$app/state';
	import HexField from '$lib/components/account/HexField.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { copy } from '$lib/state/lang.svelte';

	const c = $derived(copy());

	/** Below this, a navigation is quick enough that saying anything about it is noise. */
	const HOLD_MS = 140;

	/** Which of the two heavy destinations this navigation is headed for, if either. */
	const kind = $derived.by((): 'account' | 'app' | null => {
		const full = navigating.to?.url.pathname;
		if (!full) return null;
		const path = base && full.startsWith(base) ? full.slice(base.length) : full;
		if (path === '/account' || path.startsWith('/account/')) return 'account';
		if (path === '/app' || path.startsWith('/app/')) return 'app';
		return null;
	});

	let shown = $state(false);
	$effect(() => {
		if (!kind) {
			shown = false;
			return;
		}
		const t = setTimeout(() => (shown = true), HOLD_MS);
		return () => clearTimeout(t);
	});
</script>

{#if shown && kind}
	<div
		class="veil"
		role="status"
		aria-label={kind === 'account' ? c.account.openingAccount : c.account.openingMap}
		transition:fade={{ duration: 160 }}
	>
		{#if kind === 'account'}
			<!-- The account page's own frame: a header, a two-column head with the model
			     beside it, the pair of balances, the field, and three tiers. Same widths
			     and same gaps as the page itself, so nothing shifts on the handover. -->
			<div class="head-row">
				<Skeleton w="6.5rem" h="1rem" radius="999px" />
				<div class="row">
					<Skeleton w="4.5rem" h="1.5rem" radius="999px" delay={60} />
					<Skeleton w="6rem" h="1.5rem" radius="999px" delay={120} />
				</div>
			</div>

			<div class="sheet">
				<div class="hero">
					<div class="hero-text">
						<Skeleton w="5rem" h="0.625rem" radius="999px" />
						<div class="titleline">
							<Skeleton w="3.25rem" h="3.25rem" radius="var(--r-md)" delay={60} />
							<div class="stack">
								<Skeleton w="8rem" h="1.5rem" delay={90} />
								<Skeleton w="6rem" h="0.875rem" delay={120} />
							</div>
						</div>
						<div class="rule"></div>
						<div class="stack">
							<Skeleton w="7rem" h="0.75rem" delay={150} />
							<Skeleton w="10rem" h="0.6875rem" delay={180} />
						</div>
					</div>
					<Skeleton h="9.5rem" radius="var(--r-lg)" delay={90} />
				</div>

				<div class="pair">
					<Skeleton h="6.5rem" radius="var(--r-lg)" delay={120} />
					<Skeleton h="6.5rem" radius="var(--r-lg)" delay={160} />
				</div>

				<Skeleton h="11rem" radius="var(--r-lg)" delay={200} />

				<div class="trio">
					<Skeleton h="13rem" radius="var(--r-lg)" delay={240} />
					<Skeleton h="13rem" radius="var(--r-lg)" delay={280} />
					<Skeleton h="13rem" radius="var(--r-lg)" delay={320} />
				</div>
			</div>
		{:else}
			<!-- The map's frame: the two floating pills and the question box between
			     them. The lattice underneath is the grid the map is about to draw, at
			     the one weight `HexField` is allowed to be drawn at, so no cell on it
			     can be read as a cell that scored anything. -->
			<div class="ground"><HexField opacity={0.22} mask="edges" /></div>
			<div class="pill left"><Skeleton w="6rem" h="1.375rem" radius="999px" /></div>
			<div class="pill right"><Skeleton w="10.5rem" h="1.375rem" radius="999px" delay={80} /></div>
			<div class="ask">
				<Skeleton w="9rem" h="0.75rem" radius="999px" delay={60} />
				<Skeleton w="14rem" h="1.625rem" delay={100} />
				<Skeleton h="2.5rem" radius="999px" delay={140} />
				<div class="chips">
					<Skeleton w="5.5rem" h="1.5rem" radius="999px" delay={180} />
					<Skeleton w="7rem" h="1.5rem" radius="999px" delay={210} />
					<Skeleton w="4.5rem" h="1.5rem" radius="999px" delay={240} />
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.veil {
		position: fixed;
		inset: 0;
		z-index: 40;
		overflow: hidden;
		background: var(--bg-base);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
		flex: 1;
	}

	/* ── the account page's frame ─────────────────────────────────────────────── */

	.head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
	}
	.sheet {
		width: min(54rem, 100%);
		margin: 0 auto;
		padding: 0.5rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 19rem);
		gap: 1.25rem;
		align-items: center;
		padding: 1.25rem;
		border-radius: var(--r-xl);
		background: var(--bg-elevated);
		border: 1px solid var(--separator);
	}
	.hero-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.titleline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.rule {
		height: 1px;
		margin-top: 0.1875rem;
		background: var(--separator);
	}
	.pair {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}
	.trio {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
	}
	@media (max-width: 46rem) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* ── the map's frame ──────────────────────────────────────────────────────── */

	.ground {
		position: absolute;
		inset: 0;
	}
	.pill {
		position: absolute;
		top: 0.75rem;
		padding: 0.3125rem 0.5rem;
		border-radius: 999px;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		border: 1px solid var(--separator);
	}
	.pill.left {
		left: 0.75rem;
	}
	.pill.right {
		right: 0.75rem;
	}
	/* Same width, same radius and same padding as `AskLauncher`, because that is what
	   is about to stand here. */
	.ask {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(32rem, calc(100vw - 1.5rem));
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem 1.375rem 1.25rem;
		border-radius: var(--r-xl);
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		border: 1px solid var(--separator);
		box-shadow: var(--shadow-panel);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.125rem;
	}
</style>
