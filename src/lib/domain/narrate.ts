import type { Copy } from '$lib/i18n';
import { pct } from '$lib/utils/format';
import type { AiAnswer, ScoredHex, StructuredQuery } from '$lib/types';

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
	if (q.filter?.dalam_catchment_transit) out.push(c.query.within(q.radius_m));
	if (q.filter?.ruang_sewa_tersedia) out.push(c.query.hasSpace);
	if (q.filter?.tier_harga === 'rendah') out.push(c.query.cheap);
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
