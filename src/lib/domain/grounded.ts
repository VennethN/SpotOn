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
import { METRIC_MAP, standingShare } from './metrics';
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
 * A quantity written as a word rather than as digits, and the digits it stands for.
 *
 * The digit rule above cannot see these, and "balik modal dalam delapan bulan" is the same
 * fabrication as the one with an 8 in it. So a spelled count is held to the SAME rule as a
 * digit: it passes only when the figure it spells is one the facts carry. "The strongest of
 * the five" passes on a list of five, and "delapan bulan" fails on a sheet with no eight in
 * it, which is exactly how their digit forms are treated.
 *
 * Counts used to be refused outright, on the argument that the facts hand over digits and
 * there is never a reason to spell one out. There is: English counts small things in words,
 * "the five", "one of the two", "out of a hundred", and a reply thrown away for it was a
 * true reply lost, with the reader none the wiser and Tapak a little plainer.
 *
 * `satu` and `one` are not counts here. They are articles as often as they are numbers
 * ("salah satu", "one of them"), and a rule that read them as quantities would reject most
 * ordinary sentences to catch a quantity that the scale words already catch.
 *
 * Compounds are not read. "Dua belas" is two words to this and the first of them is 2,
 * which a sheet carrying 12 does not have, so it is refused, exactly as every count in
 * words was before. The sheet hands the model digits and a model shown digits writes
 * them, so what this buys is the handful of small counts English says in words.
 */
const SPELLED: Record<string, string> = {
	dua: '2',
	tiga: '3',
	empat: '4',
	lima: '5',
	enam: '6',
	tujuh: '7',
	delapan: '8',
	sembilan: '9',
	sepuluh: '10',
	sebelas: '11',
	seratus: '100',
	two: '2',
	three: '3',
	four: '4',
	five: '5',
	six: '6',
	seven: '7',
	eight: '8',
	nine: '9',
	ten: '10',
	eleven: '11',
	twelve: '12',
	hundred: '100'
};
const SPELLED_WORD = new RegExp(`\\b(${Object.keys(SPELLED).join('|')})\\b`, 'gi');

/**
 * A quantity that names no figure at all. "Belasan pesaing" and "dozens of shops" are
 * claims about a count nobody made, and there is nothing in the facts they could be
 * checked against, so they are refused outright.
 */
const VAGUE_COUNT = /\b(belasan|puluhan|ratusan|ribuan|jutaan|dozen|dozens|hundreds|thousands|millions)\b/i;

/**
 * A scale a figure is written on. Allowed where a grounded figure sits immediately in
 * front of it, since "Rp 59,8 juta" is the natural way to write a figure that IS grounded.
 * "Beberapa juta" has no figure in front and is a claim about money nobody measured. The
 * one scale word that stands on its own is "hundred", which is the ruler every score is
 * read against, and it passes for the same reason 100 does.
 */
const SCALE_WORD =
	/(\d[\d.,]*\s*)?\b(puluh|ratus|ribu|juta|miliar|milyar|triliun|persen|hundred|thousand|million|billion|trillion|percent)\b/gi;

/**
 * Whether every quantity word in a reply is one a grounded figure introduced.
 *
 * Read after the digits, because it leans on them: a scale word passes on the strength of
 * the figure written in front of it, and that figure has already been checked against the
 * facts by the time this runs.
 */
export function quantityWordsGrounded(reply: string, allowed: ReadonlySet<string>): boolean {
	if (VAGUE_COUNT.test(reply)) return false;
	for (const m of reply.matchAll(SPELLED_WORD)) {
		if (!allowed.has(SPELLED[m[1].toLowerCase()])) return false;
	}
	for (const m of reply.matchAll(SCALE_WORD)) {
		const lead = m[1]?.trim();
		if (lead) {
			if (!allowed.has(normaliseFigure(lead))) return false;
			continue;
		}
		// No figure in front. "A hundred" is the scale itself; "a million" is a figure.
		if (!allowed.has(SPELLED[m[2].toLowerCase()] ?? '')) return false;
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
						}.${stand(e.standing.measure)}`
			);
		}
		if (!e.covered) {
			lines.push(
				`- Kotanya belum disurvei untuk kategori ini, jadi tidak ada skor, tidak ada hitungan pesaing, dan tidak ada keramaian. Bukan nol: belum dihitung.`
			);
		} else {
			lines.push(`- Skor peluang ${score(e.score)} dari 100.${stand(e.standing.score)}`);
			lines.push(`- Keramaian ${score(e.demand)} dari 100, dari ${e.density} usaha lain dalam radius ${e.radius} m.${stand(e.standing.demand)}`);
			lines.push(`- Penawaran ${score(e.supply)} dari 100, dari ${e.rivals} pesaing sejenis dalam radius yang sama.${stand(e.standing.supply)}`);
		}
		lines.push(`- Akses transit ${score(e.access)} dari 100, dari ${e.stops} simpul transit dalam radius ${e.radius} m.${stand(e.standing.access)}`);
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
 * Where a figure sits on the grid, for the sheet.
 *
 * The share is the same floored whole number the interface composes its own sentence
 * with, through the same function, so a reply quoting "higher than 78% of areas" is
 * quoting a figure that is on the sheet. Rounded here and floored there, the composed
 * sentence would fail its own fence on every explanation, and the only symptom would be
 * the template standing in. Nothing at all when there is no standing, which is how a
 * cell nobody scored reads: an absence, not a bottom rung.
 */
function stand(level: number | null): string {
	if (level === null) return '';
	if (level === 1) return ' Paling tinggi dari semua petak yang punya angka ini.';
	if (level === 0) return ' Paling rendah dari semua petak yang punya angka ini.';
	return ` Lebih tinggi dari ${standingShare(level)}% petak lain yang punya angka ini.`;
}

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
 * courtesy, and shorter than an essay. Four or five sentences is what somebody who has
 * walked the area would say before stopping to let you ask the next thing.
 *
 * It was 460, and the interface's own composed explanation runs past that in English. A
 * model saying the same thing at the same length was thrown away for saying it, on every
 * explanation, and the only symptom was the template standing in.
 */
export const REPLY_MAX_CHARS = 720;

/**
 * Why a reply would be refused, or null when it would not be.
 *
 * Said rather than swallowed, in the server log and in the answer's provenance, because a
 * reply dropped in silence has exactly one symptom, Tapak sounding plainer, and that is
 * not a symptom anybody reports. Indonesian, like every other line of provenance.
 */
export function groundingFault(
	raw: unknown,
	facts: string,
	named: readonly string[],
	everyName: readonly string[]
): string | null {
	if (typeof raw !== 'string') return 'bukan teks';
	const s = raw.trim().replace(/\s+/g, ' ');
	if (!s) return 'kosong';
	if (s.length > REPLY_MAX_CHARS) {
		return `terlalu panjang, ${s.length} karakter dari batas ${REPLY_MAX_CHARS}`;
	}
	const allowed = allowedFigures(facts);
	const figures = ungroundedFigures(s, allowed);
	if (figures.length) return `memuat angka yang tidak ada di fakta: ${figures.join(', ')}`;
	if (!quantityWordsGrounded(s, allowed)) return 'memuat jumlah dalam kata yang tidak ada di fakta';
	const places = unnamedPlaces(s, named, everyName);
	if (places.length) return `menyebut kawasan yang tidak ada di jawaban: ${places.join(', ')}`;
	return null;
}

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
	return groundingFault(s, facts, named, everyName) ? null : s;
}
