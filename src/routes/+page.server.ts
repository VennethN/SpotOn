import { CATEGORIES } from '$lib/domain/categories';
import { describeQuery, narrate } from '$lib/domain/narrate';
import { runQuery } from '$lib/domain/nlq';
import { DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { DICT, LANGS, type Copy, type Lang } from '$lib/i18n';
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

/**
 * Sepasang pertanyaan yang sudah ditentukan — jawabannya tetap dihitung mesin.
 *
 * Teksnya tidak disimpan di sini melainkan diambil dari kamus per bahasa, jadi
 * satu skrip menghasilkan percakapan Indonesia dan Inggris dari hitungan yang
 * sama persis. Keduanya dihitung saat build dan dikirim bersama; halaman ini
 * statis, jadi tidak ada permintaan kedua saat pembaca mengganti bahasa.
 */
interface Script {
	id: string;
	kategori: CategoryKey;
	/** Mengambil teks percakapan dari kamus bahasa yang diminta. */
	lines: (c: Copy) => { pilih: string; chip: string; tanya: string; jawab: string; preface: string };
	query: StructuredQuery;
}

const W = DEFAULT_WEIGHTS;

export interface DemoSet {
	id: string;
	kategori: CategoryKey;
	pilih: string;
	chip: string;
	tanya: string;
	jawab: string;
	preface: string;
	tangkap: string[];
	kalimat: string;
	hasil: Array<{ name: string; value: number | null }>;
	sisa: number;
}

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
	return {
		id: kategori,
		kategori,
		lines: (c) => ({
			pilih: c.category[kategori].name,
			chip: c.category[kategori].short,
			tanya: c.tapak.budgetAsk(c.category[kategori].name.toLowerCase()),
			jawab: modalKecil ? c.tapak.budgetTight : c.tapak.budgetLoose,
			preface: modalKecil ? c.tapak.prefaceTight : c.tapak.prefaceLoose
		}),
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
		lines: (c) => ({
			pilih: c.category.minimarket.name,
			chip: c.demo.saturatedChip,
			tanya: c.demo.saturatedAsk,
			jawab: c.demo.saturatedYes,
			preface: c.demo.saturatedPreface
		}),
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
		lines: (c) => ({
			pilih: c.demo.coverageAsk,
			chip: c.demo.coverageChip,
			tanya: c.demo.coverageReply,
			jawab: c.demo.coverageYes,
			preface: c.demo.coveragePreface
		}),
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

	// Satu hitungan per skrip, dua naskah. Angkanya identik lintas bahasa karena
	// memang berasal dari `runQuery` yang sama.
	const percakapan = Object.fromEntries(
		LANGS.map((l) => [
			l,
			SCRIPTS.map((s) => {
				const c = DICT[l];
				const lines = s.lines(c);
				const ans = runQuery(s.query, lines.pilih, hexes, W);
				return {
					id: s.id,
					kategori: s.kategori,
					...lines,
					tangkap: describeQuery(ans.query, c),
					kalimat: narrate(ans, c),
					// Tiga teratas saja: halaman depan menjanjikan bacaan, bukan tabel.
					hasil: ans.items.slice(0, 3).map((i) => ({ name: i.name, value: i.value })),
					sisa: Math.max(0, ans.items.length - 3)
				};
			})
		])
	) as Record<Lang, DemoSet[]>;

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
