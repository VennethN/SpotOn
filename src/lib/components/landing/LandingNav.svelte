<script lang="ts">
	import { browser } from '$app/environment';

	const LINKS = [
		{ href: '#masalah', label: 'Masalah' },
		{ href: '#cara-kerja', label: 'Cara kerja' },
		{ href: '#ai', label: 'AI' },
		{ href: '#data', label: 'Data' }
	];

	let scrolled = $state(false);
	let theme = $state<'light' | 'dark' | 'system'>('system');

	$effect(() => {
		if (!browser) return;
		const stored = localStorage.getItem('spoton:theme');
		theme = stored === 'dark' || stored === 'light' ? stored : 'system';

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

	function cycleTheme() {
		theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
		if (theme === 'system') {
			document.documentElement.removeAttribute('data-theme');
			localStorage.removeItem('spoton:theme');
		} else {
			document.documentElement.setAttribute('data-theme', theme);
			localStorage.setItem('spoton:theme', theme);
		}
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
		<button
			type="button"
			class="ghost"
			onclick={cycleTheme}
			aria-label={theme === 'system' ? 'Tema sistem' : theme === 'dark' ? 'Tema gelap' : 'Tema terang'}
		>
			<!-- Satu keluarga ikon digambar sendiri, satu berat garis. Glif Unicode
			     berganti bentuk per platform dan tidak pernah sebaris dengan tipografinya. -->
			<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
				{#if theme === 'dark'}
					<path
						d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linejoin="round"
					/>
				{:else if theme === 'light'}
					<circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4" />
					<g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
						<path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6" />
						<path d="M3.4 3.4 4.5 4.5M11.5 11.5l1.1 1.1M12.6 3.4 11.5 4.5M4.5 11.5l-1.1 1.1" />
					</g>
				{:else}
					<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />
					<path d="M8 2a6 6 0 0 0 0 12Z" fill="currentColor" />
				{/if}
			</svg>
		</button>
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
	.ghost {
		display: grid;
		place-items: center;
		border: 1px solid currentColor;
		background: transparent;
		border-radius: 999px;
		width: 1.75rem;
		height: 1.75rem;
		cursor: pointer;
		color: var(--stage-ink-muted, var(--label-2));
		transition:
			transform 100ms ease-out,
			color 160ms ease-out;
	}
	.ghost:hover {
		color: var(--stage-ink, var(--label-1));
	}
	.nav.scrolled .ghost {
		color: var(--label-2);
		border-color: var(--separator);
		background: var(--fill-1);
	}
	.ghost:active {
		transform: scale(0.92);
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
