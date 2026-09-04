import { withinFence } from '$lib/domain/chat';

/**
 * Reading a tool call while the model is still writing it.
 *
 * Kept apart from `llm.ts` for two reasons. It is a self-contained concern — server-sent
 * events in, one tool call out — and it touches no environment and no model list, so
 * `selftest-markdown.mjs` can load it and put a half-written argument through it. The
 * escape handling in `partialArg` is exactly the kind of thing that works on every reply
 * anybody tried by hand and then breaks on the first one carrying an accent.
 */

/** A tool call, in the one shape the rest of the model layer reads. */
export interface ToolCall {
	function?: { name?: string; arguments?: string };
}

/**
 * Where a casual reply goes while it is still arriving.
 *
 * Only the casual reply. Everything else the model produces is a tool argument that
 * means nothing until it is complete — half of an enum value is not half an answer —
 * and the figures are not the model's to write in the first place. So this is the one
 * thing in the product there is any point streaming, and the sink exists so this module
 * can hand it over without knowing whether the other end is an HTTP stream, a test, or
 * nothing at all.
 */
export interface ChatSink {
	/** More of the reply, ready to be shown. */
	delta(text: string): void;
	/** Everything sent so far is void. Drop it. */
	reset(): void;
}

/**
 * The reply as it arrives, with the fence already around it.
 *
 * `domain/chat` throws away a reply carrying any digit, and it does that AFTER the
 * whole sentence has landed. Streaming without this class would put the rejected
 * sentence on the reader's screen first and take it away afterwards, which is worse
 * than never streaming it: "warteg biasanya balik modal dalam 8 bulan" would have been
 * read by then.
 *
 * So the same fence is applied to every prefix. The moment a digit appears the preview
 * is pulled and nothing more is sent for that attempt. The final sentence still goes
 * through `cleanChatReply` afterwards, and still wins: this is a preview, not the
 * answer.
 */
export class Preview {
	#sink: ChatSink;
	#shown = '';
	#fenced = false;

	constructor(sink: ChatSink) {
		this.#sink = sink;
	}

	/** Whether anything has been put on the reader's screen. */
	get live() {
		return this.#shown.length > 0;
	}

	/** The reply as far as it has arrived, raw. */
	offer(raw: string) {
		if (this.#fenced) return;
		// Cleaned exactly the way `cleanChatReply` will clean the finished reply, so the
		// preview is a true prefix of the sentence that replaces it and the bubble does
		// not reflow when the answer lands. Trimmed at both ends, which also means a
		// half-written word never trails a space it is about to fill.
		const s = raw.replace(/\s+/g, ' ').trim();
		if (!s) return;

		// The same fence `cleanChatReply` will apply at the end, applied to every prefix
		// on the way there. Once it fails it stays failed, so nothing more is sent.
		if (!withinFence(s)) {
			this.#fenced = true;
			this.#take();
			return;
		}
		// A reply only ever grows. Anything else means a different attempt is writing,
		// and the old one has to come off the screen before the new one goes on.
		if (!s.startsWith(this.#shown)) {
			this.#take();
			this.#sink.delta(s);
			this.#shown = s;
			return;
		}
		if (s.length === this.#shown.length) return;
		this.#sink.delta(s.slice(this.#shown.length));
		this.#shown = s;
	}

	/**
	 * Take back whatever is on screen and start fresh.
	 *
	 * Called when an attempt is abandoned, so the fence lifts with it: a reply that
	 * broke the rule belonged to the model that wrote it, and the next model in the
	 * chain gets to say its own sentence. The fence inside `offer` deliberately does
	 * NOT go through here — un-fencing there would put the digit straight back.
	 */
	clear() {
		this.#fenced = false;
		this.#take();
	}

	/** Take back whatever is on screen. Silent when there is nothing there. */
	#take() {
		if (!this.#shown) return;
		this.#shown = '';
		this.#sink.reset();
	}
}

const UNESCAPE: Record<string, string> = {
	'"': '"',
	'\\': '\\',
	'/': '/',
	b: '\b',
	f: '\f',
	n: '\n',
	r: '\r',
	t: '\t'
};

/**
 * One string argument out of a tool call that is only half written.
 *
 * The model streams its tool arguments as fragments of JSON, so there is no complete
 * object to parse until the very end — which is exactly the moment streaming was
 * supposed to avoid waiting for. This reads the one key it needs straight out of the
 * fragment, decoding escapes as it goes and stopping cleanly at the end of what has
 * arrived, including in the middle of a `\u00e9`.
 *
 * Null means the key has not started yet. An empty string means it has started and is
 * still empty, which are different things: the first is "keep waiting", the second is
 * "the model opened its quote".
 */
export function partialArg(buf: string, key: string): string | null {
	const at = buf.indexOf(`"${key}"`);
	if (at === -1) return null;

	let i = at + key.length + 2;
	while (i < buf.length && /\s/.test(buf[i])) i++;
	if (buf[i] !== ':') return null;
	i++;
	while (i < buf.length && /\s/.test(buf[i])) i++;
	if (buf[i] !== '"') return null;
	i++;

	let out = '';
	while (i < buf.length) {
		const ch = buf[i];
		if (ch === '"') break;
		if (ch !== '\\') {
			out += ch;
			i++;
			continue;
		}
		const esc = buf[i + 1];
		// Half an escape sequence: stop, and pick it up on the next fragment.
		if (esc === undefined) break;
		if (esc === 'u') {
			const hex = buf.slice(i + 2, i + 6);
			if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
			out += String.fromCharCode(parseInt(hex, 16));
			i += 6;
			continue;
		}
		out += UNESCAPE[esc] ?? esc;
		i += 2;
	}
	return out;
}

/**
 * A streamed completion, read down to the one tool call this layer wants.
 *
 * Server-sent events, which is what OpenRouter speaks: `data:` lines, comment lines
 * that keep the connection warm, and `[DONE]` at the end. The tool call arrives split
 * across dozens of them, so the name and the argument text are stitched back together
 * here and handed on in exactly the shape the non-streamed path produces. Everything
 * downstream then reads one kind of object and never learns which way it came.
 *
 * Only the first tool call is followed. This layer asks for one operation and there is
 * nothing sensible to do with a second.
 */
export async function readStream(res: Response, preview: Preview | null): Promise<ToolCall | undefined> {
	if (!res.body) return undefined;
	const reader = res.body.getReader();
	const decoder = new TextDecoder();

	let buf = '';
	let name = '';
	let args = '';

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });

			let nl: number;
			while ((nl = buf.indexOf('\n')) !== -1) {
				const line = buf.slice(0, nl).trim();
				buf = buf.slice(nl + 1);
				// Blank lines separate events, and a line opening with a colon is a
				// comment OpenRouter sends to stop the connection idling out.
				if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
				const payload = line.slice(5).trim();
				if (payload === '[DONE]') continue;

				let msg: unknown;
				try {
					msg = JSON.parse(payload);
				} catch {
					continue;
				}

				const calls = (msg as { choices?: [{ delta?: { tool_calls?: unknown } }] })?.choices?.[0]
					?.delta?.tool_calls;
				if (!Array.isArray(calls)) continue;
				for (const raw of calls) {
					const tc = raw as { index?: number; function?: { name?: string; arguments?: string } };
					if (typeof tc.index === 'number' && tc.index !== 0) continue;
					if (typeof tc.function?.name === 'string' && tc.function.name) name = tc.function.name;
					if (typeof tc.function?.arguments === 'string') args += tc.function.arguments;
				}

				// Show it as it is written, but only the casual reply, and only once the
				// model has said that is what it is calling.
				if (preview && name === 'ngobrol') {
					const partial = partialArg(args, 'balasan');
					if (partial !== null) preview.offer(partial);
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	// No tool named means no operation chosen, which to this layer is the same as no
	// answer at all — the caller moves on to the next model.
	if (!name) return undefined;
	return { function: { name, arguments: args } };
}
