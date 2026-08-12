<script lang="ts">
	/**
	 * Profil 24 jam: satu batang per jam, puncaknya ditonjolkan.
	 *
	 * Bagan yang sama dipakai di panel detail aplikasi dan di halaman depan.
	 * Sebelumnya digambar dua kali dengan kode yang berbeda, jadi perbaikan pada
	 * satu bagan tidak pernah sampai ke bagan yang lain.
	 *
	 * Satu deret, satu rona — tingginya yang membawa besaran, warnanya tidak
	 * membawa apa-apa selain "ini datanya". Hanya jam puncak yang diberi label;
	 * memberi angka pada 24 batang membuat tidak satu pun terbaca. Angka
	 * lengkapnya disediakan pemanggil, di tabel yang dilipat.
	 */
	import { copy } from '$lib/state/lang.svelte';
	import { formatHour, num } from '$lib/utils/format';

	interface Props {
		/** 24 nilai, indeks = jam. */
		jam: number[];
		/** Satuan untuk pembaca layar dan tooltip. Kosong = satuan aplikasi. */
		unit?: string;
		/** Ringkas: tinggi kecil untuk panel sempit, tanpa sumbu dan tooltip. */
		dense?: boolean;
	}
	let { jam, unit, dense = false }: Props = $props();

	const c = $derived(copy());
	const u = $derived(unit ?? c.hourChart.unitApp);

	const peak = $derived(Math.max(1, ...jam));
	const peakHour = $derived(jam.indexOf(Math.max(...jam)));
	const total = $derived(jam.reduce((a, b) => a + b, 0));
	// Tanda jam yang jatuh tepat di bawah label puncak dilewati; dua label yang
	// bertumpuk lebih buruk daripada satu tanda yang hilang.
	const ticks = $derived([0, 6, 12, 18].filter((h) => Math.abs(h - peakHour) > 1.5));

	let hover = $state<number | null>(null);

	const at = (h: number) => ((h + 0.5) / 24) * 100;
	/**
	 * Label sumbu ditengahkan pada batangnya, kecuali di kedua tepi: di sana
	 * separuh labelnya jatuh ke luar bidang dan angkanya terpotong.
	 */
	const anchor = (h: number) => (at(h) < 6 ? '0' : at(h) > 94 ? '-100%' : '-50%');
</script>

<div class="hours" class:dense>
	<div
		class="plot"
		role="img"
		aria-label={c.hourChart.label(num(total), formatHour(peakHour), num(peak), u)}
		onpointerleave={() => (hover = null)}
	>
		{#each jam as v, h (h)}
			<button
				type="button"
				class="col"
				class:on={h === peakHour}
				class:hot={hover === h}
				aria-label={c.hourChart.bar(formatHour(h), num(v), u)}
				onpointerenter={() => (hover = h)}
				onfocus={() => (hover = h)}
				onblur={() => (hover = null)}
			>
				<span class="bar" style:height={`${Math.max(1.5, (v / peak) * 100)}%`}></span>
			</button>
		{/each}

		{#if hover !== null && !dense}
			<span class="tip" style:left={`${at(hover)}%`}>
				<b>{num(jam[hover])}</b>
				{u} · {formatHour(hover)}
			</span>
		{/if}
	</div>

	<div class="axis" aria-hidden="true">
		{#each ticks as h (h)}
			<span style:left={`${at(h)}%`} style:--anchor={anchor(h)}>{formatHour(h)}</span>
		{/each}
		<span class="peak" style:left={`${at(peakHour)}%`} style:--anchor={anchor(peakHour)}>
			{c.hourChart.peak} {formatHour(peakHour)}
		</span>
	</div>
</div>

<style>
	.hours {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.plot {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: clamp(6rem, 14vh, 9.5rem);
		border-bottom: 1px solid var(--separator-strong);
	}
	.dense .plot {
		height: 3.25rem;
		gap: 1px;
	}
	.col {
		flex: 1;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: flex-end;
		background: none;
		border: 0;
		padding: 0;
		cursor: default;
	}
	.bar {
		display: block;
		width: 100%;
		/* Ujung data dibulatkan, pangkalnya tetap menempel pada garis dasar. */
		border-radius: 3px 3px 0 0;
		background-color: color-mix(in srgb, var(--accent) 42%, transparent);
		background-image: var(--lift-bar);
		transition: background-color 140ms ease-out;
	}
	.dense .bar {
		border-radius: 2px 2px 0 0;
	}
	.col.on .bar {
		background: var(--accent);
	}
	.col.hot .bar {
		background: color-mix(in srgb, var(--accent) 78%, transparent);
	}
	.col.on.hot .bar {
		background: var(--accent);
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 0.375rem);
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 0.6875rem;
		color: var(--label-2);
		background: var(--bg-elevated);
		border: 1px solid var(--separator);
		border-radius: var(--r-xs);
		padding: 0.125rem 0.375rem;
		pointer-events: none;
		box-shadow: var(--shadow-chip);
	}
	.tip b {
		color: var(--label-1);
		font-variant-numeric: tabular-nums;
	}

	.axis {
		position: relative;
		height: 1.6rem;
		font-size: 0.625rem;
		color: var(--label-3);
	}
	.dense .axis {
		height: 1.1rem;
		font-size: 0.5625rem;
	}
	.axis span {
		position: absolute;
		top: 0.25rem;
		transform: translateX(var(--anchor, -50%));
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.axis .peak {
		color: var(--accent);
		font-weight: 600;
	}
</style>
