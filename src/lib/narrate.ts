import { CATEGORY_MAP } from './categories';
import { pct } from './scoring';
import type { AiAnswer, StructuredQuery } from './types';

/**
 * Menerjemahkan hasil mesin skor ke satu kalimat yang bisa dibaca siapa pun.
 *
 * Dipisahkan dari kelas `Tapak` supaya halaman depan memakai kalimat yang sama
 * persis dengan aplikasinya. Kalau keduanya menulis kalimatnya sendiri-sendiri,
 * cepat atau lambat halaman depan menjanjikan sesuatu yang tidak dikatakan
 * aplikasinya — dan itu tepat jenis ketidakjujuran yang produk ini hindari.
 */
export function narrate(ans: AiAnswer): string {
	// Model mengaku tidak paham. Tapak ikut mengaku, bukan mengarang jawaban
	// atas pertanyaan yang tidak ia mengerti — di sinilah kepercayaan dijaga.
	if (ans.notUnderstood) {
		return `${ans.notUnderstood} Yang saya hafal cuma kawasan di sekitar transit Jakarta, untuk lima jenis usaha. Mau saya carikan salah satunya?`;
	}

	const cat = CATEGORY_MAP[ans.query.kategori].name.toLowerCase();
	const n = ans.items.length;

	if (ans.query.intent === 'COVERAGE') {
		return n === 0
			? 'Semua kawasan sudah ada datanya.'
			: `Ada ${n} kawasan yang belum saya punya datanya sama sekali. Saya tidak menilainya — daripada saya karang, lebih baik saya bilang belum tahu.`;
	}
	if (ans.query.intent === 'FLAG_SATURATED') {
		return n === 0
			? 'Tidak ada yang benar-benar sesak untuk usaha ini.'
			: `Ini ${n} kawasan yang menurut saya sebaiknya dihindari dulu untuk ${cat} — pesaingnya rapat dan kebanyakan ramai.`;
	}
	if (ans.query.intent === 'COMPARE') {
		return n < 2 ? ans.headline : `Kalau dibandingkan, begini hasilnya.`;
	}
	if (n === 0) {
		return `Belum ada kawasan yang cocok untuk ${cat} dengan syarat itu. Mau saya longgarkan syaratnya?`;
	}
	const top = ans.items[0];
	return `Kalau saya yang pilih, ${top.name} dulu${
		top.value != null ? ` — nilainya ${pct(top.value)} dari 100` : ''
	}. Ini ${n} yang teratas menurut catatan saya.`;
}

/**
 * Query terstruktur ditulis ulang sebagai potongan kata biasa.
 *
 * Isinya sama persis dengan objek query yang dijalankan mesin — pengguna tetap
 * bisa memeriksa apa yang ditangkap peta — tapi tanpa sintaks yang cuma terbaca
 * oleh programmer.
 */
export function describeQuery(q: StructuredQuery): string[] {
	const out = [CATEGORY_MAP[q.kategori].name.toLowerCase()];
	if (q.intent === 'FLAG_SATURATED') out.push('yang sudah sesak');
	if (q.intent === 'COVERAGE') out.push('yang belum ada datanya');
	if (q.filter?.dalam_catchment_transit) {
		out.push(`dalam ${q.radius_m} m jalan kaki dari simpul transit`);
	}
	if (q.filter?.ruang_sewa_tersedia) out.push('ada ruang yang disewakan');
	if (q.filter?.tier_harga === 'rendah') out.push('sewa kelas bawah');
	return out;
}
