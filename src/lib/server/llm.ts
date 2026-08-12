import { env } from '$env/dynamic/private';
import { CATEGORY_KEYS } from '$lib/domain/categories';
import type { CategoryKey, StructuredQuery, Weights } from '$lib/types';

/**
 * Lapisan pemahaman bahasa: pertanyaan orang → query terstruktur.
 *
 * Model dipanggil lewat OpenRouter dengan *function calling*, dan itu satu-satunya
 * tugasnya: memilih operasi dan mengisi argumen. Model tidak pernah menghitung,
 * menyusun kalimat jawaban, atau menyentuh angka — seluruh nilai tetap dihitung
 * mesin skor dari data. Dengan begitu tidak ada angka yang bisa dikarang model.
 *
 * Dua hal yang membuat lapisan ini jujur:
 *
 * 1. Model diberi alat kedua, `tidak_dimengerti`. Kalau pertanyaannya di luar
 *    yang bisa dijawab data ini, ia mengaku — bukan menebak lalu dijawab dengan
 *    percaya diri. Ini justru bagian terpenting: jawaban yang salah paham tapi
 *    terdengar meyakinkan lebih berbahaya daripada tidak menjawab.
 * 2. Bila kunci tidak ada, panggilan gagal, atau waktu habis, pemanggil jatuh ke
 *    pengurai aturan. Demo tidak boleh mati hanya karena jaringan sedang buruk.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Router gratis OpenRouter. Ia mendukung function calling — syarat mati di sini,
 * karena lapisan ini tidak pernah meminta prosa, hanya pemilihan alat.
 */
const DEFAULT_MODEL = 'openrouter/free';

/**
 * Anggaran waktu satu panggilan.
 *
 * Sempat 12 detik, dan itu terlalu ketat untuk model gratis: giliran di antrean
 * bersama membuat jawaban wajar datang di detik ke-14, jadi permintaan yang
 * sebenarnya baik-baik saja dibatalkan tepat sebelum tiba. Yang terlihat oleh
 * pengguna cuma Tapak yang diam-diam kembali memakai pengurai aturan, tanpa
 * sebab yang kelihatan. Gagal karena kehabisan waktu tetap ditanggung dengan
 * anggun — tapi jangan sampai kita sendiri yang memanggil kegagalan itu.
 */
const TIMEOUT_MS = 60_000;

/**
 * Model yang dipakai lapisan pemahaman, dari `OPENROUTER_MODEL`.
 *
 * Dibaca lewat `$env/dynamic/private`, jadi mengganti model di Vercel cukup
 * mengubah Environment Variable — tidak perlu build ulang. Nilai kosong atau
 * berisi spasi diperlakukan sebagai "tidak diisi", bukan sebagai nama model
 * kosong yang akan ditolak OpenRouter dengan 400 yang membingungkan.
 */
export function activeModel(): string {
	return env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

/** Apakah lapisan model benar-benar bisa dipakai (kunci terpasang). */
export function llmEnabled(): boolean {
	return Boolean(env.OPENROUTER_API_KEY?.trim());
}

export type ParseResult =
	| { ok: true; query: StructuredQuery }
	/** Model mengerti bahasanya tapi tahu pertanyaannya di luar jangkauan data. */
	| { ok: false; reason: string }
	/** Model tidak tersedia — pemanggil harus memakai pengurai aturan. */
	| null;

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

/* Satu-satunya kalimat yang benar-benar ditulis model dan dibaca pengguna adalah
   `alasan` pada tidak_dimengerti. Ia harus keluar dalam bahasa yang sedang
   dipilih pembaca, bukan bahasa prompt-nya. */
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
 * Mengembalikan `null` bila lapisan model tidak bisa dipakai — pemanggil wajib
 * memperlakukannya sebagai "pakai pengurai aturan", bukan sebagai kegagalan.
 */
export async function parseWithLLM(
	question: string,
	w: Weights,
	fallbackCategory: CategoryKey,
	lang = 'id'
): Promise<ParseResult> {
	const key = env.OPENROUTER_API_KEY?.trim();
	if (!key) return null;
	const model = activeModel();

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			signal: controller.signal,
			headers: {
				authorization: `Bearer ${key}`,
				'content-type': 'application/json',
				// Dipakai OpenRouter untuk atribusi; tidak wajib, tapi sopan.
				'x-title': 'SpotOn'
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: `${SYSTEM}\n\n${LANG_RULE[lang] ?? LANG_RULE.id}` },
					{
						role: 'user',
						content: `Kategori yang sedang aktif: ${fallbackCategory}.\nPertanyaan: ${question}`
					}
				],
				tools: TOOLS,
				// Model wajib memilih salah satu alat — termasuk alat "tidak paham".
				tool_choice: 'required',
				// Wajib diisi, dan bukan sekadar penghematan. Tanpa baris ini
				// OpenRouter memesan seluruh jendela keluaran model (65.536 token)
				// di muka, lalu menolak permintaan dengan 402 bila sisa kredit
				// kunci tidak sanggup menanggung pesanan sebesar itu — padahal
				// yang benar-benar dipakai cuma puluhan token. Jawaban di sini
				// selalu satu panggilan alat dengan argumen pendek, tidak pernah
				// prosa, jadi 1.024 sudah sangat lapang.
				max_tokens: 1024
			})
		});

		if (!res.ok) {
			// Nama model yang salah ketik jatuh persis di sini; tanpa menyebutnya,
			// yang terlihat cuma "jawaban jadi pakai aturan" tanpa alasan.
			console.error(
				`[SpotOn] OpenRouter menolak permintaan (model ${model}):`,
				res.status,
				await res.text()
			);
			return null;
		}

		const data = await res.json();
		const call: ToolCall | undefined = data?.choices?.[0]?.message?.tool_calls?.[0];
		const name = call?.function?.name;
		if (!name) return null;

		let args: Record<string, unknown> = {};
		try {
			args = JSON.parse(call?.function?.arguments ?? '{}');
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
		// Termasuk timeout (AbortError). Bukan alasan untuk menggagalkan permintaan.
		console.error('[SpotOn] Lapisan model tidak terpakai:', (err as Error).message);
		return null;
	} finally {
		clearTimeout(timer);
	}
}
