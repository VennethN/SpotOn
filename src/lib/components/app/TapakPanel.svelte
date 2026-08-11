<script lang="ts">
	/**
	 * Percakapan dengan Tapak — permukaan utama aplikasi.
	 *
	 * Tapak yang memulai dan yang menawarkan langkah berikutnya, jadi pengguna yang
	 * tidak tahu harus bertanya apa tetap bisa jalan hanya dengan menekan pilihan.
	 * Kotak ketik tetap ada untuk yang sudah tahu mau tanya apa.
	 */
	import { onMount } from 'svelte';
	import TapakFigure from '$lib/components/ui/TapakFigure.svelte';
	import { getAppState } from '$lib/state/app.svelte';
	import { Tapak } from '$lib/state/tapak.svelte';
	import { pct } from '$lib/utils/format';

	const app = getAppState();
	const tapak = new Tapak(app);

	let draft = $state('');
	let log = $state<HTMLDivElement | null>(null);

	onMount(() => tapak.greet());

	// Tapak ikut menoleh saat pengguna memilih kawasan sendiri di peta.
	$effect(() => {
		void app.selectedId;
		tapak.remarkOnSelection();
	});

	// Gulir mengikuti giliran terbaru, bukan melompat: pengguna harus melihat
	// pesan baru itu datang, bukan tiba-tiba sudah di bawah.
	$effect(() => {
		void tapak.turns.length;
		if (!log) return;
		queueMicrotask(() => log?.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }));
	});

	function send(e: SubmitEvent) {
		e.preventDefault();
		tapak.submit(draft);
		draft = '';
	}
</script>

<div class="tapak">
	<div class="log scroll" bind:this={log}>
		{#each tapak.turns as turn, i (i)}
			{#if turn.who === 'tapak'}
				<div class="row">
					<span class="avatar"><TapakFigure size={26} /></span>
					<div class="bubble">
						<p class:thinking={turn.pending}>{turn.text}</p>

						{#if turn.answer && turn.answer.items.length}
							<ul class="places">
								{#each turn.answer.items as item, k (item.id)}
									<li>
										<button
											type="button"
											class="place"
											class:on={app.selectedId === item.id}
											onclick={() => app.select(item.id)}
										>
											<span class="rank">{k + 1}</span>
											<span class="nm">{item.name}</span>
											{#if item.value != null}
												<span class="score">{pct(item.value)}</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{:else}
				<div class="row mine"><p class="bubble said">{turn.text}</p></div>
			{/if}

			{#if turn.chips?.length}
				<ul class="chips">
					{#each turn.chips as chip (chip.label)}
						<li>
							<button type="button" onclick={() => tapak.tap(chip)} disabled={tapak.busy}>
								{chip.label}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
	</div>

	<form onsubmit={send}>
		<input
			bind:value={draft}
			placeholder="Atau tanya sendiri…"
			aria-label="Tanya Tapak"
			disabled={tapak.busy}
		/>
		<button type="submit" class="btn accent" disabled={tapak.busy || !draft.trim()}>Tanya</button>
	</form>
</div>

<style>
	.tapak {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-height: 0;
	}
	.log {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		max-height: min(58vh, 30rem);
		padding-right: 0.25rem;
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.row.mine {
		justify-content: flex-end;
	}
	.avatar {
		flex: none;
		margin-top: 0.1rem;
	}

	.bubble {
		border-radius: var(--r-md);
		padding: 0.5rem 0.6875rem;
		background: var(--fill-1);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
		max-width: 92%;
	}
	.bubble.said {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.thinking {
		color: var(--label-3);
	}

	.places {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.place {
		width: 100%;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		text-align: left;
		border: 1px solid var(--separator);
		background: var(--bg-elevated);
		border-radius: var(--r-sm);
		padding: 0.375rem 0.5rem;
		cursor: pointer;
		transition:
			border-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.place:hover {
		border-color: var(--separator-strong);
	}
	.place:active {
		transform: scale(0.985);
	}
	.place.on {
		border-color: var(--accent);
	}
	.rank {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--label-3);
		font-variant-numeric: tabular-nums;
		min-width: 1ch;
	}
	.nm {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		flex: 1;
		min-width: 0;
	}
	.score {
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0 0 0 2.125rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3125rem;
	}
	.chips button {
		border: 1px solid var(--separator-strong);
		background: transparent;
		color: var(--label-1);
		border-radius: 999px;
		padding: 0.25rem 0.6875rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			background-color 140ms ease-out,
			transform 100ms ease-out;
	}
	.chips button:hover:not(:disabled) {
		background: var(--fill-1);
	}
	.chips button:active:not(:disabled) {
		transform: scale(0.96);
	}
	.chips button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	form {
		display: flex;
		gap: 0.375rem;
	}
	input {
		flex: 1;
		min-width: 0;
		border: 1px solid var(--separator);
		background: var(--bg-elevated);
		border-radius: 999px;
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
	}
	input:disabled {
		opacity: 0.6;
	}
</style>
