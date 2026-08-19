<script lang="ts">
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import { browser } from '$app/environment';
	import LangToggle from '$lib/components/ui/LangToggle.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { copy } from '$lib/state/lang.svelte';
	import { applyTheme, storedTheme, type Theme } from '$lib/state/theme.svelte';

	const c = $derived(copy());

	let scrolled = $state(false);
	let theme = $state<Theme>('system');

	$effect(() => {
		if (!browser) return;
		theme = storedTheme();

		// The bar only condenses once the diorama stage has genuinely passed. Pinned to
		// "scrollY > 8" alone, it turns into opaque material on the very first scroll and
		// covers the scene that is the whole point at that moment.
		const onScroll = () => {
			const stage = document.querySelector('section.stage');
			const overStage = stage ? stage.getBoundingClientRect().bottom > 56 : false;
			scrolled = !overStage && window.scrollY > 8;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	function pickTheme(next: Theme) {
		theme = next;
		applyTheme(next);
	}
</script>

<!-- Floating chrome: content flows beneath it.
     Over the diorama the bar is invisible chrome sitting on the sky. Once the stage
     has passed it draws itself in as a rounded pill that hovers over the paper,
     rather than a full-width band welded to the top edge: the page below is a sheet
     of drawing paper, and a bar spanning the whole viewport cuts it in half. -->
<header class="nav" class:scrolled>
	<div class="bar">
		<a class="brand" href="#top">
			<BrandMark size={13} />
			{c.brand.name}
		</a>

		<nav aria-label={c.nav.aria}>
			{#each c.nav.sections as l (l.href)}
				<a href={l.href}>{l.label}</a>
			{/each}
		</nav>

		<div class="actions">
			<LangToggle ghost />
			<ThemeToggle {theme} onchange={pickTheme} ghost />
			<a class="cta" href="/app">{c.brand.open}</a>
		</div>
	</div>
</header>

<style>
	/* The fixed rail is only a place to stand: it spans the viewport so the bar inside
	   it can centre, and it never paints anything itself. Pointer events are handed
	   back to the bar alone, so the transparent gutters either side stay clickable
	   map/paper rather than an invisible strip that eats clicks. */
	.nav {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: 30;
		display: flex;
		justify-content: center;
		padding: 0.625rem max(0.75rem, calc((100vw - 68rem) / 2));
		pointer-events: none;
		transition: padding-top 320ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	.nav.scrolled {
		/* Lifted off the top edge, which is what makes it read as floating rather than
		   fixed to the frame. */
		padding-top: 0.875rem;
	}

	.bar {
		position: relative;
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 0.3125rem 0.3125rem 0.3125rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		/* The material arrives as a material: blur, edge and shadow move together with
		   the width rather than an opacity fade tacked onto a static shape. */
		transition:
			max-width 380ms cubic-bezier(0.32, 0.72, 0, 1),
			background-color 300ms ease-out,
			border-color 300ms ease-out,
			box-shadow 300ms ease-out,
			backdrop-filter 300ms ease-out;
		max-width: 100%;
	}
	.nav.scrolled .bar {
		/* Narrower than the text column below it: the pill has to read as an object
		   sitting ON the sheet, and matching the sheet's width would read as its header. */
		max-width: 56rem;
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		border-color: var(--separator);
		box-shadow: var(--shadow-panel);
	}
	/* A bright hairline along the top: light landing on the material. Only once the
	   material is actually there. */
	.bar::before {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 1px;
		border-radius: inherit;
		background: var(--mat-edge);
		opacity: 0;
		pointer-events: none;
		transition: opacity 300ms ease-out;
	}
	.nav.scrolled .bar::before {
		opacity: 1;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--stage-ink, var(--label-1));
		text-decoration: none;
	}
	.nav.scrolled .brand {
		color: var(--label-1);
	}

	nav {
		display: flex;
		gap: 1.25rem;
		margin-inline: auto;
	}
	nav a {
		font-size: 0.8125rem;
		color: var(--stage-ink-muted, var(--label-2));
		text-decoration: none;
		transition: color 160ms ease-out;
	}
	nav a:hover {
		color: var(--stage-ink, var(--label-1));
	}
	.nav.scrolled nav a {
		color: var(--label-2);
	}
	.nav.scrolled nav a:hover {
		color: var(--label-1);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	/* The theme button is a shared component; all that is specific to this bar is how
	   it changes once the bar condenses over paper. */
	.nav.scrolled :global(.ghost) {
		color: var(--label-2);
		border-color: var(--separator);
		background: var(--fill-1);
	}
	.cta {
		display: inline-flex;
		align-items: center;
		background: var(--stage-ink, var(--accent));
		color: var(--stage-ink-inverse, var(--accent-ink));
		border-radius: 999px;
		padding: 0.3125rem 0.875rem;
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 620;
		letter-spacing: -0.005em;
		text-decoration: none;
		transition:
			transform 100ms ease-out,
			filter 160ms ease-out;
	}
	.nav.scrolled .cta {
		background: var(--accent);
		color: var(--accent-ink);
		box-shadow: var(--shadow-chip);
	}
	.cta:hover {
		filter: brightness(1.07);
	}
	.cta:active {
		transform: scale(0.96);
	}

	@media (max-width: 720px) {
		nav {
			display: none;
		}
		.actions {
			margin-left: auto;
		}
	}
</style>
