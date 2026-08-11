import { CATEGORIES, CATEGORY_MAP } from './categories';
import { pct } from './scoring';
import type { AppState } from './state.svelte';
import type { AiAnswer, CategoryKey } from './types';

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

const CATEGORY_CHIPS: Chip[] = CATEGORIES.map((c) => ({
	label: c.name,
	action: { kind: 'category', value: c.key }
}));

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

	greet() {
		if (this.#greeted) return;
		this.#greeted = true;
		// Angkanya dibaca dari data, bukan ditulis tangan — begitu kisinya dibangun
		// ulang, sapaan Tapak ikut benar tanpa ada yang perlu ingat memperbaruinya.
		const { terdata, total } = this.#app.coverage;
		this.#say(
			`Halo. Saya Tapak. Saya sudah keliling ${total} petak kawasan di sekitar MRT, KRL, LRT, dan koridor TransJakarta — ${terdata} di antaranya sudah ada datanya. Anda lagi kepikiran buka usaha apa?`,
			CATEGORY_CHIPS
		);
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
		if (action.kind === 'restart') {
			this.smallBudget = null;
			this.#say('Boleh. Mau lihat usaha apa sekarang?', CATEGORY_CHIPS);
			return;
		}

		if (action.kind === 'category') {
			this.#app.setCategory(action.value);
			const name = CATEGORY_MAP[action.value].name.toLowerCase();
			this.#say(`Oke, ${name}. Modalnya kira-kira bagaimana?`, [
				{ label: 'Pas-pasan', action: { kind: 'budget', small: true } },
				{ label: 'Agak longgar', action: { kind: 'budget', small: false } }
			]);
			return;
		}

		if (action.kind === 'budget') {
			this.smallBudget = action.small;
			const cat = CATEGORY_MAP[this.#app.category].name.toLowerCase();
			// Frasa "modal kecil" inilah yang membuat mesin menyaring ke kawasan yang
			// ruang usahanya benar-benar tersedia — bukan sekadar basa-basi.
			const q = action.small
				? `Di mana buka ${cat} modal kecil dekat MRT?`
				: `Di mana buka ${cat} dekat MRT?`;
			void this.#ask(q, action.small
				? 'Saya carikan yang ruangnya benar-benar sedang disewakan, ya.'
				: 'Baik, saya lihat semuanya dulu.');
			return;
		}

		void this.#ask(action.question);
	}

	async #ask(question: string, preface?: string) {
		if (preface) this.#say(preface);
		const turn: Turn = { who: 'tapak', text: 'Sebentar, saya cek catatan saya…', pending: true };
		this.turns.push(turn);

		await this.#app.ask(question);

		const idx = this.turns.indexOf(turn);
		if (idx === -1) return;

		if (this.#app.aiError) {
			this.turns[idx] = {
				who: 'tapak',
				text: `Maaf, catatan saya tidak terbuka barusan. ${this.#app.aiError} Coba tanya lagi?`,
				chips: [{ label: 'Coba lagi', action: { kind: 'ask', question } }]
			};
			return;
		}

		const ans = this.#app.ai;
		if (!ans) {
			this.turns[idx] = { who: 'tapak', text: 'Saya belum menemukan apa-apa untuk itu.' };
			return;
		}

		this.turns[idx] = {
			who: 'tapak',
			text: this.#narrate(ans),
			answer: ans,
			chips: this.#followUps(ans)
		};
	}

	/** Menerjemahkan hasil mesin ke satu kalimat yang bisa dibaca siapa pun. */
	#narrate(ans: AiAnswer): string {
		// Model mengaku tidak paham. Tapak ikut mengaku, bukan mengarang jawaban
		// atas pertanyaan yang tidak ia mengerti — di sinilah kepercayaan dijaga.
		if (ans.notUnderstood) {
			return `${ans.notUnderstood} Yang saya hafal cuma kawasan di sekitar transit Jakarta, untuk lima jenis usaha. Mau saya carikan salah satunya?`;
		}

		const cat = CATEGORY_MAP[ans.query.kategori].name.toLowerCase();
		const n = ans.items.length;

		if (ans.query.intent === 'COVERAGE') {
			return n === 0
				? 'Semua kawasan sudah ada datanya.'
				: `Ada ${n} kawasan yang belum saya punya datanya sama sekali. Saya tidak menilainya — daripada saya karang, lebih baik saya bilang belum tahu.`;
		}
		if (ans.query.intent === 'FLAG_SATURATED') {
			return n === 0
				? 'Tidak ada yang benar-benar sesak untuk usaha ini.'
				: `Ini ${n} kawasan yang menurut saya sebaiknya dihindari dulu untuk ${cat} — pesaingnya rapat dan kebanyakan ramai.`;
		}
		if (ans.query.intent === 'COMPARE') {
			return n < 2 ? ans.headline : `Kalau dibandingkan, begini hasilnya.`;
		}
		if (n === 0) {
			return `Belum ada kawasan yang cocok untuk ${cat} dengan syarat itu. Mau saya longgarkan syaratnya?`;
		}
		const top = ans.items[0];
		return `Kalau saya yang pilih, ${top.name} dulu${
			top.value != null ? ` — nilainya ${pct(top.value)} dari 100` : ''
		}. Ini ${n} yang teratas menurut catatan saya.`;
	}

	#followUps(ans: AiAnswer): Chip[] {
		// Tidak paham berarti tidak ada hasil untuk ditindaklanjuti; yang berguna
		// justru menawarkan jalan yang memang bisa dijawab.
		if (ans.notUnderstood) return CATEGORY_CHIPS;

		const cat = CATEGORY_MAP[this.#app.category].name.toLowerCase();
		const chips: Chip[] = [];

		if (ans.query.intent !== 'FLAG_SATURATED') {
			chips.push({
				label: 'Mana yang sebaiknya dihindari?',
				action: { kind: 'ask', question: `Kawasan mana yang sudah jenuh untuk ${cat}?` }
			});
		}
		if (ans.query.intent !== 'COVERAGE') {
			chips.push({
				label: 'Mana yang belum ada datanya?',
				action: { kind: 'ask', question: 'Kawasan mana yang belum terdata?' }
			});
		}
		chips.push({ label: 'Coba usaha lain', action: { kind: 'restart' } });
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

		const def = CATEGORY_MAP[this.#app.category];
		if (row.nodata) {
			this.#say(
				`${row.name} — kawasan ini belum ada datanya, jadi saya tidak berani menilai. Yang saya tahu cuma ada ${row.osm} ${def.name.toLowerCase()} di sekitarnya menurut peta terbuka.`
			);
			return;
		}
		const verdict =
			(row.score ?? 0) >= 0.66
				? 'Ini termasuk yang bagus'
				: (row.score ?? 0) >= 0.4
					? 'Ini menengah'
					: 'Terus terang ini kurang menjanjikan';
		this.#say(
			`${row.name} — ${verdict.toLowerCase()} untuk ${def.name.toLowerCase()}, nilainya ${pct(
				row.score
			)}. Ada ${row.osm} pesaing sejenis, dan ${
				row.listings > 0 ? `${row.listings} tempat sedang disewakan` : 'tidak ada tempat yang sedang disewakan'
			}.`
		);
	}
}
