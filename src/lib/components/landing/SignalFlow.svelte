<script lang="ts">
	/**
	 * The mechanism in a single field: two signals subtract from each other, then one
	 * condition gates the result.
	 *
	 * Colour has a job here, it does not decorate — blue for what adds, orange for what
	 * suppresses, green for the condition that has to be met. Every colour is always
	 * accompanied by its own name, so this reading never depends on being able to tell
	 * colours apart.
	 */
	import { copy } from '$lib/state/lang.svelte';

	const c = $derived(copy());
	const SIGNALS = $derived([
		{ k: 'demand', ...c.signal.demand, w: 82 },
		{ k: 'supply', ...c.signal.supply, w: 54 }
	]);
</script>

<div class="flow">
	<ol class="sig">
		{#each SIGNALS as s (s.k)}
			<li class={s.k}>
				<div class="hd">
					<span class="nm">{s.nm}</span>
					<span class="src">{s.src}</span>
				</div>
				<div class="track"><span class="fill" style:width={`${s.w}%`}></span></div>
				<p>{s.d}</p>
			</li>
		{/each}
	</ol>

	<div class="gate">
		<div class="hd">
			<span class="nm">{c.signal.gate.nm}</span>
			<span class="src">{c.signal.gate.src}</span>
		</div>
		<div class="states">
			<span class="st ok">{c.signal.gate.ok}</span>
			<span class="st no">{c.signal.gate.no}</span>
		</div>
		<p>{c.signal.gate.d}</p>
	</div>
</div>

<style>
	.flow {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: 1.5rem 2.5rem;
		align-items: start;
	}

	.sig {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.nm {
		font-family: var(--font-display);
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.012em;
	}
	.src {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--label-3);
	}

	.track {
		margin: 0.5rem 0 0.4375rem;
		height: 0.375rem;
		border-radius: 999px;
		background: var(--fill-1);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background-image: var(--lift-bar);
	}
	.demand .fill {
		background-color: var(--accent);
	}
	.supply .fill {
		background-color: var(--warn);
	}

	p {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--label-2);
		max-width: 40ch;
	}

	.gate {
		border-left: 1px solid var(--paper-line);
		padding-left: 1.5rem;
	}
	.states {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0.625rem 0 0.5rem;
	}
	.st {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.75rem;
		color: var(--label-2);
	}
	/* The marker shapes differ too, not just their colours. */
	.st::before {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		flex: none;
		border: 1.5px solid currentColor;
	}
	.st.ok {
		color: var(--good);
	}
	.st.ok::before {
		border-radius: 999px;
		background: currentColor;
	}
	.st.no {
		color: var(--label-3);
	}
	.st.no::before {
		border-radius: 999px;
	}

	@media (max-width: 720px) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
		}
		.gate {
			border-left: 0;
			border-top: 1px solid var(--paper-line);
			padding-left: 0;
			padding-top: 1.25rem;
		}
	}
</style>
