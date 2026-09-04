import { CATEGORIES } from '$lib/domain/categories';
import { narrate } from '$lib/domain/narrate';
import { copy } from '$lib/state/lang.svelte';
import { pct } from '$lib/utils/format';
import type { AppState } from '$lib/state/app.svelte';
import type { AiAnswer, CategoryKey } from '$lib/types';

/**
 * Tapak — pemandu di dalam SpotOn.
 *
 * Sosoknya salah satu figur putih di maket: orang yang sudah keliling tiap kawasan
 * dan melaporkan apa yang dilihatnya. Ia memimpin percakapan, bukan menunggu diketik:
 * menyapa lebih dulu, balik bertanya, menyodorkan pilihan yang bisa ditekan, dan
 * berkomentar saat pengguna memilih kawasan sendiri di peta.
 *
 * Yang penting: Tapak tidak pernah mengarang angka. Setiap jawabannya datang dari
 * `/api/ai/query` — mesin skor yang sama yang dipakai seluruh aplikasi. Tapak hanya
 * memilih pertanyaan mana yang diajukan dan menerjemahkan hasilnya ke bahasa orang.
 * Karena itu tiap pertanyaan yang ia tawarkan selalu dipetakan ke salah satu niat
 * yang memang dimengerti mesin (RANK, FLAG_SATURATED, COMPARE, COVERAGE) — ia tidak
 * boleh menjanjikan sesuatu yang tidak bisa dijawab.
 */

export type ChipAction =
	| { kind: 'category'; value: CategoryKey }
	| { kind: 'budget'; small: boolean }
	| { kind: 'ask'; question: string }
	| { kind: 'restart' };

export interface Chip {
	label: string;
	action: ChipAction;
}

export interface Turn {
	who: 'tapak' | 'user';
	text: string;
	chips?: Chip[];
	/** Hasil dari mesin skor, ditampilkan sebagai daftar tempat. */
	answer?: AiAnswer;
	/** Menandai giliran yang sedang menunggu jawaban mesin. */
	pending?: boolean;
}

/* Chip dibangun saat dibutuhkan, bukan sekali di tingkat modul: labelnya ikut
   bahasa yang sedang dipilih, dan bahasa bisa diganti di tengah percakapan. */
function categoryChips(): Chip[] {
	const c = copy();
	return CATEGORIES.map((def) => ({
		label: c.category[def.key].name,
		action: { kind: 'category', value: def.key }
	}));
}

export class Tapak {
	turns = $state<Turn[]>([]);
	/** Modal kecil → hasil disaring ke kawasan yang ruangnya benar-benar tersedia. */
	smallBudget = $state<boolean | null>(null);
	#app: AppState;
	#greeted = false;
	/** Nama kawasan yang terakhir dikomentari, supaya Tapak tidak mengulang diri. */
	#lastRemarked: string | null = null;

	constructor(app: AppState) {
		this.#app = app;
	}

	get busy() {
		return this.#app.aiLoading;
	}

	#say(text: string, chips?: Chip[]) {
		this.turns.push({ who: 'tapak', text, chips });
	}

	/** Mengosongkan utas dan menyapa lagi — dipakai saat bahasa diganti. */
	reset() {
		this.turns = [];
		this.smallBudget = null;
		this.#greeted = false;
		this.#lastRemarked = null;
		this.greet();
	}

	greet() {
		if (this.#greeted) return;
		this.#greeted = true;
		// Angkanya dibaca dari data, bukan ditulis tangan — begitu kisinya dibangun
		// ulang, sapaan Tapak ikut benar tanpa ada yang perlu ingat memperbaruinya.
		const { terdata, total } = this.#app.coverage;
		this.#say(copy().tapak.greet(total, terdata), categoryChips());
	}

	/** Menutup chip pada giliran terakhir supaya pilihan lama tidak bisa ditekan ulang. */
	#consume() {
		for (let i = this.turns.length - 1; i >= 0; i--) {
			if (this.turns[i].who === 'tapak' && this.turns[i].chips) {
				this.turns[i].chips = undefined;
				break;
			}
		}
	}

	tap(chip: Chip) {
		this.#consume();
		this.turns.push({ who: 'user', text: chip.label });
		this.#run(chip.action);
	}

	/** Pertanyaan yang diketik sendiri tetap dilayani mesin yang sama. */
	submit(text: string) {
		const q = text.trim();
		if (!q) return;
		this.#consume();
		this.turns.push({ who: 'user', text: q });
		void this.#ask(q);
	}

	#run(action: ChipAction) {
		const c = copy();

		if (action.kind === 'restart') {
			this.smallBudget = null;
			this.#say(c.tapak.restart, categoryChips());
			return;
		}

		if (action.kind === 'category') {
			this.#app.setCategory(action.value);
			const name = c.category[action.value].name.toLowerCase();
			this.#say(c.tapak.budgetAsk(name), [
				{ label: c.tapak.budgetTight, action: { kind: 'budget', small: true } },
				{ label: c.tapak.budgetLoose, action: { kind: 'budget', small: false } }
			]);
			return;
		}

		if (action.kind === 'budget') {
			this.smallBudget = action.small;
			const cat = c.category[this.#app.category].name.toLowerCase();
			// Frasa "modal kecil" inilah yang membuat mesin menyaring ke kawasan yang
			// ruang usahanya benar-benar tersedia — bukan sekadar basa-basi.
			const q = action.small
				? `Di mana buka ${cat} modal kecil dekat MRT?`
				: `Di mana buka ${cat} dekat MRT?`;
			void this.#ask(q, action.small ? c.tapak.prefaceTight : c.tapak.prefaceLoose);
			return;
		}

		void this.#ask(action.question);
	}

	async #ask(question: string, preface?: string) {
		if (preface) this.#say(preface);
		const turn: Turn = { who: 'tapak', text: copy().ai.thinking, pending: true };
		this.turns.push(turn);

		await this.#app.ask(question);

		const idx = this.turns.indexOf(turn);
		if (idx === -1) return;

		const c = copy();
		if (this.#app.aiError) {
			this.turns[idx] = {
				who: 'tapak',
				text: c.tapak.failed(this.#app.aiError),
				chips: [{ label: c.tapak.retry, action: { kind: 'ask', question } }]
			};
			return;
		}

		const ans = this.#app.ai;
		if (!ans) {
			this.turns[idx] = { who: 'tapak', text: c.tapak.nothing };
			return;
		}

		this.turns[idx] = {
			who: 'tapak',
			text: narrate(ans, c),
			answer: ans,
			chips: this.#followUps(ans)
		};
	}

	#followUps(ans: AiAnswer): Chip[] {
		// Tidak paham berarti tidak ada hasil untuk ditindaklanjuti; yang berguna
		// justru menawarkan jalan yang memang bisa dijawab.
		if (ans.notUnderstood) return categoryChips();

		const c = copy();
		const cat = c.category[this.#app.category].name.toLowerCase();
		const chips: Chip[] = [];

		if (ans.query.intent !== 'FLAG_SATURATED') {
			chips.push({ label: c.tapak.avoid, action: { kind: 'ask', question: c.tapak.avoidQ(cat) } });
		}
		if (ans.query.intent !== 'COVERAGE') {
			chips.push({
				label: c.tapak.coverage,
				action: { kind: 'ask', question: c.tapak.coverageQ }
			});
		}
		chips.push({ label: c.tapak.tryOther, action: { kind: 'restart' } });
		return chips;
	}

	/**
	 * Dipanggil saat pengguna memilih kawasan sendiri di peta. Tapak ikut menoleh —
	 * inilah yang membedakannya dari kotak obrolan yang cuma menunggu diketik.
	 */
	remarkOnSelection() {
		const row = this.#app.selected;
		if (!row || row.name === this.#lastRemarked) return;
		if (!this.#greeted) return;
		this.#lastRemarked = row.name;

		const c = copy();
		const def = c.category[this.#app.category];
		const cat = def.name.toLowerCase();
		if (row.nodata) {
			this.#say(c.narrate.remarkNodata(row.name, row.osm, def.many));
			return;
		}
		const verdict =
			(row.score ?? 0) >= 0.66
				? c.narrate.verdictGood
				: (row.score ?? 0) >= 0.4
					? c.narrate.verdictMid
					: c.narrate.verdictLow;
		this.#say(
			c.narrate.remark(
				row.name,
				verdict,
				cat,
				pct(row.score),
				row.osm,
				row.listings > 0 ? c.narrate.listingSome(row.listings) : c.narrate.listingNone
			)
		);
	}
}
