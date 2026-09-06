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
		/* Urutannya mengikuti urutan halaman, dan halamannya diurutkan ulang: datanya
		   dulu, baru cara menghitungnya, baru cara bertanya. Menjelaskan skor sebelum
		   pembaca tahu angkanya dari mana itu terbalik. */
		sections: [
			{ href: '#masalah', label: 'Masalah' },
			{ href: '#data', label: 'Data' },
			{ href: '#cara-kerja', label: 'Cara kerja' },
			{ href: '#ai', label: 'Tanya' }
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
			'SpotOn menghitung usaha yang sudah berdiri, pesaing sejenis, simpul transit, dan tempat yang dijual di tiap kawasan transit Jakarta, lalu menjawab di mana sebaiknya Anda buka usaha dan kenapa.',
		heroHint: 'gulir untuk menyusuri satu blok',
		dayTitle: 'Ramai itu bisa dihitung.',
		dayBody:
			'Bukan dari firasat dan bukan dari survei yang belum pernah ada. Yang dihitung adalah usaha yang sudah berdiri di radius jalan kaki: kalau satu blok sudah menghidupi puluhan usaha, orangnya jelas lewat situ.',
		lotTitle: 'Petak bergaris putih itu masih kosong.',
		lotBody:
			'Kotak tembus pandang di atasnya bukan bangunan yang sudah ada. Itu usaha yang bisa Anda buka di situ. Permintaan sebesar apa pun tidak ada gunanya kalau tempatnya tidak bisa disewa, jadi ketersediaan tempat kami pakai sebagai syarat, bukan nilai tambah.',
		reading: (nama: string, n: number) => `${nama} · ${n} usaha dalam radius jalan kaki`,
		sceneLabel: (nama: string, n: number, pesaing: number) =>
			`Blok jalan di kawasan ${nama}. Ramainya mengikuti jumlah usaha yang benar-benar berdiri di radius jalan kaki petak itu, ${n} usaha, ${pesaing} di antaranya sejenis.`
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
		pois: { label: 'gerai usaha terdata', sub: 'dalam radius jalan kaki' },
		cats: {
			label: 'jenis usaha dinilai',
			sub: 'kuliner, ritel harian, dan jasa'
		}
	},

	problem: {
		mark: 'Masalah',
		title: 'Salah pilih lokasi, modalnya yang hangus.',
		rows: [
			{
				t: 'Ramainya belum pernah dihitung',
				d: 'Semua tahu kawasan stasiun itu ramai. Tidak ada yang tahu petak mananya.'
			},
			{
				t: 'Pesaingnya tidak kelihatan',
				d: 'Buka kedai kopi di jalan yang sudah penuh kedai kopi itu resep bangkrut.'
			},
			{
				t: 'Tempatnya tidak ikut dihitung',
				d: 'Kawasan bagus yang tidak ada rukonya bukan peluang.'
			}
		],
		statement:
			'Sekitar stasiun itu tempat dagang paling ramai di Jakarta, dan orang masih memilih lokasi pakai firasat.',
		chartTitle: 'Ramainya tidak rata.',
		chartBody:
			'Tiap batang: berapa petak yang punya sekian usaha dalam radius jalan kaki. Kebanyakan sepi, sedikit yang padat.'
	},

	how: {
		mark: 'Cara kerja',
		title: 'Satu skor per petak, per jenis usaha.',
		steps: [
			{
				t: 'Petak sejauh jalan kaki',
				d: (radius: number, hexes: string) =>
					`Jakarta ditutup kisi heksagon. Yang dinilai cuma ${hexes} petak yang punya titik transit dalam ${radius} m.`
			},
			{
				t: 'Tiga data dicocokkan',
				d: 'Titik usaha, simpul transit, dan tempat yang dipasarkan, masing-masing masuk ke petaknya.'
			},
			{
				t: 'Dihitung per jenis usaha',
				d: 'Ramai dikurangi pesaing sejenis, lalu dikali akses transit dan harga tempat.'
			},
			{
				t: 'Diurutkan, dengan alasannya',
				d: 'Tiap petak dapat keterangan: kurang dilayani, bersaing ketat, atau sudah penuh.'
			}
		],
		plain: 'Cari kawasan yang ramai, pesaing sejenisnya masih sedikit, dan tempatnya ada.'
	},


	grid: {
		mark: 'skema, bukan kawasan tertentu',
		caption: {
			lead: 'Satu heksagon, satu petak.',
			strong: 'Tinggi dan warnanya sama-sama skor peluang',
			rest: ', diambil dari skor sungguhan kisinya, pada skala yang sama persis dengan peta di dalam aplikasi. Yang cekung dan tidak berwarna kotanya belum disurvei. Lingkaran putus-putus itu jangkauan jalan kaki yang dipakai waktu kisinya dibangun.'
		},
		outOfScale: 'belum disurvei, di luar skala',
		label:
			'Maket kisi heksagon. Tinggi dan warnanya adalah skor peluang sungguhan, diambil merata dari seluruh kisi, pada skala yang sama dengan peta. Yang letaknya saja yang skema: yang tertinggi ditaruh di tengah. Petak yang kotanya belum disurvei dibiarkan cekung tanpa warna.'
	},

	ai: {
		mark: 'Tanya petanya',
		title: 'Tanya pakai bahasa sehari-hari, petanya yang berubah.',
		p1: 'Sebutkan mau buka usaha apa, dan seluruh kota berganti warna untuk usaha itu. Tidak ada rumus yang harus diisi dan tidak ada istilah yang harus dihafal.',
		p2: 'Sebelum menjawab, peta menunjukkan apa yang dia tangkap. Kalau salah tangkap, Anda langsung tahu.',
		p3: 'Pertanyaannya contoh. Angkanya tidak: tiap warna dan nilai di sini dihitung mesin yang sama dengan aplikasinya.',
		mapEmpty: 'Peta 562 petak kawasan transit Jakarta, menunggu pertanyaan pertama.',
		mapLabel: (jenis: string) =>
			`Peta 562 petak kawasan transit Jakarta, diwarnai menurut skor peluang untuk ${jenis}.`,
		mapCaption: (jenis: string) => `Skor peluang ${jenis}, 562 petak, dihitung saat ini juga.`,
		caught: 'Yang ditangkap peta',
		/* Tanpa titik-titik di ujungnya. Titik-titiknya sekarang bergerak sendiri,
		   digambar `ui/Dots`, karena elipsis yang diketik cuma bilang kalimatnya
		   menggantung, bukan bahwa masih ada yang sedang dikerjakan. */
		thinking: 'Sebentar, saya cek catatan saya',
		/* Menunggunya ada dua bagian, dan lamanya jauh berbeda. Membaca pertanyaan
		   berarti menunggu model yang dipakai ramai-ramai, dan di situlah hampir
		   semua waktunya habis. Menghitungnya cepat. Menyebut yang mana yang sedang
		   jalan itu versi jujurnya bilah kemajuan: tidak ada persen yang dikarang. */
		stage: {
			reading: 'Sebentar, saya baca dulu pertanyaannya',
			/* Jujur untuk semua sebabnya, bukan cuma yang paling sering. Modelnya bisa
			   penuh, bisa lambat, bisa balas ngawur. Yang pasti cuma satu: yang tadi
			   belum menjawab. */
			retrying: 'Belum ada jawaban dari yang tadi, saya coba yang lain',
			/* Bukan "sedang mengambil data", karena belum ada data yang diambil. Yang
			   sedang terjadi persis ini: pertanyaannya sudah ditangkap, dan pencarian
			   yang mau dijalankan sedang disusun. */
			choosing: 'Sudah saya tangkap, sedang saya susun pencariannya',
			computing: 'Sekarang saya hitung dari catatan saya'
		},
		more: (n: number) => `+${n} lagi di dalam aplikasi`,
		play: 'Jalankan percakapan',
		pause: 'Jeda percakapan'
	},

	data: {
		mark: 'Data',
		title: 'Tiap petak dihitung sendiri.',
		body: 'Usaha yang sudah berdiri, titik transit, dan tempat yang sedang dipasarkan. Dihitung satu per satu di tiap petak, bukan dikira-kira dari rata-rata kota.',
		gridWithData: 'petak sudah ada datanya',
		gridEmpty: 'belum ada datanya',
		gridLabel: (total: number, terdata: number, nodata: number) =>
			`Kisi ${total} petak: ${terdata} kotanya sudah disurvei, ${nodata} belum.`
	},

	spreadChart: {
		caption: 'Sebaran petak menurut jumlah usaha dalam radius jalan kaki.',
		table: 'Angka per kelompoknya',
		colBand: 'Sampai',
		colValue: 'Petak',
		tableCaption: 'Jumlah petak per kelompok kepadatan usaha',
		axisUnit: 'usaha',
		unit: 'petak',
		upTo: (batas: string) => `sampai ${batas} usaha`,
		label: (total: string, batas: string, puncak: string, unit: string) =>
			`Sebaran ${total} ${unit}, paling banyak di kelompok sampai ${batas} usaha dengan ${puncak} ${unit}.`,
		bar: (batas: string, nilai: string, unit: string) => `Sampai ${batas} usaha: ${nilai} ${unit}`
	},

	scale: { low: '0 · kecil', high: '100 · besar', nodata: 'belum disurvei, tidak diberi nilai' },

	/* Nama saja, tanpa kalimat penjelas. Dulu tiap baris punya satu kalimat di
	   bawahnya, dan kalimat itu cuma pengisi di sekeliling satu-satunya isi yang
	   penting, yaitu namanya. */
	audience: {
		mark: 'Untuk siapa',
		/* Tidak dipatok di tiga belas. Angkanya memang tiga belas hari ini, dan menulis
		   angkanya di judul membuatnya terbaca sebagai batas, padahal itu cuma jumlah
		   jenis usaha yang sudah masuk. */
		title: 'Satu peta, macam-macam keputusan.',
		typesLabel: 'Jenis usaha yang dinilai',
		rows: [
			'Pemodal ritel & kuliner',
			'UMKM bermodal pas-pasan',
			'Calon wirausaha rumahan',
			'Tim pembukaan cabang',
			'Pemilik & agen properti',
			'Pencari lokasi cabang'
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
			'Geometri dan POI © OpenStreetMap contributors (ODbL). Titik usaha dan properti komersial dari katalog Data Premium MAPID. Basemap wajib pada produk final: MAPID MAPS.'
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
		'not-covered': 'Belum disurvei',
		/* Bukan kekosongan data, tapi pertanyaan yang belum diajukan. */
		'no-type': 'Belum ada jenis usaha'
	},

	supply: {
		denseBusy: 'pesaingnya padat tapi kawasannya memang ramai, jadi celahnya sempit',
		denseQuiet: 'pesaingnya padat padahal kawasannya sepi, tandanya sudah jenuh',
		fewBusy: 'pesaingnya sedikit padahal kawasannya ramai, celahnya justru di situ',
		fewQuiet: 'pesaingnya sedikit dan kawasannya juga sepi'
	},


	/* ── Susunan skor ──────────────────────────────────────────────────────
	   Panel ini yang menjawab "kenapa segini?". Urutannya sengaja: yang dipimpin
	   adalah simpul transit, karena itu inti proyek ini, baru sesudahnya rinciannya
	   langkah per langkah. Dulu di sini tertulis bahwa transit satu-satunya masukan
	   yang datanya nyata. Sekarang semuanya nyata, jadi alasan itu gugur. */
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

	/* Catatan lapangan: survei MAPID Apps yang dikerjakan orang, bukan katalog.
	   Bedanya harus kelihatan di setiap kalimat. Katalog pesaing mengaku memuat
	   semua kedai kopi di Jakarta, jadi angka nol di sana itu temuan. Ini tidak
	   mengaku apa-apa: 191 dari 562 petak punya catatan, dan petak yang kosong cuma
	   berarti belum ada yang ke sana. Makanya setiap label bilang "tercatat". */
	field: {
		title: 'Catatan lapangan',
		notCensus:
			'Ini catatan orang yang datang ke tempatnya, bukan sensus. Petak tanpa catatan belum tentu sepi, bisa jadi memang belum ada yang ke sana.',
		none: 'Belum ada yang mencatat apa pun di petak ini.',
		loading: 'Memuat catatannya…',
		failed: 'Catatannya gagal dimuat. Angka di atas tetap utuh, yang hilang cuma daftarnya.',
		count: (n: number) => `${num(n)} catatan di petak ini`,
		last: (tanggal: string) => `Terakhir dicatat ${tanggal}.`,
		mapShow: 'Tampilkan di peta',
		mapHide: 'Sembunyikan dari peta',
		walk: (m: number) => `${m} m`,
		more: (n: number) => `+${n} lagi`,

		/* Struk Go */
		strukTitle: 'Struk belanja',
		strukCount: (n: number) => `${num(n)} struk difoto di sini`,
		cashless: (persen: number) => `${persen}% di antaranya dibayar nontunai.`,
		cashlessThin: (n: number, min: number) =>
			`Baru ${n} struk yang metode bayarnya terbaca. Di bawah ${min}, pangsanya belum bisa dibilang apa-apa.`,

		/* Menu Go */
		menuTitle: 'Tempat makan',
		menuCount: (n: number) => `${num(n)} tempat makan didatangi surveyor`,
		menuTypical: (v: number) => `Sekali makan di sini rata-rata ${rp(v)}.`,
		menuTypicalThin: (n: number, min: number) =>
			`Baru ${n} tempat yang harganya tercatat. Di bawah ${min}, itu harga satu warung, bukan harga kawasan.`,
		menuPrice: (v: number) => `${rp(v)} rata-rata`,
		menuNoPrice: (n: number) => `+${n} tempat lagi tanpa harga yang tertulis`,
		crowd: { sepi: 'sepi', sedang: 'sedang', ramai: 'ramai' },
		crowdSeen: (kata: string) => `pas didatangi: ${kata}`,

		/* Properti Go. Satu-satunya sumber sewa yang dipunya produk ini, jadi
		   kalimatnya menyebut itu terang-terangan. Yang dicatat penawarannya, harganya
		   tidak ditanyakan di formulirnya. */
		propTitle: 'Tempat yang ditawarkan',
		propCount: (n: number) => `${num(n)} tempat tercatat di sini`,
		propRent: (n: number) => `${n} di antaranya disewakan.`,
		propNoRent: 'Semuanya dijual, tidak ada yang disewakan.',
		rentNote:
			'Cuma survei ini yang mencatat sewa. Yang dicatat penawarannya, harga sewanya tidak ditanyakan.',
		offer: { sewa: 'Disewakan', jual: 'Dijual' },

		/* Catatan warga */
		noteTitle: 'Catatan warga',
		noteCount: (n: number) => `${num(n)} catatan tentang jalan di sekitar sini`,
		noteBy: (nama: string) => `oleh ${nama}`,

		provenance: (n: number, petak: number, total: number) =>
			`${num(n)} catatan lapangan MAPID Apps, tersebar di ${petak} dari ${total} petak. Tidak satu pun masuk ke perhitungan skor.`,

		/* Tanggalnya ditulis di berkas bahasa, bukan di komponen: nama bulan dan
		   urutannya beda per bahasa, dan yang dioper komponen selalu angka atau ISO. */
		day: (iso: string) => {
			const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
			const [y, m, d] = iso.split('-').map(Number);
			return bulan[m - 1] ? `${d} ${bulan[m - 1]} ${y}` : iso;
		},
		mapAria: (jenis: string, tempat: string, m: number) =>
			`${jenis}: ${tempat}, ${m} m dari pusat petak`,
		kinds: {
			struk: 'Struk',
			menu: 'Tempat makan',
			properti: 'Properti',
			catatan: 'Catatan warga'
		}
	},



	mood: {
		busiest: 'paling ramai',
		busy: 'cukup ramai',
		quiet: 'agak sepi',
		empty: 'sepi',
		nodata:
			'Kota petak ini belum ada di katalog, jadi jalannya sengaja dibiarkan kosong. Bukan berarti benar-benar sepi.',
		reading: (n: number, kata: string) => `Ada ${n} usaha di radius jalan kaki sini, jadi ${kata}.`,
		rivals: (n: number, cat: string) => `${n} di antaranya ${cat}`,
		listings: (n: number) => `dan ${n} unit sedang dipasarkan.`,
		noListings: 'dan tidak ada unit yang sedang dipasarkan.',
		rows: {
			score: 'Skor peluang',
			demand: 'Keramaian',
			supply: 'Penawaran efektif',
			around: 'Usaha lain di sekitar',
			rivals: 'Pesaing sejenis',
			access: 'Akses transit',
			space: 'Unit dipasarkan'
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
		prov: 'Titik usaha & properti: katalog MAPID. Pesaing & simpul transit: OSM.',
		sceneLabel: (nama: string, isi: string) => `Skema kawasan ${nama}. ${isi}`,
		sceneNodata: 'Kota kawasan ini belum disurvei, jadi jalannya ditampilkan kosong.',
		sceneBody: (n: number, osm: number, cat: string, unit: number) =>
			`Ada ${n} usaha dalam radius jalan kaki, ${osm} di antaranya ${cat} pesaing, dan ${unit} unit sedang dipasarkan.`,
		/* Belum ada jenis usaha yang disebut. Cacahnya tetap disebut karena memang
		   terhitung; pesaingnya tidak, karena pesaing untuk usaha apa itu justru
		   pertanyaan yang belum diajukan. */
		sceneNoType: (n: number, unit: number) =>
			`Ada ${n} usaha dalam radius jalan kaki dan ${unit} unit sedang dipasarkan.`,
		askForScore:
			'Sebutkan mau buka usaha apa, nanti saya hitung skor peluangnya untuk petak ini.'
	},

	/* ── app ──────────────────────────────────────────────────────────────── */

	app: {
		radiusLabel: 'Jangkauan',
		radiusValue: (m: number) => `${m} m`,
		radiusAria: 'Jangkauan jalan kaki yang dinilai',
		radiusHint:
			'Sejauh apa dari titik tengah yang dihitung, untuk petak maupun tempat. Harga tiap jangkauan dihitung sendiri, bukan ditaksir dari jangkauan lain.',
		categoryLabel: 'Jenis usaha',
		coverage: (terdata: number, total: number, poi: number) =>
			`${terdata}/${total} petak disurvei · ${poi} pesaing terdata`,
		/* Cacah pesaing baru ada setelah kolom satu kategori dimuat. Sebelum itu
		   kalimatnya berhenti di petak — menulis "0 pesaing terdata" berarti mengaku
		   sudah menghitung dan tidak menemukan siapa pun, padahal belum menghitung. */
		coverageCells: (terdata: number, total: number) => `${terdata}/${total} petak`,
		coverageTitle: 'Petak yang kotanya sudah disurvei, dan jumlah pesaing sejenis yang tercatat',
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
		/* Peta pembuka: belum ada jenis usaha yang disebut, jadi belum ada skor peluang
		   yang bisa diberikan. Yang bisa dihitung tanpa jenis usaha cuma satu, yaitu
		   berapa banyak usaha yang berdiri dalam radius jalan kaki, apa pun jualannya. */
		basisDensity: 'Usaha di sekitar',
		basisDensityUnit: 'semua jenis usaha',
		basisDensityLow: '0 · sepi',
		basisDensityHigh: 'terpadat',
		basisDensityCells: (n: number) => `${n} petak kotanya belum disurvei, tidak dihitung`,
		sourceLabel: 'Sumber data pesaing',
		sourceBothLabel: 'Keduanya',
		/* "Keduanya" bukan penjumlahan, dan kalimat ini yang menjaga supaya tidak
		   dibaca begitu. Dua survei ini membaca kota yang sama, jadi menjumlahkannya
		   berarti menghitung toko yang sama dua kali. */
		sourceBoth: 'Tiap petak dibaca dari survei yang menjangkaunya, yang lebih banyak kalau dua-duanya. Tidak dijumlahkan.',
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
		legendNodata: (n: number) => `${n} petak kotanya belum disurvei, tidak dinilai`,
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
		/* Bacaan petak sebelum ada jenis usaha yang disebut: cacah usaha di sekitarnya,
		   bukan skor peluang. */
		tipDensity: 'usaha di sekitar',
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
		tipNodata: 'Kotanya belum disurvei · kandidat prioritas survei',
		tipScore: (cat: string) => `skor ${cat}`,
		tipBusy: (n: number) => `${n} usaha di sekitar`,
		tipRivals: (n: number) => `${n} pesaing`,
		tipUnits: (n: number) => `${n} unit dipasarkan`,
		sheet: 'Panel informasi',
		sheetGrip: 'Ubah tinggi panel'
	},

	tapak: {
		/* Dulu menyebut dua angka: berapa petak, lalu berapa yang sudah ada datanya.
		   Sejak dua survei dibaca sekaligus, dua angka itu sama besar, dan kalimatnya
		   jadi berbunyi "562 petak, 562 di antaranya sudah ada datanya". */
		greet: (total: number) =>
			`Halo, saya Tapak. Saya sudah keliling ${total} petak di sekitar MRT, KRL, LRT, dan koridor TransJakarta. Lagi kepikiran buka usaha apa?`,
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
		/* Paham, cuma kurang satu kata. Bukan penolakan: yang kurang bukan datanya,
		   tapi jenis usahanya, dan skor peluang memang tidak ada artinya tanpa itu. */
		needsCategory:
			'Sebelum saya jawab, mau buka usaha apa? Skor peluang selalu untuk satu jenis usaha, karena 83 untuk kedai kopi bukan 83 untuk laundry.',
		notUnderstood: (why: string) =>
			`${why} Yang saya hafal cuma kawasan di sekitar transit Jakarta, untuk sejumlah jenis usaha. Mau saya carikan salah satunya?`,
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
		/* Ditambahkan cuma kalau pertanyaannya memang minta ganti mode. Yang saya
		   sebut di atas selalu kawasan, karena hitungannya jalan di atas kisi;
		   yang di panel sebelah adalah tempat-tempat yang berdiri di dalamnya.
		   Dua-duanya benar, dan keduanya bukan daftar yang sama. */
		nowByUnit:
			'Petanya saya ganti ke per tempat, jadi yang jadi barisnya tempat usahanya sendiri, bukan kawasannya.',
		nowByCell: 'Petanya saya balikkan ke per petak, jadi barisnya kawasan lagi.',
		remarkUncovered: (name: string, cat: string) =>
			`Kota ${name} belum ada di katalog, jadi ${cat} di sekitarnya belum pernah dihitung dan saya tidak berani menilai. Bukan berarti tidak ada pesaingnya.`,
		remark: (name: string, verdict: string, cat: string, nilai: string, osm: number, listing: string) =>
			`${name} ${verdict} untuk ${cat}, nilainya ${nilai}. Ada ${osm} pesaing sejenis, dan ${listing}.`,
		verdictGood: 'termasuk bagus',
		verdictMid: 'menengah',
		verdictLow: 'terus terang kurang menjanjikan',
		listingSome: (n: number) => `${n} unit sedang dipasarkan`,
		listingNone: 'tidak ada unit yang sedang dipasarkan'
	},

	/* ── Ngobrol biasa ─────────────────────────────────────────────────────
	   Kalimat baku untuk giliran yang bukan pertanyaan data. Dipakai kalau
	   modelnya tidak ada, atau kalau balasan modelnya memuat angka dan dibuang
	   `domain/chat`. Nadanya sama dengan Tapak yang lain: ramah, pendek, dan
	   selalu balik mengarahkan ke yang bisa dijawab peta.

	   Tidak boleh ada angka di sini juga. Bukan karena kodenya memeriksa, tapi
	   karena kalimat baku yang memuat angka justru jadi contoh dari hal yang
	   sedang dilarang. */
	chat: {
		sapaan: 'Halo. Saya cuma bisa cerita soal kawasan transit Jakarta, tapi soal itu saya lumayan tahu. Mau mulai dari jenis usaha apa?',
		tentang:
			'Saya membaca keramaian, jumlah pesaing, dan tempat usaha yang dipasarkan di tiap petak sekitar stasiun, lalu menjawab dari angkanya. Kalau datanya tidak ada, saya bilang tidak ada.',
		usaha:
			'Biasanya yang menentukan itu siapa yang lewat, siapa yang sudah jualan di situ, dan tempatnya bisa ditempati atau tidak. Tiga hal itu yang bisa saya tunjukkan angkanya per kawasan.'
	},

	/* ── Pivot tempat usaha ────────────────────────────────────────────────
	   Mode kedua peta: barisnya unit yang dipasarkan, bukan petak. Kuncinya
	   dari `domain/units`, jadi ukuran baru di sana harus ada namanya di sini
	   dan di en.ts.

	   `harga` tetap harga JUAL. Tidak ada listing sewa di katalog MAPID untuk
	   Jakarta, dan menamainya "sewa" di sini bakal jadi satu-satunya kalimat
	   di produk ini yang tidak benar. */
	units: {
		title: 'Tempat yang dipasarkan',
		pivotCell: 'Per petak',
		pivotUnit: 'Per tempat',
		pivotHint: 'Ganti yang jadi barisnya: kawasan, atau tempat usahanya sendiri',
		count: (n: number) => `${num(n)} tempat usaha yang bisa ditempati`,
		filteredOut: (n: number) => `${num(n)} lagi disaring keluar`,
		unmeasured: (n: number, ukuran: string) =>
			`${num(n)} lagi tidak diperingkat karena ${ukuran.toLowerCase()}-nya belum terukur`,
		rampLow: 'bawah daftar',
		rampHigh: 'atas daftar',
		rampNodata: 'belum terukur, tidak ikut diperingkat',
		rampNote: (ukuran: string) =>
			`Warna titik di peta mengikuti urutan daftar ini, bukan skor petaknya. Yang paling pekat adalah yang teratas menurut ${ukuran.toLowerCase()}.`,
		none: 'Tidak ada tempat yang lolos saringan ini. Longgarkan salah satunya.',
		more: (n: number) => `+${num(n)} lagi, urutkan atau saring untuk mempersempit`,
		cellScore: (nilai: string) => `skor petaknya ${nilai}`,
		cellUnscored: 'petaknya belum dinilai untuk jenis usaha ini',
		provenance:
			'Tiap tempat dipasangkan ke petak terdekat yang pusatnya masih dalam jarak jalan kaki. Angka petaknya dihitung dari petak itu, bukan dari titik tempatnya.',
		metrics: {
			harga: 'Harga',
			harga_m2: 'Harga per m²',
			luas_tanah: 'Luas tanah',
			luas_bangunan: 'Luas bangunan',
			lantai: 'Jumlah lantai',
			skor_petak: 'Skor petak',
			permintaan_petak: 'Permintaan petak',
			pesaing_petak: 'Pesaing di petak',
			akses_petak: 'Akses transit',
			jarak_pusat: 'Jarak ke pusat petak'
		},
		/* Format nilainya ikut jenis ukurannya, dibaca dari `domain/units`. */
		value: (k: string, v: number) => {
			if (k === 'harga') return rp(v);
			if (k === 'harga_m2') return `${rp(v)}/m²`;
			if (k === 'luas_tanah' || k === 'luas_bangunan') return `${num(Math.round(v))} m²`;
			if (k === 'jarak_pusat') return `${num(Math.round(v))} m`;
			if (k === 'skor_petak' || k === 'permintaan_petak' || k === 'akses_petak') {
				return String(Math.round(v * 100));
			}
			return num(Math.round(v));
		},
		/* ── Penanda kepala kartu ───────────────────────────────────────────
		   Kedua kartunya sengaja dibikin mirip, jadi lencana inilah yang
		   membedakan 800 m kota dari satu pintu depan. */
		markCell: 'Satu petak kawasan',
		markUnit: 'Satu tempat yang dipasarkan',

		/* ── Kartu satu tempat ─────────────────────────────────────────────── */
		cardIn: (petak: string) => `di petak ${petak}`,
		cardWalk: (m: number) => `${num(m)} m dari pusat petak`,
		cardAbout: 'Tentang tempatnya',
		cardArea: 'Tentang kawasannya',
		cardFigures: 'Lihat kolom lengkap listingnya',
		cardNoScore:
			'Petak ini belum tercakup data pesaing untuk jenis usaha yang dipilih, jadi belum ada skornya. Keterangan tempatnya di atas tetap berlaku.',
		/* Baris tabel kolom listingnya. Kolom yang kosong dilewat, bukan diisi
		   strip: separuh katalognya tidak mengisi jumlah lantai atau sertifikat,
		   dan tabel penuh strip terbaca seperti unit yang tidak punya keterangan. */
		rows: {
			type: 'Jenis',
			cell: 'Petaknya',
			distance: 'Jarak ke pusat petak',
			price: 'Harga jual diminta',
			ppm: 'Harga per m² tanah',
			land: 'Luas tanah',
			build: 'Luas bangunan',
			floors: 'Jumlah lantai',
			cert: 'Sertifikat'
		}
	},

	query: {
		/* Kata sambung untuk daftar jenis usaha yang ditanya sekaligus. Di sini,
		   bukan di kode, karena tiap bahasa menyambungnya dengan caranya sendiri. */
		and: 'dan',
		saturated: 'yang sudah sesak',
		coverage: 'yang belum ada datanya',
		within: (r: number) => `dalam ${r} m jalan kaki dari titik transit`,
		hasSpace: 'ada tempat yang disewakan',
		cheap: 'sewa kelas bawah',
		/* Dua hal yang diubah jawabannya di PETA, bukan di peringkatnya. Disebut
		   supaya pembaca yang melihat petanya bergerak tahu bagian mana yang
		   memang dia minta. */
		pivotCell: 'dibaca per petak',
		pivotUnit: 'dibaca per tempat',
		radius: (r: number) => `dihitung dalam ${r} m jalan kaki`,
		/* ── Ukuran yang bisa ditanyakan ────────────────────────────────────
		   Kuncinya dari `domain/metrics`, jadi ukuran baru di sana harus ada
		   namanya di sini dan di en.ts. `harga_tempat` sengaja tidak dinamai
		   "sewa": katalog MAPID tidak punya listing sewa untuk Jakarta, dan
		   menamainya begitu bakal jadi satu-satunya kebohongan di layar. */
		metrics: {
			skor: 'skor peluang',
			permintaan: 'keramaian kawasan',
			penawaran: 'penawaran efektif',
			pesaing: 'jumlah pesaing',
			keramaian: 'jumlah usaha di sekitar',
			harga_tempat: 'harga jual tempat usaha',
			unit_dipasarkan: 'unit yang dipasarkan',
			akses_transit: 'akses transit',
			simpul_transit: 'simpul transit',
			struk_dicatat: 'struk yang tercatat',
			sewa_ditawarkan: 'tempat yang disewakan'
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

	/* Pertanyaan contoh di halaman utama, ditulis utuh seperti orang yang sudah tahu
	   mau buka apa. Dulu dipecah jadi empat giliran tanya jawab, dan di halaman
	   penjualan itu terlalu lama sebelum ada yang terjawab. */
	demo: {
		askOpen: (jenis: string) => `Di mana sebaiknya buka ${jenis} dekat stasiun?`,
		askCheap: (jenis: string) => `Di mana buka ${jenis} modal kecil dekat MRT?`,
		askSaturated: (jenis: string) => `Kawasan mana yang ${jenis}-nya sudah terlalu padat?`
	}
};

export type Copy = typeof id;
