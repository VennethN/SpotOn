<script lang="ts">
	import { pct } from '$lib/scoring';
	import { getAppState } from '$lib/state.svelte';
	import { rampIndex } from '$lib/scoring';

	const app = getAppState();

	let question = $state('');
	let showQuery = $state(false);

	const SUGGESTIONS = [
		{ label: 'Kopi, modal kecil', q: 'Di mana buka kedai kopi modal kecil dekat MRT?' },
		{ label: 'Warung, jenuh', q: 'Stasiun mana yang sudah jenuh untuk warung makan?' },
		{ label: 'Bandingkan', q: 'Bandingkan Blok M BCA dan Bundaran HI' },
		{ label: 'Belum terdata', q: 'Hex mana yang belum terdata?' },
		{ label: 'Laundry', q: 'Di mana peluang laundry paling besar?' }
	];

	function ask(q: string) {
		question = q;
		if (q.trim()) app.ask(q.trim());
	}

	const answer = $derived(app.ai);
	/** Nilai peringkat FLAG_SATURATED adalah penawaran, bukan skor — warnanya jangan menyesatkan. */
	const isRank = $derived(answer?.query.intent === 'RANK' || answer?.query.intent === 'COMPARE');
</script>

<div class="ai">
	<form
		class="ask"
		onsubmit={(e) => {
			e.preventDefault();
			ask(question || 'rekomendasi lokasi');
		}}
	>
		<input
			type="text"
			bind:value={question}
			placeholder="Tanya peta… mis. buka kopi modal kecil"
			aria-label="Pertanyaan untuk mesin rekomendasi"
			enterkeyhint="search"
		/>
		<button class="btn accent" type="submit" disabled={app.aiLoading}>
			{app.aiLoading ? 'Memproses…' : 'Tanya'}
		</button>
	</form>

	<div class="chips">
		{#each SUGGESTIONS as s (s.q)}
			<button type="button" class="chip" onclick={() => ask(s.q)}>{s.label}</button>
		{/each}
	</div>

	{#if app.aiError}
		<p class="error">{app.aiError}</p>
	{/if}

	{#if answer}
		<details class="query" bind:open={showQuery}>
			<summary class="eyebrow">Query terstruktur hasil parsing</summary>
			<pre class="mono">{JSON.stringify(answer.query, null, 1)}</pre>
		</details>

		<p class="headline">{answer.headline}</p>

		<ol class="rank">
			{#each answer.items as item, i (item.id)}
				<li>
					<button
						type="button"
						class="card"
						class:selected={app.selectedId === item.id}
						onclick={() => app.select(item.id)}
					>
						<span class="hd">
							<span class="pos" class:warn={answer.query.intent === 'FLAG_SATURATED'}>{i + 1}</span>
							<span class="nm">{item.name}</span>
							<span
								class="sc"
								style:color={item.value === null
									? 'var(--label-3)'
									: isRank
										? `var(--ramp-${rampIndex(item.value)})`
										: 'var(--critical)'}
							>
								{item.value === null ? 'N=0' : pct(item.value)}
							</span>
						</span>
						<span class="why"><strong>Kenapa di sini?</strong> {item.why}</span>
						<span class="evidence mono">{item.evidence}</span>
					</button>
				</li>
			{/each}
		</ol>

		<details class="query">
			<summary class="eyebrow">Validasi & sumber</summary>
			<ul class="prov">
				{#each answer.provenance as line (line)}
					<li>{line}</li>
				{/each}
			</ul>
		</details>
	{:else if !app.aiLoading}
		<p class="empty">
			Tanyakan dalam bahasa sehari-hari. Pertanyaan diterjemahkan menjadi query terstruktur yang
			ditampilkan apa adanya, lalu dijalankan mesin skor — angkanya dihitung basis data, bukan
			dikarang model.
		</p>
	{/if}
</div>

<style>
	.ai {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.ask {
		display: flex;
		gap: 0.375rem;
	}
	.ask input {
		flex: 1;
		min-width: 0;
		border: 1px solid var(--separator);
		background: var(--fill-1);
		border-radius: 999px;
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		color: var(--label-1);
	}
	.ask input::placeholder {
		color: var(--label-3);
	}
	.ask input:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--bg-elevated);
	}
	.ask button:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.chip {
		border: 1px solid var(--separator);
		background: var(--fill-1);
		color: var(--label-2);
		border-radius: 999px;
		padding: 0.1875rem 0.5rem;
		font-size: 0.6875rem;
		cursor: pointer;
		transition:
			transform 100ms ease-out,
			color 140ms ease-out,
			border-color 140ms ease-out;
	}
	.chip:hover {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.chip:active {
		transform: scale(0.95);
	}

	.query {
		border: 1px solid var(--separator);
		border-radius: var(--r-sm);
		background: var(--fill-1);
		padding: 0.4375rem 0.625rem;
	}
	.query summary {
		cursor: pointer;
		list-style: none;
	}
	.query summary::-webkit-details-marker {
		display: none;
	}
	.query summary::after {
		content: ' ⌄';
	}
	.query pre {
		margin: 0.4375rem 0 0;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--label-2);
		line-height: 1.5;
	}
	.prov {
		margin: 0.4375rem 0 0;
		padding-left: 1rem;
		font-size: 0.6875rem;
		line-height: 1.5;
		color: var(--label-2);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.headline {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--label-1);
	}
	.empty,
	.error {
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--label-3);
	}
	.error {
		color: var(--critical);
	}

	.rank {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		text-align: left;
		border: 1px solid var(--separator);
		background: var(--bg-elevated);
		border-radius: var(--r-md);
		padding: 0.5rem 0.625rem;
		cursor: pointer;
		box-shadow: var(--shadow-chip);
		transition:
			transform 120ms ease-out,
			border-color 140ms ease-out,
			box-shadow 140ms ease-out;
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		box-shadow: var(--shadow-panel);
	}
	.card:active {
		transform: scale(0.985);
	}
	.card.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.hd {
		display: flex;
		align-items: baseline;
		gap: 0.4375rem;
	}
	.pos {
		flex: none;
		min-width: 1.125rem;
		text-align: center;
		border-radius: 5px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.625rem;
		font-weight: 700;
		padding: 0.0625rem 0.25rem;
	}
	.pos.warn {
		background: var(--critical);
	}
	.nm {
		font-size: 0.8125rem;
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.sc {
		margin-left: auto;
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.why {
		font-size: 0.6875rem;
		line-height: 1.45;
		color: var(--label-2);
	}
	.why strong {
		color: var(--label-1);
	}
	.evidence {
		color: var(--label-3);
		font-size: 0.625rem;
	}
</style>
