# Data MAPID — status, cakupan, dan daftar impor

Lembar kerja untuk melacak dataset MAPID yang sudah masuk dan yang masih perlu
diimpor. Diperbarui manual; angka cakupan dihasilkan `node scripts/fetch-mapid.mjs`.

---

## 1. Cara kerjanya

Pembagian tugas antara antarmuka dan skrip, dan alasannya:

| Langkah | Di mana | Kenapa di situ |
|---|---|---|
| Mencari dataset | GEO MAPID (kotak "Cari data/layer") | Endpoint daftar katalog mengabaikan `page`, `limit`, dan semua parameter pencarian — selalu mengembalikan 20 baris yang sama. Mencari di antara ~20.000 entri tidak bisa dilakukan dari skrip. |
| **Impor** ke proyek | GEO MAPID (tombol Impor) | Menulis ke akun MAPID; perlu sesi login. `MAPID_API_KEY` hanya bisa membaca. |
| Mengambil isinya | `node scripts/fetch-mapid.mjs` | Skrip menemukan sendiri semua layer di proyek — tidak ada id yang perlu disalin tangan. |

Proyek: `6a7c1672fb8d434002151fa7` (ubah lewat `MAPID_PROJECT_ID` bila pindah).

### Dua jebakan yang sudah kena sekali

**`get_layer` memotong di 200 fitur tanpa memberi tahu.** Tidak ada penanda
"masih ada lagi" pada responsnya, jadi pengambilan yang terpotong terlihat
sukses sempurna. Layer RESTORAN Jakarta Pusat sebenarnya 1.160 titik, MAKANAN
DAN MINUMAN 1.714 — tanpa `&limit=` eksplisit, 83% hilang diam-diam. Sudah
diperbaiki di skrip; ingat ini kalau menarik layer MAPID dari tempat lain.

**Jangan menebak kategori dari kolom `NAMA`.** Satu halte TransJakarta pernah
terhitung sebagai minimarket karena namanya memuat "MART". Pesaing palsu menekan
skor petak yang sebenarnya kosong — persis kebalikan dari yang kita cari.
Klasifikasi sekarang hanya membaca `TIPE_1/2/3`.

---

## 2. Cakupan sekarang

Sudah diimpor (12 layer, 2.194 titik unik setelah 1.296 duplikat dibuang):

| Kategori SpotOn | Jakpus | Jakbar | Jaksel | Jaktim | Jakut | Titik |
|---|:--:|:--:|:--:|:--:|:--:|--:|
| kopi | ✅ | ✅ | ✅ | ✅ | ✅ | 660 |
| warung | ✅ | — | — | — | — | 1.534 |
| minimarket | — | — | — | — | — | 0 |
| apotek | — | — | — | — | — | 0 |
| laundry | — | — | — | — | — | 0 |

### Hasil penggabungan (`node scripts/join-mapid.mjs`)

- 537 dari 558 petak berhasil ditentukan kotanya (21 sisanya di luar 14 wilayah
  yang diambil — Bodetabek terluar).
- 515 pasangan petak×kategori **tercakup**, 2.275 **belum tercakup**.
- Pesaing MAPID terhitung: kopi 1.301, warung 3.288 pengamatan. Angka ini lebih
  besar daripada jumlah titik karena satu gerai bisa berada dalam 800 m dari
  beberapa petak sekaligus — memang begitu definisinya ("pesaing dalam jarak
  jalan kaki dari petak ini"), bukan pembagian wilayah.

Cakupan ditentukan **per kota administrasi** memakai batas OSM `admin_level=5`,
bukan dari kedekatan POI. Sempat memakai `admin_level=6` dan yang kembali justru
kecamatan (Kebon Jeruk, Cilincing, Pulo Gadung) — tidak ada yang cocok dengan
`KABKOT`, sehingga seluruh petak salah ditandai "belum tercakup" tanpa satu pun
galat muncul. Perlu diperiksa hasilnya, bukan hanya status keluarannya.

Sel bertanda **—** diperlakukan sebagai **belum tercakup**, bukan nol pesaing.
Ini konsekuensi langsung dari prinsip proyek: ketiadaan data bukan bukti
ketiadaan usaha. Petak di kota yang datasetnya belum diimpor tidak boleh
mendapat skor tinggi hanya karena pesaingnya belum terdata.

Layer HALTE (606 titik) sengaja tidak dipakai — akses transit sudah dihitung
dari OSM untuk empat moda, dan HALTE MAPID hanya mencakup sebagian kota.

### Yang perlu diimpor untuk menutup lima kategori

Cari di GEO MAPID → Impor data → Data Premium, lalu Impor:

```bash
node scripts/search-mapid.mjs        # → docs/mapid-import-checklist.md
```

Daftar lengkap beserta tautan langsung ada di
[`mapid-import-checklist.md`](mapid-import-checklist.md), dihasilkan otomatis.
Ringkasnya, yang sudah terverifikasi ada dan tinggal ditekan Impor:

- [ ] **RESTORAN** — kelima kota, lengkap (menutup `warung`)
- [ ] **MINIMARKET** — kelima kota, lengkap (menutup `minimarket`)

Yang tidak terlihat lewat jalur ini dan masih perlu dicek manual: `MAKANAN DAN
MINUMAN` di luar Jakpus, `APOTEK`, dan `LAUNDRY`. Perlu ditegaskan karena mudah
salah baca: pencarian itu hanya mengindeks layer **publik**, sedangkan katalog
premium tidak ada di dalamnya — jadi kosong di sana berarti "tidak terlihat dari
sini", bukan "tidak ada".

Setelah impor, jalankan ulang keduanya:

```bash
node scripts/fetch-mapid.mjs   # tarik titik dari proyek  → mapid-poi.json
node scripts/join-mapid.mjs    # gabungkan ke kisi        → hexes.json
```

### Efek saklar sumber pada penilaian

Sumber dipilih lewat saklar **OSM | MAPID** di bilah atas. Keduanya lepas — tidak
pernah dicampur dalam satu skor.

| Kategori | Dinilai (OSM) | Dinilai (MAPID) | Belum tercakup |
|---|--:|--:|--:|
| kopi | 469 | 382 | 87 |
| warung | 469 | 46 | 423 |
| minimarket / laundry / apotek | 469 | 0 | 469 |

Angka MAPID yang kecil bukan kerusakan: itu cakupan impor yang tercermin apa
adanya. Petak yang belum tercakup tidak diberi skor sama sekali — memberi nilai
berdasarkan "nol pesaing" justru akan menobatkan wilayah yang paling sedikit
diperiksa sebagai peluang terbaik.

Di peta, tiga keadaan itu dibedakan: petak bernilai diwarnai skala peluang,
petak **belum terdata** diarsir, dan petak **belum tercakup** hanya digariskan
putus-putus tanpa isi.

### Belum tersambung ke skor

Data MAPID sudah menempel di `hexes.json` sebagai `mapid` dan `covered`, tetapi
**mesin skor masih memakai cacah OSM**. Menukarnya mengubah seluruh peringkat,
dan selama cakupan baru satu kota untuk warung, hasilnya akan timpang: Jakarta
Pusat dinilai dengan data padat sementara kota lain belum tercakup. Tukar setelah
lima kategori × lima kota terisi, atau setelah diputuskan bagaimana petak yang
belum tercakup ditampilkan di peta.

---

## 3. Yang bisa didapat di luar lima kategori

Katalog premium punya 16 kategori (~90.000 dataset). Kita tidak terbatas pada
lima jenis usaha yang dipilih di awal. Yang menarik bukan menambah kategori
usaha, melainkan **menambal permintaan** — satu-satunya sinyal yang masih
sepenuhnya contoh.

| Kategori katalog | Jumlah | Contoh dataset | Buat SpotOn |
|---|--:|---|---|
| Sosial | 23.254 | `ANGKA HARAPAN HIDUP` | **Statistik demografi.** Kandidat terkuat untuk mengganti `d` (permintaan) yang sekarang dikarang. Perlu ditelusuri indikator apa saja yang ada. |
| Penelitian | 4.134 | `NIGHT TIME LIGHT` | **Proksi aktivitas ekonomi** dari citra malam — mapan dipakai di literatur, dan ada per kabupaten. Bagus persis di tempat data survei tidak ada. |
| Perumahan | 4.063 | `APARTEMEN` | Kepadatan hunian = pembeli yang tinggal di sana. Penghasil permintaan, bukan pesaing. |
| Layanan TI | 2.649 | `ATM` | Proksi aktivitas komersial dan ekonomi tunai. |
| Kesehatan | 7.206 | `APOTEK` | Langsung mengisi kategori apotek; rumah sakit juga penghasil permintaan. |
| Retail | 19.980 | `ALFAMART`, `212 MART` | Minimarket tingkat merek — lebih tajam daripada satu kelas "minimarket". |
| Pariwisata | 1.936 | `PARIWISATA & HIBURAN` | Penarik kunjungan; menjelaskan keramaian yang bukan dari penduduk setempat. |
| Pemerintah | 3.966 | `FASILITAS PENEGAKAN HUKUM` | Kantor = populasi pekerja siang hari. |
| Perencanaan Kota | 719 | `BATAS ADMINISTRASI` | Batas administrasi rapi — berguna untuk pelabelan petak dan agregasi per kecamatan. |
| Transportasi | 5.599 | `BANDARA` | Sudah tertutup OSM untuk empat moda; nilai tambahnya kecil. |
| Lingkungan | 4.770 | `AKSES AIR MINUM LAYAK` | Indikator kesejahteraan; relevansinya tidak langsung. |
| Manufaktur / Energi / Iklim / Barang Konsumsi | — | — | Belum ada kaitan jelas dengan pemilihan lokasi ritel. |

### Kalau harus memilih tiga

1. **Sosial** — demografi. Ini yang membuat `permintaan` berhenti jadi karangan.
2. **Penelitian → NIGHT TIME LIGHT** — proksi aktivitas yang tersedia merata,
   termasuk di petak yang tidak punya data survei sama sekali.
3. **Perumahan → APARTEMEN** — sisi penduduk dari permintaan, melengkapi (1).

Catatan penting: begitu permintaan berasal dari data nyata, penandaan **MOCK**
di antarmuka wajib ikut berubah per sinyal — jangan sampai satu label lama
menutupi campuran data nyata dan contoh.

---

## 4. Yang tetap tidak tersedia

Struk Go, Menu Go, dan Properti Go adalah dataset misi kompetisi, bukan bagian
katalog premium. Selama belum ada:

- **Kondisi pembeli** (seberapa ramai pesaing) — tetap contoh.
- **Ruang usaha yang disewakan** — tetap contoh; gerbang ketersediaan ruang
  masih berjalan sebagai penampung yang ditandai jelas.

Bila dataset misi sudah muncul di akun, ia akan hadir sebagai **proyek terpisah**
yang dibagikan, bukan sebagai entri katalog. Buka proyeknya di editor, ambil
`project_id` dari URL, lalu jalankan skrip dengan `MAPID_PROJECT_ID=<id>`.

---

## 5. Endpoint yang sudah terverifikasi

Semuanya memakai `MAPID_API_KEY` (baca saja).

```
# daftar layer dalam satu proyek
GET https://geoserver.mapid.io/layers_new/get_layer_list
      ?api_key=<KEY>&project_id=<PROJECT_ID>

# isi satu layer — WAJIB pakai limit, lihat §1
GET https://geoserver.mapid.io/layers_new/get_layer
      ?api_key=<KEY>&layer_id=<LAYER_ID>&project_id=<PROJECT_ID>&limit=100000

# jumlah dataset per kategori katalog (tanpa autentikasi)
GET https://server.mapid.io/moneys_bun/get_data_premium_count

# menelusuri layer PUBLIK — parameternya `skip`, 20 baris per halaman
GET https://geoserver.mapid.io/layers_new/search_layers_public/<istilah>
      ?skip=<n>&api_key=<KEY>

# metadata satu layer, tanpa isi (boleh untuk layer milik siapa pun)
GET https://geoserver.mapid.io/layers/get_detail_wo_geojson_by_link/<LAYER_ID>
      ?api_key=<KEY>
```

Endpoint pencarian pada `server.mapid.io/moneys_bun/search_layers` memakai nama
parameter **`search_params`**, bukan `search`/`q`/`keyword`, dan digeser dengan
**`skip`**, bukan `page`/`limit`. Inilah sebab kesimpulan lama bahwa "katalog
tidak bisa ditelusuri": parameter yang tidak dikenal diabaikan diam-diam,
sehingga tiap tebakan mengembalikan halaman pertama tanpa filter dan tampak
seperti pencarian yang tidak didukung. Nama yang benar dibaca dari kode sumber
antarmuka GEO MAPID.

**Koreksi.** Dokumen ini sempat menyatakan dataset premium bisa dibaca langsung
lewat `get_layer` tanpa impor. Itu keliru — yang diuji waktu itu kebetulan layer
yang sudah ada di proyek kita. Layer milik orang lain menolak dengan
`{"is_owner_project": false, "is_owner_layer": false}`, dan `get_layer_point`
menjawab `"No token"`. Membaca isi layer memerlukan kepemilikan; **impor tetap
wajib**, dan itu operasi tulis yang perlu sesi login pengguna.

Basemap MAPID MAPS memerlukan kunci **Map Service** yang berbeda (Dashboard →
Map Services → API Keys); kunci ini ditolak 401 di `basemap.mapid.io`. Format
gayanya: `https://basemap.mapid.io/styles/street-2d-building/style.json?key=…`
(juga `street`, `satellite`, `dark`, `light`) → isi ke `PUBLIC_MAPID_STYLE_URL`.
