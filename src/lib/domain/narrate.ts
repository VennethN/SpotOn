import type { Copy } from '$lib/i18n';
import { formatHour, pct } from '$lib/utils/format';
import { METRIC_MAP } from './metrics';
import { DEFAULT_WEIGHTS } from './weights';
import type {
	AiAnswer,
	CategoryKey,
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
	if (ans.notUnderstood) return n$.notUnderstood(ans.notUnderstood);

	// Small talk. The model's own sentence if it wrote one that survived the fence in
	// `domain/chat`, and this interface's canned line for the topic if it did not — which
	// is also the only thing available when there is no model at all. Either way nothing
	// was computed, so nothing else on screen changes.
	if (ans.chat) return ans.chat.text ?? c.chat[ans.chat.topik];

	/* Understood, and one word short of answerable. Said before the category name is
	   read below, because there is no category name to read: this is the branch where
	   the reader has not named one and the figure they asked for needs one. */
	if (ans.needsCategory) return c.narrate.needsCategory;

	const cat = categoryNames(ans.query.kategori, c, 'many');
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
 * The structured query rewritten as ordinary word fragments.
 *
 * The content is exactly the query object the engine ran — the user can still
 * check what the map understood — but without syntax only a programmer can read.
 */
export function describeQuery(q: StructuredQuery, c: Copy): string[] {
	const out = [categoryNames(q.kategori, c, 'many')];
	if (q.intent === 'FLAG_SATURATED') out.push(c.query.saturated);
	if (q.intent === 'COVERAGE') out.push(c.query.coverage);
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
