<script lang="ts">
	/**
	 * Mekanismenya dalam satu bidang: dua sinyal saling mengurangi, lalu satu
	 * syarat mengunci hasilnya.
	 *
	 * Warnanya bertugas, bukan menghias — biru untuk yang menambah, jingga untuk
	 * yang menekan, hijau untuk syarat yang harus terpenuhi. Setiap warna selalu
	 * ditemani namanya sendiri, jadi bacaan ini tidak pernah bergantung pada
	 * kemampuan membedakan warna.
	 */
	const SIGNALS = [
		{
			k: 'demand',
			nm: 'Permintaan',
			src: 'Struk Go',
			d: 'Berapa banyak orang di sana membelanjakan uangnya.',
			w: 82
		},
		{
			k: 'supply',
			nm: 'Pesaing',
			src: 'Menu Go',
			d: 'Bukan cuma jumlahnya — yang selalu penuh menekan lebih keras.',
			w: 54
		}
	];
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
			<span class="nm">Ruang usaha</span>
			<span class="src">Properti Go</span>
		</div>
		<div class="states">
			<span class="st ok">ada yang disewakan → peluang berlaku</span>
			<span class="st no">tidak ada → peluang nyaris nol</span>
		</div>
		<p>Syarat, bukan bonus: peluang yang tidak bisa ditempati bukan peluang.</p>
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
	/* Bentuk penanda ikut berbeda, tidak hanya warnanya. */
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
