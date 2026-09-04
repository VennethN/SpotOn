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
		warung: { name: 'Warung Makan', short: 'Warung', many: 'warung makan' },
		minimarket: { name: 'Minimarket', short: 'Minimarket', many: 'minimarket' },
		laundry: { name: 'Laundry', short: 'Laundry', many: 'laundry' },
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
		heroTitle: 'Lihat jalannya dulu.\nBaru tanda tangan.',
		heroBody:
			'Ini satu blok di sekitar stasiun, pada jam yang sedang berjalan sekarang. Ramai sepinya trotoar mengikuti data transaksi 24 jam. Angka di halaman ini masih contoh; hitungan sebenarnya ada di dalam aplikasi.',
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
		cats: { label: 'jenis usaha dinilai', sub: 'kopi, warung, minimarket, laundry, apotek' },
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
			'Maket kisi heksagon. Tiap petak satu heksagon; tinggi dan warnanya mewakili skor peluang pada skala yang sama dengan peta, dan petak yang belum terdata dibiarkan cekung tanpa warna. Lingkaran putus-putus menandai jangkauan berjalan kaki dari petak yang sedang dibidik.'
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
		foot: 'Pertanyaannya contoh; jawabannya dihitung mesin skor yang sama dengan aplikasinya.',
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
		title: 'Satu peta, lima jenis keputusan.',
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
		title: 'SpotOn — Jangan tebak lokasi usaha. Tanya petanya.',
		description:
			'SpotOn menggabungkan permintaan, persaingan, dan ketersediaan tempat usaha di setiap kawasan berjalan kaki di sekitar transit Jakarta, lalu menunjukkan di mana sebaiknya buka usaha dan kenapa.',
		appTitle: 'SpotOn — Peta cari lokasi usaha kawasan transit Jakarta'
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
		hourTitle: (n: number) => `Transaksi per jam — Struk Go · N = ${n}`,
		acrossTitle: 'Peluang per jenis usaha, dengan bobot saat ini',
		summaryLead: 'Ringkasan.',
		summary: (jam: string, cat: string, osm: number, r: number, frasa: string, listing: number, kat: string) =>
			`Petak ini paling ramai pukul ${jam}. Untuk ${cat}, OSM mencatat ${osm} pesaing dalam radius ${r} m; ${frasa}. Tersedia ${listing} listing berkategori ${kat}.`,
		summaryNote:
			'Angka pesaing dari OSM (nyata); atribut misi MAPID masih contoh. N ditampilkan supaya bisa diperiksa.'
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
			poi: 'Sebaran pesaing',
			nodata: 'Petak belum terdata',
			label: 'Nama titik transit'
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
		coverageTitle:
			'Petak yang sudah ada datanya, dan jumlah pesaing sejenis yang tercatat di OpenStreetMap',
		advanced: 'Pengaturan lanjutan',
		advancedClose: 'Tutup pengaturan',
		tapak: 'Tapak',
		tapakSub: '— pemandu Anda',
		mood: 'Suasana kawasan',
		numbers: 'Angka lengkap kawasan',
		table: 'Tabel atribut',
		tableHide: 'Sembunyikan tabel atribut',
		tableHint: '— klik judul kolom untuk mengurutkan',
		panel: 'Panel',
		tabs: { recommendations: 'Tapak', detail: 'Kawasan', table: 'Tabel', controls: 'Lanjutan' },
		loadingMap: 'Memuat peta…',
		zoomIn: 'Perbesar',
		zoomOut: 'Perkecil',
		reset: 'Kembalikan tampilan awal',
		legendUnit: 'skor peluang',
		sourceLabel: 'Sumber data pesaing',
		sourceOsm: 'OpenStreetMap — merata, dikumpulkan sukarela',
		sourceMapid: 'MAPID — tersurvei, baru sebagian kota',
		legendUncovered: (n: number, cat: string) =>
			`${n} petak belum tercakup data MAPID untuk ${cat} — tidak dinilai, bukan berarti tanpa pesaing`,
		legendUncoveredAll: (cat: string) =>
			`Data MAPID untuk ${cat} belum diimpor sama sekali, jadi tidak ada petak yang bisa dinilai. Impor datasetnya, atau kembali ke OSM.`,
		legendNodata: (n: number) => `${n} petak belum terdata, tidak dinilai`,
		ask: 'Atau tanya sendiri…',
		askAria: 'Tanya Tapak',
		askSend: 'Tanya',
		emptyMood: 'Belum ada kawasan yang dipilih. Tekan salah satu petak di peta untuk melihat suasananya.',
		pickBest: (cat: string) => `Pilihkan yang terbaik untuk ${cat}`,
		clock: 'Jam',
		clockAria: 'Geser untuk melihat kawasan ini pada jam lain',
		schema: 'skema, bukan denah sebenarnya',
		fullNumbers: 'Lihat angka lengkapnya',
		tipNodata: 'Data misi MAPID: N = 0 · kandidat prioritas survei',
		tipScore: (cat: string) => `skor ${cat}`,
		sheet: 'Panel informasi',
		sheetGrip: 'Ubah tinggi panel'
	},

	tapak: {
		greet: (total: number, terdata: number) =>
			`Halo, saya Tapak. Saya sudah keliling ${total} petak di sekitar MRT, KRL, LRT, dan koridor TransJakarta; ${terdata} di antaranya sudah ada datanya. Lagi kepikiran buka usaha apa?`,
		budgetAsk: (cat: string) => `Oke, ${cat}. Modalnya kira-kira bagaimana?`,
		budgetTight: 'Pas-pasan',
		budgetLoose: 'Agak longgar',
		prefaceTight: 'Saya carikan yang tempatnya memang sedang disewakan, ya.',
		prefaceLoose: 'Baik, saya lihat semuanya dulu.',
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
			`${why} Yang saya hafal cuma kawasan di sekitar transit Jakarta, untuk lima jenis usaha. Mau saya carikan salah satunya?`,
		coverageNone: 'Semua kawasan sudah ada datanya.',
		coverageSome: (n: number) =>
			`Ada ${n} kawasan yang datanya belum saya punya sama sekali. Saya tidak menilainya; daripada saya karang, lebih baik saya bilang belum tahu.`,
		saturatedNone: 'Tidak ada yang benar-benar sesak untuk usaha ini.',
		saturatedSome: (n: number, cat: string) =>
			`Ini ${n} kawasan yang sebaiknya dihindari dulu untuk ${cat}. Pesaingnya rapat dan kebanyakan ramai.`,
		compare: 'Kalau dibandingkan, begini hasilnya.',
		rankNone: (cat: string) =>
			`Belum ada kawasan yang cocok untuk ${cat} dengan syarat itu. Mau saya longgarkan syaratnya?`,
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
		cheap: 'sewa kelas bawah'
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
