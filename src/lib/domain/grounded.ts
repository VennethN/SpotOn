/**
 * A sentence the model wrote, and the rule that every figure in it was computed.
 *
 * WHY THIS EXISTS
 *
 * Tapak could answer in exactly one way: the engine ran an operation, and an interface
 * template read the result out. Every ranking opened "if I had to pick, X first", every
 * explanation was the same paragraph with different numbers, and two different questions
 * about one catchment came back word for word identical. That is a state machine wearing
 * a conversation's clothes, and a reader notices within two turns.
 *
 * So the model writes the reply. What it may write is fenced, and the fence is what makes
 * this a widening of the product rather than a hole in it.
 *
 * WHY IT IS NOT `domain/chat`'s FENCE
 *
 * That one bans digits outright, which is right for small talk: a casual turn computes
 * nothing, so any figure in it is invented by definition. Here the opposite holds. The
 * engine has just computed a page of figures, and the whole point is to say them. Banning
 * digits would leave the model able to write only the sentences that carry no answer.
 *
 * The rule that replaces it is GROUNDING: a reply may carry a figure only if that figure
 * is one of the ones handed to it. Not "looks plausible", not "is about the right size" —
 * present, in the facts the scoring engine produced for this turn. A model that writes
 * "warteg biasanya balik modal dalam 8 bulan" has written an 8 nobody computed, and the
 * reply is thrown away whole rather than repaired.
 *
 * The guarantee is therefore unchanged from the one the rest of the product makes, and it
 * is worth stating in the same words: no figure a reader sees was written by the model.
 * Every one of them was computed by `domain/scoring` on the data, and this module is what
 * checks that the sentence around them did not add any.
 */

import { moneyScale } from '$lib/utils/format';
import { METRIC_MAP } from './metrics';
import type { AiAnswer } from '$lib/types';

/**
 * One figure, written so that two renderings of it compare equal.
 *
 * The two languages punctuate numbers in opposite directions and the model may echo
 * either, so "Rp 59,8 jt" and "Rp 59.8m" have to reach the same string. Group separators
 * are the ones followed by exactly three more digits, which is what tells `59.800.000`
 * (a grouped integer) from `59.8` (a decimal). Everything left is a decimal mark.
 *
 * Deliberately NOT parsed to a number. `08` and `8` are different things to look at on a
 * screen, and a check that reads them as equal is a check that can be argued with.
 */
export function normaliseFigure(token: string): string {
	const grouped = token.replace(/[.,](?=\d{3}(?!\d))/g, '');
	return grouped.replace(',', '.').replace(/[.,]+$/, '');
}

/** Every figure written in a piece of text, in the order it appears. */
export function figuresIn(text: string): string[] {
	return (text.match(/\d[\d.,]*/g) ?? []).map(normaliseFigure).filter(Boolean);
}

/** The figures a reply is allowed to carry: exactly the ones its facts carry. */
export function allowedFigures(facts: string): Set<string> {
	const out = new Set(figuresIn(facts));
	/* The scale a proportion is read against. Every score in this product is said as "N
	   out of 100" and the 100 is the interface's own word for the scale, not a reading of
	   anything, so it is never in the facts and would fail on every reply that quoted a
	   score correctly. 0 is here for the same reason: it is the other end of the ruler. */
	out.add('100');
	out.add('0');
	return out;
}

/** The figures in a reply that nobody computed. Empty means the reply is grounded. */
export function ungroundedFigures(reply: string, allowed: ReadonlySet<string>): string[] {
	return figuresIn(reply).filter((f) => !allowed.has(f));
}

/**
 * A quantity written as a word rather than as digits.
 *
 * The digit rule above cannot see these, and "balik modal dalam delapan bulan" is the
 * same fabrication as the one with an 8 in it. Counts are banned outright, because the
 * facts hand over digits and there is never a reason to spell one out instead.
 *
 * Scale words are the exception and have to be, since "Rp 59,8 juta" is the natural way
 * to write a figure that IS grounded. So a scale word is allowed only where a grounded
 * figure sits immediately in front of it. "Beberapa juta" has no figure in front and is
 * a claim about money nobody measured.
 *
 * `satu` and `one` are not counts here. They are articles as often as they are numbers
 * ("salah satu", "one of them"), and a rule that rejected them would reject most ordinary
 * sentences to catch a quantity that the scale words already catch.
 */
const SPELLED_COUNT =
	/\b(dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|belasan|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\b/i;

const SCALE_WORD =
	/(\d[\d.,]*\s*)?\b(puluh(?:an)?|ratus(?:an)?|ribu(?:an)?|juta(?:an)?|miliar|milyar|triliun|persen|hundred|thousand|million|billion|trillion|percent)\b/gi;

/**
 * Whether every quantity word in a reply is one a grounded figure introduced.
 *
 * Read after the digits, because it leans on them: a scale word passes on the strength of
 * the figure written in front of it, and that figure has already been checked against the
 * facts by the time this runs.
 */
export function quantityWordsGrounded(reply: string, allowed: ReadonlySet<string>): boolean {
	if (SPELLED_COUNT.test(reply)) return false;
	for (const m of reply.matchAll(SCALE_WORD)) {
		const lead = m[1]?.trim();
		if (!lead || !allowed.has(normaliseFigure(lead))) return false;
	}
	return true;
}

/**
 * Catchments the reply names that the answer did not.
 *
 * The figure rules say nothing about names, and a reply that quotes the right score
 * against the wrong place is wrong in the one way a reader cannot catch: the number
 * checks out. The grid's names are a closed set, so this is answerable rather than merely
 * worrying about.
 *
 * The named ones are struck out of the reply BEFORE the rest are looked for, because the
 * names nest: "Matraman" sits inside "Matraman Baru", and an answer that named the longer
 * one would otherwise be caught mentioning the shorter.
 *
 * WHICH NAMES ARE WORTH CHECKING, AND WHY NOT ALL OF THEM
 *
 * Eighty-seven of these are a single word and some of those are ordinary words. Damai,
 * Duri, Karet, Depok, Tebet. Checked as written, a reply saying "kawasannya damai" or
 * naming the city of Depok is thrown away for mentioning a catchment it was talking about
 * neither, and the reader gets the plainer sentence with nothing wrong with the one they
 * lost. So a lone short word is not treated as a name here.
 *
 * That is a deliberate hole and it is the right way round. What slips through is a reply
 * naming a five-letter catchment the answer did not name, and what would otherwise be
 * lost is a large share of perfectly true replies. The cost of the first is one sentence
 * to check against a list that is on screen directly underneath it; the cost of the
 * second is the feature quietly not working.
 */
function worthChecking(name: string): boolean {
	return name.includes(' ') || name.length >= 6;
}

/** One name, as a pattern that will not fire inside a longer word. */
function namePattern(name: string): RegExp {
	return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
}

export function unnamedPlaces(
	reply: string,
	named: readonly string[],
	everyName: readonly string[]
): string[] {
	let rest = reply;
	for (const name of [...named].sort((a, b) => b.length - a.length)) {
		rest = rest.replace(new RegExp(namePattern(name).source, 'gi'), ' ');
	}
	return everyName.filter((name) => worthChecking(name) && namePattern(name).test(rest));
}

/**
 * Everything the scoring engine computed for one turn, written out for the model.
 *
 * THE SHEET AND THE FENCE ARE ONE TEXT. `cleanGroundedReply` builds its whitelist from
 * the very string handed over here, so the rule the model is held to is exactly "you may
 * write a figure you were given, and no other". Two texts, one to read from and one to
 * check against, is how the two come to disagree, and a disagreement in that direction is
 * a true figure being rejected while an invented one is not.
 *
 * The prose is Indonesian because everything the engine writes is. It is not shown to
 * anyone: the model reads it and answers in the reader's own language, and the figures in
 * it are digits either way. Prices are rendered in BOTH shapes on purpose, the short one
 * the interface prints and the long one it is rounded from, because the model will
 * reasonably echo either and only the ones written here are allowed through.
 */
export function factSheet(ans: AiAnswer): string {
	const q = ans.query;
	const lines = [
		`Operasi yang dijalankan: ${q.intent}, ukuran ${q.ukuran ?? 'skor'}, kategori ${q.kategori.join(', ') || 'belum ada'}, radius ${q.radius_m} m.`,
		`Ringkasan mesin: ${ans.headline}`
	];

	if (ans.explain) {
		const e = ans.explain;
		lines.push(`Rincian ${e.name}:`);
		/* Said first, because it is what was asked. The rest below is context for it, and
		   a sheet that buried the answer among the context is what produced a paragraph
		   about the opportunity score in reply to a question about the price. */
		if (e.measure) {
			lines.push(
				e.measure.value === null
					? `- YANG DITANYAKAN: ${e.measure.ukuran}. Tidak ada angkanya untuk petak ini. Bukan nol: belum terukur, jadi katakan begitu.`
					: `- YANG DITANYAKAN: ${e.measure.ukuran} = ${
							METRIC_MAP[e.measure.ukuran]?.kind === 'rupiah'
								? rupiah(e.measure.value)
								: e.measure.text
						}`
			);
		}
		if (!e.covered) {
			lines.push(
				`- Kotanya belum disurvei untuk kategori ini, jadi tidak ada skor, tidak ada hitungan pesaing, dan tidak ada keramaian. Bukan nol: belum dihitung.`
			);
		} else {
			lines.push(`- Skor peluang ${score(e.score)} dari 100.`);
			lines.push(`- Keramaian ${score(e.demand)} dari 100, dari ${e.density} usaha lain dalam radius ${e.radius} m.`);
			lines.push(`- Penawaran ${score(e.supply)} dari 100, dari ${e.rivals} pesaing sejenis dalam radius yang sama.`);
		}
		lines.push(`- Akses transit ${score(e.access)} dari 100, dari ${e.stops} simpul transit dalam radius ${e.radius} m.`);
		lines.push(
			e.units === 0
				? '- Tidak ada unit komersial yang sedang dipasarkan dalam radius itu.'
				: e.price === null
					? `- ${e.units} unit komersial dipasarkan dalam radius itu, tidak satu pun memasang harga.`
					: `- ${e.units} unit komersial dipasarkan dalam radius itu, median harga JUAL ${rupiah(e.price)} per m² tanah.`
		);
		if (e.priceLevel !== null) {
			lines.push(`- Harga itu lebih mahal dari ${Math.round(e.priceLevel * 100)}% petak lain di kisi.`);
		}
		lines.push(
			'- PENTING: harga di atas adalah harga JUAL yang diminta penjual. Katalog properti tidak memuat satu pun listing SEWA untuk Jakarta, jadi tidak ada angka sewa yang bisa disebut, dan tidak boleh diperkirakan dari harga jual.'
		);
	}

	if (ans.items.length) {
		lines.push(`Baris hasil (${ans.items.length}):`);
		for (const [i, it] of ans.items.entries()) {
			const value = it.value === null ? 'tidak diberi nilai' : `skor ${score(it.value)} dari 100`;
			/* The engine's own `text` for a price is the figure written out in full, and
			   the interface prints it rounded onto a scale. Both shapes go in, because the
			   model will echo whichever it is shown and only what is written here is
			   allowed through — see `rupiah`. */
			const measure = it.measure
				? ` · ${it.measure.ukuran} = ${
						METRIC_MAP[it.measure.ukuran]?.kind === 'rupiah'
							? rupiah(it.measure.value)
							: it.measure.text
					}`
				: '';
			lines.push(`${i + 1}. ${it.name} — ${value}${measure}. ${it.why} ${it.evidence}`);
		}
	}

	lines.push(...ans.provenance.map((p) => `Catatan sumber: ${p}`));
	return lines.join('\n');
}

/** A 0..1 reading as the whole number the interface prints beside it. */
const score = (v: number | null): string => (v === null ? 'tidak ada' : String(Math.round(v * 100)));

/**
 * A price in both shapes the reader might see it in.
 *
 * The long one is what the engine writes into its own prose and the short one is what the
 * interface prints, and a model handed only one of them will sometimes write the other.
 * Both are in the sheet, so both are grounded, and neither is a figure this did not
 * compute.
 *
 * The short one is rounded THROUGH `moneyScale`, the same function both locale files
 * round through, rather than through a division written here. A price of Rp 4.3 billion
 * is printed "Rp 4,3 M" on screen, and a sheet that had divided by a million would offer
 * the model 4300 instead: the reader would then see a correct figure rejected, on every
 * catchment above a billion, and the only symptom would be Tapak sounding plainer there.
 */
function rupiah(v: number): string {
	const whole = Math.round(v);
	const { value } = moneyScale(v);
	const short = Math.round(value * 10) / 10;
	return `Rp ${whole.toLocaleString('id-ID')} (dibulatkan jadi ${short.toLocaleString('id-ID')} pada skalanya)`;
}

/**
 * How long a written reply may be.
 *
 * Longer than small talk's leash, because this one is carrying an answer rather than a
 * courtesy, and shorter than an essay. Three or four sentences is what somebody who has
 * walked the area would say before stopping to let you ask the next thing.
 */
export const REPLY_MAX_CHARS = 460;

/**
 * A model-written answer, or null if it broke the fence.
 *
 * Null is not an error to report. The caller falls back to the sentence the interface
 * composes from the same figures, so a model that misbehaves costs the reader nothing:
 * they get the plainer answer rather than a wrong one.
 */
export function cleanGroundedReply(
	raw: unknown,
	facts: string,
	named: readonly string[],
	everyName: readonly string[]
): string | null {
	if (typeof raw !== 'string') return null;
	const s = raw.trim().replace(/\s+/g, ' ');
	if (!s || s.length > REPLY_MAX_CHARS) return null;
	const allowed = allowedFigures(facts);
	if (ungroundedFigures(s, allowed).length) return null;
	if (!quantityWordsGrounded(s, allowed)) return null;
	if (unnamedPlaces(s, named, everyName).length) return null;
	return s;
}
