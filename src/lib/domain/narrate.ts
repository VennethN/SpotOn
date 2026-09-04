import type { Copy } from '$lib/i18n';
import { pct } from '$lib/utils/format';
import type { AiAnswer, ScoredHex, StructuredQuery } from '$lib/types';

/**
 * Menerjemahkan hasil mesin skor ke satu kalimat yang bisa dibaca siapa pun.
 *
 * Dipisahkan dari kelas `Tapak` supaya halaman depan memakai kalimat yang sama
 * persis dengan aplikasinya. Kalau keduanya menulis kalimatnya sendiri-sendiri,
 * cepat atau lambat halaman depan menjanjikan sesuatu yang tidak dikatakan
 * aplikasinya — dan itu tepat jenis ketidakjujuran yang produk ini hindari.
 */
export function narrate(ans: AiAnswer, c: Copy): string {
	const n$ = c.narrate;
	// Model mengaku tidak paham. Tapak ikut mengaku, bukan mengarang jawaban
	// atas pertanyaan yang tidak ia mengerti — di sinilah kepercayaan dijaga.
	if (ans.notUnderstood) return n$.notUnderstood(ans.notUnderstood);

	const cat = c.category[ans.query.kategori].name.toLowerCase();
	const n = ans.items.length;

	if (ans.query.intent === 'COVERAGE') {
		return n === 0 ? n$.coverageNone : n$.coverageSome(n);
	}
	if (ans.query.intent === 'FLAG_SATURATED') {
		return n === 0 ? n$.saturatedNone : n$.saturatedSome(n, cat);
	}
	if (ans.query.intent === 'COMPARE') {
		return n < 2 ? ans.headline : n$.compare;
	}
	if (n === 0) return n$.rankNone(cat);

	const top = ans.items[0];
	return n$.rankTop(top.name, top.value != null ? pct(top.value) : null, n);
}

/**
 * Query terstruktur ditulis ulang sebagai potongan kata biasa.
 *
 * Isinya sama persis dengan objek query yang dijalankan mesin — pengguna tetap
 * bisa memeriksa apa yang ditangkap peta — tapi tanpa sintaks yang cuma terbaca
 * oleh programmer.
 */
export function describeQuery(q: StructuredQuery, c: Copy): string[] {
	const out = [c.category[q.kategori].name.toLowerCase()];
	if (q.intent === 'FLAG_SATURATED') out.push(c.query.saturated);
	if (q.intent === 'COVERAGE') out.push(c.query.coverage);
	if (q.filter?.dalam_catchment_transit) out.push(c.query.within(q.radius_m));
	if (q.filter?.ruang_sewa_tersedia) out.push(c.query.hasSpace);
	if (q.filter?.tier_harga === 'rendah') out.push(c.query.cheap);
	return out;
}

/**
 * Frasa penawaran harus mencerminkan KEDUA pendorongnya (jumlah pesaing ×
 * keramaian). Kalau hanya keramaian yang dibaca, narasinya bisa berlawanan
 * dengan skornya sendiri.
 */
export function supplyPhrase(r: ScoredHex, c: Copy): string {
	const padat = (r.supply ?? 0) >= 0.6;
	const ramai = r.ramai >= 0.45;
	if (padat && ramai) return c.supply.denseBusy;
	if (padat && !ramai) return c.supply.denseQuiet;
	if (!padat && ramai) return c.supply.fewBusy;
	return c.supply.fewQuiet;
}
