import { CATEGORIES } from '$lib/domain/categories';
import { narrate } from '$lib/domain/narrate';
import { copy } from '$lib/state/lang.svelte';
import { pct } from '$lib/utils/format';
import type { AppState } from '$lib/state/app.svelte';
import type { AiAnswer, CategoryKey } from '$lib/types';

/**
 * Tapak — the guide inside SpotOn.
 *
 * Tapak is one of the little white figures in the diorama: someone who has walked
 * every area and reports what they saw. Tapak leads the conversation rather than
 * waiting to be typed at: greeting first, asking back, offering options that can be
 * tapped, and commenting when the user picks an area on the map themselves.
 *
 * What matters: Tapak never invents a number. Every answer comes from
 * `/api/ai/query` — the same scoring engine the whole app uses. Tapak only chooses
 * which question gets asked and translates the result into plain language. That is
 * why every question offered always maps to one of the intents the engine actually
 * understands (RANK, FLAG_SATURATED, COMPARE, COVERAGE) — Tapak must never promise
 * something that cannot be answered.
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
	/**
	 * A stable identity for one turn.
	 *
	 * Needed because `turns` is a `$state` proxy: the object pushed in is not the
	 * same object that comes back out, so `indexOf(turn)` never matched and the
	 * "thinking" bubble was never replaced by the answer. Every reply silently
	 * stalled on "checking my notes".
	 */
	id: number;
	who: 'tapak' | 'user';
	text: string;
	chips?: Chip[];
	/** The scoring engine's result, shown as a list of places. */
	answer?: AiAnswer;
	/** Marks a turn that is waiting for the engine's answer. */
	pending?: boolean;
}

/* Chips are built on demand rather than once at module level: their labels follow
   the selected language, and the language can change mid-conversation. */
function categoryChips(): Chip[] {
	const c = copy();
	return CATEGORIES.map((def) => ({
		label: c.category[def.key].name,
		action: { kind: 'category', value: def.key }
	}));
}

export class Tapak {
	turns = $state<Turn[]>([]);
	/** Small budget → results are filtered to areas where space is genuinely available. */
	smallBudget = $state<boolean | null>(null);
	#app: AppState;
	#nextId = 0;
	#greeted = false;
	/** The last area commented on, so Tapak does not repeat itself. */
	#lastRemarked: string | null = null;

	constructor(app: AppState) {
		this.#app = app;
	}

	get busy() {
		return this.#app.aiLoading;
	}

	#say(text: string, chips?: Chip[]) {
		this.turns.push({ id: this.#nextId++, who: 'tapak', text, chips });
	}

	/** Clears the thread and greets again — used when the language is switched. */
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
		// The figures are read from the data, not written by hand — once the grid is
		// rebuilt, Tapak's greeting stays correct without anyone remembering to update it.
		const { withData, total } = this.#app.coverage;
		this.#say(copy().tapak.greet(total, withData), categoryChips());
	}

	/** Closes the chips on the last turn so stale options cannot be tapped again. */
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
		this.turns.push({ id: this.#nextId++, who: 'user', text: chip.label });
		this.#run(chip.action);
	}

	/** A hand-typed question is served by the very same engine. */
	submit(text: string) {
		const q = text.trim();
		if (!q) return;
		this.#consume();
		this.turns.push({ id: this.#nextId++, who: 'user', text: q });
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
			// It is the phrase "modal kecil" (small budget) that makes the engine filter
			// down to areas where commercial space is genuinely available — not small talk.
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
		const id = this.#nextId++;
		this.turns.push({ id, who: 'tapak', text: copy().ai.thinking, pending: true });

		await this.#app.ask(question);

		// Found by id, not by object identity: `turns` is a proxy, so `indexOf` on the
		// raw object always misses and the reply is dropped on the floor.
		const idx = this.turns.findIndex((t) => t.id === id);
		if (idx === -1) return;

		const c = copy();
		if (this.#app.aiError) {
			this.turns[idx] = {
				id,
				who: 'tapak',
				text: c.tapak.failed(this.#app.aiError),
				chips: [{ label: c.tapak.retry, action: { kind: 'ask', question } }]
			};
			return;
		}

		const ans = this.#app.ai;
		if (!ans) {
			this.turns[idx] = { id, who: 'tapak', text: c.tapak.nothing };
			return;
		}

		this.turns[idx] = {
			id,
			who: 'tapak',
			text: narrate(ans, c),
			answer: ans,
			chips: this.#followUps(ans)
		};
	}

	#followUps(ans: AiAnswer): Chip[] {
		// Not understanding means there is no result to follow up on; what helps is
		// offering routes that can actually be answered.
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
	 * Called when the user picks an area on the map themselves. Tapak turns to look
	 * too — this is what sets it apart from a chat box that only waits to be typed in.
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
