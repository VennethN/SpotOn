<!-- Dihasilkan `node scripts/fetch-mapid.mjs` — jangan disunting tangan. -->

# Dataset MAPID yang dibaca SpotOn

25 dataset katalog premium + 5 layer khas proyek · 15.835 titik unik setelah 7.147 duplikat dibuang.

Semuanya dibaca **langsung dari katalog**, tanpa langkah impor. Yang dikirim ke
`get_layer` adalah `layer_id` katalog beserta `project_id` proyek kita sendiri —
server memeriksa kepemilikan proyek, bukan keanggotaan layer di dalamnya.

## Perlu disinkronkan manual?

**Tidak untuk menjalankan SpotOn.** Skrip menemukan dan membaca sendiri seluruh
dataset di bawah ini setiap kali dijalankan; berkas `mapid-poi.json` yang
dihasilkan sudah lengkap.

Impor lewat antarmuka GEO MAPID hanya perlu bila dataset ini ingin ikut terlihat
di dalam proyek — untuk ditata, digayakan, atau dipakai orang lain di tim. Daftar
lengkap beserta tautannya ada di bawah; tekan **Impor** di masing-masing.

## Katalog premium

### COFFEE SHOP — menutup `kopi`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `COFFEE SHOP DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 127 | 127 | [layer](https://geo.mapid.io/layer/6a4f888b7361c8b74fa7e6eb) |
| JAKARTA BARAT | `COFFEE SHOP DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 116 | 116 | [layer](https://geo.mapid.io/layer/6a4f88827361c8b74fa7e442) |
| JAKARTA SELATAN | `COFFEE SHOP DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 132 | 132 | [layer](https://geo.mapid.io/layer/6a4f88957361c8b74fa7ee8a) |
| JAKARTA TIMUR | `COFFEE SHOP DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 121 | 121 | [layer](https://geo.mapid.io/layer/6a4f889e7361c8b74fa7f48b) |
| JAKARTA UTARA | `COFFEE SHOP DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 120 | 120 | [layer](https://geo.mapid.io/layer/6a4f88a87361c8b74fa80568) |

### RESTORAN — menutup `warung`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `RESTORAN DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 1.160 | 1.160 | [layer](https://geo.mapid.io/layer/67dd5d38f7bf214f06cd5878) |
| JAKARTA BARAT | `RESTORAN DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 1.246 | 1.246 | [layer](https://geo.mapid.io/layer/67dd5d257df91cc44240f9f5) |
| JAKARTA SELATAN | `RESTORAN DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 1.519 | 1.519 | [layer](https://geo.mapid.io/layer/67dd5d4a0a196db6d4a4e360) |
| JAKARTA TIMUR | `RESTORAN DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 1.387 | 1.387 | [layer](https://geo.mapid.io/layer/67dd5d5e5b1d342645b9c28a) |
| JAKARTA UTARA | `RESTORAN DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 1.080 | 1.080 | [layer](https://geo.mapid.io/layer/67dd5d700468ddc2b8e71594) |

### MAKANAN DAN MINUMAN — menutup `kopi`, `warung`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `MAKANAN DAN MINUMAN DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 1.714 | 1.714 | [layer](https://geo.mapid.io/layer/6a4f91867361c8b74fb02008) |
| JAKARTA BARAT | `MAKANAN DAN MINUMAN DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 2.008 | 2.008 | [layer](https://geo.mapid.io/layer/6a4f916d7361c8b74fb01284) |
| JAKARTA SELATAN | `MAKANAN DAN MINUMAN DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 2.337 | 2.337 | [layer](https://geo.mapid.io/layer/6a4f919e7361c8b74fb02aff) |
| JAKARTA TIMUR | `MAKANAN DAN MINUMAN DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 2.001 | 2.001 | [layer](https://geo.mapid.io/layer/6a4f91b87361c8b74fb045dc) |
| JAKARTA UTARA | `MAKANAN DAN MINUMAN DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 1.690 | 1.690 | [layer](https://geo.mapid.io/layer/6a4f91d17361c8b74fb06006) |

### MINIMARKET — menutup `minimarket`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `MINIMARKET DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 455 | 455 | [layer](https://geo.mapid.io/layer/6833ee2ff387c959df7c5923) |
| JAKARTA BARAT | `MINIMARKET DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 627 | 627 | [layer](https://geo.mapid.io/layer/6833ee27eaa173655a6614fc) |
| JAKARTA SELATAN | `MINIMARKET DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 683 | 683 | [layer](https://geo.mapid.io/layer/6833ee37eaa173655a6617b7) |
| JAKARTA TIMUR | `MINIMARKET DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 656 | 656 | [layer](https://geo.mapid.io/layer/6833ee3ff387c959df7c5bb2) |
| JAKARTA UTARA | `MINIMARKET DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 561 | 561 | [layer](https://geo.mapid.io/layer/6833ee47e7404b7ed1aed095) |

### APOTEK — menutup `apotek`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `APOTEK DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 450 | 450 | [layer](https://geo.mapid.io/layer/68b66604b084399256322943) |
| JAKARTA BARAT | `APOTEK DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 728 | 728 | [layer](https://geo.mapid.io/layer/68b665fcfcc50dd6ecafd1c1) |
| JAKARTA SELATAN | `APOTEK DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 687 | 687 | [layer](https://geo.mapid.io/layer/68b6660c2a0cc6e332546b4d) |
| JAKARTA TIMUR | `APOTEK DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 815 | 815 | [layer](https://geo.mapid.io/layer/68b66615d199b43e04486c18) |
| JAKARTA UTARA | `APOTEK DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 562 | 562 | [layer](https://geo.mapid.io/layer/68b6661f7152587790a585b9) |

## Khas proyek

Ada di proyek GEO MAPID tapi bukan salinan dataset katalog di atas. Inilah jalan
masuk dataset misi kompetisi, yang datang sebagai proyek terpisah yang dibagikan.

| Dataset | Fitur | Terpakai |
|---|--:|--:|
| `HALTE DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2024 IMPORTED AT 12/AUG/2026` | 113 | 0 |
| `HALTE DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025 IMPORTED AT 12/AUG/2026` | 121 | 0 |
| `HALTE DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025 IMPORTED AT 12/AUG/2026` | 113 | 0 |
| `HALTE DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2024 IMPORTED AT 12/AUG/2026` | 140 | 0 |
| `HALTE DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025 IMPORTED AT 12/AUG/2026` | 119 | 0 |

## Cakupan yang dihasilkan

| Kategori | Kota tercakup | Keterangan |
|---|--:|---|
| kopi | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| warung | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| minimarket | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| laundry | 0/5 | **tidak ada dataset di katalog** |
| apotek | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |

Cakupan ditulis dari dataset yang berhasil dibaca, **bukan** disimpulkan dari titik
yang lolos klasifikasi. Dataset yang ada tapi kebetulan kosong tetap terhitung
"sudah dicek"; kota yang datasetnya tidak ada sama sekali tetap **belum dicek** dan
tidak boleh diberi nilai nol pesaing.

## Dicari, tidak ketemu

- **LAUNDRY** — kelima kota

Tetap dicari ulang setiap kali skrip jalan. Dibiarkan di manifest supaya
ketiadaannya terus diuji, bukan pelan-pelan berubah jadi asumsi — dan supaya
dataset ini terambil sendiri kalau suatu saat MAPID menerbitkannya.
