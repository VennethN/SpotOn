import { env } from '$env/dynamic/private';
import { CATEGORIES, CATEGORY_KEYS } from '$lib/domain/categories';
import { CHAT_TOPICS, cleanChatReply, isChatTopic, type ChatTopic } from '$lib/domain/chat';
import { DEFAULT_METRIC, METRIC_KEYS, isMetric, resolveOrder } from '$lib/domain/metrics';
import { UNIT_METRIC_KEYS, isUnitMetric, resolveUnitOrder } from '$lib/domain/units';
import { RADII, snapRadius } from '$lib/domain/weights';
import type {
	CategoryKey,
	MetricKey,
	StructuredQuery,
	UnitMetricKey,
	Weights
} from '$lib/types';

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
	/**
	 * Not a data question at all, and not one to refuse either: a greeting, a question
	 * about SpotOn itself, or general talk about running a small business.
	 *
	 * `text` is the one sentence in this whole product the model actually writes, and it
	 * has already been through `cleanChatReply` before it gets here — no digits, two
	 * sentences at most. Null means the model broke that fence and the caller falls back
	 * to the canned line for the topic.
	 */
	| { ok: false; chat: ChatTopic; text: string | null }
	/** The model understood the language but knows the question is out of the data's range. */
	| { ok: false; reason: string }
	/** The model is unavailable — the caller must use the rule-based parser. */
	| null;

/* The prompt and the tool schema below stay in Indonesian deliberately: users ask
   in Indonesian, and the structured query these produce is the documented API
   contract (intent, metrik, kategori, radius, filter). Translating them would
   change model behaviour and break that contract, so only the surrounding code
   comments are in English. */
/**
 * What each measure means, for the model.
 *
 * Written next to the registry's keys rather than inside it, because the registry is
 * arithmetic and this is a prompt. The keys come FROM the registry, so a measure added
 * there and not described here fails the check below at module load rather than
 * quietly reaching the model with no explanation of what it is.
 */
const METRIC_HELP: Record<MetricKey, string> = {
	skor: 'skor peluang gabungan, 0-100. Dipakai untuk "di mana sebaiknya buka".',
	permintaan:
		'ramainya usaha di sekitar petak selain kategori yang ditanya, 0-100. Bukan survei pembeli: ini hitungan usaha lain dalam radius jalan kaki.',
	penawaran: 'kepadatan pesaing sejenis dibanding petak terpadat di seluruh kisi, 0-100.',
	pesaing: 'jumlah pesaing sejenis dalam radius jalan kaki.',
	keramaian:
		'jumlah usaha lain dalam radius jalan kaki, apa pun jenisnya. Untuk "seberapa ramai", "mana yang sepi", "mana yang banyak pengunjung".',
	harga_tempat:
		'median harga JUAL tempat usaha per m² tanah, rupiah, dari katalog properti MAPID. PENTING: katalog MAPID tidak punya listing SEWA untuk Jakarta sama sekali, jadi ini harga beli, bukan sewa bulanan. Tetap pakai ukuran ini kalau pengguna bertanya soal sewa atau biaya tempat, karena inilah data harga yang ada.',
	unit_dipasarkan: 'jumlah unit komersial yang sedang dipasarkan dalam radius jalan kaki.',
	akses_transit: 'indeks akses transit petak, 0-100.',
	simpul_transit: 'jumlah simpul transit (stasiun/halte) dalam radius jalan kaki.'
};

/**
 * What each UNIT measure means, for the model.
 *
 * A second table rather than a mapping off the one above, because the two registries
 * measure different things and the overlap is smaller than it looks. `harga_tempat` on a
 * catchment is a median per m² across everything in walking range; `harga` on a unit is
 * the number on that one doorway. A model told they were the same measure would quote a
 * grid statistic as an asking price.
 */
const UNIT_METRIC_HELP: Record<UnitMetricKey, string> = {
	harga: 'harga JUAL yang diminta untuk tempat itu, rupiah. Bukan sewa bulanan.',
	harga_m2: 'harga jual per m² tanah tempat itu, rupiah.',
	luas_tanah: 'luas tanahnya, m².',
	luas_bangunan: 'luas bangunannya, m².',
	lantai: 'jumlah lantainya.',
	skor_petak: 'skor peluang petak tempat itu berdiri, 0-100. Ini urutan bawaannya.',
	permintaan_petak: 'perkiraan permintaan pembeli di petak tempat itu berdiri, 0-100.',
	pesaing_petak: 'jumlah pesaing sejenis di petak tempat itu berdiri.',
	akses_petak: 'indeks akses transit petak tempat itu berdiri, 0-100.',
	jarak_pusat: 'jarak tempat itu ke pusat petaknya, meter.'
};

// A measure that reached either enum with nothing said about it would be offered to the
// model as a bare key, and the model would guess at what it means.
for (const k of METRIC_KEYS) {
	if (!METRIC_HELP[k]) throw new Error(`[SpotOn] metric "${k}" has no description in llm.ts`);
}
for (const k of UNIT_METRIC_KEYS) {
	if (!UNIT_METRIC_HELP[k]) throw new Error(`[SpotOn] unit metric "${k}" has no description in llm.ts`);
}

const SYSTEM = `Kamu lapisan pemahaman untuk SpotOn, peta data lokasi usaha di kawasan stasiun transit Jakarta.

Tugasmu HANYA menerjemahkan pertanyaan pengguna menjadi satu pemanggilan alat. Kamu tidak menghitung apa pun dan tidak menulis jawaban — mesin skor yang melakukannya dari data asli.

Data yang tersedia, dan hanya ini:
- 562 petak heksagon H3 yang menutupi kawasan berjalan kaki (800 m) di sekitar simpul transit Jakarta — MRT, KRL, LRT, dan koridor TransJakarta. 90 di antaranya belum ada datanya.
- ${CATEGORIES.length} jenis usaha: ${CATEGORIES.map((c) => `${c.key} (${c.name.toLowerCase()})`).join(', ')}.
- Per petak, ukuran yang bisa ditanyakan:
${METRIC_KEYS.map((k) => `  - ${k}: ${METRIC_HELP[k]}`).join('\n')}

DUA HAL YANG DIPILIH TERPISAH: bentuk pertanyaannya (intent) dan ukuran yang ditanyakan (ukuran).

intent:
- RANK — memeringkat petak. Ini yang paling umum, dan dipakai untuk SEMUA pertanyaan "di mana", "mana yang paling", "seberapa". Ukurannya yang membedakan.
- FLAG_SATURATED — "mana yang sudah jenuh/penuh", "mana yang harus dihindari".
- COMPARE — membandingkan dua kawasan yang disebut namanya.
- COVERAGE — "mana yang belum ada datanya", pertanyaan soal cakupan data.

ukuran: pilih dari daftar di atas sesuai apa yang benar-benar ditanyakan.
- "di mana sebaiknya buka kedai kopi" → skor
- "seberapa ramai di sini" / "mana yang paling sepi" → keramaian
- "di mana sewanya paling murah" / "harga tempat" → harga_tempat
- "mana yang paling banyak tempat kosong" → unit_dipasarkan
- "mana yang paling ramai pengunjung" → kunjungan
- "jam berapa paling ramai" → jam_puncak
- "mana yang pesaingnya paling sedikit" → pesaing

urut: 'desc' untuk "paling banyak/tinggi/mahal/ramai", 'asc' untuk "paling sedikit/rendah/murah/sepi". Kalau pengguna tidak menyebut arah, kosongkan saja — mesin memakai arah yang masuk akal untuk ukuran itu.

pivot: bentuk jawabannya. 'cell' memeringkat PETAK kawasan; 'unit' memeringkat TEMPAT USAHA yang sedang dipasarkan, satu per satu, dengan petaknya ikut sebagai keterangan. Kosongkan kalau pengguna tidak menyebut bentuknya — mode yang sedang dipakai dibiarkan.
- "ruko mana yang paling murah" / "tampilkan per tempat" → pivot unit
- "kawasan mana yang paling ramai" / "per petak saja" → pivot cell
- "di mana sebaiknya buka kedai kopi" → kosongkan, ini soal ukuran bukan soal bentuk
ukuran_unit dipakai HANYA bersama pivot 'unit', untuk mengurutkan daftar tempatnya.

radius_m: radius jalan kaki yang dipakai menghitung. Isi hanya kalau pengguna menyebut jaraknya sendiri, misalnya "dalam 500 m". Pilihannya ${RADII.join(', ')} meter. Menit jalan kaki BUKAN meter, jangan dikonversi.

filters: dipakai untuk menyaring, bukan memeringkat. Tiap filter menyebut satu ukuran dan satu pita: 'rendah' (sepertiga terbawah), 'tinggi' (sepertiga teratas), atau 'ada' (ada isinya, lebih dari nol). JANGAN pernah mengarang angka ambang — kamu tidak bisa, dan memang tidak boleh.
Contoh: "kedai kopi di tempat yang sewanya murah dan dekat transit" → intent RANK, ukuran skor, filters [{ukuran: harga_tempat, arah: rendah}, {ukuran: akses_transit, arah: tinggi}].

NGOBROL SECUKUPNYA. Panggil ngobrol untuk kalimat yang memang bukan permintaan data:
- sapaan: "halo", "makasih", "kamu siapa", "sampai jumpa".
- tentang: apa itu SpotOn, datanya dari mana, apa yang bisa dan tidak bisa dijawab.
- usaha: obrolan umum soal buka usaha kecil — kenapa lokasi penting, bedanya warteg dan kafe, hal yang biasa dipikirkan sebelum menyewa tempat.

Aturan ngobrol, dan ini keras:
- MAKSIMAL DUA KALIMAT pendek.
- DILARANG menulis angka apa pun. Tidak ada persen, rupiah, jumlah, bulan, tahun, atau "sekitar sekian". Kalau menjawabnya butuh angka, itu bukan ngobrol — panggil jalankan_query.
- Jangan mengarang fakta soal pasar, harga, atau perilaku pembeli. Bicara umum saja, lalu arahkan kembali ke apa yang bisa dijawab peta.
- Balasan yang memuat angka akan dibuang mesin dan diganti kalimat baku. Jadi jangan.

Panggil tidak_dimengerti bila pertanyaannya di luar semua itu — misalnya kota selain Jakarta, jenis usaha yang tidak ada dalam daftar, perizinan, pajak, urusan pribadi, atau kalimat yang tidak jelas maksudnya. Jangan menebak hanya supaya bisa menjawab; lebih baik mengaku tidak paham.`;

/* The only sentences the model really writes and the user really reads are `alasan`
   on tidak_dimengerti and `balasan` on ngobrol. Both have to come out in the language
   the reader has selected, not in the language of the prompt. */
const LANG_RULE: Record<string, string> = {
	id: 'Tulis argumen `alasan` dan `balasan` dalam bahasa Indonesia.',
	en: 'Write the `alasan` and `balasan` arguments in English.'
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
					ukuran: {
						type: 'string',
						enum: METRIC_KEYS,
						description: `Ukuran yang ditanyakan. ${METRIC_KEYS.map((k) => `${k} = ${METRIC_HELP[k]}`).join(' ')}`
					},
					urut: {
						type: 'string',
						enum: ['asc', 'desc'],
						description:
							"'desc' untuk paling banyak/tinggi/mahal/ramai, 'asc' untuk paling sedikit/rendah/murah/sepi. Kosongkan bila pengguna tidak menyebut arah."
					},
					filters: {
						type: 'array',
						description:
							'Penyaring. Tiap item menyebut satu ukuran dan satu pita. Tidak ada angka ambang di sini — mesin menghitungnya dari sebaran data.',
						items: {
							type: 'object',
							properties: {
								ukuran: { type: 'string', enum: METRIC_KEYS },
								arah: {
									type: 'string',
									enum: ['rendah', 'tinggi', 'ada'],
									description:
										"'rendah' sepertiga terbawah, 'tinggi' sepertiga teratas, 'ada' lebih dari nol."
								}
							},
							required: ['ukuran', 'arah'],
							additionalProperties: false
						}
					},
					modal_kecil: {
						type: 'boolean',
						description:
							'true bila pengguna menyebut modal kecil, murah, atau terjangkau. Hasil akan disaring ke kawasan yang ruang usahanya benar-benar tersedia dan harganya di sepertiga terbawah.'
					},
					dekat_transit: {
						type: 'boolean',
						description: 'true bila pengguna menyebut dekat MRT, stasiun, atau transit.'
					},
					target: {
						type: 'array',
						items: { type: 'string' },
						description: 'Untuk COMPARE: nama kawasan yang disebut pengguna.'
					},
					pivot: {
						type: 'string',
						enum: ['cell', 'unit'],
						description:
							"Yang jadi barisnya di peta. 'cell' = petak kawasan, 'unit' = tempat usaha yang sedang dipasarkan, satu per satu. Isi HANYA kalau pengguna memang menyebut bentuk jawabannya: 'ruko mana yang paling murah' → unit, 'kawasan mana yang paling ramai' → cell. Kalau tidak disebut, KOSONGKAN — mode yang sedang dipakai dibiarkan apa adanya."
					},
					ukuran_unit: {
						type: 'string',
						enum: UNIT_METRIC_KEYS,
						description: `Hanya untuk pivot 'unit': daftar tempatnya diurutkan menurut ukuran ini. ${UNIT_METRIC_KEYS.map((k) => `${k} = ${UNIT_METRIC_HELP[k]}`).join(' ')}`
					},
					radius_m: {
						type: 'integer',
						enum: [...RADII],
						description:
							'Radius jalan kaki yang dipakai menghitung, dalam meter. Isi HANYA kalau pengguna menyebut jaraknya sendiri, misalnya "dalam 500 m". Kalau tidak disebut, kosongkan — radius yang sedang dipakai tetap berlaku. JANGAN mengubah lama berjalan kaki (menit) menjadi meter; itu tebakan, bukan data.'
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
			name: 'ngobrol',
			description:
				'Panggil ini untuk sapaan, pertanyaan tentang SpotOn sendiri, atau obrolan umum soal buka usaha kecil — kalimat yang memang bukan permintaan data. Maksimal dua kalimat, dan DILARANG memuat angka.',
			parameters: {
				type: 'object',
				properties: {
					topik: {
						type: 'string',
						enum: CHAT_TOPICS,
						description:
							'sapaan = halo/makasih/kamu siapa. tentang = apa itu SpotOn dan datanya. usaha = obrolan umum soal buka usaha kecil.'
					},
					balasan: {
						type: 'string',
						description:
							'Balasan singkat dan ramah, maksimal dua kalimat, tanpa satu angka pun. Tutup dengan mengarahkan ke pertanyaan yang bisa dijawab peta.'
					}
				},
				required: ['topik', 'balasan'],
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

		if (name === 'ngobrol') {
			const topik = args.topik;
			// An unrecognised topic is not chat. Letting it through would make the enum
			// decorative and hand the model a way to reply in prose about anything.
			if (!isChatTopic(topik)) return null;
			// The fence, applied rather than requested. `cleanChatReply` returns null for
			// anything carrying a digit or running long, and the caller then uses the
			// canned line for the topic — so a misbehaving model costs the reader nothing.
			return { ok: false, chat: topik, text: cleanChatReply(args.balasan) };
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
		// An unrecognised measure falls back to the opportunity score rather than failing
		// the whole parse: the model got the shape of the question right, and answering
		// the usual question beats dropping to the rule parser over one bad enum value.
		const ukuran: MetricKey = isMetric(args.ukuran) ? args.ukuran : DEFAULT_METRIC;
		// The measure's own idea of "best" when the model did not state a direction. It is
		// told to leave it out unless the user said so, precisely so this default applies:
		// cheapest space and busiest street are both "best" and sit at opposite ends.
		const urut = resolveOrder(
			ukuran,
			args.urut === 'asc' || args.urut === 'desc' ? args.urut : undefined
		);

		/* Absent means "leave the mode alone", and that is the important half: most
		   questions say nothing about the shape of the answer, and a query that always
		   carried a pivot would flip the map back to catchments every time somebody
		   browsing units asked about anything else. */
		const pivot = args.pivot === 'cell' || args.pivot === 'unit' ? args.pivot : undefined;
		/* Snapped rather than rejected, and only when the model actually filled it in.
		   The honest answer for a model that asked for 612 m is the 600 the property data
		   holds a median for — but the honest answer for a model that asked for nothing is
		   the radius the reader already had, not the default. */
		const radius = typeof args.radius_m === 'number' ? snapRadius(args.radius_m) : w.radius;

		const query: StructuredQuery = {
			intent,
			metrik:
				intent === 'COVERAGE'
					? 'N titik data misi per catchment'
					: intent === 'FLAG_SATURATED'
						? 'penawaran efektif (pesaing × keramaian)'
						: intent === 'COMPARE'
							? 'profil lengkap 2 catchment'
							: `peringkat menurut ${ukuran}`,
			kategori,
			ukuran: intent === 'RANK' ? ukuran : DEFAULT_METRIC,
			radius_m: radius,
			urut: intent === 'COVERAGE' ? 'asc' : intent === 'RANK' ? urut : 'desc',
			limit: intent === 'COMPARE' ? 2 : intent === 'COVERAGE' ? 99 : 5
		};

		if (pivot) query.pivot = pivot;
		// Only alongside the pivot it belongs to. On a catchment ranking it is a field
		// nothing downstream reads, and setting it anyway would leave the unit list
		// silently re-sorted the next time the reader switched pivot by hand.
		if (pivot === 'unit' && isUnitMetric(args.ukuran_unit)) {
			query.ukuran_unit = args.ukuran_unit;
			// Resolved against the UNIT measure, never against `urut` above — that one was
			// settled against the catchment measure, and the two registries disagree about
			// which end is "best" often enough for the reuse to be wrong quietly.
			query.urut_unit = resolveUnitOrder(
				args.ukuran_unit,
				args.urut === 'asc' || args.urut === 'desc' ? args.urut : undefined
			);
		}

		if (intent !== 'COVERAGE') {
			const filter: NonNullable<StructuredQuery['filter']> = {};
			const filters: NonNullable<StructuredQuery['filters']> = [];
			// Read before the booleans below, so a model that used both does not get its
			// explicit filters overwritten by the shorthand.
			if (Array.isArray(args.filters)) {
				for (const raw of args.filters) {
					const f = raw as { ukuran?: unknown; arah?: unknown };
					if (!isMetric(f.ukuran)) continue;
					if (f.arah !== 'rendah' && f.arah !== 'tinggi' && f.arah !== 'ada') continue;
					// Filtering a ranking by its own measure and then ranking it says the
					// same thing twice while throwing away two thirds of the answer.
					if (f.ukuran === ukuran && f.arah !== 'ada') continue;
					filters.push({ ukuran: f.ukuran, arah: f.arah });
				}
			}
			if (args.modal_kecil === true) {
				filter.ruang_sewa_tersedia = true;
				filter.tier_harga = 'rendah';
				if (!filters.some((f) => f.ukuran === 'unit_dipasarkan')) {
					filters.push({ ukuran: 'unit_dipasarkan', arah: 'ada' });
				}
				if (ukuran !== 'harga_tempat' && !filters.some((f) => f.ukuran === 'harga_tempat')) {
					filters.push({ ukuran: 'harga_tempat', arah: 'rendah' });
				}
			}
			if (args.dekat_transit === true) {
				// The radius the query will RUN at, which is not necessarily the one the
				// reader had set — the question may have named its own.
				filter.dalam_catchment_transit = `${radius} m`;
				if (
					ukuran !== 'akses_transit' &&
					ukuran !== 'simpul_transit' &&
					!filters.some((f) => f.ukuran === 'akses_transit')
				) {
					filters.push({ ukuran: 'akses_transit', arah: 'tinggi' });
				}
			}
			query.filter = filter;
			query.filters = filters;
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
