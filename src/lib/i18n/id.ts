/**
 * The Indonesian copy — the source of shape for every dictionary.
 *
 * Its voice: someone who knows the area, explaining it plainly. Short sentences.
 * Everyday words. No pile-ups of dashes, no sentence closed with a proverb, and no
 * selling adjectives. If a sentence sounds like a brochure, rewrite it until it
 * sounds like a person answering a question.
 *
 * What must never be lost: a figure always says where it came from, and what is
 * not known is called not known.
 */

import { moneyScale, num } from '$lib/utils/format';

/** Indonesian decimals: 0.45 → "0,45". Kept in the locale, where notation belongs —
    the components hand over numbers, never pre-formatted strings. */
const dec = (v: number, digits = 2): string => v.toFixed(digits).replace('.', ',');

/**
 * Rupiah, written short: 45000000 → "Rp 45 jt", 4300000000 → "Rp 4,3 M".
 *
 * The WORDS are here because "jt" and "million" are not the same string. WHERE the
 * scale breaks is not: that comes from `moneyScale`, so the two languages cannot end
 * up writing the same price as "Rp 950 jt" on one side and "Rp 1,0 billion" on the
 * other.
 *
 * A whole number keeps no decimal — "Rp 45 jt" reads as a price, "Rp 45,0 jt" reads as
 * a measurement. The rounding happens BEFORE that test, not after: Rp 6,95 miliar and
 * Rp 7 miliar are both "Rp 7 M", where testing first would set them in a column as
 * "Rp 7,0 M" above "Rp 7 M" and make one of them look more precisely known than the
 * other. They are asking prices, and neither is.
 */
const SCALE_ID = { unit: '', thousand: 'rb', million: 'jt', billion: 'M' } as const;
const rp = (v: number): string => {
	const { value, scale } = moneyScale(v);
	const r = Math.round(value * 10) / 10;
	const n = Number.isInteger(r) ? r.toLocaleString('id-ID') : dec(r, 1);
	return `Rp ${n}${SCALE_ID[scale] ? ` ${SCALE_ID[scale]}` : ''}`;
};

export const id = {
	lang: { code: 'id', label: 'Bahasa Indonesia', short: 'ID', switchTo: 'Ganti ke Bahasa Inggris' },

	brand: {
		name: 'SpotOn',
		tagline: 'Jangan tebak lokasi usaha. Tanya petanya.',
		appTagline: 'Cari lokasi usaha di kawasan transit Jakarta',
		open: 'Buka SpotOn'
	},

	/* `many` is used when the name is preceded by a number. Indonesian does not
	   inflect the noun; English does, and without this field it would read
	   "3 coffee shop". */
	category: {
		kopi: { name: 'Kedai Kopi', short: 'Kopi', many: 'kedai kopi' },
		minuman: { name: 'Kedai Minuman', short: 'Minuman', many: 'kedai minuman' },
		roti: { name: 'Toko Roti & Kue', short: 'Roti', many: 'toko roti' },
		warteg: { name: 'Warung & Rumah Makan', short: 'Warteg', many: 'warung makan' },
		cepatsaji: { name: 'Gerai Cepat Saji', short: 'Cepat Saji', many: 'gerai cepat saji' },
		mie: { name: 'Mie & Bakso', short: 'Mie', many: 'kedai mie' },
		seafood: { name: 'Rumah Makan Seafood', short: 'Seafood', many: 'rumah makan seafood' },
		restoasing: { name: 'Restoran Masakan Asing', short: 'Resto Asing', many: 'restoran asing' },
		minimarket: { name: 'Minimarket', short: 'Minimarket', many: 'minimarket' },
		kelontong: { name: 'Toko Kelontong', short: 'Kelontong', many: 'toko kelontong' },
		laundry: { name: 'Laundry', short: 'Laundry', many: 'laundry' },
		bengkel: { name: 'Bengkel Kendaraan', short: 'Bengkel', many: 'bengkel' },
		apotek: { name: 'Apotek', short: 'Apotek', many: 'apotek' }
	},

	nav: {
		sections: [
			{ href: '#masalah', label: 'Masalah' },
			{ href: '#cara-kerja', label: 'Cara kerja' },
			{ href: '#ai', label: 'AI' },
			{ href: '#data', label: 'Data' }
		],
		aria: 'Bagian halaman'
	},

	theme: { system: 'Ikut sistem', light: 'Terang', dark: 'Gelap' },

	stage: {
		/**
		 * Judulnya menyebut produknya, bukan perumpamaan.
		 *
		 * Yang dulu di sini "Lihat jalannya dulu. Baru tanda tangan." — kiasan yang
		 * baru masuk akal kalau pembacanya SUDAH tahu ini soal menyewa tempat usaha,
		 * padahal itulah yang belum ia ketahui saat baris ini dibaca. Isinya pun cuma
		 * menerangkan maketnya, jadi orang yang baru sampai di sini selesai membaca
		 * satu layar penuh tanpa tahu SpotOn ini apa.
		 *
		 * Sekarang: satu kalimat yang menyatakan pekerjaannya, lalu isi yang
		 * menyambungkan adegan di belakangnya ke pekerjaan itu.
		 */
		heroTitle: 'Jangan tebak lokasi usaha.\nTanya petanya.',
		heroBody:
			'SpotOn membaca keramaian, jumlah pesaing, dan tempat yang bisa disewa di tiap kawasan transit Jakarta, lalu menjawab di mana sebaiknya Anda buka usaha dan kenapa. Angka di halaman ini masih contoh.',
		heroHint: 'gulir untuk melihat satu hari penuh',
		dayTitle: 'Ramainya berubah tiap jam.',
		dayBody:
			'Trotoar yang sepi jam 10 pagi bisa penuh jam 7 malam. Sewanya dibayar untuk 24 jam, jadi jam berapa ramainya ikut menentukan usaha apa yang cocok di situ.',
		lotTitle: 'Petak bergaris putih itu masih kosong.',
		lotBody:
			'Kotak tembus pandang di atasnya bukan bangunan yang sudah ada. Itu usaha yang bisa Anda buka di situ. Permintaan sebesar apa pun tidak ada gunanya kalau tempatnya tidak bisa disewa, jadi ketersediaan tempat kami pakai sebagai syarat, bukan nilai tambah.',
		lotProv: 'Struk Go, Menu Go, Properti Go: contoh · Stasiun & pesaing: OSM',
		sample: 'data contoh',
		reading: (struk: string, persen: number) => `${struk} struk · ${persen}% dari jam puncak`,
		noReading: 'belum ada transaksi jam segini',
		sceneLabel: (nama: string, jam: string, struk: string) =>
			`Blok jalan di sekitar stasiun ${nama} pada pukul ${jam}. Kepadatan pejalan kaki mengikuti data transaksi 24 jam petak ini: ${struk} struk pada jam tersebut.`
	},

	phase: {
		night: 'malam',
		dawn: 'subuh',
		morning: 'pagi',
		midday: 'siang',
		afternoon: 'sore',
		dusk: 'senja'
	},

	stats: {
		hexes: { label: 'petak kawasan dinilai', sub: (r: number) => `heksagon H3, jalan kaki ${r} m` },
		stops: { label: 'titik transit terdata', sub: 'MRT, KRL, LRT, TransJakarta' },
		pois: { label: 'gerai pesaing terdata', sub: 'OpenStreetMap (ODbL)' },
		cats: {
			label: 'jenis usaha dinilai',
			sub: 'kopi, minuman, roti, warteg, cepat saji, mie, seafood, resto asing, minimarket, kelontong, laundry, bengkel, apotek'
		},
		coverNote: (terdata: string, total: string, nodata: string) =>
			`${terdata} dari ${total} petak sudah ada datanya. Sisanya ${nodata} kami tandai belum terdata: tidak kami tebak, tidak kami beri nilai.`
	},

	problem: {
		mark: 'Masalah',
		title: 'Ada tiga hal yang menentukan lokasi usaha jalan atau tidak. Selama ini ketiganya tidak pernah dilihat bersamaan.',
		rows: [
			{
				t: 'Tidak ada yang tahu permintaannya',
				d: 'Belanja warga di sekitar stasiun terekam di jutaan struk, tapi tidak pernah dikumpulkan per lokasi. Jadi tidak ada yang tahu kawasan mana yang sebenarnya masih kekurangan satu jenis usaha.'
			},
			{
				t: 'Pesaingnya tidak terpetakan',
				d: 'Buka kedai kopi di tempat yang kedai kopinya sudah berjubel itu resep bangkrut. Tapi tidak ada peta yang menunjukkan di mana usaha sejenis menumpuk, dan seramai apa mereka.'
			},
			{
				t: 'Tempatnya tidak ikut dihitung',
				d: 'Peluang baru berarti kalau ada tempatnya. Tapi ruko, kios, dan tempat yang disewakan tidak pernah dihubungkan dengan ramai sepinya pembeli atau jumlah pesaing di sekitarnya.'
			}
		],
		statement:
			'Sekitar stasiun itu tempat dagang paling ramai di Jakarta. Tapi orang masih memilih lokasi pakai firasat, dan kalau salah, modalnya yang hangus.',
		chartTitle: 'Sewa dibayar untuk 24 jam. Ramainya tidak 24 jam.',
		chartBody:
			'Trotoar yang sepi jam 10 pagi bisa penuh jam 7 malam. Grafik inilah yang menggerakkan maket di atas, dan yang dibaca peta di dalam aplikasi.'
	},

	how: {
		mark: 'Cara kerja',
		title: 'Dari data mentah jadi satu angka yang bisa dipertanggungjawabkan.',
		steps: [
			{
				t: 'Petak sejauh jalan kaki',
				d: (radius: number, hexes: string) =>
					`Jakarta kami tutup dengan kisi heksagon. Yang dinilai cuma petak yang punya titik transit dalam ${radius} m jalan kaki, jumlahnya ${hexes}. Kisi dipakai supaya kawasan yang bertumpuk tidak menghitung pembeli yang sama dua kali.`
			},
			{
				t: 'Tiga data digabung',
				d: 'Data belanja, data pesaing, dan data tempat yang disewakan dicocokkan ke petaknya masing-masing. Hasilnya tiga angka per petak: berapa banyak yang belanja, seramai apa pesaingnya, dan ada tidaknya tempat kosong.'
			},
			{
				t: 'Skor peluang per jenis usaha',
				d: 'Selisih antara yang belanja dan yang sudah dilayani dihitung untuk tiap jenis usaha. Pesaing yang ramai dihitung lebih berat, lalu hasilnya disyaratkan punya tempat yang bisa disewa.'
			},
			{
				t: 'Urutan, lengkap dengan alasannya',
				d: 'Petak diurutkan per jenis usaha dan diberi keterangan: masih kurang dilayani, sudah bersaing ketat, sudah terlalu penuh, atau ramai tapi tempatnya susah dicari.'
			}
		],
		plain:
			'Peluang = berapa banyak uang yang dibelanjakan di sana, dikurangi seramai apa pesaing sejenisnya. Lalu satu syarat: harus ada tempat yang benar-benar bisa disewa.',
		note:
			'Pesaing tidak cuma dihitung jumlahnya. Kedai sebelah yang selalu penuh menekan peluang Anda jauh lebih keras daripada kedai yang sepi, jadi keduanya tidak dihitung sama. Dan sebagus apa pun angkanya, kalau tidak ada tempat yang bisa disewa, peluang itu tidak bisa dijalankan. Karena itu ketersediaan tempat jadi syarat, bukan bonus. Bobot permintaan dan persaingannya bisa Anda geser sendiri.',
		scaleCap: 'Hasilnya satu skala, dan itu juga legenda petanya',
		formulaSummary: 'Rumus persisnya'
	},

	signal: {
		demand: {
			nm: 'Permintaan',
			src: 'Struk Go',
			d: 'Berapa banyak uang yang dibelanjakan orang di sana.'
		},
		supply: {
			nm: 'Pesaing',
			src: 'Menu Go',
			d: 'Bukan cuma jumlahnya. Yang selalu penuh menekan lebih keras.'
		},
		gate: {
			nm: 'Tempat usaha',
			src: 'Properti Go',
			ok: 'ada yang disewakan → peluang berlaku',
			no: 'tidak ada → peluang nyaris nol',
			d: 'Syarat, bukan bonus. Peluang yang tidak bisa ditempati bukan peluang.'
		}
	},

	grid: {
		mark: 'skema, bukan kawasan tertentu',
		caption: {
			lead: 'Satu heksagon, satu petak.',
			strong: 'Tinggi dan warnanya sama-sama skor peluang',
			rest: ', pada skala yang sama persis dengan peta di dalam aplikasi. Yang cekung dan tidak berwarna belum ada datanya. Lingkaran putus-putus itu jangkauan jalan kaki yang dipakai waktu kisinya dibangun.'
		},
		outOfScale: 'belum terdata, di luar skala',
		label:
			'Maket kisi heksagon. Tiap petak satu heksagon, dan tinggi serta warnanya mewakili skor peluang pada skala yang sama dengan peta. Petak yang belum terdata dibiarkan cekung tanpa warna. Lingkaran putus-putus menandai jangkauan berjalan kaki dari petak yang sedang dibidik.'
	},

	ai: {
		mark: 'Tanya petanya',
		title: 'Tanya petanya pakai bahasa sehari-hari.',
		p1: 'Tidak ada rumus yang harus diisi dan tidak ada istilah yang harus dihafal. Tapak yang mulai duluan: dia bertanya, menyodorkan pilihan yang tinggal ditekan, lalu menjawab dengan daftar tempat beserta alasannya.',
		p2: 'Sebelum menjawab, peta menunjukkan apa yang dia tangkap dari pertanyaan Anda. Kalau ada yang salah tangkap, Anda langsung tahu. Jawabannya selalu menyebut alasan dan berapa banyak data yang jadi dasarnya.',
		p3: 'Percakapan di sebelah jalan sendiri. Pertanyaannya memang sudah kami siapkan, tapi angkanya tidak: tiap nama dan nilai di situ dihitung mesin skor yang sama dengan yang dipakai peta. Tekan jenis usaha untuk pindah ke percakapan lain.',
		caught: 'Yang ditangkap peta',
		thinking: 'Sebentar, saya cek catatan saya…',
		more: (n: number) => `+${n} lagi di dalam aplikasi`,
		play: 'Jalankan percakapan',
		pause: 'Jeda percakapan',
		foot: 'Pertanyaannya contoh, tapi jawabannya dihitung mesin skor yang sama dengan aplikasinya.',
		footMock: 'atribut misi masih data contoh.'
	},

	data: {
		mark: 'Data',
		title: 'Kawasan yang datanya belum ada kami tampilkan apa adanya.',
		body: 'Kalau di satu kawasan datanya belum ada, kami tidak mengarang angka penggantinya. Kawasannya ditandai kosong dan masuk antrean untuk disurvei duluan. Setiap angka juga menyebut berapa banyak data di baliknya, biar Anda bisa menilai sendiri seberapa kuat dasarnya.',
		gridWithData: 'petak sudah ada datanya',
		gridEmpty: 'belum terdata, tidak dinilai, masuk antrean survei',
		gridLabel: (total: number, terdata: number, nodata: number) =>
			`Kisi ${total} petak: ${terdata} sudah ada datanya, ${nodata} belum.`,
		realTitle: 'Yang nyata',
		realUnit: (stops: string) =>
			`${stops} titik transit empat moda, lengkap dengan geometri jalurnya, dari OpenStreetMap lewat Overpass API (ODbL). Akses transit tiap petak dihitung dari sini.`,
		poiTitle: 'Pesaing terdata, per jenis usaha',
		poiUnit: (pois: string) =>
			`${pois} titik usaha sejenis, juga dari OpenStreetMap. Inilah angka pesaing yang dipakai mesin skor, bukan perkiraan.`,
		mockTitle: 'Yang masih contoh',
		mockNote:
			'Atribut khas dataset misi MAPID (Struk Go, Menu Go, Properti Go, termasuk profil 24 jam dan jumlah tempat yang disewakan) masih berupa contoh, karena datanya baru dibuka untuk 50 tim terkurasi. Strukturnya sudah mengikuti kolom aslinya, dan semua akses data lewat satu modul, jadi penggantian ke API MAPID tidak menyentuh kode antarmuka. Sampai itu terjadi, penanda MOCK ikut ke mana pun angkanya muncul.'
	},

	hourChart: {
		caption: 'Transaksi per jam, seluruh kawasan yang sudah terdata.',
		table: 'Angka per jamnya',
		colHour: 'Jam',
		colValue: 'Struk',
		tableCaption: 'Jumlah struk per jam',
		peak: 'puncak',
		unit: 'struk',
		unitApp: 'transaksi',
		label: (total: string, jam: string, puncak: string, unit: string) =>
			`Profil 24 jam: total ${total} ${unit}, paling ramai pukul ${jam} dengan ${puncak} ${unit}.`,
		bar: (jam: string, nilai: string, unit: string) => `Pukul ${jam}: ${nilai} ${unit}`
	},

	scale: { low: '0 · kecil', high: '100 · besar', nodata: 'belum terdata, tidak diberi nilai' },

	audience: {
		mark: 'Untuk siapa',
		title: 'Satu peta, tiga belas jenis keputusan.',
		rows: [
			{ t: 'Pemodal ritel & kuliner', d: 'Memilih lokasi cabang baru dari data, bukan dari firasat.' },
			{ t: 'UMKM bermodal pas-pasan', d: 'Cari lokasi bagus yang sewanya masih masuk akal.' },
			{
				t: 'Calon wirausaha rumahan',
				d: '“Usaha apa yang masuk akal di sekitar sini?” dijawab lengkap dengan alasannya.'
			},
			{ t: 'Tim pembukaan cabang', d: 'Menyaring dan mengurutkan calon lokasi di sepanjang jalur transit.' },
			{ t: 'Pemilik & agen properti', d: 'Tahu tempatnya cocok untuk usaha apa, dan siapa penyewa yang pas.' }
		]
	},

	closing: {
		title: 'Peta yang menjawab, bukan cuma menampilkan.',
		cta: 'Buka SpotOn',
		ghost: 'Lihat cara kerjanya'
	},

	footer: {
		desc: 'WebGIS pencarian lokasi usaha berbasis AI untuk ritel dan F&B di kawasan transit Jakarta.',
		teamLabel: 'Tim Triple T',
		team: 'Valent Nathanael · Farhan Aulianda · Anthony Gilles Rudolfo',
		campus: 'Universitas Bina Nusantara',
		dataLabel: 'Data',
		dataNote:
			'Geometri dan POI © OpenStreetMap contributors (ODbL). Atribut misi MAPID masih contoh. Basemap wajib pada produk final: MAPID MAPS.'
	},

	meta: {
		title: 'SpotOn · Jangan tebak lokasi usaha. Tanya petanya.',
		description:
			'SpotOn menggabungkan permintaan, persaingan, dan ketersediaan tempat usaha di setiap kawasan berjalan kaki di sekitar transit Jakarta, lalu menunjukkan di mana sebaiknya buka usaha dan kenapa.',
		appTitle: 'SpotOn · Peta cari lokasi usaha kawasan transit Jakarta'
	},

	typology: {
		underserved: 'Masih kurang dilayani',
		competitive: 'Bersaing ketat',
		saturated: 'Sudah jenuh',
		'busy-limited-space': 'Ramai, tempat terbatas',
		'no-data': 'Belum terdata',
		'not-covered': 'Belum tercakup'
	},

	supply: {
		denseBusy: 'jumlahnya padat dan kebanyakan ramai, jadi celahnya sempit',
		denseQuiet: 'jumlahnya padat tapi kebanyakan sepi, tandanya sudah jenuh',
		fewBusy: 'jumlahnya sedikit tapi kebanyakan ramai, permintaannya tampak tertahan',
		fewQuiet: 'jumlahnya sedikit dan kebanyakan sepi'
	},

	detail: {
		empty: 'Pilih satu petak di peta atau di tabel untuk melihat permintaan, persaingan, dan tempat usaha yang tersedia.',
		catchment: (r: number) => `jangkauan ${r} m`,
		nodata: (osm: number, cat: string, r: number) =>
			`Data misi MAPID belum ada di petak ini (N = 0). Tidak ada titik Struk Go, Menu Go, maupun Properti Go di dalamnya, jadi skornya tidak kami isi. Kawasan ini masuk daftar prioritas survei. Tidak ada data bukan berarti tidak ada usaha: OSM mencatat ${osm} ${cat} dalam radius ${r} m.`,
		score: (cat: string) => `Skor ${cat}`,
		demand: 'Permintaan',
		nStruk: (n: number) => `N struk = ${n}`,
		rivals: 'Pesaing',
		supplyEff: 'Penawaran efektif',
		busyPct: (p: string) => `${p}% ramai`,
		space: 'Tempat usaha',
		listingOf: (n: number) => `listing dari ${n}`,
		cashless: 'Non-tunai',
		cashlessSub: 'perkiraan daya beli',
		hourTitle: (n: number) => `Transaksi per jam · Struk Go · N = ${n}`,
		acrossTitle: 'Peluang per jenis usaha, dengan bobot saat ini',
		summaryLead: 'Ringkasan.',
		summary: (jam: string, cat: string, osm: number, r: number, frasa: string, listing: number, kat: string) =>
			`Petak ini paling ramai pukul ${jam}. Untuk ${cat}, OSM mencatat ${osm} pesaing dalam radius ${r} m, dan ${frasa}. Tersedia ${listing} listing berkategori ${kat}.`,
		summaryNote:
			'Angka pesaing dari OSM (nyata), sedangkan atribut misi MAPID masih contoh. N ditampilkan supaya bisa diperiksa.'
	},

	/* ── Susunan skor ──────────────────────────────────────────────────────
	   Panel ini yang menjawab "kenapa segini?". Urutannya sengaja: yang dipimpin
	   adalah simpul transit — satu-satunya masukan yang datanya nyata, dan memang
	   itu inti proyek ini — baru sesudahnya rinciannya langkah per langkah. */
	breakdown: {
		title: 'Susunan skor',
		lead: 'Skor di atas dibentuk berurutan. Tiap langkah bisa ditelusuri sampai ke datanya.',
		/* Petak yang belum tercakup sumber pesaingnya tidak punya skor untuk dibongkar.
		   Yang di bawahnya tetap berlaku: simpul transit datanya dari OSM, nyata, dan
		   tidak ikut hilang cuma karena kategorinya belum disurvei. */
		noScore:
			'Petak ini belum bisa diberi skor untuk jenis usaha yang sedang dipilih, jadi tidak ada langkah yang bisa ditampilkan. Akses transitnya tetap nyata dan tercatat.',
		transitLead: 'Yang paling menentukan: angkutan massal',
		/* Bahasa Indonesia tidak mengubah bentuk kata bendanya; parameternya ada untuk
		   bahasa yang mengubah, supaya bentuk kuncinya sama di kedua berkas. */
		stopsUnit: (_n: number) => 'simpul transit terjangkau',
		stopsSub: (r: number) => `dalam ${r} m jalan kaki dari pusat petak · OSM, data nyata`,
		stopsSplit: (rel: number, halte: number) => {
			if (rel > 0 && halte > 0) return `${rel} stasiun rel · ${halte} halte TransJakarta`;
			if (rel > 0) return `${rel} stasiun rel`;
			return `${halte} halte TransJakarta`;
		},
		none: 'Petak ini tidak menangkap simpul transit mana pun dalam jarak jalan kaki.',
		contributes: (poin: number, total: number) =>
			`Dari ${total} poin skor petak ini, ${poin} datang dari akses transitnya.`,
		without: (poin: number) => `Tanpa transit sama sekali, petak ini cuma ${poin}.`,
		ceiling: (poin: number) =>
			`Di petak ini akses transit paling banyak bisa menyumbang ${poin} poin. Sisanya sudah ditentukan permintaan dan persaingan.`,
		splitBase: 'permintaan − persaingan',
		splitTransit: 'akses transit',
		splitAria: (dasar: number, transit: number, total: number) =>
			`Skor ${total} poin: ${dasar} dari permintaan dan persaingan, ${transit} dari akses transit.`,

		stepsTitle: 'Langkah per langkah',
		rows: {
			start: 'Titik seimbang',
			demand: 'Permintaan',
			supply: 'Persaingan',
			clamp: 'Dijaga di rentang',
			gate: 'Gerbang tempat usaha',
			access: 'Akses transit',
			cost: 'Harga tempat'
		},
		notes: {
			start: 'sebelum data dibaca, tiap petak mulai dari sini',
			demand: (bobot: number, nilai: number) => `bobot ${dec(bobot)} × permintaan ${nilai}`,
			supply: (bobot: number, nilai: number) => `bobot ${dec(bobot)} × penawaran efektif ${nilai}`,
			clamp: 'hasilnya tidak boleh keluar dari 0–100',
			gateOff: 'syaratnya sedang dimatikan',
			gatePass: (n: number) => `${n} tempat disewakan, syarat terpenuhi`,
			gateBlock: (f: number) => `tidak ada tempat yang disewakan → ×${dec(f)}`,
			access: (pengali: number, akses: number) =>
				`×${dec(pengali)} = 0,60 + 0,40 × indeks akses ${dec(akses)}`,
			/* Langkah harga selalu ditampilkan, termasuk waktu tidak memotong apa-apa.
			   Empat sebab diamnya dibedakan, karena "belum disurvei", "tidak ada yang
			   dijual", "ada tapi harganya tidak dipasang", dan "termurah sekisi" itu
			   empat kalimat yang berbeda, dan cuma yang pertama berarti belum dilihat. */
			cost: (pengali: number, peringkat: number) =>
				`×${dec(pengali)} · lebih mahal dari ${peringkat}% petak lain`,
			costCheapest: (pengali: number) => `×${dec(pengali)} · termurah sekisi, tidak dipotong`,
			costUncovered: 'katalog properti kota ini belum dibaca, jadi tidak dipotong',
			costEmpty: 'tidak ada unit komersial dijual dalam radius ini, jadi tidak dipotong',
			costUnpriced: (n: number) =>
				`${n} unit dijual di sekitarnya tapi harganya tidak dipasang, jadi tidak dipotong`,
			costThin: (n: number) =>
				`baru ${n} unit di sekitarnya yang berharga, belum cukup untuk diambil mediannya`,
			costUngraded: 'harga sekisi belum cukup banyak untuk dibandingkan, jadi tidak dipotong'
		},
		total: 'Skor peluang',
		deltaAria: (poin: number) => (poin >= 0 ? `naik ${poin} poin` : `turun ${Math.abs(poin)} poin`),

		accessTitle: 'Isi indeks aksesnya',
		accessRow: (n: number, bobot: number) => `${n} simpul × bobot ${dec(bobot)}`,
		accessShare: (persen: number) => `${persen}% dari indeks`,
		accessIndex: (akses: number, pengali: number) =>
			`Indeks akses ${dec(akses)} → pengali skor ${dec(pengali)}`,
		accessFormula: (pembagi: number) =>
			`Indeks akses = √(jumlah simpul × bobot modanya) ÷ ${dec(pembagi, 1)}, dibatasi 1. Dihitung sekali waktu kisinya dibangun, dari OSM. Bobotnya beda karena daya angkutnya beda.`,

		stationsTitle: 'Simpul yang terjangkau, satu per satu',
		stationsLoading: 'Memuat daftar simpulnya…',
		stationsFailed:
			'Daftar nama simpulnya tidak bisa dimuat. Cacah dan indeks aksesnya di atas tetap berlaku, keduanya dibaca dari kisi, bukan dari berkas itu.',
		modeGroup: (moda: string, n: number) => `${moda} · ${n} simpul`,
		unnamed: (n: number) =>
			`+${n} simpul lagi tanpa nama sendiri: peron stasiun yang sama, atau halte yang belum dinamai di OSM`
	},

	/* ── Harga tempat usaha ────────────────────────────────────────────────
	   Panel ini menjawab "berapa duit tempatnya di sini". Satu hal yang tidak
	   boleh kabur: KATALOG MAPID TIDAK PUNYA DATA SEWA. Semua angka di sini
	   harga JUAL yang diminta penjual, dan tidak satu pun boleh terbaca sebagai
	   sewa bulanan. Menurunkan sewa dari harga jual butuh asumsi imbal hasil,
	   dan asumsi itu bakal jadi satu-satunya angka di layar yang datangnya
	   bukan dari data siapa pun. */
	property: {
		title: 'Harga tempat usaha',
		/* Dipimpin, bukan diselipkan di catatan kaki. Pembaca datang mencari sewa,
		   dan yang ada di katalog bukan itu. */
		saleNote:
			'Ini harga JUAL yang diminta penjual, bukan sewa. Di katalog MAPID tidak ada satu pun listing sewa untuk Jakarta, jadi tidak ada sewa bulanan yang bisa ditampilkan tanpa mengarang asumsinya.',
		perM2: 'per m² tanah',
		medianOf: (n: number, r: number) =>
			`median dari ${n} unit yang dipasarkan dalam radius ${r} m`,
		priceValue: (v: number) => rp(v),
		/* Peringkat, bukan rasio. Harga per m² di Jakarta rentangnya dua orde, dan
		   segelintir kavling raksasa duduk di dasar skala per m², jadi rasio gampang
		   diseret pencilan. Peringkat tidak bisa. */
		rank: (persen: number) => `Lebih mahal dari ${persen}% petak yang harganya terbaca.`,
		rankCheapest: 'Ini petak termurah di antara yang harganya terbaca.',
		rankDearest: 'Ini petak termahal di antara yang harganya terbaca.',
		/* `kali` datang sebagai angka, bukan teks: koma desimalnya urusan berkas bahasa,
		   dan kalau komponennya yang memformat, kalimat Indonesia ini kebagian "1.2×". */
		vsMedian: (v: number, kali: number) =>
			`Median sekisi ${rp(v)} per m², jadi di sini ${dec(kali, 1)}×.`,
		/* Apa yang dilakukan angka itu ke skor. Dibaca dari mesin skornya, bukan
		   dihitung ulang di sini. */
		effect: (poin: number, pengali: number) =>
			`Harga segini memotong ${poin} poin dari skor petak ini, pengalinya ×${dec(pengali)}.`,
		effectNone: 'Harga tempat tidak memotong skor petak ini.',
		floor: (pengali: number) =>
			`Paling banyak harga tempat bisa memotong sampai ×${dec(pengali)}. Ia menggeser urutan, bukan menentukannya: harga yang diminta penjual masih bisa ditawar, dan itu harga beli, bukan harga menempati.`,

		/* ── Empat macam diam, dibedakan ────────────────────────────────────
		   Cuma yang pertama berarti belum ada yang melihat. */
		noneUncovered:
			'Katalog properti untuk kota ini belum dibaca, jadi belum ada yang bisa dikatakan soal harga tempat di sini. Ini bukan berarti tidak ada yang dijual.',
		noneEmpty: (r: number) =>
			`Tidak ada unit komersial yang sedang dipasarkan dalam radius ${r} m. Sudah dicek, memang tidak ada.`,
		noneUnpriced: (n: number) =>
			`Ada ${n} unit yang dipasarkan di sekitarnya, tapi tidak satu pun memasang harga. Jadi harganya tidak diisi, bukan ditaksir.`,
		noneThin: (n: number, min: number) =>
			`Baru ${n} unit di sekitarnya yang memasang harga. Median butuh sedikitnya ${min}, karena satu salah ketik koma saja sudah cukup untuk memindahkan seluruh petak ini ke ujung mahal.`,
		noneUngraded:
			'Harga di petak ini terbaca, tapi belum cukup banyak petak lain yang harganya terbaca untuk dibandingkan. Jadi belum bisa dibilang mahal atau murah, dan skornya tidak dipotong.',

		/* ── Yang sedang dipasarkan ─────────────────────────────────────────── */
		marketTitle: 'Yang sedang dipasarkan di sini',
		marketCount: (n: number, r: number) => `${n} unit komersial dalam radius ${r} m`,
		marketPremises: (n: number) => `${n} di antaranya bisa ditempati usaha kecil`,
		marketNone: 'Tidak ada unit komersial yang sedang dipasarkan di sini.',
		marketLoading: 'Memuat daftar unitnya…',
		marketFailed:
			'Daftar unitnya tidak bisa dimuat. Harga dan cacahnya di atas tetap berlaku, keduanya dibaca dari kisi, bukan dari berkas itu.',
		/* Nama tipe. Kunci-kuncinya dari data (TIPE_2 di katalog), bukan terjemahan,
		   jadi harus lengkap di kedua bahasa. */
		types: {
			ruko: 'Ruko',
			toko: 'Toko / kios',
			ruang: 'Ruang usaha',
			rukan: 'Rukan',
			komersial: 'Komersial lain',
			kantor: 'Kantor',
			gedung: 'Gedung',
			gudang: 'Gudang'
		},
		typeAside: 'bukan tempat usaha kecil',

		/* ── Unit satu per satu ─────────────────────────────────────────────── */
		unitsTitle: 'Unit terdekat, satu per satu',
		unitPrice: (v: number) => rp(v),
		unitNoPrice: (n: number) =>
			`+${n} unit lagi yang bisa ditempati usaha, tanpa harga terpasang`,
		unitWalk: (m: number) => `${m} m`,
		/* Ciri unitnya, cuma yang benar-benar ada di datanya. Kolom yang kosong
		   dilewat, bukan ditulis nol: gedung tanpa jumlah lantai terpasang dan
		   gedung satu lantai itu dua hal yang berbeda. */
		unitLand: (m2: number) => `tanah ${num(m2)} m²`,
		unitBuild: (m2: number) => `bangunan ${num(m2)} m²`,
		unitFloors: (n: number) => `${n} lantai`,
		unitPerM2: (v: number) => `${rp(v)}/m²`,
		unitsMore: (n: number) => `+${n} unit lagi`,
		/* Label peta. Harganya bisa kosong kalau listingnya memang tidak memasang harga,
		   dan kalimatnya harus tetap utuh tanpa itu. */
		mapUnitAria: (jenis: string, harga: string, m: number) =>
			harga
				? `${jenis} dijual ${harga}, ${m} m dari pusat petak`
				: `${jenis} dijual tanpa harga terpasang, ${m} m dari pusat petak`,
		mapShow: 'Tampilkan di peta',
		mapHide: 'Sembunyikan dari peta',
		provenance: (n: number, kota: number) =>
			`${num(n)} listing properti komersial dari katalog Data Premium MAPID, ${kota} kota administrasi. Semuanya listing jual.`
	},

	table: {
		cols: {
			name: 'Petak',
			score: 'Skor',
			demand: 'Permintaan',
			supply: 'Penawaran',
			osm: 'Pesaing (OSM)',
			listings: 'Listing',
			nTot: 'N misi',
			typology: 'Tipologi'
		},
		empty: 'Tidak ada petak untuk ditampilkan.'
	},

	control: {
		weights: 'Bobot peluang',
		demand: 'Permintaan',
		demandHint: 'Struk Go: jumlah transaksi, jenis belanja, jam ramai, dan porsi non-tunai.',
		supply: 'Persaingan',
		supplyHint: 'Menu Go: kepadatan pesaing dibobot seramai apa pembelinya. Pesaing ramai menekan lebih keras.',
		gate: 'Gerbang tempat usaha',
		gateLabel: 'Wajib ada listing',
		gateSub: 'Tanpa tempat yang bisa ditempati, peluangnya tidak bisa dijalankan.',
		walk: 'Jangkauan jalan kaki',
		walkNote: (r: number) =>
			`Tetap ${r} m, sekitar 10 menit jalan kaki. Dipakai waktu kisinya dibangun, untuk menghitung akses transit dan pesaing tiap petak.`,
		layers: 'Layer',
		layerNames: {
			score: 'Skor peluang',
			routes: 'Jalur angkutan',
			poi: 'Pesaing petak terpilih',
			nodata: 'Petak belum terdata',
			label: 'Nama titik transit',
			stops: 'Simpul transit petak terpilih'
		},
		legend: 'Legenda',
		legendLow: 'Rendah',
		legendHigh: 'Tinggi',
		keyNodata: 'Belum terdata (N = 0)',
		keySaturated: 'Ditandai jenuh',
		keyDot: 'Titik transit, klik untuk detail',
		honesty: 'Kejujuran data',
		honesty1: (terdata: number, total: number, titik: number) =>
			`${terdata} dari ${total} petak punya data misi (${titik} titik contoh).`,
		honesty2: (poi: number, r: number) => `${poi} POI pesaing terhitung dari OSM pada radius ${r} m.`,
		honesty3:
			'Petak tanpa data tidak diinterpolasi. Ia ditandai arsir dan masuk daftar prioritas survei. Tiap skor disertai N di panel dan tabel, supaya bisa dinilai sendiri seberapa tebal dasarnya.',
		prov: 'Sumber data',
		provReal:
			'Titik transit empat moda (MRT, KRL, LRT, TransJakarta), geometri jalurnya, dan jumlah POI pesaing per radius, dari Overpass API (ODbL).',
		provMock:
			'Atribut khas dataset misi MAPID (Struk Go, Menu Go, Properti Go) karena datanya belum publik. Strukturnya mengikuti kolom asli, jadi tinggal ditukar begitu API MAPID tersedia.',
		provBasemap: 'Basemap wajib pada produk final: MAPID MAPS.'
	},

	mood: {
		busiest: 'paling ramai',
		busy: 'cukup ramai',
		quiet: 'agak sepi',
		empty: 'sepi',
		nodata:
			'Petak ini belum ada datanya, jadi jalannya sengaja dibiarkan kosong. Bukan berarti benar-benar sepi.',
		reading: (jam: string, kata: string) => `Pukul ${jam} di sini ${kata}.`,
		peakAt: (jam: string) => `Paling ramai sekitar pukul ${jam}.`,
		rivals: (n: number, cat: string) => `Ada ${n} ${cat} lain di sekitarnya`,
		listings: (n: number) => `dan ${n} tempat yang sedang disewakan.`,
		noListings: 'dan tidak ada tempat yang sedang disewakan.',
		rows: {
			score: 'Skor peluang',
			demand: 'Permintaan',
			supply: 'Penawaran efektif',
			now: 'Transaksi jam ini',
			peak: 'Puncak harian',
			rivals: 'Pesaing (OSM)',
			busy: 'Pesaing ramai',
			space: 'Tempat disewakan',
			points: 'Titik data'
		},
		/* ── Akses transit ──────────────────────────────────────────────────
		   Bagian ini ditulis untuk pembaca yang tidak membaca angka indeks. Yang
		   dipimpin adalah nama stasiunnya — "Blok M" bisa dibayangkan, dicek, dan
		   dibantah; "akses 0,82" tidak bisa apa-apa. Angkanya tetap ada, di
		   belakang namanya. */
		transit: 'Yang dijangkau dari sini',
		/* Angkanya dipimpin, bukan diselipkan. Ini "edisi angkutan massal": berapa
		   simpul yang terjangkau dari satu petak itu pertanyaan pertamanya, jadi
		   jawabannya ditulis besar sebelum apa pun yang lain. */
		transitCount: (_n: number) => 'simpul transit dalam jarak jalan kaki',
		transitCountSplit: (rel: number, halte: number) => {
			if (rel > 0 && halte > 0) return `${rel} stasiun rel · ${halte} halte TransJakarta`;
			if (rel > 0) return `${rel} stasiun rel`;
			return `${halte} halte TransJakarta`;
		},
		transitNone: 'Tidak ada simpul transit dalam jarak jalan kaki dari petak ini.',
		transitLoading: 'Memeriksa simpul transit di sekitarnya…',
		transitBand: {
			strongest: 'Akses transitnya termasuk yang terkuat di Jakarta.',
			strong: 'Akses transitnya kuat.',
			fair: 'Akses transitnya sedang.',
			thin: 'Akses transitnya terbatas.'
		},
		transitModes: {
			mrt: 'MRT',
			krl: 'KRL',
			lrt: 'LRT',
			brt: 'TransJakarta'
		},
		transitModeLong: {
			mrt: 'stasiun MRT',
			krl: 'stasiun KRL',
			lrt: 'stasiun LRT',
			brt: 'halte TransJakarta'
		},
		/* Rel dan bus dipisah karena bedanya nyata buat yang mau buka usaha: satu
		   stasiun rel itu satu pintu tetap yang ramai sepanjang hari, sedangkan
		   halte bus banyak dan menyebar, jadi keramaiannya terbagi. */
		transitRail: 'Stasiun rel yang terjangkau',
		transitBus: (n: number) => `${n} halte TransJakarta dalam jarak jalan kaki`,
		transitWalk: (m: number) => `${m} m`,
		transitUplift: (persen: number) =>
			`Akses ini menaikkan skor peluang petak ini sekitar ${persen}% dibanding petak tanpa transit sama sekali.`,
		transitWhyRail:
			'Stasiun rel mengalirkan orang yang sama tiap hari kerja pada jam yang sama. Itu arus yang bisa direncanakan, bukan lalu-lalang acak.',
		transitWhyBus:
			'Halte TransJakarta menyebar, jadi keramaiannya terbagi ke banyak titik. Bagus untuk jangkauan, bukan untuk satu titik ramai.',
		transitRadius: (m: number) => `Dihitung dari pusat petak, radius ${m} m`,
		transitShow: 'Tampilkan di peta',
		transitHide: 'Sembunyikan dari peta',
		/* Pesaing, digambar di tempatnya yang sebenarnya. Kata kerjanya sama dengan
		   sakelar transit di atas, karena janjinya sama tentang peta yang sama. */
		rivalsOnMap: 'Pesaing di peta',
		rivalsCount: (n: number, cat: string) =>
			`${n} ${cat} digambar di titik aslinya, dalam radius jalan kaki yang sama.`,
		/* Kalau dimatikan, kalimat di atas menceritakan peta yang tidak ada. Angkanya
		   sama, dan ini menyebut apa yang harus ditekan untuk melihatnya. */
		rivalsHidden: (n: number, cat: string) =>
			`${n} ${cat} di dalam radius jalan kaki. Tampilkan untuk melihat titiknya.`,
		rivalsLoading: 'Mencari titiknya…',
		/* Stasiun diberi nama, yang ini tidak, jadi bedanya perlu dijelaskan. Namanya
		   ada di data MAPID, cuma belum ikut disimpan waktu berkas titiknya dibuat,
		   dan sekali ambil ulang namanya masuk. */
		rivalsNoNames: 'Belum ada namanya di data, jadi digambar sebagai tanda saja.',
		rivalsNone: 'Tidak ada pesaing sejenis di dalam radius jalan kaki.',
		/* Cuma MAPID yang punya koordinat. Menyebut sumber mana yang punya adalah beda
		   antara jalan buntu dan sesuatu yang bisa dikerjakan pembaca. */
		rivalsNoPositions:
			'OSM memberi cacah pesaing, bukan titiknya, jadi tidak ada yang bisa digambar. Ganti sumber ke MAPID di keterangan peta untuk melihat posisinya.',
		rivalsFailed: 'Posisi pesaing gagal dimuat. Cacah di sebelahnya tidak terpengaruh.',
		prov: 'Transaksi & tempat usaha: data contoh MAPID. Pesaing & titik transit: OSM.',
		sceneLabel: (nama: string, jam: string, isi: string) => `Skema kawasan ${nama} pukul ${jam}. ${isi}`,
		sceneNodata: 'Belum ada data untuk kawasan ini, jadi jalannya ditampilkan kosong.',
		sceneBody: (n: number, osm: number, cat: string, listing: number) =>
			`Sekitar ${n} transaksi pada jam ini, ${osm} ${cat} pesaing, dan ${listing} tempat yang sedang disewakan.`
	},

	/* ── app ──────────────────────────────────────────────────────────────── */

	app: {
		categoryLabel: 'Jenis usaha',
		coverage: (terdata: number, total: number, poi: number) =>
			`${terdata}/${total} petak · ${poi} pesaing terdata`,
		/* Cacah pesaing baru ada setelah kolom satu kategori dimuat. Sebelum itu
		   kalimatnya berhenti di petak — menulis "0 pesaing terdata" berarti mengaku
		   sudah menghitung dan tidak menemukan siapa pun, padahal belum menghitung. */
		coverageCells: (terdata: number, total: number) => `${terdata}/${total} petak`,
		coverageTitle:
			'Petak yang sudah ada datanya, dan jumlah pesaing sejenis yang tercatat di OpenStreetMap',
		advanced: 'Pengaturan lanjutan',
		advancedClose: 'Tutup pengaturan',
		tapak: 'Tapak',
		tapakSub: ', pemandu Anda',
		mood: 'Suasana kawasan',
		numbers: 'Angka lengkap kawasan',
		table: 'Tabel atribut',
		tableHide: 'Sembunyikan tabel atribut',
		tableHint: ', klik judul kolom untuk mengurutkan',
		panel: 'Panel',
		tabs: { recommendations: 'Tapak', detail: 'Kawasan', table: 'Tabel', controls: 'Lanjutan' },
		loadingMap: 'Memuat peta…',
		zoomIn: 'Perbesar',
		zoomOut: 'Perkecil',
		reset: 'Kembalikan tampilan awal',
		legendUnit: 'skor peluang',
		sourceLabel: 'Sumber data pesaing',
		sourceOsm: 'OpenStreetMap: merata, dikumpulkan sukarela',
		sourceMapid: 'MAPID: tersurvei, lengkap 5 kota DKI',
		/* Menyebut sumbernya, bukan menulis "MAPID" mati. Sejak empat kategori
		   makanan dinyatakan tidak punya sumber OSM, keadaan "tidak ada yang bisa
		   dinilai" justru paling sering terjadi pada OSM — dan kalimat lamanya
		   menyuruh pengguna mengimpor dataset, langkah yang sudah tidak ada, lalu
		   menyarankan kembali ke OSM yang justru sedang jadi masalahnya. */
		legendUncovered: (n: number, cat: string, src: string) =>
			`${n} petak belum tercakup data ${src} untuk ${cat}, jadi tidak dinilai. Itu bukan berarti tanpa pesaing`,
		legendUncoveredAll: (cat: string, src: string, other: string) =>
			`${src} tidak punya data pesaing untuk ${cat}, jadi tidak ada petak yang bisa dinilai. Coba sumber ${other}.`,
		legendNodata: (n: number) => `${n} petak belum terdata, tidak dinilai`,
		/* Peta panas menyatakan pendapat: petak mana yang bagus untuk satu jenis usaha.
		   Ia baru muncul kalau memang diminta — lewat tombol ini, atau lewat Tapak yang
		   menjawab pertanyaan. */
		heatmapShow: 'Tampilkan peta panas',
		heatmapHide: 'Sembunyikan peta panas',
		heatmapLoading: 'Memuat data kategori…',
		heatmapHint: (cat: string) => `Warnai petak menurut skor peluang ${cat}`,
		heatmapAria: 'Peta panas skor peluang',
		/* Tooltip peta sebelum ada kategori yang dimuat: petaknya dinamai, tidak ada
		   angka yang diklaim. */
		tipNoCategory: 'Nyalakan peta panas untuk melihat skornya',
		needCategory: 'Belum ada kategori yang dimuat. Nyalakan peta panas atau tanya Tapak.',
		ask: 'Atau tanya sendiri…',
		askAria: 'Tanya Tapak',
		askSend: 'Tanya',
		/* Kotak tanya pembuka, di tengah layar. Judulnya pertanyaan, bukan slogan:
		   yang diminta dari pengguna memang menjawabnya. */
		launchTitle: 'Mau buka usaha apa?',
		/**
		 * Contoh pertanyaan, dipakai dua kali sekaligus.
		 *
		 * `ask` yang mengetikkan dirinya sendiri di dalam kolom, dan juga yang benar
		 * -benar dikirim. `short` yang tertulis di tombolnya. Dua wujud, satu daftar,
		 * jadi tombol tidak mungkin menjanjikan pertanyaan yang berbeda dari yang
		 * dikirimnya.
		 *
		 * Yang mengetik sendiri mengajarkan BENTUK kalimatnya; tombolnya memberi
		 * jalan masuk sekali tekan. Label tombol sengaja pendek: kalimat penuh di
		 * atas pil membuat barisnya melebar dan berhenti terbaca sebagai saran.
		 *
		 * Tiap contoh harus benar-benar terjawab, dan jawabannya harus berguna. Dua
		 * mencari lokasi, satu menandai kawasan yang sesak, satu membandingkan dua
		 * tempat. Nama kawasan yang disebut wajib ada di kisi, kalau tidak,
		 * pembandingnya jatuh ke pesan "sebutkan dua nama" dan sarannya jadi jebakan.
		 */
		launchSuggestions: [
			{ short: 'Kedai kopi sewa murah', ask: 'Di mana buka kedai kopi dengan sewa murah dekat MRT?' },
			/* Label pil harus berdiri sendiri, tanpa kalimat sebelumnya untuk disandari.
			   Karena itu tiap label menyebut subjeknya. "Yang sebaiknya dihindari" dan
			   "Yang belum ada datanya" dibuka kata ganti tanpa acuan: dihindari apa,
			   belum ada datanya apa. Di dalam percakapan hal itu tidak masalah karena
			   ada jawaban di atasnya, tapi di sini tidak ada apa-apa di atasnya. */
			{
				short: 'Kawasan yang sebaiknya dihindari',
				ask: 'Kawasan mana yang sudah jenuh untuk minimarket?'
			},
			{ short: 'Bandingkan dua kawasan', ask: 'Bandingkan Balai Kota dan Manggarai untuk apotek' },
			/* Di sini dulu "Kawasan yang belum terdata". Pertanyaan itu memang bisa
			   dijawab, tapi jawabannya daftar kawasan yang justru TIDAK dinilai, dan
			   tidak ada orang membuka SpotOn untuk itu. Sebagai saran pembuka ia
			   membuang satu dari empat tempat yang ada. Pertanyaan soal cakupan data
			   tetap hidup di dalam percakapan, tempatnya memang di sana: setelah ada
			   jawaban yang pantas dipertanyakan. */
			{ short: 'Kawasan bagus untuk laundry', ask: 'Di mana buka laundry dekat stasiun?' }
		],
		/* Kaki kartu: seberapa tebal dasar jawabannya, dalam empat angka. Labelnya
		   menyebut sumber, karena angka tanpa asal cuma hiasan. */
		launchStats: {
			hexes: 'petak kawasan',
			stops: 'titik transit',
			pois: 'titik usaha terdata',
			cats: 'jenis usaha'
		},
		/* Jalan keluar buat yang tidak mau ditanya dulu. Bunyinya menyebut apa yang
		   didapat, bukan apa yang dilewati: "lewati" saja tidak memberi tahu ke mana
		   perginya. Tapak tetap ada di sebelah kanan, jadi tidak ada yang hilang. */
		launchSkip: 'Lihat petanya dulu',
		closeArea: 'Tutup kawasan',
		dismissRemark: 'Tutup catatan Tapak',
		home: 'Kembali ke beranda SpotOn',
		emptyMood: 'Belum ada kawasan yang dipilih. Tekan salah satu petak di peta untuk melihat suasananya.',
		pickBest: (cat: string) => `Pilihkan yang terbaik untuk ${cat}`,
		clock: 'Jam',
		clockAria: 'Geser untuk melihat kawasan ini pada jam lain',
		schema: 'skema, bukan denah sebenarnya',
		fullNumbers: 'Lihat angka lengkapnya',
		/* Tanda di peta, menempel pada petak yang dipilih. Sengaja cuma cacahnya:
		   rinciannya ada di panel, yang dibutuhkan di peta cuma "berapa banyak". */
		mapStops: (n: number) => `${n} simpul transit`,
		mapStopsAria: (n: number, r: number) =>
			`${n} simpul transit dalam ${r} m jalan kaki dari petak ini`,
		/* Cacah titik pesaing yang benar-benar tergambar, bukan angka panel. Lencana
		   dan peta yang ditempelinya tidak boleh berselisih. */
		mapRivals: (n: number) => `${n} pesaing`,
		mapRivalsAria: (n: number, r: number) =>
			`${n} pesaing sejenis dalam ${r} m jalan kaki dari petak ini`,
		mapReach: (r: number) => `jangkauan ${r} m`,
		tipNodata: 'Data misi MAPID: N = 0 · kandidat prioritas survei',
		tipScore: (cat: string) => `skor ${cat}`,
		sheet: 'Panel informasi',
		sheetGrip: 'Ubah tinggi panel'
	},

	tapak: {
		greet: (total: number, terdata: number) =>
			`Halo, saya Tapak. Saya sudah keliling ${total} petak di sekitar MRT, KRL, LRT, dan koridor TransJakarta, dan ${terdata} di antaranya sudah ada datanya. Lagi kepikiran buka usaha apa?`,
		/* Pertanyaan ini dulu berbunyi "Modalnya kira-kira bagaimana?" dengan pilihan
		   "Pas-pasan" dan "Agak longgar" — dua kata yang tidak memberi tahu apa pun
		   soal apa yang akan berubah. Yang sebenarnya dipilih di sini cuma satu:
		   apakah hasilnya disaring ke kawasan yang tempatnya memang sedang
		   disewakan, di kelas sewa bawah. Jadi itu yang ditanyakan, dan itu yang
		   tertulis di tombolnya. */
		budgetAsk: (cat: string) => `Oke, ${cat}. Sewa tempatnya bagaimana?`,
		budgetTight: 'Harus yang sewanya murah',
		budgetLoose: 'Berapa pun, asal kawasannya bagus',
		prefaceTight:
			'Baik. Saya saring ke kawasan yang tempatnya memang sedang disewakan, di kelas sewa bawah.',
		prefaceLoose: 'Baik, semua kawasan saya lihat, tanpa saringan sewa.',
		restart: 'Mau lihat usaha apa sekarang?',
		tryOther: 'Coba usaha lain',
		avoid: 'Mana yang sebaiknya dihindari?',
		avoidQ: (cat: string) => `Kawasan mana yang sudah jenuh untuk ${cat}?`,
		coverage: 'Mana yang belum ada datanya?',
		coverageQ: 'Kawasan mana yang belum terdata?',
		retry: 'Coba lagi',
		failed: (err: string) => `Maaf, catatan saya tidak kebuka barusan. ${err} Coba tanya lagi?`,
		nothing: 'Saya belum menemukan apa-apa untuk itu.'
	},

	narrate: {
		notUnderstood: (why: string) =>
			`${why} Yang saya hafal cuma kawasan di sekitar transit Jakarta, untuk tiga belas jenis usaha. Mau saya carikan salah satunya?`,
		coverageNone: 'Semua kawasan sudah ada datanya.',
		coverageSome: (n: number) =>
			`Ada ${n} kawasan yang datanya belum saya punya sama sekali. Saya tidak menilainya. Daripada saya karang, lebih baik saya bilang belum tahu.`,
		saturatedNone: 'Tidak ada yang benar-benar sesak untuk usaha ini.',
		saturatedSome: (n: number, cat: string) =>
			`Ini ${n} kawasan yang sebaiknya dihindari dulu untuk ${cat}. Pesaingnya rapat dan kebanyakan ramai.`,
		compare: 'Kalau dibandingkan, begini hasilnya.',
		rankNone: (cat: string) =>
			`Belum ada kawasan yang cocok untuk ${cat} dengan syarat itu. Mau saya longgarkan syaratnya?`,
		rankBy: (name: string, ukuran: string, nilai: string, n: number) =>
			`Menurut ${ukuran}, ${name} yang teratas: ${nilai}. Ini ${n} yang teratas menurut catatan saya.`,
		rankTop: (name: string, nilai: string | null, n: number) =>
			`Kalau saya yang pilih, ${name} dulu${nilai ? `, nilainya ${nilai} dari 100` : ''}. Ini ${n} yang teratas menurut catatan saya.`,
		remarkNodata: (name: string, osm: number, cat: string) =>
			`${name} belum ada datanya, jadi saya tidak berani menilai. Yang saya tahu cuma ada ${osm} ${cat} di sekitarnya menurut peta terbuka.`,
		remark: (name: string, verdict: string, cat: string, nilai: string, osm: number, listing: string) =>
			`${name} ${verdict} untuk ${cat}, nilainya ${nilai}. Ada ${osm} pesaing sejenis, dan ${listing}.`,
		verdictGood: 'termasuk bagus',
		verdictMid: 'menengah',
		verdictLow: 'terus terang kurang menjanjikan',
		listingSome: (n: number) => `${n} tempat sedang disewakan`,
		listingNone: 'tidak ada tempat yang sedang disewakan'
	},

	query: {
		saturated: 'yang sudah sesak',
		coverage: 'yang belum ada datanya',
		within: (r: number) => `dalam ${r} m jalan kaki dari titik transit`,
		hasSpace: 'ada tempat yang disewakan',
		cheap: 'sewa kelas bawah',
		/* ── Ukuran yang bisa ditanyakan ────────────────────────────────────
		   Kuncinya dari `domain/metrics`, jadi ukuran baru di sana harus ada
		   namanya di sini dan di en.ts. `harga_tempat` sengaja tidak dinamai
		   "sewa": katalog MAPID tidak punya listing sewa untuk Jakarta, dan
		   menamainya begitu bakal jadi satu-satunya kebohongan di layar. */
		metrics: {
			skor: 'skor peluang',
			permintaan: 'permintaan',
			penawaran: 'penawaran efektif',
			pesaing: 'jumlah pesaing',
			keramaian: 'keramaian',
			kunjungan: 'transaksi tercatat',
			jam_puncak: 'jam puncak',
			nontunai: 'porsi non-tunai',
			listing: 'listing ruang usaha',
			harga_tempat: 'harga jual tempat usaha',
			unit_dipasarkan: 'unit yang dipasarkan',
			akses_transit: 'akses transit',
			simpul_transit: 'simpul transit'
		},
		sortedBy: (ukuran: string, naik: boolean) =>
			`diurutkan dari ${ukuran} ${naik ? 'terkecil' : 'terbesar'}`,
		band: (ukuran: string, arah: 'rendah' | 'tinggi' | 'ada') =>
			arah === 'ada'
				? `${ukuran} ada isinya`
				: `${ukuran} sepertiga ${arah === 'rendah' ? 'terbawah' : 'teratas'}`,
		perM2: (v: number) => `${rp(v)}/m²`,
		count: (v: number) => num(Math.round(v))
	},

	demo: {
		coverageAsk: 'Sebentar, datanya lengkap?',
		coverageChip: 'Cakupan data',
		coverageReply: 'Tidak semuanya. Mau saya tunjukkan yang mana saja yang belum?',
		coverageYes: 'Tunjukkan',
		coveragePreface: 'Ini yang belum saya punya datanya.',
		saturatedChip: 'Yang jenuh',
		saturatedAsk: 'Oke, minimarket. Mau saya carikan yang bagus, atau yang sebaiknya dihindari?',
		saturatedYes: 'Yang sebaiknya dihindari',
		saturatedPreface: 'Boleh. Ini yang pesaingnya paling rapat.'
	}
};

export type Copy = typeof id;
