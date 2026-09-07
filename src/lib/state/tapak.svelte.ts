import { CATEGORIES } from '$lib/domain/categories';
import { categoryNames, narrate } from '$lib/domain/narrate';
import { copy } from '$lib/state/lang.svelte';
import { pct } from '$lib/utils/format';
import type { AppState } from '$lib/state/app.svelte';
import type { AiAnswer, AiStage, CategoryKey } from '$lib/types';

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
	/**
	 * Marks a turn that is waiting with nothing to show yet. The panel says which
	 * `stage` is running rather than one motionless line, because the wait runs to
	 * ninety seconds at its longest and a line that never changes in that time is
	 * indistinguishable from a broken one.
	 */
	pending?: boolean;
	stage?: AiStage;
	/**
	 * The text is arriving in pieces and is not final.
	 *
	 * True only for the casual reply, which is the one sentence in the product the model
	 * writes. It is a PREVIEW: the sentence in the finished answer replaces it, and it
	 * can be taken away entirely if it fails `domain/chat`'s fence.
	 */
	streaming?: boolean;
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
	/**
	 * What Tapak says about the area the user just picked, shown as a toast rather
	 * than as a turn.
	 *
	 * Kept apart from `turns` on purpose: the thread is the conversation, and this is
	 * Tapak looking where the user is pointing. Mixing the two made the thread grow by
	 * a paragraph on every tap of the map.
	 */
	remark = $state<{ id: number; text: string } | null>(null);
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
		this.remark = null;
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
		const { total } = this.#app.coverage;
		this.#say(copy().tapak.greet(total), categoryChips());
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
			const cat = categoryNames(this.#app.categories, c, 'many');
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

	/**
	 * The turn being waited on, by id.
	 *
	 * Found by id, not by object identity: `turns` is a proxy, so `indexOf` on the raw
	 * object always misses and the reply is dropped on the floor. Looked up fresh on
	 * every event rather than held onto, because a language switch clears the thread
	 * mid-answer and a held index would then write into somebody else's turn.
	 */
	#waiting(id: number): Turn | null {
		const idx = this.turns.findIndex((t) => t.id === id);
		return idx === -1 ? null : this.turns[idx];
	}

	async #ask(question: string, preface?: string) {
		if (preface) this.#say(preface);
		const id = this.#nextId++;
		this.turns.push({ id, who: 'tapak', text: '', pending: true, stage: 'reading' });

		await this.#app.ask(question, {
			// Which half of the engine is running. No figures, and no percentage of
			// anything: there is nothing here that could honestly be a fraction.
			stage: (stage) => {
				const turn = this.#waiting(id);
				if (turn) turn.stage = stage;
			},
			// The casual reply, as it is written. Nothing else arrives this way.
			delta: (text) => {
				const turn = this.#waiting(id);
				if (!turn) return;
				turn.text += text;
				turn.streaming = true;
				turn.pending = false;
			},
			// The reply broke the fence, or the model that was writing it gave up. Either
			// way it comes off the screen and the wait goes back on.
			reset: () => {
				const turn = this.#waiting(id);
				if (!turn) return;
				turn.text = '';
				turn.streaming = false;
				turn.pending = true;
			}
		});

		const idx = this.turns.findIndex((t) => t.id === id);
		if (idx === -1) return;

		const c = copy();
		/* The question was never sent, or was sent and refused. Handled BEFORE the answer
		   is read, because `app.ai` still holds the answer to the PREVIOUS question: read
		   in this order, a refused turn would come back carrying somebody else's places.

		   No retry chip either, unlike a failure. Asking the same thing again is exactly
		   what will not work, and the way on is a plan rather than a second attempt, which
		   the notice over the map is already offering. */
		if (this.#app.outOf === 'ai' || this.#app.signedOut) {
			this.turns[idx] = {
				id,
				who: 'tapak',
				text: this.#app.signedOut ? c.account.errors.signedout : c.tapak.outOfQuota
			};
			return;
		}

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

		// Understood, and waiting on a business type. The thirteen are offered directly,
		// because the reply just asked which one and making the reader type it out again
		// would be asking twice.
		if (ans.needsCategory) return categoryChips();

		// Small talk gets the same treatment, and this is the "not too much" part of
		// allowing it at all: a casual turn always ends holding the door open to a
		// question the map can answer. Without it, chat is a room with no exit — the
		// reader says hello, gets a friendly sentence back, and is left where they
		// started with nothing to tap.
		if (ans.chat) return categoryChips();

		const c = copy();
		const cat = categoryNames(this.#app.categories, c, 'many');
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
	 * too, which is what sets this apart from a chat box that only waits to be typed
	 * in.
	 *
	 * The remark does NOT go into the thread. A thread is a conversation, and a
	 * conversation is made of things that were asked and answered; picking an area on
	 * the map asked nothing. Pushed in as turns, five taps around the map left five
	 * paragraphs stacked under the question the user actually asked, burying it. So
	 * the remark is set aside here and shown as a toast instead: same voice, same
	 * figure, gone on its own.
	 */
	remarkOnSelection() {
		const row = this.#app.selected;
		// Deselecting takes the remark with it. A note about an area nobody is looking
		// at any more is a claim about the map that the map no longer makes.
		if (!row) {
			this.remark = null;
			this.#lastRemarked = null;
			return;
		}
		if (row.name === this.#lastRemarked) return;
		if (!this.#greeted) return;
		this.#lastRemarked = row.name;

		const c = copy();
		const cat = categoryNames(this.#app.categories, c, 'many');
		// Unscored means the active source has never read this cell's city. Saying so is
		// the whole remark: a verdict here would be a number about a place nobody counted.
		if (row.score === null) {
			this.#note(c.narrate.remarkUncovered(row.name, cat));
			return;
		}
		const verdict =
			(row.score ?? 0) >= 0.66
				? c.narrate.verdictGood
				: (row.score ?? 0) >= 0.4
					? c.narrate.verdictMid
					: c.narrate.verdictLow;
		this.#note(
			c.narrate.remark(
				row.name,
				verdict,
				cat,
				pct(row.score),
				row.osm,
				row.units > 0 ? c.narrate.listingSome(row.units) : c.narrate.listingNone
			)
		);
	}

	/** Set the remark aside for the toast. The id changes every time, so picking a
	    second area restarts the toast rather than quietly swapping its text. */
	#note(text: string) {
		this.remark = { id: this.#nextId++, text };
	}

	/** Dismissed by hand, or by its own timer. */
	clearRemark() {
		this.remark = null;
	}
}
