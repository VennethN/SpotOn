# Proposal Ide WebGIS: MAPID WebGIS Competition 2026
### *Maps That Think! Mass Transportation Edition*

---

## Halaman Sampul

**Judul Proyek:** ***SpotOn: WebGIS Rekomendasi Site-Selection Berbasis AI untuk Ritel & F&B di Kawasan Transit Jakarta***

**Nama Tim:** Triple T

**Anggota Tim:**
| Nama | Peran | Asal Universitas | Jurusan | Semester |
|---|---|---|---|---|
| **Valent Nathanael** *(Ketua)* | Project Lead / Data & AI Engineer | Universitas Bina Nusantara | Computer Science | 7 |
| **Farhan Aulianda** | Frontend / WebGIS Developer | Universitas Bina Nusantara | Computer Science | 6 |
| **Anthony Gilles Rudolfo** | GIS & Spatial Analyst / UI-UX | Universitas Bina Nusantara | Computer Science | 7 |

**Instansi:** Universitas Bina Nusantara

**Kontak Ketua Tim:** Valent Nathanael, valentnathana@gmail.com

> *Tagline:* Jangan tebak lokasi usaha. Tanya petanya.

---

## 1. Ringkasan Eksekutif

**Masalah.** Kawasan di sekitar stasiun MRT, LRT, dan TransJakarta adalah magnet komersial paling menjanjikan di Jakarta karena arus pejalan kaki (*footfall*) yang padat dan berulang setiap hari. Namun keputusan di mana membuka usaha ritel/F&B baru (apakah coffee shop, minimarket, warung makan, atau restoran) hampir selalu diambil berdasarkan tebakan, "feeling", atau meniru pesaing. Investor, jaringan franchise, dan terutama UMKM tidak punya basis data yang menyatukan tiga hal yang menentukan sukses-gagalnya sebuah lokasi: permintaan riil (pola & waktu belanja warga), persaingan (kepadatan, tingkat harga, dan seberapa ramai usaha eksisting), dan ketersediaan ruang usaha yang benar-benar bisa ditempati. Akibatnya: salah lokasi, cepat tutup, modal hangus.

**Ide WebGIS.** SpotOn adalah WebGIS *decision-support* untuk *site-selection*. Sistem membangun catchment berjalan kaki di sekitar tiap stasiun transit Jakarta, lalu menghitung Opportunity Score per jenis usaha melalui analisis gap permintaan–penawaran (*demand–supply gap*). Peta interaktif memvisualisasikan lokasi ter-*ranking* per kategori usaha, sementara mesin rekomendasi AI di dalam interface memberi justifikasi bahasa natural: *"Buka coffee shop di catchment Stasiun X karena permintaan tinggi, persaingan rendah, dan sewa terjangkau."*

**Data.** Menggunakan data dasar MAPID secara substantif, dan seluruh indikator inti dibangun dari kolom terstruktur tanpa bergantung pada ekstraksi nilai dari foto: Struk Go sebagai sinyal permintaan (kategori tempat, waktu transaksi, metode pembayaran), Menu Go sebagai sinyal persaingan (jenis tempat, harga rata-rata per porsi, kondisi pembeli, mobilitas), Properti Go sebagai sinyal ketersediaan ruang usaha (kategori properti, jenis sewa/jual), dan Community Maps (activity) sebagai proksi footfall. Seluruhnya diperkaya data sekunder terbuka (rute & titik transit, populasi/BIG) serta *survey activities* untuk memadatkan data pada koridor studi.

**Peran AI.** AI mengubah data tak terstruktur (foto tempat usaha, foto tampak depan properti) menjadi atribut baru yang tidak ada pada data mentah: tier formalitas dan kualitas storefront, lalu, di dalam interface, me-*ranking* kandidat lokasi dan menjelaskan alasannya kepada pengguna dalam bahasa manusia.

**Dampak.** Alat bantu keputusan yang menurunkan risiko investasi salah lokasi, memberdayakan UMKM agar bersaing berbasis data, dan mengoptimalkan nilai ekonomi kawasan transit.

---

## 2. Latar Belakang Masalah

**Konteks: kawasan transit = arena komersial bernilai tinggi, tetapi keputusan lokasinya masih menebak.**
Setiap stasiun transit Jakarta menyalurkan ribuan pejalan kaki setiap hari, arus yang paling diincar bisnis ritel dan F&B. Wajar bila di sekitar stasiun tumbuh coffee shop, minimarket, gerai makanan cepat saji, warung, hingga pedagang keliling. Namun keputusan membuka usaha apa dan di mana nyaris tidak pernah dilandasi data spasial yang menyatukan permintaan, persaingan, dan ketersediaan ruang usaha. Kesalahan lokasi berujung pada tingkat kegagalan usaha yang tinggi, terutama bagi pelaku dengan modal terbatas.

**Masalah 1: Permintaan tidak terukur.** Berapa besar dan seperti apa pola pengeluaran warga di sekitar stasiun tertentu? Kategori belanja apa yang dominan: makanan, kebutuhan harian, apotek? Informasi ini tersebar di jutaan struk yang tak pernah teragregasi secara spasial, sehingga investor tidak tahu catchment mana yang benar-benar "haus" akan sebuah kategori usaha.

**Masalah 2: Persaingan tidak terpetakan.** Membuka coffee shop di lokasi yang sudah jenuh coffee shop adalah resep kegagalan. Namun tidak ada peta yang menunjukkan kepadatan usaha sejenis dan tingkat harganya per kawasan. Pelaku usaha buta terhadap tingkat kejenuhan pasar dan celah (*gap*) yang belum tergarap.

**Masalah 3: Ketersediaan ruang usaha tidak terpetakan.** Peluang pasar hanya berarti bila ada ruang yang benar-benar bisa ditempati. Ketersediaan ruko, retail, dan kios sangat timpang antar-catchment: ada kawasan berpermintaan tinggi yang nyaris tidak pernah punya listing kosong, dan ada kawasan dengan banyak ruang menganggur. Informasi ini terserak di listing yang tidak pernah ditautkan ke konteks permintaan maupun persaingan, sehingga pelaku usaha mengejar lokasi yang secara praktis tertutup baginya.

**Masalah 4: Ketiga sinyal tidak pernah disatukan.** Inti persoalan: permintaan, persaingan, dan ketersediaan ruang dianalisis terpisah (kalau dianalisis sama sekali), padahal keputusan *site-selection* yang baik menuntut ketiganya dipertimbangkan bersama pada konteks lokasi yang sama: yaitu catchment stasiun.

**Keterkaitan dengan tema.** Masalah ini berada tepat di irisan tema kompetisi (transportasi massal) dengan isu nyata yang secara eksplisit dicontohkan panitia: potensi lokasi (*site selection*) dan ekosistem ekonomi di sekitar transit. Menariknya, dataset MAPID (Struk/Menu/Properti Go) bersifat ekonomi-komersial dan secara alami memuat ketiga sinyal permintaan–persaingan–ketersediaan ruang, sehingga sangat pas untuk menjawab pertanyaan *site-selection* yang justru paling sering ditinggalkan tim lain.

---

## 3. Solusi yang Diusulkan

### 3.1 Deskripsi solusi dan masalah yang diselesaikan
**SpotOn** adalah *decision-support WebGIS* untuk pemilihan lokasi usaha. Untuk setiap stasiun transit di Jakarta, sistem membangun catchment berjalan kaki (400–800 m), mengumpulkan seluruh sinyal ekonomi di dalamnya, lalu menghitung Opportunity Score per jenis usaha berbasis analisis *gap* permintaan–penawaran. Hasilnya dipetakan interaktif dan dijelaskan oleh AI, menjawab tiga pertanyaan pelaku usaha: *Di mana permintaan untuk usaha X paling tinggi? Di mana persaingannya masih lemah? Di mana ruang usahanya benar-benar tersedia, dan di mana ketiganya bertemu?*

### 3.2 Sumber data & cara visualisasi dalam WebGIS
| Kelompok Data | Sumber | Peran dalam solusi | Visualisasi di WebGIS |
|---|---|---|---|
| **Data Mission: Struk Go** | MAPID | Sinyal PERMINTAAN, dari kolom terstruktur: `Kategori Tempat` (mix belanja), `Waktu Transaksi` (profil jam), `Metode Pembayaran` (proksi daya beli & formalitas) | Choropleth mix pengeluaran + grafik profil jam per catchment |
| **Data Mission: Menu Go** | MAPID | Sinyal PERSAINGAN, dari kolom terstruktur: `Jenis Tempat Makan`, `Harga rata-rata per porsi` (numerik), `Kondisi Pembeli`, `Mobilitas` | Layer titik F&B berwarna tier harga + heatmap kepadatan pesaing |
| **Data Mission: Properti Go** | MAPID | Sinyal KETERSEDIAAN RUANG USAHA: `Kategori Properti` & `Jenis (Sewa/Jual)`. Harga pada foto spanduk hanya pengayaan opsional, bukan indikator inti | Titik listing komersial + indikator ketersediaan per catchment |
| **Community Maps (activity)** | MAPID | Proksi FOOTFALL & aktivitas partisipasi pengguna | Cluster/heatmap aktivitas |
| **Rute & titik transit** | Data sekunder terbuka | Basis catchment & arus pejalan kaki antarmoda | Garis rute + node stasiun |
| **Populasi (BIG)** | Data sekunder terbuka | Konteks kepadatan penduduk & basis permintaan potensial | Layer konteks opsional |
| **Survey activities** | Tim terkurasi (MAPID APPS) | Memadatkan satu koridor studi (papan menu & storefront dapat difoto dari trotoar) + validasi kondisi lapangan | Foto & skor kondisi pada popup |

Basemap utama menggunakan MAPID MAPS (wajib). Semua layer dilengkapi layer control, filter, popup atribut, tabel lokasi, dan tabel atribut.

![Antarmuka SpotOn](assets/fig1_peta.png)

*Gambar 1. Purwarupa antarmuka SpotOn pada koridor MRT Utara–Selatan. Lingkaran catchment 800 m digambar pada skala sebenarnya (proyeksi Web Mercator, galat jarak 0,1%). Koordinat & nama stasiun, geometri jalur, jaringan jalan, dan jumlah POI pesaing per catchment diambil nyata dari OpenStreetMap; catchment tanpa data misi ditandai arsir, bukan diinterpolasi.*

### 3.3 Metode analisis spasial dan/atau prediksi
1. **Pembuatan catchment**: buffer/isochrone berjalan kaki di sekitar tiap stasiun.
2. **Spatial join**: mengaitkan setiap titik Struk/Menu/Properti Go & activity ke catchment stasiun terdekat.
3. **Indikator PERMINTAAN**: dari kolom terstruktur Struk Go: jumlah transaksi, komposisi kategori belanja (F&B, minimarket, apotek, dll.), profil jam transaksi (pagi/siang/malam, menentukan *format* usaha, bukan hanya kategorinya), dan rasio non-tunai sebagai proksi daya beli & formalitas kawasan. *Nilai rupiah pada foto struk tidak dipakai sebagai indikator inti.*
4. **Indikator PERSAINGAN**: dari kolom terstruktur Menu Go: kepadatan usaha per `Jenis Tempat Makan`, median `Harga rata-rata per porsi` (plafon harga yang ditanggung pasar setempat), rasio pedagang *keliling* vs. menetap, dan distribusi `Kondisi Pembeli`. Silang kepadatan × kondisi pembeli adalah detektor peluang utama: padat + mayoritas *sepi* = pasar jenuh; jarang + mayoritas *ramai* = celah permintaan nyata.
5. **Indikator KETERSEDIAAN RUANG**: dari Properti Go: jumlah listing komersial per `Kategori Properti`, rasio sewa:jual (likuiditas pasar ruang usaha), dan kecocokan kategori listing dengan jenis usaha yang dituju. Diperlakukan sebagai gerbang kelayakan (tidak ada ruang berarti tidak ada peluang), bukan sekadar variabel biaya.
6. **Analisis *gap* demand–supply**: untuk tiap kategori usaha, bandingkan sinyal permintaan terhadap kepadatan penawaran → deteksi hotspot (permintaan & penawaran sama-sama tinggi) vs. gap/peluang (permintaan tinggi, penawaran rendah).
7. **Opportunity Score**: skor peluang ter-normalisasi per jenis usaha per catchment: `Gap(usaha) = Permintaan(kategori) − Penawaran(kategori)`, di mana penawaran dibobot kondisi pembeli pesaing (pesaing *ramai* = penawaran kuat; *sepi* = penawaran lemah), lalu digerbang oleh ketersediaan ruang usaha. Bobot transparan, dapat dijelaskan, dan dapat disesuaikan pengguna secara langsung di interface.
8. **Ranking & tipologi**: mengurutkan catchment per jenis usaha dan mengelompokkan menjadi profil peluang (*underserved / kompetitif / jenuh / ramai-tapi-terbatas ruang*).
9. **Disiplin kehandalan data**: (a) analisis diagregasi pada level koridor selama kepadatan titik masih rendah, lalu diturunkan ke level stasiun setelah data penuh & hasil survey tersedia; (b) jumlah titik (N) ditampilkan berdampingan dengan setiap skor; (c) catchment tanpa data ditampilkan sebagai "belum terdata", bukan diinterpolasi menjadi nilai yang tampak wajar. Kejujuran data ini merupakan bagian dari output, bukan catatan kaki.

Metode analisis spasial diutamakan menggunakan tools open-source (QGIS / geopandas / PostGIS) sesuai anjuran panitia.

### 3.4 Peran AI dalam sistem (input → proses → output)
AI hadir di dua lapis, keduanya menghasilkan *spatial output*:

**Lapis A: Pengayaan data (offline, saat pipeline):**
- *Input:* foto tempat usaha (Menu Go `Foto Tempat`), foto tampak depan (Properti Go), serta foto & catatan lapangan hasil *survey activities*.
- *Proses:* klasifikasi visual menghasilkan atribut yang tidak tersedia pada data mentah: tier formalitas (permanen / semi-permanen / gerobak), kualitas & keterlihatan storefront (papan nama, frontage, kondisi bangunan), dan indikasi kesiapan ruang usaha. Opsional: OCR foto spanduk Properti Go untuk menandai frasa *"take over usaha" / "over kontrak"* sebagai sinyal pergantian usaha.
- *Output:* atribut baru yang dapat dipetakan per titik (tier formalitas, skor kualitas storefront, flag pergantian usaha) yang menjadi masukan langsung bagi indikator persaingan dan ketersediaan ruang.
- *Validasi:* tingkat keyakinan ditampilkan per tag; klasifikasi berkeyakinan rendah dialihkan ke status *"perlu tinjauan manual"* alih-alih dinyatakan sebagai fakta. Disilangkan dengan atribut terstruktur bawaan dataset (`Jenis Tempat Makan`, `Mobilitas`, `Kategori Properti`) dan sampel *survey activities*.
- *Catatan penting:* tanpa klasifikasi ini, atribut tersebut tidak ada sama sekali: AI berperan menghasilkan data, bukan sekadar menarasikan angka yang sudah dihitung rumus.

**Lapis B: Mesin rekomendasi AI di dalam interface WebGIS (interaktif, wajib):**
- *Input:* aksi pengguna (klik stasiun/catchment, pilih jenis usaha yang ingin dibuka, atur prioritas bobot, atau ketik pertanyaan seperti *"di mana lokasi terbaik buka warung kopi modal kecil?"*).
- *Proses:* AI membaca indikator permintaan–persaingan–ketersediaan ruang & Opportunity Score area terpilih, me-*ranking* kandidat lokasi, lalu menyusun justifikasi bahasa natural yang merujuk angka indikator.
- *Output di layar:* "Rekomendasi Lokasi" (daftar catchment ter-*ranking* untuk jenis usaha terpilih + peta ter-highlight), "Kenapa di sini?" (justifikasi: permintaan tinggi / pesaing sepi / ruang usaha tersedia, dengan angka pendukung beserta N di baliknya), dan "Profil Peluang Catchment" (ringkasan naratif tiap kawasan).
- *Validasi:* setiap klaim AI dirujuk ke angka indikator yang tampil di panel (transparan & dapat diaudit pengguna), sehingga rekomendasi tidak menjadi "kotak hitam".

![Panel AI dan query terstruktur](assets/fig2_ai.png)

*Gambar 2. Panel AI di dalam interface. Pertanyaan bahasa natural diterjemahkan menjadi query terstruktur yang ditampilkan apa adanya (intent, metrik, kategori, radius, filter), lalu dieksekusi PostGIS. Tiap rekomendasi memuat justifikasi "Kenapa di sini?" beserta N titik data di baliknya, sehingga dapat diaudit dan tidak dapat dikarang model.*

### 3.5 Output utama berupa insight atau rekomendasi
- **Peta *site-selection* ter-*ranking* per jenis usaha** (coffee shop, minimarket, F&B, warung, apotek, dll.).
- Identifikasi hotspot vs. gap permintaan–penawaran per kategori usaha.
- Rekomendasi naratif AI: "di mana membuka usaha X dan mengapa", siap dibaca stakeholder.
- **Profil peluang tiap catchment**: ringkasan permintaan, persaingan, dan ketersediaan ruang dalam satu kartu, lengkap dengan jumlah titik data (N) yang mendasarinya.
- Sorotan peluang UMKM modal kecil (mis. lokasi dengan permintaan tinggi, pesaing sepi, dan ruang usaha kecil yang tersedia).
- **Peta kejujuran data**: catchment yang belum terdata ditampilkan apa adanya sebagai *"belum terdata"*, sekaligus menjadi daftar prioritas *survey activities* berikutnya.

![Panel detail catchment](assets/fig3_detail.png)

*Gambar 3. Panel detail satu catchment. Setiap indikator diberi label sumber (`OSM` = nyata, `MOCK` = contoh), disertai N titik di baliknya, profil jam transaksi, peringkat peluang lintas jenis usaha, dan ringkasan AI yang konsisten dengan angkanya sendiri.*

### 3.6 Integrasi keseluruhan sistem (end-to-end)
`Data mentah - Community Maps, Mission, dan data sekunder` → `Cleaning & standardisasi` → `Pengayaan AI - klasifikasi foto tempat & tampak depan + validasi survey` → `Spatial join & indikator - permintaan, persaingan, dan ketersediaan ruang per catchment` → `Analisis gap + Opportunity Score + ranking` → `Insight & rekomendasi site-selection` → `Interface WebGIS - peta + mesin rekomendasi AI + dashboard`. Alur ini identik dengan kerangka 8 tahap panduan panitia (Bagian B.3), sehingga mudah dinilai keterkaitannya.

![Alur end-to-end SpotOn](assets/fig4_pipeline.png)

*Gambar 4. Alur end-to-end SpotOn, dari data mentah hingga interface WebGIS, diwarnai per fase. Dua garis putus-putus menandai keterkaitan yang bukan sekadar urutan: catchment "belum terdata" mengembalikan prioritas ke survey activities berikutnya, dan setiap klaim mesin rekomendasi AI terikat pada angka indikator Tahap 4.*

---

## 4. Potensi WebGIS dan Manfaat

**Target pasar / pengguna:**
- **Investor ritel / F&B**: memilih lokasi ekspansi berbasis data permintaan, persaingan, dan ketersediaan ruang, bukan tebakan.
- **UMKM & pelaku usaha modal terbatas**: menemukan lokasi bernilai yang ruangnya benar-benar terjangkau, bersaing berbasis data.
- **Calon wirausaha rumah tangga (lapisan publik)**: warga yang hendak membuka warung, laundry, atau kedai kecil di dekat rumahnya dapat bertanya langsung kepada peta: *"usaha apa yang masuk akal di sekitar sini?"*, dan menerima jawaban beserta alasannya, tanpa perlu kemampuan GIS. Lapisan publik ini sekaligus menjadi kanal partisipasi: foto papan menu & storefront yang dikirim pengguna memperkaya lapisan persaingan.
- **Tim ekspansi franchise**: *screening* dan *ranking* kandidat lokasi lintas koridor transit secara cepat.
- **Pemilik & agen properti**: memahami potensi komersial listing mereka dan menargetkan penyewa yang tepat.

**Skalabilitas:** kerangka catchment + Opportunity Score bersifat *city-agnostic*, dapat direplikasi ke Bandung, Surabaya, atau kota lain hanya dengan mengganti data transit & dataset MAPID setempat. Menambah stasiun/koridor atau kategori usaha baru tidak mengubah arsitektur.

**Lanskap kompetitif & keunggulan:**
- **Diferensiasi utama:** memakai dataset ekonomi MAPID (Struk/Menu/Properti Go) secara *substantif* untuk menjawab pertanyaan *site-selection* yang konkret dan komersial, bukan sekadar menampilkan rute & titik seperti mayoritas solusi aksesibilitas biasa.
- **Menyatukan tiga sinyal keputusan** (permintaan–persaingan–ketersediaan ruang) yang biasanya terserak, tepat pada konteks kawasan transit.
- **Seluruh indikator inti berasal dari kolom terstruktur**, sehingga analisis tidak bergantung pada ekstraksi angka dari foto: solusi tetap berdiri saat kepadatan data masih rendah, dan menguat seiring data penuh & hasil survey masuk.
- **AI yang benar-benar spasial & interaktif**: mesin rekomendasi yang me-*ranking* lokasi dan menjelaskan alasannya, memenuhi persyaratan AI-in-interface secara natural (bukan fitur tempelan).
- **Insight & rekomendasi, bukan data mentah**: sesuai penilaian utama panitia.
- **Sudut pemberdayaan UMKM** memberi nilai sosial & narasi yang kuat.

---

## 5. Kelayakan Teknis
> *Catatan: stack final akan disesuaikan dengan kekuatan tim (lihat Lampiran 1). Berikut rencana acuan.*

**Arsitektur acuan:**
- **Frontend / peta:** MapLibre GL JS + MAPID MAPS sebagai basemap utama; UI dengan React. Interaksi wajib (zoom, klik, filter, layer control, tabel atribut) didukung penuh.
- **Backend / API:** layanan ringan (Node/Express atau FastAPI) untuk melayani layer, indikator, dan endpoint AI rekomendasi.
- **Basis data spasial:** PostgreSQL + PostGIS / MongoDB (spatial join, buffer, agregasi). Akses data MAPID melalui API terdokumentasi yang diberikan ke 50 tim terkurasi.
- **Analisis spasial:** QGIS / geopandas / PostGIS (open-source, sesuai anjuran).

- **AI:** model klasifikasi citra ringan (mis. CLIP *zero-shot* / MobileNet) untuk foto tempat usaha & tampak depan; LLM via API dengan tool-use / function-calling terhadap daftar operasi spasial terbatas di PostGIS untuk ranking & justifikasi naratif; LLM memilih operasi dan mengisi argumen, angka selalu dihitung basis data, tidak pernah dikarang model. Skor & atribut hasil AI di-*cache* agar interface tetap cepat.
- **Deployment:** publik di Vercel (frontend) + hosting API; responsif desktop & mobile, waktu muat wajar.

**Persyaratan teknis utama & mitigasi risiko:**
- *Kelengkapan data mission per catchment* → agregasi pada level koridor selama data masih jarang, penayangan N per skor, dan status *"belum terdata"* untuk catchment kosong. Survey activities diarahkan untuk memadatkan satu koridor studi: papan menu dapat difoto dari trotoar tanpa transaksi maupun izin khusus, sehingga menjadi data termurah untuk diperbanyak.
- *Sampel Struk Go sebagai proksi permintaan* → titik struk merekam lokasi merchant, bukan tempat tinggal pembeli. Karena itu disajikan sebagai indikator relatif antar-catchment, bukan estimasi permintaan absolut; diperkuat konteks populasi BIG & footfall activity.
- *Bias waktu pada `Kondisi Pembeli`* → kondisi keramaian tercatat pada saat kunjungan surveyor; perbandingan dilakukan pada rentang jam yang setara dan disilangkan dengan profil jam Struk Go.
- *Beban komputasi AI real-time* → pra-komputasi skor + cache; AI interaktif hanya untuk narasi & ranking ringan.
- *Kualitas klasifikasi visual AI* → tingkat keyakinan ditampilkan per tag; hasil berkeyakinan rendah masuk antrean *"perlu tinjauan manual"*, tidak dinyatakan sebagai fakta. Divalidasi silang dengan atribut terstruktur dataset (`Jenis Tempat Makan`, `Mobilitas`, `Kategori Properti`) + sampel survey.

---

## 6. Kesimpulan
**SpotOn** mengubah data komunitas & misi MAPID menjadi alat keputusan spasial yang menjawab pertanyaan bisnis paling nyata di kawasan transit Jakarta: *usaha apa sebaiknya dibuka, di mana, dan mengapa?* Solusi ini memenuhi seluruh komponen wajib: peta interaktif di atas MAPID MAPS, AI di dalam interface yang menghasilkan rekomendasi spasial ter-*ranking*, dan output berupa insight & rekomendasi, bukan data mentah. Keunggulannya jelas: menyatukan tiga sinyal keputusan (permintaan dari Struk Go, persaingan dari Menu Go, ketersediaan ruang dari Properti Go) yang selama ini terserak (seluruhnya dari kolom terstruktur, tanpa menggantungkan analisis pada ekstraksi angka dari foto), menautkannya dengan arus ekonomi transit, dan menyajikannya lewat mesin rekomendasi yang mudah dipahami investor maupun UMKM. Tim kami layak melaju karena idenya nyata, datanya masuk akal, metodenya dapat dijelaskan, dan WebGIS-nya dapat diimplementasikan serta langsung berguna bagi pelaku usaha.

---

## Lampiran 1: Asesmen Tim
**Nama Tim:** Triple T, Universitas Bina Nusantara

**Seluruh Anggota Tim:** Valent Nathanael (Ketua), Farhan Aulianda, Anthony Gilles Rudolfo

1. **Framework/library frontend yang dikuasai:** React; Svelte / SvelteKit; Next.js; Vue; Tailwind CSS; TypeScript; JavaScript; HTML/CSS; Three.js; Mapbox GL JS; MapLibre GL JS.

2. **Bahasa & framework backend yang pernah digunakan:** Node.js; FastAPI (Python); Go; Rust; C#; PHP; GraphQL; Kafka; Docker; Terraform; CI/CD; AWS; GCP; Cloudflare; DigitalOcean; Linux.

3. **Database geospasial yang pernah digunakan:** PostgreSQL; MongoDB; Supabase; Redis; ClickHouse. PostGIS belum pernah digunakan, akan diadopsi di atas PostgreSQL. Analisis pendukung: geopandas; QGIS.

4. **Stack AI yang dikuasai:** PyTorch; TensorFlow; Keras; scikit-learn; LangChain; LiteLLM; Strands Agents.

---
*Catatan format: konversi ke PDF A4, font min. 11pt, maks. 10 halaman. Nama file: `[NamaTim_JudulProyek]`. Sertakan pula 2 dokumen persetujuan yang sudah ditandatangani.*
