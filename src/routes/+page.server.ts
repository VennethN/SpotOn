import { CATEGORIES, CATEGORY_MAP } from '$lib/categories';
import { describeQuery, narrate } from '$lib/narrate';
import { runQuery } from '$lib/nlq';
import { DEFAULT_WEIGHTS } from '$lib/scoring';
import { grid, loadHexes } from '$lib/server/source';
import type { CategoryKey, StructuredQuery } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Isi halaman depan dihitung di server, bukan ditulis tangan.
 *
 * Dua alasan, dan keduanya soal kejujuran:
 *
 * 1. **Angkanya tidak boleh basi.** Jumlah petak, simpul transit, dan pesaing
 *    dibaca dari berkas kisi yang sama dengan yang dipakai peta. Begitu kisinya
 *    dibangun ulang, halaman depan ikut benar tanpa ada yang perlu ingat
 *    memperbaruinya — angka yang ditulis tangan di sini pernah tertinggal jauh.
 * 2. **Percakapan contohnya dijawab mesin yang sama.** Pertanyaannya memang
 *    sudah ditentukan, tapi jawabannya dihitung `runQuery` dari data — bukan
 *    transkrip yang dikarang. Yang dijanjikan halaman depan persis yang akan
 *    ditemui pengguna di dalam aplikasi.
 *
 * Atribut misinya sendiri masih CONTOH, dan penandanya ikut sampai ke layar.
 */

/** Sepasang pertanyaan yang sudah ditentukan — jawabannya tetap dihitung mesin. */
interface Script {
	id: string;
	kategori: CategoryKey;
	/** Yang ditekan pengguna pada langkah pertama. */
	pilih: string;
	/** Label pendek untuk bilah lompat — kalimat panjang merusak barisnya. */
	chip: string;
	/** Pertanyaan lanjutan dari Tapak, lalu jawaban yang ditekan pengguna. */
	tanya: string;
	jawab: string;
	/** Kalimat pengantar Tapak sebelum menghitung. */
	preface: string;
	query: StructuredQuery;
}

const W = DEFAULT_WEIGHTS;

const rank = (kategori: CategoryKey, modalKecil: boolean): StructuredQuery => ({
	intent: 'RANK',
	metrik: 'gap permintaan − penawaran',
	kategori,
	radius_m: W.radius,
	filter: {
		dalam_catchment_transit: `${W.radius} m`,
		...(modalKecil ? { ruang_sewa_tersedia: true, tier_harga: 'rendah' as const } : {})
	},
	urut: 'desc',
	limit: 3
});

function scriptFor(kategori: CategoryKey, modalKecil: boolean): Script {
	const nama = CATEGORY_MAP[kategori].name.toLowerCase();
	return {
		id: kategori,
		kategori,
		pilih: CATEGORY_MAP[kategori].name,
		chip: CATEGORY_MAP[kategori].short,
		tanya: `Oke, ${nama}. Modalnya kira-kira bagaimana?`,
		jawab: modalKecil ? 'Pas-pasan' : 'Agak longgar',
		preface: modalKecil
			? 'Saya carikan yang ruangnya benar-benar sedang disewakan, ya.'
			: 'Baik, saya lihat semuanya dulu.',
		query: rank(kategori, modalKecil)
	};
}

/** Modal kecil dipakai selang-seling supaya kedua cabang percakapan ikut terlihat. */
const SCRIPTS: Script[] = [
	scriptFor('kopi', true),
	scriptFor('warung', false),
	{
		id: 'jenuh',
		kategori: 'minimarket',
		pilih: 'Minimarket',
		chip: 'Yang jenuh',
		tanya: 'Oke, minimarket. Mau saya carikan yang bagus, atau yang sebaiknya dihindari?',
		jawab: 'Yang sebaiknya dihindari',
		preface: 'Boleh. Ini yang pesaingnya paling rapat.',
		query: {
			intent: 'FLAG_SATURATED',
			metrik: 'penawaran efektif (pesaing × keramaian)',
			kategori: 'minimarket',
			radius_m: W.radius,
			urut: 'desc',
			limit: 3
		}
	},
	scriptFor('laundry', true),
	scriptFor('apotek', false),
	{
		id: 'cakupan',
		kategori: 'kopi',
		pilih: 'Sebentar — datanya lengkap?',
		chip: 'Cakupan data',
		tanya: 'Tidak semuanya. Mau saya tunjukkan yang mana saja yang belum?',
		jawab: 'Tunjukkan',
		preface: 'Ini yang belum saya punya datanya.',
		query: {
			intent: 'COVERAGE',
			metrik: 'N titik data misi per catchment',
			kategori: 'kopi',
			radius_m: W.radius,
			urut: 'asc',
			limit: 99
		}
	}
];

/**
 * Tidak ada satu pun angka di sini yang bergantung pada permintaan: kisinya
 * berkas yang ikut di-bundel. Jadi halaman ini digambar sekali saat build dan
 * disajikan sebagai berkas statis — tidak ada fungsi server yang dibangunkan
 * hanya untuk menghitung ulang jawaban yang sama.
 */
export const prerender = true;

export const load: PageServerLoad = () => {
	const hexes = loadHexes();
	const terdata = hexes.filter((h) => !h.nodata);

	// Profil 24 jam se-kawasan: jumlah struk tiap jam, dijumlahkan dari petak yang
	// sudah ada datanya. Bentuknya nyata untuk dataset ini — bukan kurva hiasan.
	const jam = Array.from({ length: 24 }, (_, h) =>
		terdata.reduce((a, r) => a + (r.jam?.[h] ?? 0), 0)
	);

	const percakapan = SCRIPTS.map((s) => {
		const ans = runQuery(s.query, s.pilih, hexes, W);
		return {
			id: s.id,
			kategori: s.kategori,
			pilih: s.pilih,
			chip: s.chip,
			tanya: s.tanya,
			jawab: s.jawab,
			preface: s.preface,
			tangkap: describeQuery(ans.query),
			kalimat: narrate(ans),
			// Tiga teratas saja: halaman depan menjanjikan bacaan, bukan tabel.
			hasil: ans.items.slice(0, 3).map((i) => ({
				name: i.name,
				value: i.value,
				why: i.why
			})),
			sisa: Math.max(0, ans.items.length - 3)
		};
	});

	return {
		kisi: {
			hexes: grid.hexes,
			nodata: grid.nodata,
			terdata: grid.hexes - grid.nodata,
			resolution: grid.resolution,
			walkRadius: grid.walkRadius,
			stops: grid.stops,
			stopsByMode: grid.stopsByMode,
			pois: grid.pois,
			poisByCategory: grid.poisByCategory,
			kategori: CATEGORIES.length,
			titikMisi: terdata.reduce((a, r) => a + r.nStruk + r.nMenu + r.nProp, 0)
		},
		// Satu karakter per petak, urut sesuai kisi: 1 = belum terdata. Dikirim
		// sebagai teks supaya 558 nilai boolean tidak jadi 558 baris JSON.
		cakupan: hexes.map((h) => (h.nodata ? '1' : '0')).join(''),
		jam,
		percakapan
	};
};
