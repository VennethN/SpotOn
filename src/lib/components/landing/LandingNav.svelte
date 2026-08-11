<script lang="ts">
	import { browser } from '$app/environment';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { applyTheme, storedTheme, type Theme } from '$lib/state/theme.svelte';

	const LINKS = [
		{ href: '#masalah', label: 'Masalah' },
		{ href: '#cara-kerja', label: 'Cara kerja' },
		{ href: '#ai', label: 'AI' },
		{ href: '#data', label: 'Data' }
	];

	let scrolled = $state(false);
	let theme = $state<Theme>('system');

	$effect(() => {
		if (!browser) return;
		theme = storedTheme();

		// Bilah baru memadat setelah panggung maket benar-benar lewat. Dipatok pada
		// "scrollY > 8" saja, ia berubah jadi material buram di gulir pertama dan
		// menutupi adegan yang justru sedang jadi pokoknya.
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

<!-- Chrome mengambang: konten mengalir di bawahnya, dan pemisahnya baru muncul
     ketika benar-benar ada yang lewat di baliknya. -->
<header class="nav" class:scrolled>
	<a class="brand" href="#top">
		<span class="mark" aria-hidden="true"></span>
		SpotOn
	</a>

	<nav aria-label="Bagian halaman">
		{#each LINKS as l (l.href)}
			<a href={l.href}>{l.label}</a>
		{/each}
	</nav>

	<div class="actions">
		<ThemeToggle {theme} onchange={pickTheme} ghost />
		<a class="cta" href="/app">Buka SpotOn</a>
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
	/* Tanda: satu petak dengan sudut yang dipangkas — bentuk petak sewa di maket. */
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
	/* Tombol temanya komponen bersama; yang khas bilah ini cuma bagaimana ia
	   berubah saat bilahnya memadat di atas kertas. */
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
