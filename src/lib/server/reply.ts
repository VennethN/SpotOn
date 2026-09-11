import { cleanGroundedReply, factSheet, REPLY_MAX_CHARS } from '$lib/domain/grounded';
import { completeText } from '$lib/server/llm';
import type { AiAnswer, ChatTurn } from '$lib/types';

/**
 * The answer, written as an answer to the question that was actually asked.
 *
 * WHY THERE IS A SECOND PASS AT ALL
 *
 * Because one pass makes a state machine. The model picked an operation, the engine ran
 * it, and an interface template read the result out — so every ranking opened with the
 * same clause, every explanation was the same paragraph, and two different questions
 * about one catchment came back word for word identical. "Kenapa yang itu" and "menurutmu
 * sewa di Tosari bagus" both resolve to the same operation on the same place, and with a
 * template between the figures and the reader they produce the same reply. The reader is
 * left talking to a form that has learned to say hello.
 *
 * The engine is not the problem and does not change. It still computes every figure, on
 * the data, exactly as before. What changes is who writes the sentence around them.
 *
 * WHAT KEEPS IT HONEST
 *
 * `domain/grounded`. The model is handed the figures this turn produced and may write
 * those and no others, checked afterwards rather than asked for in the prompt. A reply
 * carrying a figure nobody computed is thrown away whole and the interface's own
 * composed sentence stands in, so the worst a misbehaving model can do is cost the reader
 * the plainer answer.
 *
 * The sheet it reads from and the whitelist it is held to are THE SAME STRING, so the two
 * cannot drift into disagreeing about what was computed.
 *
 * WHY IT IS NOT STREAMED
 *
 * Every other model-written sentence in this product is, because a casual reply carries
 * no figures and a reader watching one appear is watching a wait move. This one is made
 * of figures, and the rule about those has not moved: no figure is ever streamed. A
 * number arriving a digit at a time is a number being read before it has been checked,
 * and the check is the whole of why this is allowed to exist.
 */

/**
 * The budget for writing, which is deliberately not the budget for understanding.
 *
 * By the time this runs there is already a complete answer in hand and a sentence ready
 * to say it. So the wait here buys phrasing, not information, and a reader must not spend
 * another ninety seconds on it. Time out, and the composed sentence is what they get.
 */
const WRITE_MS = 30_000;
const WRITE_ATTEMPT_MS = 15_000;

const SYSTEM = `Kamu Tapak, pemandu di dalam SpotOn, peta data lokasi usaha di kawasan stasiun transit Jakarta.

Mesin skor SUDAH menghitung jawabannya dari data. Tugasmu satu: menuliskannya sebagai jawaban atas pertanyaan yang baru saja ditanyakan.

ATURAN, DAN INI KERAS:
- Setiap angka yang kamu tulis harus ADA DI FAKTA di bawah, disalin apa adanya. Dilarang menjumlahkan, merata-ratakan, membulatkan, membandingkan dengan angka dari ingatanmu, atau menulis kisaran.
- Dilarang menulis angka yang tidak ada di fakta. Tidak ada perkiraan dan tidak ada "sekitar sekian". Balasan yang memuat angka begitu dibuang mesin, dan pembacanya dapat kalimat baku, jadi tidak ada gunanya.
- Dilarang menyebut nama kawasan yang tidak ada di fakta.
- Kalau faktanya tidak bisa menjawab yang ditanya, katakan begitu. Itu jawaban yang sah di sini, dan lebih berguna daripada tebakan yang enak dibaca.
- Kalau yang ditanya soal SEWA, faktanya harga JUAL, dan itu harus dikatakan terus terang. Tidak ada data sewa untuk Jakarta di katalognya, dan sewa TIDAK BOLEH diperkirakan dari harga jual.
- JANGAN membacakan ulang seluruh daftar peringkatnya. Daftarnya sudah tampil di layar tepat di bawah kalimatmu. Jawab pertanyaannya, sebut yang perlu disebut saja.
- Maksimal empat kalimat pendek. Bicara seperti orang yang sudah keliling kawasannya, bukan seperti laporan.
- Jangan menyapa ulang, jangan memperkenalkan diri, jangan menawarkan bantuan lain di akhir.`;

const LANG_RULE: Record<string, string> = {
	id: 'Tulis balasanmu dalam bahasa Indonesia.',
	en: 'Write your reply in English.'
};

/**
 * Writes one answer, or returns null and lets the interface compose its own.
 *
 * `everyName` is every catchment name on the grid, which is what makes the name rule
 * answerable rather than merely worrying: the set is closed at 562, so a reply can be
 * checked for naming a place this answer never named. A figure quoted against the wrong
 * place is wrong in the one way a reader cannot catch, because the number checks out.
 */
export async function writeReply(
	answer: AiAnswer,
	question: string,
	history: readonly ChatTurn[],
	everyName: readonly string[],
	lang: string
): Promise<string | null> {
	/* Nothing to write from. A turn that computed nothing is either small talk, which has
	   its own fence and its own sentence, or a refusal, which the model already wrote. */
	if (!answer.items.length && !answer.explain) return null;

	const facts = factSheet(answer);
	const thread = history
		.slice(-6)
		.map((t) => `${t.who === 'user' ? 'Pengguna' : 'Kamu'}: ${t.text || (t.places ?? []).join(', ')}`)
		.join('\n');

	const raw = await completeText(
		[
			{ role: 'system', content: `${SYSTEM}\n\n${LANG_RULE[lang] ?? LANG_RULE.id}` },
			{
				role: 'user',
				content:
					(thread ? `Percakapan sebelumnya:\n${thread}\n\n` : '') +
					`Pertanyaan yang harus dijawab: ${question}\n\n` +
					`FAKTA (semua sudah dihitung mesin skor dari data, dan cuma angka di sini yang boleh kamu tulis):\n${facts}`
			}
		],
		WRITE_MS,
		WRITE_ATTEMPT_MS,
		// Four short sentences. Room to finish one rather than room to write an essay:
		// a reply that runs past the fence's length is thrown away either way.
		Math.ceil(REPLY_MAX_CHARS / 2)
	);

	const named = [
		...(answer.explain ? [answer.explain.name] : []),
		...answer.items.map((i) => i.name)
	];
	const clean = cleanGroundedReply(raw, facts, named, everyName);
	if (raw && !clean) {
		console.error('[SpotOn] A written reply broke the grounding fence and was dropped.');
	}
	return clean;
}
