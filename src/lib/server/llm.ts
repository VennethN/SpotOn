import { env } from '$env/dynamic/private';
import { CATEGORY_KEYS } from '$lib/domain/categories';
import type { CategoryKey, StructuredQuery, Weights } from '$lib/types';

/**
 * The language-understanding layer: a person's question → a structured query.
 *
 * The model is called through OpenRouter with *function calling*, and that is its
 * only job: pick an operation and fill in the arguments. The model never computes,
 * never writes the answer sentence, and never touches a number — every value is
 * still calculated by the scoring engine from the data. That way there is no
 * number the model could invent.
 *
 * Two things keep this layer honest:
 *
 * 1. The model is given a second tool, `tidak_dimengerti` ("not understood"). If
 *    the question lies outside what this data can answer, it says so — rather than
 *    guessing and answering with confidence. That is the most important part: an
 *    answer that misunderstands the question but sounds convincing is more
 *    dangerous than no answer at all.
 * 2. If the key is missing, the call fails, or time runs out, the caller falls back
 *    to the rule-based parser. A demo must not die just because the network is bad.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * A chain of free models, tried in order until one answers.
 *
 * Every one of them must support function calling — a hard requirement here, since
 * this layer never asks for prose, only for a tool choice. Free models are shared
 * by many people at once, so the common failure is not "the model got it wrong"
 * but "it is busy right now": 429, 503, or an answer that arrives too late. A
 * single model name means a single point of failure; chained like this, one model
 * being full just passes the turn to the next.
 *
 * Ordered from lightest and fastest to largest: the first one answers most of the
 * time, the ones below it catch the rest.
 */
const MODEL_CHAIN = [
	'nvidia/nemotron-3.5-lightning:free',
	'nvidia/nemotron-3-ultra-550b-a55b:free',
	'inclusionai/ling-3.0-tiny:free',
	'google/gemma-4-31b-it:free',
	'openai/gpt-oss-20b:free'
];

const DEFAULT_MODEL = MODEL_CHAIN[0];

/**
 * The time budget for one attempt, and the budget for the whole chain.
 *
 * Per attempt this was once 12 seconds, and that is far too tight for free models:
 * waiting your turn in a shared queue means a perfectly reasonable answer arrives
 * at second 14, so a request that was doing fine got cancelled right before it
 * landed. All the user saw was Tapak quietly falling back to the rule-based parser,
 * for no visible reason.
 *
 * The total cap exists so the chain does not add up its delays: five models ×
 * 60 seconds would leave the user waiting five minutes for an answer that has a
 * rule-based version available in an instant. Total budget spent → straight to the
 * rules.
 */
const ATTEMPT_MS = 60_000;
const TOTAL_MS = 90_000;

/**
 * The model this understanding layer uses, from `OPENROUTER_MODEL`.
 *
 * Read through `$env/dynamic/private`, so switching models on Vercel is just an
 * Environment Variable change — no rebuild needed. An empty or whitespace-only
 * value is treated as "not set", rather than as an empty model name that
 * OpenRouter would reject with a confusing 400.
 */
export function activeModel(): string {
	return env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * The order models will be tried in. An `OPENROUTER_MODEL` filled in by hand means
 * someone made a deliberate choice — it is honoured as-is, not quietly padded with
 * fallbacks they never asked for.
 */
function modelChain(): string[] {
	const pinned = env.OPENROUTER_MODEL?.trim();
	return pinned ? [pinned] : MODEL_CHAIN;
}

/** Whether the model layer is actually usable (the key is configured). */
export function llmEnabled(): boolean {
	return Boolean(env.OPENROUTER_API_KEY?.trim());
}

export type ParseResult =
	| { ok: true; query: StructuredQuery }
	/** The model understood the language but knows the question is out of the data's range. */
	| { ok: false; reason: string }
	/** The model is unavailable — the caller must use the rule-based parser. */
	| null;

/* The prompt and the tool schema below stay in Indonesian deliberately: users ask
   in Indonesian, and the structured query these produce is the documented API
   contract (intent, metrik, kategori, radius, filter). Translating them would
   change model behaviour and break that contract, so only the surrounding code
   comments are in English. */
const SYSTEM = `Kamu lapisan pemahaman untuk SpotOn, peta rekomendasi lokasi usaha di kawasan stasiun transit Jakarta.

Tugasmu HANYA menerjemahkan pertanyaan pengguna menjadi satu pemanggilan alat. Kamu tidak menghitung apa pun dan tidak menulis jawaban — mesin skor yang melakukannya dari data asli.

Data yang tersedia, dan hanya ini:
- 558 petak heksagon H3 yang menutupi kawasan berjalan kaki (800 m) di sekitar simpul transit Jakarta — MRT, KRL, LRT, dan koridor TransJakarta. 89 di antaranya belum ada datanya.
- 5 jenis usaha: kopi (kedai kopi/kafe), warung (warung makan/restoran), minimarket, laundry, apotek.
- Per petak: perkiraan permintaan, jumlah pesaing sejenis, seberapa ramai pesaingnya, dan jumlah ruang usaha yang sedang disewakan.

Pilih niat yang tepat:
- RANK — "di mana sebaiknya buka X", "lokasi terbaik untuk X". Ini yang paling umum.
- FLAG_SATURATED — "mana yang sudah jenuh/penuh", "mana yang harus dihindari".
- COMPARE — membandingkan dua kawasan yang disebut namanya.
- COVERAGE — "mana yang belum ada datanya", pertanyaan soal cakupan data.

Panggil tidak_dimengerti bila pertanyaannya di luar jangkauan di atas — misalnya kota selain Jakarta, jenis usaha yang tidak ada dalam daftar, pertanyaan soal modal/perizinan/pajak, atau kalimat yang tidak jelas maksudnya. Jangan menebak jenis usaha terdekat hanya supaya bisa menjawab; lebih baik mengaku tidak paham.`;

/* The only sentence the model really writes and the user really reads is `alasan`
   on tidak_dimengerti. It has to come out in the language the reader has selected,
   not in the language of the prompt. */
const LANG_RULE: Record<string, string> = {
	id: 'Tulis argumen `alasan` dalam bahasa Indonesia.',
	en: 'Write the `alasan` argument in English.'
};

const TOOLS = [
	{
		type: 'function',
		function: {
			name: 'jalankan_query',
			description:
				'Jalankan pencarian pada data SpotOn. Panggil ini bila pertanyaan pengguna bisa dijawab oleh data yang tersedia.',
			parameters: {
				type: 'object',
				properties: {
					intent: {
						type: 'string',
						enum: ['RANK', 'FLAG_SATURATED', 'COMPARE', 'COVERAGE'],
						description: 'Jenis pertanyaan.'
					},
					kategori: {
						type: 'string',
						enum: CATEGORY_KEYS,
						description:
							'Jenis usaha yang ditanyakan. Bila pengguna tidak menyebut, pakai kategori yang sedang aktif.'
					},
					modal_kecil: {
						type: 'boolean',
						description:
							'true bila pengguna menyebut modal kecil, murah, atau terjangkau. Hasil akan disaring ke kawasan yang ruang usahanya benar-benar tersedia.'
					},
					dekat_transit: {
						type: 'boolean',
						description: 'true bila pengguna menyebut dekat MRT, stasiun, atau transit.'
					},
					target: {
						type: 'array',
						items: { type: 'string' },
						description: 'Untuk COMPARE: nama kawasan yang disebut pengguna.'
					}
				},
				required: ['intent', 'kategori'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'tidak_dimengerti',
			description:
				'Panggil ini bila pertanyaan tidak bisa dijawab oleh data SpotOn, atau maksudnya tidak jelas. Lebih baik mengaku daripada menebak.',
			parameters: {
				type: 'object',
				properties: {
					alasan: {
						type: 'string',
						description:
							'Satu kalimat bahasa Indonesia sederhana untuk pengguna, menjelaskan apa yang tidak bisa dijawab. Tanpa istilah teknis.'
					}
				},
				required: ['alasan'],
				additionalProperties: false
			}
		}
	}
];

interface ToolCall {
	function?: { name?: string; arguments?: string };
}

function isCat(v: unknown): v is CategoryKey {
	return typeof v === 'string' && (CATEGORY_KEYS as string[]).includes(v);
}

/**
 * Returns `null` when the model layer cannot be used — the caller must treat that
 * as "use the rule-based parser", not as a failure.
 */
export async function parseWithLLM(
	question: string,
	w: Weights,
	fallbackCategory: CategoryKey,
	lang = 'id'
): Promise<ParseResult> {
	const key = env.OPENROUTER_API_KEY?.trim();
	if (!key) return null;

	const body = {
		messages: [
			{ role: 'system', content: `${SYSTEM}\n\n${LANG_RULE[lang] ?? LANG_RULE.id}` },
			{
				role: 'user',
				content: `Kategori yang sedang aktif: ${fallbackCategory}.\nPertanyaan: ${question}`
			}
		],
		tools: TOOLS,
		// The model must pick one of the tools — including the "I don't understand" one.
		tool_choice: 'required',
		// Required, and not merely a cost saving. Without this line OpenRouter
		// reserves the model's entire output window (tens of thousands of tokens)
		// up front, then rejects the request with a 402 if the key's remaining
		// credit cannot cover an order that size — even though what actually gets
		// used is a few dozen tokens. The answer here is always a single tool call
		// with short arguments, never prose, so 1,024 is already very generous.
		max_tokens: 1024
	};

	const chain = modelChain();
	const deadline = Date.now() + TOTAL_MS;
	let call: ToolCall | undefined;

	for (const [i, model] of chain.entries()) {
		const left = deadline - Date.now();
		if (left <= 0) {
			console.error('[SpotOn] Model chain time budget exhausted, falling back to the rule parser.');
			break;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), Math.min(ATTEMPT_MS, left));
		try {
			const res = await fetch(ENDPOINT, {
				method: 'POST',
				signal: controller.signal,
				headers: {
					authorization: `Bearer ${key}`,
					'content-type': 'application/json',
					// Used by OpenRouter for attribution; not required, but polite.
					'x-title': 'SpotOn'
				},
				body: JSON.stringify({ model, ...body })
			});

			if (!res.ok) {
				// A mistyped model name lands exactly here; without naming it, all you
				// see is "the answer came from the rules" with no reason given.
				console.error(
					`[SpotOn] ${model} rejected the request (${res.status}):`,
					(await res.text()).slice(0, 200)
				);
				continue;
			}

			const data = await res.json();
			const got: ToolCall | undefined = data?.choices?.[0]?.message?.tool_calls?.[0];
			if (!got?.function?.name) {
				// The model answered, but wrote prose instead of calling a tool. To this
				// layer that is exactly as useless as a network error.
				console.error(`[SpotOn] ${model} called no tool; moving on to the next model.`);
				continue;
			}

			if (i > 0) console.error(`[SpotOn] Answered by fallback model: ${model}`);
			call = got;
			break;
		} catch (err) {
			// Includes timeouts (AbortError). Not a reason to fail the request.
			console.error(`[SpotOn] ${model} failed:`, (err as Error).message);
		} finally {
			clearTimeout(timer);
		}
	}

	// The whole chain ran out without a single tool call → rule-based parser.
	if (!call) return null;

	try {
		const name = call.function?.name;
		if (!name) return null;

		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(call.function?.arguments ?? '{}');
		} catch {
			return null;
		}

		if (name === 'tidak_dimengerti') {
			const alasan = typeof args.alasan === 'string' ? args.alasan.trim() : '';
			return {
				ok: false,
				reason: alasan || 'Pertanyaan itu di luar yang bisa saya jawab dari data ini.'
			};
		}

		if (name !== 'jalankan_query') return null;

		const intent = args.intent;
		if (intent !== 'RANK' && intent !== 'FLAG_SATURATED' && intent !== 'COMPARE' && intent !== 'COVERAGE') {
			return null;
		}

		const kategori = isCat(args.kategori) ? args.kategori : fallbackCategory;

		const query: StructuredQuery = {
			intent,
			metrik:
				intent === 'COVERAGE'
					? 'N titik data misi per catchment'
					: intent === 'FLAG_SATURATED'
						? 'penawaran efektif (pesaing × keramaian)'
						: intent === 'COMPARE'
							? 'profil lengkap 2 catchment'
							: 'gap permintaan − penawaran',
			kategori,
			radius_m: w.radius,
			urut: intent === 'COVERAGE' ? 'asc' : 'desc',
			limit: intent === 'COMPARE' ? 2 : intent === 'COVERAGE' ? 99 : 5
		};

		if (intent !== 'COVERAGE') {
			const filter: NonNullable<StructuredQuery['filter']> = {};
			if (args.modal_kecil === true) {
				filter.ruang_sewa_tersedia = true;
				filter.tier_harga = 'rendah';
			}
			if (args.dekat_transit === true) filter.dalam_catchment_transit = `${w.radius} m`;
			query.filter = filter;
		}

		if (intent === 'COMPARE' && Array.isArray(args.target)) {
			query.target = args.target.filter((t): t is string => typeof t === 'string').slice(0, 2);
		}

		return { ok: true, query };
	} catch (err) {
		// An unexpected argument shape from the model. Same as every other failure in
		// this layer: drop to the rule-based parser, don't fail the request.
		console.error('[SpotOn] Could not read the tool call:', (err as Error).message);
		return null;
	}
}
