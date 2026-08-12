# Data MAPID — status, cakupan, dan cara mengambilnya

Bagaimana data MAPID masuk ke SpotOn, endpoint apa saja yang sudah terverifikasi,
sejauh mana cakupannya sekarang, dan apa lagi yang tersedia di katalog premium.

Daftar dataset yang benar-benar dibaca ada di
[`mapid-layers.md`](mapid-layers.md) — dihasilkan skrip, selalu mutakhir.

---

## 1. Cara kerjanya

Satu perintah, tanpa langkah manual:

```bash
node scripts/fetch-mapid.mjs   # cari + baca dari katalog  → mapid-poi.json, mapid-layers.md
node scripts/join-mapid.mjs    # gabungkan ke kisi         → hexes.json
```

`fetch-mapid.mjs` mencari sendiri dataset yang dibutuhkan di katalog premium,
membacanya langsung, mengklasifikasikan tiap titik ke lima kategori SpotOn, lalu
menulis berkas titik beserta deklarasi cakupannya. Tidak ada id yang perlu
disalin tangan dan tidak ada tombol yang perlu ditekan.

Dataset apa yang dicari ditentukan `MANIFEST` di dalam skrip itu. Untuk
menjelajah katalog sebelum menambah entri baru ke manifest:

```bash
node scripts/search-mapid.mjs                 # lima kategori SpotOn
node scripts/search-mapid.mjs APOTEK ATM      # istilah bebas
node scripts/search-mapid.mjs --kota "BANDUNG,SURABAYA" PASAR
```

### Koreksi: impor manual ternyata tidak pernah wajib

Dokumen ini sempat menyatakan sebaliknya, dengan yakin, dan itu keliru — layak
dicatat karena kekeliruannya bukan pada endpoint melainkan pada cara
menyimpulkan.

Kesimpulan lamanya: isi layer premium hanya bisa dibaca setelah datasetnya
diimpor ke proyek sendiri lewat antarmuka GEO MAPID, karena `get_layer` menolak
layer milik orang lain dengan `{"is_owner_project": false, "is_owner_layer":
false}`. Bunyi penolakannya memang mengesankan pemeriksaan kepemilikan layer.

Yang terlewat: penolakan itu datang dari **`project_id`** yang dikirim, bukan
dari `layer_id`. Percobaan waktu itu memakai `project_id` milik MAPID Database —
proyek yang memang bukan milik kita, jadi wajar ditolak. Server memeriksa
"apakah pemanggil memiliki proyek ini", lalu menyajikan layer yang diminta; ia
tidak pernah memeriksa apakah layer itu benar-benar anggota proyek tersebut.

`layer_id` katalog + `project_id` **milik sendiri** = 200 dengan isi lengkap.

Satu percobaan yang salah parameter menghasilkan "tidak boleh" yang bertahan
berminggu-minggu dan memaksa tiap penambahan kota lewat antarmuka. Pelajarannya
sama dengan `admin_level=6` yang diam-diam mengembalikan kecamatan: hasil yang
masuk akal bukan bukti pemanggilannya benar.

### Proyek GEO MAPID masih dibaca

Bukan lagi sebagai sumber utama, melainkan karena **dataset misi kompetisi akan
datang sebagai proyek terpisah yang dibagikan** — bukan sebagai entri katalog.
Layer di proyek yang ternyata salinan dataset katalog dikenali dari namanya
(akhiran `IMPORTED AT …`) dan dilewati supaya tidak ditarik dua kali.

Proyek: `6a7c1672fb8d434002151fa7`, diubah lewat `MAPID_PROJECT_ID`. Perhatikan
bahwa nilai ini kini punya dua peran sekaligus: ia menentukan proyek mana yang
dipindai **dan** menjadi tiket baca ke katalog. Isi dengan proyek yang benar-benar
milik akun pemegang `MAPID_API_KEY`.

### Tiga jebakan yang sudah kena sekali

**`get_layer` memotong di 200 fitur tanpa memberi tahu.** Tidak ada penanda
"masih ada lagi" pada responsnya, jadi pengambilan yang terpotong terlihat
sukses sempurna. RESTORAN Jakarta Barat sebenarnya 1.246 titik; tanpa `&limit=`
eksplisit 84% hilang diam-diam. Sudah diperbaiki, dan `readLayer` sekarang
**melempar galat** bila hasilnya menyentuh batas — supaya pemotongan berikutnya
tidak bisa lewat tanpa suara.

**Jangan menebak kategori dari kolom `NAMA`.** Satu halte TransJakarta pernah
terhitung sebagai minimarket karena namanya memuat "MART". Pesaing palsu menekan
skor petak yang sebenarnya kosong — persis kebalikan dari yang dicari.
Klasifikasi hanya membaca `TIPE_1/2/3`.

**Pencarian katalog memakai `search_params`,** bukan `search`, `q`, atau
`keyword`. Parameter yang tidak dikenal diabaikan diam-diam, jadi tiap tebakan
mengembalikan halaman pertama tanpa filter dan tampak seperti "pencarian tidak
didukung". Ini sebab kesimpulan lama bahwa katalog tidak bisa ditelusuri dari
skrip.

### Prasyarat menjalankan skrip

**Kunci.** `MAPID_API_KEY` dibaca dari variabel lingkungan lebih dulu, baru dari
`.env` (lihat `.env.example`). Yang dari lingkungan menang, jadi kunci lain bisa
diuji sekali jalan tanpa menyunting berkas:

```bash
MAPID_API_KEY=<kunci lain> node scripts/fetch-mapid.mjs
```

**Jaringan.** Skrip perlu akses keluar ke `geoserver.mapid.io` dan
`server.mapid.io`; `join-mapid.mjs` juga ke cermin Overpass (`overpass-api.de`
dan kawan-kawan) untuk batas administrasi. Keduanya sering diblokir di
lingkungan berpagar — kontainer CI, sesi remote, jaringan kantor dengan proksi.

Perlu diwaspadai karena mudah salah baca: bila proksi menolak, yang muncul
adalah `Gagal: get_layer_list: 403 Forbidden` — persis seperti kunci ditolak.
Bedakan sebelum mengganti kunci:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://geoserver.mapid.io/
# "CONNECT tunnel failed, response 403" = jaringan, bukan kunci.
```

---

## 2. Cakupan sekarang

25 dataset katalog premium, **15.835 titik unik** setelah 7.147 duplikat dibuang.

| Kategori SpotOn | Jakpus | Jakbar | Jaksel | Jaktim | Jakut | Titik |
|---|:--:|:--:|:--:|:--:|:--:|--:|
| kopi | ✅ | ✅ | ✅ | ✅ | ✅ | 895 |
| warung | ✅ | ✅ | ✅ | ✅ | ✅ | 8.813 |
| minimarket | ✅ | ✅ | ✅ | ✅ | ✅ | 2.928 |
| apotek | ✅ | ✅ | ✅ | ✅ | ✅ | 3.199 |
| laundry | — | — | — | — | — | 0 |

Empat dari lima kategori tercakup penuh di kelima kota administrasi.

**`laundry` tidak ada di katalog premium.** Ini kesimpulan yang berbeda sifatnya
dari sebelumnya. Dulu jawaban "tidak ketemu" datang dari
`search_layers_public`, yang hanya mengindeks layer publik dan karena itu tidak
bisa membedakan "tidak ada" dari "tidak terlihat dari sini" — `APOTEK` pernah
dilaporkan begitu padahal ada lengkap untuk kelima kota. Sekarang pencarian
memakai endpoint katalog premium yang sebenarnya, jadi kosong berarti memang
kosong. `LAUNDRY` tetap tinggal di manifest supaya ketiadaannya diuji ulang tiap
kali skrip jalan, bukan pelan-pelan mengeras jadi asumsi.

Sel bertanda **—** diperlakukan sebagai **belum tercakup**, bukan nol pesaing.
Ini konsekuensi langsung dari prinsip proyek: ketiadaan data bukan bukti
ketiadaan usaha. Petak tidak boleh mendapat skor tinggi hanya karena pesaingnya
belum terdata.

Layer HALTE (606 titik, khas proyek) sengaja tidak dipakai — akses transit sudah
dihitung dari OSM untuk empat moda, dan HALTE MAPID hanya mencakup sebagian kota.

### Cakupan dideklarasikan, bukan disimpulkan dari titik

Dulu daftar "kota mana yang tercakup" dihitung mundur dari `KABKOT` titik yang
lolos klasifikasi. Itu mencampur dua hal yang justru menjadi inti janji proyek
ini: dataset yang **tidak ada**, dan dataset yang **ada tapi kebetulan nol baris**
setelah disaring. Keduanya menghasilkan nol titik, padahal yang pertama berarti
"belum dicek" dan yang kedua "sudah dicek, memang kosong".

Sekarang `fetch-mapid.mjs` menuliskan cakupan dari manifest: begitu dataset
sebuah kota berhasil dibaca, kota itu tercakup untuk kategori yang dijanjikan
dataset tersebut — berapa pun titik yang akhirnya lolos. `join-mapid.mjs`
membaca deklarasi itu apa adanya dan tidak menyimpulkan ulang.

Perhatikan bahwa satu dataset bisa menutup dua kategori: `MAKANAN DAN MINUMAN`
memuat kedai kopi **dan** rumah makan, jadi keberadaannya menutup `kopi` dan
`warung` sekaligus.

### Hasil penggabungan (`node scripts/join-mapid.mjs`)

- 537 dari 558 petak berhasil ditentukan kotanya (21 sisanya di luar 14 wilayah
  yang diambil — Bodetabek terluar).
- **1.828** pasangan petak×kategori tercakup, 962 belum — sebelumnya 515 dan
  2.275.
- Pesaing MAPID terhitung: kopi 1.768, warung 16.114, minimarket 5.143,
  apotek 5.720 pengamatan.

Pesaing dihitung dalam radius jalan kaki 800 m dari titik pusat petak. Total
pengamatan lebih besar daripada jumlah titik karena satu gerai bisa berada dalam
jangkauan beberapa petak sekaligus — memang begitu definisinya ("pesaing dalam
jarak jalan kaki dari petak ini"), bukan pembagian wilayah.

Cakupan ditentukan **per kota administrasi** memakai batas OSM `admin_level=5`,
bukan dari kedekatan POI. Sempat memakai `admin_level=6` dan yang kembali justru
kecamatan (Kebon Jeruk, Cilincing, Pulo Gadung) — tidak ada yang cocok dengan
`KABKOT`, sehingga seluruh petak salah ditandai "belum tercakup" tanpa satu pun
galat muncul. Perlu diperiksa hasilnya, bukan hanya status keluarannya.

**Penetapan kota dipakai ulang.** Petak mana ada di kota mana hanya berubah
kalau kisinya berubah, sedangkan skrip ini jalan tiap kali data MAPID
diperbarui. Menarik ulang batas tiap kali menggantungkan seluruh penggabungan
pada layanan paling rapuh di jalur ini — satu putaran pernah habis tujuh menit
lalu gagal `503` karena semua cermin Overpass penuh, padahal jawabannya sudah
tersimpan di `hexes.json` dan tidak berubah sedikit pun. Tarik ulang dengan:

```bash
node scripts/join-mapid.mjs --refresh-kota   # setelah build-hexes.mjs
```

Di peta, tiga keadaan dibedakan: petak bernilai diwarnai skala peluang, petak
**belum terdata** diarsir, dan petak **belum tercakup** hanya digariskan
putus-putus tanpa isi.

### Efek saklar sumber pada penilaian

Dari 558 petak, 89 **belum terdata** dan tidak pernah dinilai sumber mana pun.

| Kategori | Dinilai (OSM) | Dinilai (MAPID) | Belum tercakup |
|---|--:|--:|--:|
| kopi | 469 | 382 | 87 |
| warung | 469 | 382 | 87 |
| minimarket | 469 | 382 | 87 |
| apotek | 469 | 382 | 87 |
| laundry | 469 | 0 | 469 |

Selisih 87 petak adalah Bodetabek: katalog MAPID memberi dataset per kota
administrasi DKI, sedangkan kisi SpotOn membentang sedikit lebih luas. Itu
cakupan yang tercermin apa adanya, bukan kerusakan.

Sebelumnya kolom MAPID berbunyi kopi 382, warung 46, sisanya 0.

### Belum tersambung ke skor

Data MAPID sudah menempel di `hexes.json` sebagai `mapid` dan `covered`, dan
saklar **OSM | MAPID** di bilah atas sudah memilih di antara keduanya —
keduanya lepas, tidak pernah dicampur dalam satu skor.

Yang masih terbuka: **mana yang jadi bawaan.** Alasan lama untuk bertahan di OSM
sudah hilang — cakupan MAPID tidak lagi timpang satu kota, melainkan penuh di
empat dari lima kategori, dan lebih rapat daripada OSM di semuanya. Yang tersisa
tinggal `laundry`, yang akan tampil sebagai kolom kosong pada sumber MAPID.
Putuskan itu dulu sebelum menukar bawaannya.

---

## 3. Yang bisa didapat di luar lima kategori

Katalog premium punya 16 kategori (~90.000 dataset). Semuanya kini terbaca lewat
jalur yang sama — menambahkan satu kategori berarti menambah satu baris ke
`MANIFEST`, bukan sesi impor manual.

Yang menarik bukan menambah jenis usaha, melainkan **menambal permintaan** —
satu-satunya sinyal yang masih sepenuhnya contoh.

Sudah diverifikasi tersedia untuk kelima kota DKI lewat `search-mapid.mjs`:

| Dataset | Buat SpotOn |
|---|---|
| `APARTEMEN` | Kepadatan hunian = pembeli yang tinggal di sana. Penghasil permintaan, bukan pesaing. |
| `PUSAT PERBELANJAAN` | Mal = pengunjung siang hari yang bukan penduduk setempat. |
| `PASAR` | Penarik kunjungan harian; menjelaskan keramaian yang bukan dari penduduk setempat. |
| `ATM` | Proksi aktivitas komersial dan ekonomi tunai. |
| `RUMAH SAKIT`, `KLINIK` | Penghasil permintaan sekaligus pelengkap kategori apotek. |
| `SEKOLAH` | Populasi harian yang berulang dan mudah diprediksi. |
| `HOTEL` | Kunjungan non-penduduk. |

Dicari dan **tidak ada** di katalog: `LAUNDRY`, `BINATU`, `SPBU`, `PERKANTORAN`,
`MALL`. Dua yang terakhir bukan berarti datanya tidak ada — `PUSAT PERBELANJAAN`
menutup `MALL`, dan kantor kemungkinan tersimpan di bawah nama lain pada
kategori Pemerintah. Nama istilah di katalog tidak selalu yang pertama terpikir;
telusuri dengan `search-mapid.mjs` sebelum menyimpulkan.

Kategori katalog yang belum ditelusuri per dataset, dan kandidat terkuatnya:

| Kategori katalog | Jumlah | Buat SpotOn |
|---|--:|---|
| Sosial | 23.254 | **Statistik demografi.** Kandidat terkuat untuk mengganti `d` (permintaan) yang sekarang dikarang. |
| Retail | 19.980 | Minimarket tingkat merek (`ALFAMART`, `212 MART`) — lebih tajam daripada satu kelas "minimarket". |
| Kesehatan | 7.206 | Sudah dipakai untuk apotek; rumah sakit juga penghasil permintaan. |
| Transportasi | 5.599 | Sudah tertutup OSM untuk empat moda; nilai tambahnya kecil. |
| Lingkungan | 4.770 | Indikator kesejahteraan; relevansinya tidak langsung. |
| Penelitian | 4.134 | `NIGHT TIME LIGHT` — proksi aktivitas ekonomi dari citra malam, mapan di literatur, dan ada persis di tempat data survei tidak ada. |
| Perumahan | 4.063 | Sisi penduduk dari permintaan. |
| Pemerintah | 3.966 | Kantor = populasi pekerja siang hari. |
| Layanan TI | 2.649 | `ATM` sebagai proksi aktivitas ekonomi. |
| Pariwisata | 1.936 | Penarik kunjungan. |
| Perencanaan Kota | 719 | Batas administrasi rapi — berguna untuk pelabelan petak dan agregasi per kecamatan. |
| Manufaktur / Energi / Iklim / Barang Konsumsi | — | Belum ada kaitan jelas dengan pemilihan lokasi ritel. |

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
`project_id` dari URL (`/editor/<id>`), lalu jalankan skrip dengan
`MAPID_PROJECT_ID=<id>`. Layer di proyek itu akan terbaca sebagai "khas proyek"
dan ikut masuk tanpa perubahan kode.

---

## 5. Endpoint yang sudah terverifikasi

```
# menelusuri KATALOG PREMIUM — tanpa autentikasi, cocok AND per kata
GET https://server.mapid.io/moneys_bun/search_data_premium_v2
      ?search_params=<istilah>[&category_id=<id>]

# isi satu layer — layer_id boleh milik siapa pun selama layer-nya publik,
# project_id WAJIB milik sendiri, limit WAJIB eksplisit (lihat §1)
GET https://geoserver.mapid.io/layers_new/get_layer
      ?api_key=<KEY>&layer_id=<LAYER_ID>&project_id=<PROJECT_ID_SENDIRI>&limit=100000

# daftar layer dalam satu proyek milik sendiri
GET https://geoserver.mapid.io/layers_new/get_layer_list
      ?api_key=<KEY>&project_id=<PROJECT_ID>

# metadata satu layer tanpa isi — termasuk category_id, is_premium, dan
# geo_project pemiliknya. Boleh untuk layer milik siapa pun.
GET https://geoserver.mapid.io/layers/get_detail_wo_geojson_by_link/<LAYER_ID>
      ?api_key=<KEY>

# jumlah dataset per kategori katalog, beserta category_id tiap kategori
GET https://server.mapid.io/moneys_bun/get_data_premium_count

# daftar dataset premium satu kategori, 20 baris per halaman
GET https://server.mapid.io/moneys_bun/get_data_premium_by_category_id
      ?category_id=<id>&skip=<n>
```

Yang **tidak** dipakai lagi:

- `layers_new/search_layers_public/<istilah>?skip=<n>` — hanya mengindeks layer
  publik, tidak memuat katalog premium, dan mengembalikan proyek tugas kuliah
  orang lain yang namanya kebetulan mirip. Inilah sumber laporan palsu "APOTEK
  tidak terlihat".
- `layers_new/get_layer_point` — menjawab `"No token"`; perlu sesi login.

Nama parameter di atas dibaca dari kode sumber antarmuka GEO MAPID sendiri
(`https://geo.mapid.io/static/js/main.*.js`) — cara yang jauh lebih murah
daripada menebak, dan satu-satunya yang menemukan `search_params`.

`skip` diterima `search_data_premium_v2` tetapi **diabaikan** — jangan andalkan
paginasi di sana, persempit kuerinya. Karena pencocokannya AND per kata, kueri
seperti `APOTEK JAKARTA PUSAT` mengembalikan tepat satu dataset.

Basemap MAPID MAPS memerlukan kunci **Map Service** yang berbeda (Dashboard →
Map Services → API Keys); `MAPID_API_KEY` ditolak 401 di `basemap.mapid.io`.
Format gayanya: `https://basemap.mapid.io/styles/street-2d-building/style.json?key=…`
(juga `street`, `satellite`, `dark`, `light`) → isi ke `PUBLIC_MAPID_STYLE_URL`.
