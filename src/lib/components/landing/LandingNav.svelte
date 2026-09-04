<script lang="ts">
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

<!-- Floating chrome: content flows beneath it, and the separator only appears once
     something is genuinely passing behind it. -->
<header class="nav" class:scrolled>
	<a class="brand" href="#top">
		<span class="mark" aria-hidden="true"></span>
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
</header>

<style>
	.nav {
		position: fixed;
		inset-inline: 0;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.625rem max(1rem, calc((100vw - 68rem) / 2));
		background: transparent;
		transition:
			background-color 260ms ease-out,
			box-shadow 260ms ease-out,
			backdrop-filter 260ms ease-out;
	}
	.nav.scrolled {
		background: var(--mat-thick);
		-webkit-backdrop-filter: var(--blur-thick);
		backdrop-filter: var(--blur-thick);
		box-shadow: 0 1px 0 var(--separator);
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
	/* The mark: a single lot with a clipped corner — the shape of a rental lot in the model. */
	.mark {
		width: 0.8125rem;
		height: 0.8125rem;
		border: 1.5px solid currentColor;
		border-radius: 3px;
		clip-path: polygon(0 0, 100% 0, 100% 62%, 62% 100%, 0 100%);
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
