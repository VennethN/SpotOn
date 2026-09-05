<script lang="ts">
	/**
	 * The mechanism in three columns: two signals that subtract from each other, then
	 * one condition that gates the result.
	 *
	 * It used to be two columns of unequal weight with the condition hanging off a rule
	 * to the right, which made the gate read as a footnote to the second signal rather
	 * than as the third term it is. Three equal columns say what the arithmetic says.
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

<ol class="flow">
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

	<li class="gate">
		<div class="hd">
			<span class="nm">{c.signal.gate.nm}</span>
			<span class="src">{c.signal.gate.src}</span>
		</div>
		<div class="states">
			<span class="st ok">{c.signal.gate.ok}</span>
			<span class="st no">{c.signal.gate.no}</span>
		</div>
		<p>{c.signal.gate.d}</p>
	</li>
</ol>

<style>
	.flow {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(1.25rem, 3vw, 2.25rem);
	}
	.flow > li {
		display: flex;
		flex-direction: column;
		/* A rule between the columns rather than around them: three boxes here would
		   read as three unrelated things, and these three are one sum. */
		padding-left: clamp(1.25rem, 3vw, 2.25rem);
		border-left: 1px solid var(--separator);
	}
	.flow > li:first-child {
		padding-left: 0;
		border-left: 0;
	}

	.hd {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.nm {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.014em;
	}
	.src {
		font-size: 0.625rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--label-3);
	}

	.track {
		margin: 0.875rem 0 0.75rem;
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
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--ink-2, var(--label-2));
		margin: 0;
	}

	.states {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0.75rem 0 0.75rem;
	}
	.st {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.8125rem;
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

	@media (max-width: 56rem) {
		.flow {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.25rem;
		}
		.flow > li {
			padding-left: 0;
			padding-top: 1.25rem;
			border-left: 0;
			border-top: 1px solid var(--separator);
		}
		.flow > li:first-child {
			padding-top: 0;
			border-top: 0;
		}
	}
</style>
