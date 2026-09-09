import { CATEGORIES } from '$lib/domain/categories';
import { categoryNames, narrate } from '$lib/domain/narrate';
import { greetingNow } from '$lib/state/clock';
import { copy } from '$lib/state/lang.svelte';
import { pct } from '$lib/utils/format';
import type { AppState } from '$lib/state/app.svelte';
import type { AiAnswer, AiStage, CategoryKey, ChatTurn } from '$lib/types';

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
 * understands (RANK, FLAG_SATURATED, COMPARE, COVERAGE, EXPLAIN) — Tapak must never
 * promise something that cannot be answered.
 *
 * IT IS A THREAD, NOT A ROW OF FORMS. Every turn goes out with the ones before it, so a
 * follow-up is understood as a follow-up: "why that one", "compare the top two", "what
 * about pharmacies instead". Whether a turn needs data at all is decided per turn by the
 * understanding layer rather than by a list of recognised phrasings kept here, which is
 * why this class knows about the thread and nothing about what may be said into it.
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
	 * The places a turn is ABOUT when it carries no answer to read them off.
	 *
	 * An answer's places are its items. A scripted line has none, and the one scripted
	 * line that needs some is the one the area card files, "Pondok Jati, then": what it
	 * puts into the thread is the name, so that whatever is typed next is read about
	 * that place. See `askAbout`.
	 */
	places?: string[];
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
	 * True only for the casual reply, which is the one sentence the model writes with
	 * nothing computed behind it. The answer's own sentence is written by the model too and
	 * arrives whole, because it is made of figures and no figure is ever streamed. It is a PREVIEW: the sentence in the finished answer replaces it, and it
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
	/**
	 * The place the next question is about, when a surface has said so.
	 *
	 * Only the box's placeholder reads it. The thread carries the name itself, on the
	 * turn `askAbout` files, and that is what the understanding layer reads. Cleared
	 * the moment a question goes out, so the hint never outlives the question it was
	 * a hint for.
	 */
	subject = $state<string | null>(null);
	/**
	 * Bumped when a surface asks for the question box. The panel focuses its field
	 * on every change, and the page raises the sheet on a compact screen so the field
	 * is not under the keyboard that opens for it. A counter rather than a flag, so
	 * two asks in a row are two focuses.
	 */
	focusRequest = $state(0);
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
		this.subject = null;
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
		// And the salutation is read from the reader's own clock, so Tapak opens with
		// the same words the card outside greeted them with a moment ago.
		const { part, wording } = greetingNow();
		this.#say(copy().tapak.greet(total, part, wording), categoryChips());
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
		this.subject = null;
		void this.#ask(q);
	}

	/**
	 * The reader wants to ask about ONE place, in their own words.
	 *
	 * Offered from the area card, where the reader is already looking at the place.
	 * Nothing is asked here. The thread is told which place is meant, by one short line
	 * carrying the name, so the next question, whatever it is, is read about that place:
	 * "is the rent any good", "why so low", "how busy is it" all resolve against it the
	 * way a follow-up to a ranking does. Then the box is handed the focus with an empty
	 * field. A menu of questions here would be the wrong shape twice over: wrong the
	 * first time somebody wanted to ask something not on it, and redundant beside a box
	 * that takes anything.
	 *
	 * Pressed twice for the same place it files nothing twice. The line is already the
	 * last thing said, and saying it again would be Tapak repeating itself to a reader
	 * who only wanted the cursor back.
	 */
	askAbout(name: string) {
		const last = this.turns[this.turns.length - 1];
		const already =
			last?.who === 'tapak' && !last.answer && !last.pending && last.places?.[0] === name;
		if (!already) {
			this.#consume();
			this.turns.push({
				id: this.#nextId++,
				who: 'tapak',
				text: copy().tapak.aboutPlace(name),
				places: [name]
			});
		}
		this.subject = name;
		this.focusRequest++;
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
			/* ONE TAP, ONE QUESTION, and the model takes over from here. There used to be a
			   second scripted turn in between, asking about the rent, so the reader answered
			   two questions from a script before hearing one thing from the data. Nothing in
			   that turn came from the model or from the grid: it was a form with a face. The
			   rent narrowing is offered on the answer instead, see `#followUps`, where it is
			   what it actually is, one filter on a result the reader has already seen. */
			void this.#ask(this.#openingQuestion());
			return;
		}

		if (action.kind === 'budget') {
			this.smallBudget = action.small;
			void this.#ask(this.#openingQuestion());
			return;
		}

		void this.#ask(action.question);
	}

	/**
	 * The question a tapped business type asks, and the one the rent chip asks again.
	 *
	 * Indonesian whatever the reader's language, because it is a question for the engine:
	 * "modal kecil" is the phrase that narrows the result to areas where space is genuinely
	 * on the market in the lower price band, and "dekat MRT" is what puts the transit
	 * filter on. The business type is written in the reader's language, which both the
	 * model and the rule parser read.
	 */
	#openingQuestion(): string {
		const cat = categoryNames(this.#app.categories, copy(), 'many');
		return this.smallBudget
			? `Di mana buka ${cat} modal kecil dekat MRT?`
			: `Di mana buka ${cat} dekat MRT?`;
	}

	/**
	 * The conversation so far, in the shape the engine is given it.
	 *
	 * THIS IS WHAT MAKES IT A CONVERSATION. Every question used to go out on its own,
	 * so "kenapa yang itu" was read as a brand new question about nothing in particular
	 * and came back as the previous answer all over again. A follow-up does not carry
	 * its own subject; the thread is where the subject is.
	 *
	 * An answer contributes the NAMES it put on screen. Not its figures: those were
	 * computed here from the grid, and a figure sent back to the model is a figure the
	 * model has read and could write out again in a sentence of its own. The names are
	 * what "that one" points at, and they are all this has to carry.
	 *
	 * Turns still being waited on are left out. A bubble with nothing in it yet is not
	 * something that was said.
	 */
	#thread(): ChatTurn[] {
		const out: ChatTurn[] = [];
		for (const turn of this.turns) {
			if (turn.pending || !turn.text.trim()) continue;
			if (turn.who === 'user') {
				out.push({ who: 'user', text: turn.text });
				continue;
			}
			/* The head of the list and no more. A coverage answer names ninety-nine
			   catchments and nobody points at the seventy-first, so the rest is weight on
			   every request from here on for nothing. The endpoint caps this too, because
			   it is the one that has to survive a caller that did not. */
			const places =
				turn.places ?? (turn.answer?.items ?? []).slice(0, 8).map((i) => i.name);
			out.push(
				places.length
					? { who: 'tapak', text: turn.text, places }
					: { who: 'tapak', text: turn.text }
			);
		}
		return out;
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

	async #ask(question: string) {
		// Read before the waiting bubble goes in, so the thread is what was actually
		// said rather than what is about to be.
		const history = this.#thread();
		const id = this.#nextId++;
		this.turns.push({ id, who: 'tapak', text: '', pending: true, stage: 'reading' });

		await this.#app.ask(question, history, {
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
				text: c.tapak.failed,
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

		/* The question a reader handed a ranking actually asks next, offered rather than
		   left to be discovered. One chip, not a menu of phrasings: the box below takes
		   anything, and the point of this one is to show that it does.

		   Never on an answer that is already about one place, where it would offer to
		   explain what was just explained. */
		const top = ans.items[0];
		if (top && !ans.explain) {
			const why = c.tapak.why(top.name);
			chips.push({ label: why, action: { kind: 'ask', question: why } });
		}

		/* The rent question, which used to be asked before anything had been answered. It
		   is offered here instead, on a ranking, as the narrowing it is: one tap asks the
		   same question again with the filter on, or with it off again. Read off the
		   answer's own query rather than off `smallBudget`, because a typed question can
		   carry the filter too and the chip has to offer the opposite of what is on screen. */
		if (ans.query.intent === 'RANK' && ans.items.length) {
			const tight = ans.query.filter?.tier_harga === 'rendah';
			chips.push({
				label: tight ? c.tapak.budgetLoose : c.tapak.budgetTight,
				action: { kind: 'budget', small: !tight }
			});
		}

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
