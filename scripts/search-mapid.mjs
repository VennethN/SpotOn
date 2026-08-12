/**
 * Menelusuri katalog MAPID untuk menemukan dataset yang masih perlu diimpor.
 *
 *   node scripts/search-mapid.mjs              # lima kategori SpotOn
 *   node scripts/search-mapid.mjs LAUNDRY ATM  # istilah bebas
 *
 * Keluarannya daftar periksa Markdown: nama dataset persis seperti di katalog,
 * beserta tautan langsung ke halamannya. Impor tetap dilakukan lewat antarmuka
 * GEO MAPID — yang dihapus skrip ini adalah pekerjaan menebak-nebak nama.
 *
 * ENDPOINT YANG DIPAKAI, DAN KENAPA YANG SEBELUMNYA GAGAL
 *
 *   GET geoserver.mapid.io/layers_new/search_layers_public/<istilah>?skip=<n>&api_key=
 *
 * Sempat disimpulkan bahwa katalog tidak bisa ditelusuri dari skrip karena
 * endpoint daftarnya selalu mengembalikan 20 baris yang sama apa pun parameter
 * yang dikirim. Yang sebenarnya terjadi: nama parameternya bukan `search`,
 * `q`, atau `keyword` — melainkan `search_params`, dan halamannya digeser
 * dengan `skip`, bukan `page`. Parameter yang tidak dikenal diabaikan diam-diam,
 * jadi setiap tebakan terlihat seperti "pencarian tidak didukung" padahal yang
 * kembali adalah halaman pertama tanpa filter. Nama yang benar diambil dari
 * kode sumber antarmuka GEO MAPID sendiri.
 *
 * Pencarian mengembalikan SELURUH layer publik, bukan hanya katalog premium —
 * termasuk proyek tugas kuliah orang lain yang namanya kebetulan mirip. Karena
 * itu hasilnya disaring ke layer milik akun MAPID Database; tanpa saringan itu
 * daftar ini akan memuat data yang tidak jelas asal-usulnya.
 *
 * BATAS YANG PENTING: INDEKS INI BUKAN KATALOG PREMIUM
 *
 * `search_layers_public` hanya mengindeks layer yang dipublikasikan. Katalog
 * premium tidak ada di dalamnya. RESTORAN dan MINIMARKET ketemu semata-mata
 * karena MAPID Database kebetulan menerbitkan keduanya secara publik; COFFEE
 * SHOP yang muncul justru salinan "IMPORT" milik pengguna lain, bukan aslinya.
 *
 * Maka kategori yang kosong di sini TIDAK boleh dibaca sebagai "tidak ada di
 * katalog" — yang benar "tidak terlihat dari jalur ini, periksa manual di
 * antarmuka". Prinsipnya sama dengan yang dipegang seluruh proyek ini: tidak
 * adanya data bukan bukti tidak adanya barang. Perkakasnya pun harus tunduk
 * pada aturan itu, bukan cuma peta akhirnya.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapidKey } from './lib/mapid-key.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEOSERVER = 'https://geoserver.mapid.io';
const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; kontak lewat repo)';

/** Pemilik resmi katalog premium. */
const PUBLISHER = /mapid\.database|MAPID Database/i;

/** Lima kota administrasi DKI. Katalog memberi satu dataset per kota. */
const KOTA = ['JAKARTA PUSAT', 'JAKARTA BARAT', 'JAKARTA SELATAN', 'JAKARTA TIMUR', 'JAKARTA UTARA'];

/**
 * Dua halaman per pencarian sudah cukup karena tiap kueri dipersempit ke satu
 * kota; kecocokan persis selalu muncul di peringkat teratas.
 */
const MAX_PAGES = 2;

/**
 * Istilah pencarian per kategori SpotOn, beserta kata kunci yang WAJIB ada di
 * nama dataset.
 *
 * Saringan `must` bukan hiasan. Pencarian mencocokkan kata secara longgar dan
 * memberi peringkat, bukan menyaring: kueri "APOTEK JAKARTA BARAT" dengan
 * senang hati mengembalikan "BATAS ADMINISTRASI KOTA ADMINISTRASI JAKARTA
 * BARAT" karena tiga dari empat katanya cocok. Tanpa `must`, daftar impor akan
 * penuh dataset yang sama sekali bukan yang dicari.
 */
const TERMS = {
	kopi: { must: /COFFEE|KOPI/i, base: ['COFFEE SHOP'] },
	warung: { must: /RESTORAN|MAKANAN DAN MINUMAN/i, base: ['RESTORAN', 'MAKANAN DAN MINUMAN'] },
	minimarket: { must: /MINIMARKET|ALFAMART|INDOMARET|MART/i, base: ['MINIMARKET'] },
	apotek: { must: /APOTEK|APOTIK/i, base: ['APOTEK'] },
	laundry: { must: /LAUNDRY|BINATU/i, base: ['LAUNDRY'] }
};

async function get(url, label) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': UA } });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			if (attempt === 3) throw new Error(`${label}: ${err.message}`);
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
		}
	}
}

/** Semua hasil untuk satu istilah, halaman demi halaman sampai habis. */
async function searchAll(term, key) {
	const out = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const rows = await get(
			`${GEOSERVER}/layers_new/search_layers_public/${encodeURIComponent(term)}?skip=${page * 20}&api_key=${key}`,
			`cari "${term}"`
		);
		if (!Array.isArray(rows) || rows.length === 0) break;
		out.push(...rows);
		if (rows.length < 20) break;
	}
	return out;
}

async function main() {
	const key = mapidKey();
	const argv = process.argv.slice(2);
	const groups = argv.length
		? { '(istilah bebas)': { must: new RegExp(argv.join('|'), 'i'), base: argv } }
		: TERMS;

	const seen = new Set();
	const found = {};
	let scanned = 0;

	for (const [cat, { must, base }] of Object.entries(groups)) {
		found[cat] = [];
		for (const b of base) {
			for (const kota of KOTA) {
				const term = `${b} ${kota}`;
				const rows = await searchAll(term, key);
				scanned += rows.length;
				let kept = 0;
				for (const r of rows) {
					const name = r.name ?? '';
					const owner = `${r.user?.name ?? ''} ${r.user?.full_name ?? ''}`;
					if (!PUBLISHER.test(owner)) continue;
					if (!must.test(name)) continue;
					// Nama harus menyebut kota yang dicari — pencarian longgar
					// gemar mengembalikan kota tetangga di peringkat bawah.
					if (!new RegExp(kota, 'i').test(name)) continue;
					if (seen.has(r._id)) continue;
					seen.add(r._id);
					found[cat].push({ id: r._id, name });
					kept++;
				}
				console.error(`  ${term.padEnd(34)} ${String(rows.length).padStart(3)} hasil → ${kept} baru`);
			}
		}
		found[cat].sort((a, b) => a.name.localeCompare(b.name));
	}

	console.error(`\n${scanned} baris ditelusuri · ${seen.size} dataset MAPID Database di DKI Jakarta\n`);

	const lines = [
		'<!-- Dihasilkan `node scripts/search-mapid.mjs` — jangan disunting tangan. -->',
		'',
		'Buka tautannya, tekan **Impor**, lalu jalankan `node scripts/fetch-mapid.mjs && node scripts/join-mapid.mjs`.',
		'',
		'Daftar ini berasal dari indeks layer **publik**, yang tidak memuat katalog premium.',
		'Kategori kosong berarti _tidak terlihat dari jalur ini_ — bukan tidak ada. Periksa manual di GEO MAPID.',
		''
	];
	for (const [cat, list] of Object.entries(found)) {
		lines.push(`**${cat}** — ${list.length} dataset`);
		lines.push('');
		if (!list.length) {
			lines.push('- _tidak terlihat lewat pencarian publik; perlu dicek manual di antarmuka_');
		} else {
			for (const l of list) {
				lines.push(`- [ ] \`${l.name}\` — [buka](https://geo.mapid.io/layer/${l.id})`);
			}
		}
		lines.push('');
	}
	const md = lines.join('\n');

	writeFileSync(resolve(ROOT, 'docs/mapid-import-checklist.md'), md);
	console.log(md);
	console.error('→ docs/mapid-import-checklist.md');
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
