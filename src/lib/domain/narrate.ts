import type { Copy } from '$lib/i18n';
import { formatHour, pct } from '$lib/utils/format';
import { METRIC_MAP } from './metrics';
import { DEFAULT_WEIGHTS } from './weights';
import type {
	AiAnswer,
	CategoryKey,
	Explanation,
	MetricKey,
	Recommendation,
	ScoredHex,
	StructuredQuery
} from '$lib/types';

/**
 * One measured value, in the reader's language.
 *
 * The engine already wrote this value out once, into `measure.text`, and that string is
 * Indonesian on purpose: it is API output, a stable contract for anything reading the
 * endpoint directly. What the reader sees is rebuilt here from the structured fields
 * beside it, so an English reader gets "Rp 45m/m²" rather than the API's phrasing.
 */
export function metricValue(m: NonNullable<Recommendation['measure']>, c: Copy): string {
	const kind = METRIC_MAP[m.ukuran]?.kind;
	if (kind === 'pct') return `${pct(m.value)}%`;
	if (kind === 'rupiah') return c.query.perM2(m.value);
	return c.query.count(m.value);
}

/** What a measure is called, for saying which figure an answer is about. */
export const metricName = (k: MetricKey, c: Copy): string => c.query.metrics[k] ?? k;

/**
 * The business types an answer covers, written as one phrase in the reader's language.
 *
 * ONE PLACE, because a set of types is named in seven different sentences across the
 * app and the landing page, and seven hand-rolled joins would disagree about the
 * conjunction the first time anybody touched one. The joining word comes from the
 * locale files: Indonesian puts "dan" before the last item, English "and", and a
 * hard-coded comma would read as a list of separate answers rather than as one.
 *
 * `form` picks which name: `name` is the title case one for a heading, `many` the
 * lower-case plural for the middle of a sentence, `short` the one that has to fit on a
 * chip.
 */
export function categoryNames(
	cats: readonly CategoryKey[],
	c: Copy,
	form: 'name' | 'many' | 'short' = 'name'
): string {
	const parts = cats.map((k) => c.category[k][form]);
	if (parts.length < 2) return parts[0] ?? '';
	return `${parts.slice(0, -1).join(', ')} ${c.query.and} ${parts[parts.length - 1]}`;
}

/**
 * Turns the scoring engine's output into one sentence anybody can read.
 *
 * Kept separate from the `Tapak` class so the landing page uses exactly the same
 * sentences as the app. If the two each wrote their own, sooner or later the
 * landing page would promise something the app never says — precisely the kind of
 * dishonesty this product avoids.
 */
export function narrate(ans: AiAnswer, c: Copy): string {
	const n$ = c.narrate;
	// The model admits it did not understand. Tapak admits it too, rather than
	// inventing an answer to a question it does not grasp — this is where trust is kept.
	if (ans.notUnderstood) {
		// The model's own sentence, or the interface's when the rule parser could read
		// nothing in the question and has no sentence of its own to quote.
		return ans.notUnderstood === true ? n$.unclear : n$.notUnderstood(ans.notUnderstood);
	}

	// Small talk. The model's own sentence if it wrote one that survived the fence in
	// `domain/chat`, and this interface's canned line for the topic if it did not — which
	// is also the only thing available when there is no model at all. Either way nothing
	// was computed, so nothing else on screen changes.
	if (ans.chat) return ans.chat.text ?? c.chat[ans.chat.topik];

	/* Understood, and one word short of answerable. Said before the category name is
	   read below, because there is no category name to read: this is the branch where
	   the reader has not named one and the figure they asked for needs one. */
	if (ans.needsCategory) return c.narrate.needsCategory;

	/* The model's own sentence, when it wrote one and it cleared `domain/grounded`.
	   
	   Read before every composed sentence below and after the three above, which is the
	   right place for both reasons. It only ever exists on a turn that computed something,
	   so it can never stand in front of a refusal or a greeting. And where it does exist
	   it answers the question that was asked, which is the whole of why it is preferred:
	   the sentences below are composed per INTENT, so a question about one catchment's
	   rent and a question about why it is on the list produce the same words. */
	if (ans.reply) return ans.reply;

	const cat = categoryNames(ans.query.kategori, c, 'many');

	/* "Why that one." Read before the intents below, because this answer carries one
	   item like a ranking of one and would otherwise be narrated as a list. */
	if (ans.explain) return explainSentence(ans.explain, cat, c);
	// The intent was understood as a why-question and no catchment in it could be
	// matched. Asking which one is the honest move; guessing at the top of the last
	// ranking would explain a place nobody asked about.
	if (ans.query.intent === 'EXPLAIN') return n$.explainWhich;
	const n = ans.items.length;

	/**
	 * The mode this answer put the map into, when the question asked for one.
	 *
	 * Worth saying out loud precisely because the two halves of the screen then rank
	 * different things: the engine runs on the GRID whichever mode the map is in, so
	 * these named catchments are the answer to "where", while the panel beside them lists
	 * the individual premises standing in them. Both are true and they are not the same
	 * list, and a reader who watched the map change without being told what changed would
	 * reasonably read that as a contradiction.
	 *
	 * Only when the question named a mode. `pivot` is left undefined by both the rule
	 * parser and the model unless the reader asked, so this never appears on a question
	 * that said nothing about it.
	 */
	const mode = ans.query.pivot
		? ` ${ans.query.pivot === 'unit' ? n$.nowByUnit : n$.nowByCell}`
		: '';

	if (ans.query.intent === 'COVERAGE') {
		return (n === 0 ? n$.coverageNone : n$.coverageSome(n)) + mode;
	}
	if (ans.query.intent === 'FLAG_SATURATED') {
		return (n === 0 ? n$.saturatedNone : n$.saturatedSome(n, cat)) + mode;
	}
	if (ans.query.intent === 'COMPARE') {
		return (n < 2 ? ans.headline : n$.compare) + mode;
	}
	if (n === 0) return n$.rankNone(cat) + mode;

	const top = ans.items[0];
	// A ranking by something other than the opportunity score has to say so, and say
	// which figure. Without it every answer opened "if I had to pick, X, scoring 93 out
	// of 100" — the same sentence whether the question was where to open, where is
	// busiest, or where space is cheapest.
	if (top.measure) {
		return (
			n$.rankBy(top.name, metricName(top.measure.ukuran, c), metricValue(top.measure, c), n) +
			mode
		);
	}
	return n$.rankTop(top.name, top.value != null ? pct(top.value) : null, n) + mode;
}

/**
 * One catchment's score, said out loud in the reader's language.
 *
 * Assembled from the parts rather than from the engine's own `why` line, which is
 * Indonesian API output — the same split every other sentence here is built on. Every
 * figure in it was computed by the scoring engine on the grid, and there is no branch
 * in which one is guessed at: an unsurveyed catchment says it is unsurveyed and stops.
 *
 * The clauses are separate strings and not one long template because the two languages
 * put them in different orders, and because most of them are conditional. A catchment
 * with nothing on the market must not say "0 units are on the market, median price ·".
 */
function explainSentence(e: Explanation, cat: string, c: Copy): string {
	const n$ = c.narrate.explain;
	// Nobody has read this street. Everything below depends on a competitor count, so
	// there is nothing to take apart, and saying so is the whole answer.
	if (!e.covered || e.score === null) return n$.unscored(e.name, cat, e.stops, e.radius);

	/* THE QUESTION ASKED ABOUT A FIGURE, SO THE ANSWER LEADS WITH IT.
	   
	   Without this the shape explained the opportunity score whatever was asked, so "what
	   is the rent at Pusdiklat BPS" and "why is it on the list" produced the same
	   paragraph and the price sat fourth in it. A shape and a measure are chosen
	   separately everywhere else in this engine, and this is that rule applied here. */
	if (e.measure) {
		const name = metricName(e.measure.ukuran, c);
		if (e.measure.value === null) return n$.measureNone(e.name, name);
		const parts = [n$.measure(e.name, name, metricValue({ ...e.measure, value: e.measure.value }, c))];
		/* Where it sits among the others, which is what "is that cheap" actually asks.
		   Only for the price, because it is the only measure this row carries a position
		   on the grid for, and a position invented for the rest would be one. */
		if (e.measure.ukuran === 'harga_tempat' && e.priceLevel !== null) {
			parts.push(n$.priceRank(Math.round(e.priceLevel * 100)));
			parts.push(n$.priceIsSale);
		}
		parts.push(n$.scoreAside(pct(e.score), cat));
		return parts.join(' ');
	}

	const parts = [n$.lead(e.name, cat, pct(e.score))];
	parts.push(n$.crowd(e.density, e.radius, pct(e.demand)));
	parts.push(
		e.rivals === 0 ? n$.rivalsNone(cat) : n$.rivals(e.rivals, cat, pct(e.supply))
	);
	parts.push(
		e.units === 0
			? n$.spaceNone
			: e.price === null
				? n$.spaceUnpriced(e.units)
				: n$.space(e.units, c.query.perM2(e.price))
	);
	/* Only when it actually moved the score, and said as a POSITION on the ladder rather
	   than as a verdict. The multiplier is below 1 for everything except the cheapest
	   catchment on the grid, so "space here is expensive" would be said of a catchment in
	   the cheapest tenth. It is exactly 1 where nothing was priced, and a deduction
	   reported there would be one that never happened. */
	const dearer = e.priceLevel === null ? 0 : Math.round(e.priceLevel * 100);
	if (e.costFactor < 1 && dearer >= 1) parts.push(n$.costHeld(dearer));
	if (e.stops > 0) parts.push(n$.transit(e.stops));
	return parts.join(' ');
}

/**
 * The structured query rewritten as ordinary word fragments.
 *
 * The content is exactly the query object the engine ran — the user can still
 * check what the map understood — but without syntax only a programmer can read.
 */
export function describeQuery(q: StructuredQuery, c: Copy): string[] {
	const out = [categoryNames(q.kategori, c, 'many')];
	if (q.intent === 'FLAG_SATURATED') out.push(c.query.saturated);
	if (q.intent === 'COVERAGE') out.push(c.query.coverage);
	// Named, because the reader has to be able to see that the map answered about ONE
	// place rather than ranking the grid again — which is precisely what it used to do
	// with this question.
	if (q.intent === 'EXPLAIN') out.push(c.query.explain);
	// Which figure, and which end of it. Only when it is not the opportunity score,
	// which is what the whole map is about anyway and would be noise on every chip row.
	if (q.intent === 'RANK' && q.ukuran && q.ukuran !== 'skor') {
		out.push(c.query.sortedBy(metricName(q.ukuran, c), q.urut === 'asc'));
	}
	// The band filters, named. A reader has to be able to see that "cheap" narrowed the
	// map to a third of it, rather than wondering where the other cells went.
	for (const f of q.filters ?? []) {
		out.push(c.query.band(metricName(f.ukuran, c), f.arah));
	}
	if (q.filter?.dalam_catchment_transit) out.push(c.query.within(q.radius_m));
	/* The two things an answer is allowed to change about the MAP rather than about the
	   ranking. Both are said out loud for the same reason every filter is: the reader
	   watched the map move, and a chip row that does not account for it leaves them
	   guessing which part of what they are looking at they asked for.

	   The radius is only worth a chip when it is not the standard walk — printed on every
	   answer it would be a constant, and a constant on a row of chips reads as noise
	   rather than as information. Skipped when the transit chip above already carries it. */
	if (q.pivot) out.push(q.pivot === 'unit' ? c.query.pivotUnit : c.query.pivotCell);
	if (q.radius_m !== DEFAULT_WEIGHTS.radius && !q.filter?.dalam_catchment_transit) {
		out.push(c.query.radius(q.radius_m));
	}
	// Only when the newer filter list did not already say it, so the chips do not read
	// "space available · space available".
	if (q.filter?.ruang_sewa_tersedia && !q.filters?.length) out.push(c.query.hasSpace);
	if (q.filter?.tier_harga === 'rendah' && !q.filters?.length) out.push(c.query.cheap);
	return out;
}

/**
 * The competition phrase, read off BOTH sides of the gap.
 *
 * Rivals alone say very little: five coffee shops on a street with two hundred other
 * businesses is a different place from five on a street with eight. So the phrase pairs
 * the count of rivals with the trade around them, and those are the two figures the
 * score itself is made of — the sentence cannot end up contradicting the number it sits
 * beside.
 *
 * It used to pair the count with how busy those rivals were, from a column that was
 * generated. Nobody has ever measured how full the shops of Jakarta are.
 */
export function supplyPhrase(r: ScoredHex, c: Copy): string {
	const dense = (r.supply ?? 0) >= 0.6;
	const busy = (r.demand ?? 0) >= 0.45;
	if (dense && busy) return c.supply.denseBusy;
	if (dense && !busy) return c.supply.denseQuiet;
	if (!dense && busy) return c.supply.fewBusy;
	return c.supply.fewQuiet;
}
