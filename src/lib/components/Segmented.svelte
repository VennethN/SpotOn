<script lang="ts" generics="T extends string">
	import { SpringValue, prefersReducedMotion } from '$lib/motion.svelte';

	interface Option {
		value: T;
		label: string;
		hint?: string;
	}

	let {
		options,
		value = $bindable(),
		label,
		onchange
	}: { options: Option[]; value: T; label: string; onchange?: (v: T) => void } = $props();

	function pick(v: T) {
		value = v;
		onchange?.(v);
	}

	let root = $state<HTMLDivElement | null>(null);
	let buttons: HTMLButtonElement[] = $state([]);

	// Pil penunjuk mengejar pilihan dengan pegas kritis: tanpa lonjakan, karena
	// perpindahan ini tidak dipicu momentum gestur.
	const x = new SpringValue(0, { damping: 1, response: 0.32 });
	const w = new SpringValue(0, { damping: 1, response: 0.32 });
	let measured = $state(false);

	$effect(() => {
		const i = options.findIndex((o) => o.value === value);
		const el = buttons[i];
		if (!el || !root) return;
		const left = el.offsetLeft;
		const width = el.offsetWidth;
		if (!measured) {
			x.snap(left);
			w.snap(width);
			measured = true;
			return;
		}
		x.to(left);
		w.to(width);
	});

	function onKeydown(e: KeyboardEvent) {
		const i = options.findIndex((o) => o.value === value);
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			pick(options[(i + 1) % options.length].value);
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			pick(options[(i - 1 + options.length) % options.length].value);
			e.preventDefault();
		}
	}
</script>

<div
	class="seg"
	role="radiogroup"
	aria-label={label}
	tabindex="-1"
	bind:this={root}
	onkeydown={onKeydown}
	class:instant={prefersReducedMotion()}
>
	<span
		class="thumb"
		aria-hidden="true"
		style:transform={`translate3d(${x.current}px,0,0)`}
		style:width={`${w.current}px`}
	></span>
	{#each options as opt, i (opt.value)}
		<button
			type="button"
			role="radio"
			aria-checked={value === opt.value}
			tabindex={value === opt.value ? 0 : -1}
			title={opt.hint}
			bind:this={buttons[i]}
			onclick={() => pick(opt.value)}
		>
			{opt.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		position: relative;
		display: flex;
		gap: 0.125rem;
		padding: 0.1875rem;
		background: var(--fill-1);
		border-radius: 999px;
		isolation: isolate;
	}
	.thumb {
		position: absolute;
		left: 0;
		top: 0.1875rem;
		bottom: 0.1875rem;
		z-index: -1;
		border-radius: 999px;
		background: var(--bg-elevated);
		box-shadow: var(--shadow-chip);
		will-change: transform, width;
	}
	button {
		flex: 1;
		border: 0;
		background: none;
		border-radius: 999px;
		padding: 0.25rem 0.625rem;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.002em;
		color: var(--label-2);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 140ms ease-out,
			transform 100ms ease-out;
	}
	button[aria-checked='true'] {
		color: var(--label-1);
		font-weight: 600;
	}
	button:active {
		transform: scale(0.96);
	}
</style>
