/**
 * A small, closed markdown reader, and the reason it is not a library.
 *
 * WHAT NEEDS PARSING AT ALL
 *
 * Every sentence Tapak can fall back on is composed here, from `i18n`, out of figures the
 * scoring engine computed, and those are plain text and always will be. Three kinds of
 * string are written by the model instead: the casual reply (`balasan`), the reason it
 * did not understand (`alasan`), and the answer itself when one clears the fence in
 * `domain/grounded`. A model asked for a sentence returns markdown whether or not
 * anybody asked it to, so the reader was seeing literal asterisks around the words the
 * model meant to stress.
 *
 * WHY A SUBSET, WRITTEN OUT
 *
 * The obvious move is a markdown library and `{@html}`. That puts arbitrary HTML,
 * built from a string a remote model wrote, into the page. The whole product rests on
 * being able to say where every word on screen came from, and there is no version of
 * that claim that survives handing the model an HTML injection point.
 *
 * So this parses to a tree of plain objects, and the renderer walks that tree with
 * ordinary Svelte elements. There is no `{@html}` anywhere on the path, which means
 * there is nothing to sanitise: a tag the model wrote arrives here as text and leaves
 * as text.
 *
 * WHAT IS SUPPORTED, AND WHAT IS DELIBERATELY NOT
 *
 * Bold, italic, inline code, bullet lists, numbered lists, paragraphs. That is what a
 * short reply uses. Headings are read but flattened to a bold line, because a level
 * two heading inside a chat bubble two sentences long is a shape the bubble does not
 * have. Rules (`---`) are dropped for the same reason.
 *
 * LINKS ARE NOT SUPPORTED, ON PURPOSE. A link is the one markdown construct that
 * carries a destination, and the destination would be a URL a remote model chose.
 * There is nothing on the map worth linking to and every reason not to offer a
 * stranger a clickable one, so `[text](url)` renders as its own literal characters.
 */

export type Inline =
	| { kind: 'text'; text: string }
	| { kind: 'strong'; children: Inline[] }
	| { kind: 'em'; children: Inline[] }
	| { kind: 'code'; text: string };

export type Block =
	| { kind: 'p'; children: Inline[] }
	| { kind: 'list'; ordered: boolean; start: number; items: Inline[][] };

/** Characters a backslash is allowed to escape. Anything else keeps its backslash. */
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>]/;

/**
 * The closing marker for an emphasis span, or -1 when there is none.
 *
 * An unmatched marker is not an error and must not be repaired: `*` on its own is a
 * character somebody typed, and a parser that hunts for a partner across the rest of
 * the reply turns a multiplication sign into the start of an italic that swallows the
 * sentence.
 */
function closer(src: string, from: number, marker: string): number {
	for (let j = from; j < src.length; j++) {
		if (src[j] === '\\') {
			j++;
			continue;
		}
		if (!src.startsWith(marker, j)) continue;
		// A single `*` looking for its partner must not stop on the first half of a
		// `**`, or `*a **b** c*` closes after `a `.
		if (marker.length === 1 && src[j + 1] === marker) {
			j++;
			continue;
		}
		// An empty span is not emphasis. `**` alone stays two asterisks.
		if (j === from) continue;
		return j;
	}
	return -1;
}

/**
 * One line of prose to its inline pieces.
 *
 * Underscores are held to a stricter rule than asterisks: an underscore only opens
 * emphasis at the start of a word. Without that, `harga_tempat` and `unit_dipasarkan`
 * — the measure keys, which do turn up in a reply about what can be asked — come out
 * as `hargatempat` with the middle in italics.
 */
export function parseInline(src: string): Inline[] {
	const out: Inline[] = [];
	let text = '';
	const flush = () => {
		if (text) out.push({ kind: 'text', text });
		text = '';
	};

	let i = 0;
	while (i < src.length) {
		const ch = src[i];

		if (ch === '\\' && ESCAPABLE.test(src[i + 1] ?? '')) {
			text += src[i + 1];
			i += 2;
			continue;
		}

		if (ch === '`') {
			const end = src.indexOf('`', i + 1);
			if (end > i + 1) {
				flush();
				out.push({ kind: 'code', text: src.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}

		if (ch === '*' || ch === '_') {
			const doubled = src[i + 1] === ch;
			const marker = doubled ? ch + ch : ch;
			const wordInner = ch === '_' && /[\p{L}\p{N}]/u.test(src[i - 1] ?? '');
			if (!wordInner) {
				const end = closer(src, i + marker.length, marker);
				if (end !== -1) {
					flush();
					out.push({
						kind: doubled ? 'strong' : 'em',
						children: parseInline(src.slice(i + marker.length, end))
					});
					i = end + marker.length;
					continue;
				}
			}
		}

		text += ch;
		i++;
	}

	flush();
	return out;
}

/** `- `, `* `, `+ ` or `• `, which models emit as often as the ASCII ones. */
const BULLET = /^\s{0,3}([-*+•])\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

/**
 * Markdown to blocks.
 *
 * Soft line breaks inside a paragraph are joined with a space, the way markdown reads
 * them. That matters here because the casual reply arrives with its whitespace already
 * collapsed by `domain/chat`, so a reply that wanted a break never had one to lose.
 */
export function parseMarkdown(src: string): Block[] {
	const lines = String(src ?? '')
		.replace(/\r\n?/g, '\n')
		.split('\n');
	const blocks: Block[] = [];

	let para: string[] = [];
	let list: { ordered: boolean; start: number; items: string[] } | null = null;

	const endPara = () => {
		if (para.length) blocks.push({ kind: 'p', children: parseInline(para.join(' ')) });
		para = [];
	};
	const endList = () => {
		if (list) {
			blocks.push({
				kind: 'list',
				ordered: list.ordered,
				start: list.start,
				items: list.items.map((t) => parseInline(t))
			});
		}
		list = null;
	};
	const endAll = () => {
		endPara();
		endList();
	};

	for (const raw of lines) {
		const line = raw.replace(/\s+$/, '');

		if (!line.trim()) {
			endAll();
			continue;
		}
		if (RULE.test(line)) {
			endAll();
			continue;
		}

		const heading = line.match(HEADING);
		if (heading) {
			endAll();
			// Flattened to one bold line rather than kept as a heading level: these
			// bubbles are two sentences tall and have no document structure to be a
			// heading of.
			blocks.push({ kind: 'p', children: [{ kind: 'strong', children: parseInline(heading[1]) }] });
			continue;
		}

		const bullet = line.match(BULLET);
		const numbered = bullet ? null : line.match(NUMBERED);
		if (bullet || numbered) {
			endPara();
			const ordered = Boolean(numbered);
			const start = numbered ? Number(numbered[1]) : 1;
			// A bullet list running straight into a numbered one is two lists, not one
			// list that changes its mind halfway down.
			if (!list || list.ordered !== ordered) {
				endList();
				list = { ordered, start, items: [] };
			}
			list.items.push((bullet ? bullet[2] : numbered![2]).trim());
			continue;
		}

		// A line under a list item continues that item rather than opening a paragraph
		// inside the list.
		if (list) {
			const quoted = line.match(QUOTE);
			list.items[list.items.length - 1] += ` ${(quoted ? quoted[1] : line).trim()}`;
			continue;
		}

		const quoted = line.match(QUOTE);
		para.push((quoted ? quoted[1] : line).trim());
	}

	endAll();
	return blocks;
}

/** How many characters of prose a tree holds. Markers are not prose and are not counted. */
export function textLength(blocks: readonly Block[]): number {
	let n = 0;
	const walk = (parts: readonly Inline[]) => {
		for (const p of parts) {
			if (p.kind === 'text' || p.kind === 'code') n += p.text.length;
			else walk(p.children);
		}
	};
	for (const b of blocks) {
		if (b.kind === 'p') walk(b.children);
		else for (const item of b.items) walk(item);
	}
	return n;
}

/**
 * The first `budget` characters of prose, as a tree.
 *
 * Cutting the TREE rather than the source string is what keeps a reveal from
 * flickering: cut the string and `**Blok M** teratas` renders as literal asterisks for
 * two frames on its way to being bold, and every emphasis in the reply blinks as it
 * arrives. Cut here and the markers were already read, so a word that will be bold is
 * bold from its first letter.
 */
export function truncate(blocks: readonly Block[], budget: number): Block[] {
	if (!Number.isFinite(budget)) return blocks as Block[];
	let left = Math.max(0, Math.floor(budget));

	const cut = (parts: readonly Inline[]): Inline[] => {
		const out: Inline[] = [];
		for (const p of parts) {
			if (left <= 0) break;
			if (p.kind === 'text' || p.kind === 'code') {
				const take = p.text.slice(0, left);
				left -= take.length;
				if (take) out.push({ ...p, text: take });
			} else {
				const children = cut(p.children);
				if (children.length) out.push({ ...p, children });
			}
		}
		return out;
	};

	const out: Block[] = [];
	for (const b of blocks) {
		if (left <= 0) break;
		if (b.kind === 'p') {
			const children = cut(b.children);
			if (children.length) out.push({ kind: 'p', children });
			continue;
		}
		const items: Inline[][] = [];
		for (const item of b.items) {
			if (left <= 0) break;
			const children = cut(item);
			if (children.length) items.push(children);
		}
		if (items.length) out.push({ ...b, items });
	}
	return out;
}
