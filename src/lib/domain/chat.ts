/**
 * Small talk, and the fence around it.
 *
 * WHY THIS EXISTS
 *
 * Tapak had two possible replies: an answer computed from the data, or "that is outside
 * what I can answer". So "halo" got a refusal, "makasih" got a refusal, and "kenapa
 * lokasi penting sih" got a refusal — a product whose whole manner is a person
 * explaining things, unable to say hello back. A greeting met with a scope statement
 * does not read as rigour, it reads as broken.
 *
 * WHY IT IS FENCED THIS TIGHTLY
 *
 * Everywhere else in this codebase the model picks an operation and fills in arguments,
 * and never writes a sentence the reader sees. Chat is the one exception, and an
 * exception to that rule is exactly where a fabricated figure would get in — "warteg
 * biasanya balik modal dalam 8 bulan" is a fluent, plausible, completely invented
 * sentence, and it would sit in the same thread as figures that are traceable to a
 * source. The reader has no way to tell which is which.
 *
 * So the fence is three things, and none of them is the prompt:
 *
 * 1. NO DIGITS. A chat reply containing any digit is thrown away, not repaired. A
 *    figure belongs to the scoring engine; if a question needs one, it is not chat.
 * 2. A SHORT LEASH. Two sentences at most. Chat is a courtesy on the way to a question
 *    the map can answer, not the product.
 * 3. A CLOSED TOPIC LIST. Greetings, what SpotOn is, and general talk about running a
 *    small business. Anything else keeps going to "I cannot answer that".
 *
 * The prompt asks for all three. This module enforces them, because a prompt is a
 * request and this is a guarantee.
 */

/**
 * What a casual turn is allowed to be about.
 *
 * - `sapaan`  — hello, thanks, goodbye, "who are you"
 * - `tentang` — what SpotOn is, what its data is, what it cannot do
 * - `usaha`   — running a small business in general, with no figures attached
 */
export const CHAT_TOPICS = ['sapaan', 'tentang', 'usaha'] as const;
export type ChatTopic = (typeof CHAT_TOPICS)[number];

export const isChatTopic = (v: unknown): v is ChatTopic =>
	typeof v === 'string' && (CHAT_TOPICS as readonly string[]).includes(v);

/**
 * How long a casual reply may be.
 *
 * 240 characters is about two sentences of this product's voice. The cap is not about
 * tokens: a model that starts explaining the restaurant business at length has stopped
 * being a courtesy and started being a different product, and the reader came here for
 * a map.
 */
export const CHAT_MAX_CHARS = 240;

/**
 * A model-written casual reply, or null if it broke the fence.
 *
 * Null is not an error to report to the reader. The caller falls back to the canned
 * line for the topic, which says the same thing in this product's own voice — so a
 * model that misbehaves costs the reader nothing and gains the model nothing.
 *
 * THE DIGIT RULE IS DELIBERATELY BLUNT
 *
 * Any digit at all, not "any digit that looks like a statistic". A blunt rule can be
 * reasoned about at a glance and cannot be argued with in a code review; a clever one
 * grows exceptions, and the first exception is where "sekitar 8 bulan" gets through.
 * The cost is that a legitimate "24 jam" is rejected too, and that cost is one canned
 * sentence instead of one invented one.
 */
export function cleanChatReply(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const s = raw.trim().replace(/\s+/g, ' ');
	if (!s) return null;
	return withinFence(s) ? s : null;
}

/**
 * Whether a reply is inside the fence, asked of a PREFIX as well as of a whole one.
 *
 * The rule is here, once, because it is now applied twice. The casual reply is streamed
 * to the reader as the model writes it, and a fence that only ran at the end would put
 * "warteg biasanya balik modal dalam delapan bulan" on the screen for two seconds
 * before taking it away — by which time it has been read, which is the entire harm the
 * fence exists to prevent. So every prefix is held to it as well.
 *
 * A prefix can be judged by exactly the same test, and that is not luck: text only
 * grows, so a digit that appears is a digit that stays, and length only rises. A reply
 * that fails here at any point was always going to fail.
 */
export function withinFence(s: string): boolean {
	if (s.length > CHAT_MAX_CHARS) return false;
	// Digits in any script the reply might arrive in.
	return !/[0-9٠-٩]/.test(s);
}

/**
 * The casual topic a question is, when it plainly is one — no model involved.
 *
 * This is the fallback path's whole share of chat, and it is deliberately the narrow
 * half. Greetings are a closed set of words and can be recognised by rule; "kenapa
 * lokasi penting" cannot, and a rule parser guessing at it would be inventing an intent
 * rather than reading one. Without a model key, general business talk goes back to the
 * honest "that is outside what I can answer from this data".
 *
 * Anchored to the start of the sentence on purpose. `hai` sits inside "ramai" and
 * "pantai", and an unanchored match turns "di mana yang ramai" into a greeting.
 */
/** Greetings and courtesies, at the head of the message. */
const OPENER =
	/^(hai|halo|hallo|helo|hello|hi|hey|hei|selamat pagi|selamat siang|selamat sore|selamat malam|selamat|pagi|siang|sore|malam|assalamualaikum|assalamu'alaikum|salam|permisi|makasih|terima kasih|thanks|thank you|thx|oke|okay|ok|sip|mantap|bye|dadah)\b/;

/**
 * What may follow a greeting and still leave it a greeting.
 *
 * Politeness, and nothing else. "Hai, apa kabar" is small talk; "oke berapa harga
 * tempat di sini" is a question with a courtesy in front of it, and answering that with
 * "hello, what would you like to know" throws away the thing they actually asked.
 */
const FILLER =
	/^(ya|iya|nih|dong|deh|kok|sih|gan|kak|bro|sis|min|banget|juga|semua|apa kabar|gimana kabarnya|how are you|there|again|selamat|pagi|siang|sore|malam)?[\s,.!?~-]*$/;

export function ruleChatTopic(q: string): ChatTopic | null {
	const s = q.trim().toLowerCase();
	if (!s) return null;

	// Who or what is this. Checked first, because "halo kamu siapa" opens with a
	// greeting and is nevertheless a question about the product, which has a better
	// answer than "hello".
	if (
		/\b(kamu siapa|siapa kamu|kamu ini apa|apa itu spoton|spoton itu apa|who are you|what are you|what is spoton)\b/.test(
			s
		)
	) {
		return 'tentang';
	}
	if (/\b(kamu bisa apa|bisa apa saja|apa saja yang bisa|what can you do)\b/.test(s)) {
		return 'tentang';
	}

	// A greeting is only a greeting when it is the WHOLE message. Matching it at the
	// head alone was enough to turn "oke berapa harga tempat di sini" into small talk:
	// the reader gets a friendly hello and the question they typed is never answered,
	// with nothing on screen to say it was dropped.
	const opener = s.match(OPENER);
	if (opener) {
		const rest = s.slice(opener[0].length).trim().replace(/^[,.!?~-]+/, '').trim();
		if (FILLER.test(rest)) return 'sapaan';
	}
	return null;
}
