import { error, json } from '@sveltejs/kit';
import { isCategory } from '$lib/categories';
import { answer, parseQuestion, runQuery } from '$lib/nlq';
import { DEFAULT_WEIGHTS } from '$lib/scoring';
import { parseWithLLM } from '$lib/server/llm';
import { loadHexes } from '$lib/server/source';
import type { AiAnswer, CategoryKey, Weights } from '$lib/types';
import type { RequestHandler } from './$types';

interface Body {
	question?: string;
	kategori?: string;
	weights?: Partial<Weights>;
}

const clamp01 = (v: unknown, fallback: number) =>
	typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

/**
 * POST /api/ai/query — mesin rekomendasi di dalam antarmuka.
 *
 * Dua lapis, dan pembagiannya yang penting:
 *
 * - **Memahami** pertanyaan dikerjakan model (OpenRouter, function-calling).
 *   Model hanya memilih operasi dan mengisi argumennya.
 * - **Menghitung** dikerjakan mesin skor di server, dari data. Model tidak
 *   pernah menyentuh satu angka pun, jadi tidak ada nilai yang bisa dikarang.
 *
 * Bila model tidak tersedia — kunci belum dipasang, jaringan mati, waktu habis —
 * pengurai aturan mengambil alih dan jawabannya tetap keluar. Yang berubah cuma
 * seberapa pandai pertanyaannya dipahami, bukan benar atau tidaknya angkanya.
 * Jalur mana yang dipakai ikut dikirim sebagai `parsedBy`, supaya antarmuka bisa
 * jujur soal itu alih-alih menyamarkannya.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: Body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body harus berupa JSON.');
	}

	const question = (body.question ?? '').trim();
	if (!question) throw error(400, 'Pertanyaan kosong.');
	if (question.length > 500) throw error(413, 'Pertanyaan terlalu panjang.');

	const fallback: CategoryKey = isCategory(body.kategori) ? body.kategori : 'kopi';
	const w = body.weights ?? {};
	const weights: Weights = {
		wd: clamp01(w.wd, DEFAULT_WEIGHTS.wd),
		ws: clamp01(w.ws, DEFAULT_WEIGHTS.ws),
		gate: w.gate ?? DEFAULT_WEIGHTS.gate,
		radius: w.radius === 400 ? 400 : 800
	};

	const catchments = loadHexes();
	const parsed = await parseWithLLM(question, weights, fallback);

	// Model mengaku tidak paham. Ini hasil yang sah, bukan kegagalan — dan jauh
	// lebih baik daripada menjawab pertanyaan yang salah ditafsirkan.
	if (parsed && !parsed.ok) {
		const empty: AiAnswer = {
			query: parseQuestion(question, weights, fallback),
			parsedBy: 'model',
			notUnderstood: parsed.reason,
			headline: parsed.reason,
			items: [],
			highlight: [],
			provenance: [
				'Pertanyaan tidak dipetakan ke operasi mana pun, jadi tidak ada angka yang dihitung.'
			]
		};
		return json(empty);
	}

	const result: AiAnswer = parsed
		? { ...runQuery(parsed.query, question, catchments, weights), parsedBy: 'model' }
		: { ...answer(question, catchments, weights, fallback), parsedBy: 'aturan' };

	return json(result);
};
