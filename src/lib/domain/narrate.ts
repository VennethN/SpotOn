import type { Copy } from '$lib/i18n';
import { formatHour, pct } from '$lib/utils/format';
import { METRIC_MAP } from './metrics';
import type { AiAnswer, MetricKey, Recommendation, ScoredHex, StructuredQuery } from '$lib/types';

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
	if (kind === 'hour') return formatHour(m.value);
	if (kind === 'rupiah') return c.query.perM2(m.value);
	return c.query.count(m.value);
}

/** What a measure is called, for saying which figure an answer is about. */
export const metricName = (k: MetricKey, c: Copy): string => c.query.metrics[k] ?? k;

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

	const cat = c.category[ans.query.kategori].name.toLowerCase();
	const n = ans.items.length;

	if (ans.query.intent === 'COVERAGE') {
		return n === 0 ? n$.coverageNone : n$.coverageSome(n);
	}
	if (ans.query.intent === 'FLAG_SATURATED') {
		return n === 0 ? n$.saturatedNone : n$.saturatedSome(n, cat);
	}
	if (ans.query.intent === 'COMPARE') {
		return n < 2 ? ans.headline : n$.compare;
	}
	if (n === 0) return n$.rankNone(cat);

	const top = ans.items[0];
	// A ranking by something other than the opportunity score has to say so, and say
	// which figure. Without it every answer opened "if I had to pick, X, scoring 93 out
	// of 100" — the same sentence whether the question was where to open, where is
	// busiest, or where space is cheapest.
	if (top.measure) {
		return n$.rankBy(top.name, metricName(top.measure.ukuran, c), metricValue(top.measure, c), n);
	}
	return n$.rankTop(top.name, top.value != null ? pct(top.value) : null, n);
}

/**
 * The structured query rewritten as ordinary word fragments.
 *
 * The content is exactly the query object the engine ran — the user can still
 * check what the map understood — but without syntax only a programmer can read.
 */
export function describeQuery(q: StructuredQuery, c: Copy): string[] {
	const out = [c.category[q.kategori].name.toLowerCase()];
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
	// Only when the newer filter list did not already say it, so the chips do not read
	// "space available · space available".
	if (q.filter?.ruang_sewa_tersedia && !q.filters?.length) out.push(c.query.hasSpace);
	if (q.filter?.tier_harga === 'rendah' && !q.filters?.length) out.push(c.query.cheap);
	return out;
}

/**
 * The supply phrase has to reflect BOTH of its drivers (competitor count × how
 * busy they are). Read only the busyness and the narrative can end up contradicting
 * the very score it accompanies.
 */
export function supplyPhrase(r: ScoredHex, c: Copy): string {
	const dense = (r.supply ?? 0) >= 0.6;
	const busy = r.busy >= 0.45;
	if (dense && busy) return c.supply.denseBusy;
	if (dense && !busy) return c.supply.denseQuiet;
	if (!dense && busy) return c.supply.fewBusy;
	return c.supply.fewQuiet;
}
