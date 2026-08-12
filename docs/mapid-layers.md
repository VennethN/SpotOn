<!-- Dihasilkan `node scripts/fetch-mapid.mjs` — jangan disunting tangan. -->

# Dataset MAPID yang dibaca SpotOn

55 dataset katalog premium + 5 layer khas proyek · 24.614 titik unik setelah 11.462 duplikat dibuang.

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

### BRAND COFFEE SHOP — menutup `kopi`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `BRAND COFFEE SHOP DI KOTA ADM JAKARTA PUSAT 2026` | 277 | 277 | [layer](https://geo.mapid.io/layer/6a6c553229f45f1dcbac5511) |
| JAKARTA BARAT | `BRAND COFFEE SHOP DI KOTA ADM JAKARTA BARAT 2026` | 270 | 270 | [layer](https://geo.mapid.io/layer/6a6c552b29f45f1dcbac4e66) |
| JAKARTA SELATAN | `BRAND COFFEE SHOP DI KOTA ADM JAKARTA SELATAN 2026` | 529 | 529 | [layer](https://geo.mapid.io/layer/6a6c553829f45f1dcbac569a) |
| JAKARTA TIMUR | `BRAND COFFEE SHOP DI KOTA ADM JAKARTA TIMUR 2026` | 237 | 237 | [layer](https://geo.mapid.io/layer/6a6c553ed46504ea7d4af5cf) |
| JAKARTA UTARA | `BRAND COFFEE SHOP DI KOTA ADM JAKARTA UTARA 2026` | 190 | 190 | [layer](https://geo.mapid.io/layer/6a6c554429f45f1dcbac66a4) |

### MINUMAN — menutup `kopi`, `minuman`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `MINUMAN DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 284 | 284 | [layer](https://geo.mapid.io/layer/695778a34b943372f06aac24) |
| JAKARTA BARAT | `MINUMAN DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 342 | 342 | [layer](https://geo.mapid.io/layer/695778994b943372f06aa91d) |
| JAKARTA SELATAN | `MINUMAN DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 273 | 273 | [layer](https://geo.mapid.io/layer/695778ac2e0b60c56dfa4e03) |
| JAKARTA TIMUR | `MINUMAN DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 272 | 272 | [layer](https://geo.mapid.io/layer/695778b42e0b60c56dfa50f1) |
| JAKARTA UTARA | `MINUMAN DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 305 | 305 | [layer](https://geo.mapid.io/layer/695778bd4b943372f06ab024) |

### ROTI DAN KUE — menutup `roti`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `ROTI DAN KUE DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2026` | 267 | 267 | [layer](https://geo.mapid.io/layer/69d8a5bb9bfe4509be033724) |
| JAKARTA BARAT | `ROTI DAN KUE DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2026` | 418 | 418 | [layer](https://geo.mapid.io/layer/69d8aa811adb68b4b720257a) |
| JAKARTA SELATAN | `ROTI DAN KUE DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2026` | 540 | 540 | [layer](https://geo.mapid.io/layer/69d8a5c29bfe4509be033950) |
| JAKARTA TIMUR | `ROTI DAN KUE DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2026` | 342 | 342 | [layer](https://geo.mapid.io/layer/69d8a5cb9bfe4509be033c19) |
| JAKARTA UTARA | `ROTI DAN KUE DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2026` | 302 | 302 | [layer](https://geo.mapid.io/layer/69d8a5d31adb68b4b71e7935) |

### RESTORAN — menutup `warung`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `RESTORAN DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 1.160 | 1.160 | [layer](https://geo.mapid.io/layer/67dd5d38f7bf214f06cd5878) |
| JAKARTA BARAT | `RESTORAN DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 1.246 | 1.246 | [layer](https://geo.mapid.io/layer/67dd5d257df91cc44240f9f5) |
| JAKARTA SELATAN | `RESTORAN DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 1.519 | 1.519 | [layer](https://geo.mapid.io/layer/67dd5d4a0a196db6d4a4e360) |
| JAKARTA TIMUR | `RESTORAN DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 1.387 | 1.387 | [layer](https://geo.mapid.io/layer/67dd5d5e5b1d342645b9c28a) |
| JAKARTA UTARA | `RESTORAN DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 1.080 | 1.080 | [layer](https://geo.mapid.io/layer/67dd5d700468ddc2b8e71594) |

### MAKANAN DAN MINUMAN — menutup `kopi`, `minuman`, `roti`, `warung`

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

### TOKO KELONTONG — menutup `kelontong`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `TOKO KELONTONG DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 341 | 341 | [layer](https://geo.mapid.io/layer/67dbc4570468ddc2b8dd0284) |
| JAKARTA BARAT | `TOKO KELONTONG DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 530 | 530 | [layer](https://geo.mapid.io/layer/67dbc44d7fefcb01f4c62bb9) |
| JAKARTA SELATAN | `TOKO KELONTONG DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 730 | 730 | [layer](https://geo.mapid.io/layer/67dbc4615b1d342645af627a) |
| JAKARTA TIMUR | `TOKO KELONTONG DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 729 | 729 | [layer](https://geo.mapid.io/layer/67dbc46d0468ddc2b8dd0504) |
| JAKARTA UTARA | `TOKO KELONTONG DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 377 | 377 | [layer](https://geo.mapid.io/layer/67dbc478f7bf214f06c31dde) |

### LAYANAN ATAU JASA — menutup `laundry`, `bengkel`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `LAYANAN ATAU JASA DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 2.528 | 778 | [layer](https://geo.mapid.io/layer/68706c9e6637c4000c06861f) |
| JAKARTA BARAT | `LAYANAN ATAU JASA DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 3.346 | 952 | [layer](https://geo.mapid.io/layer/68706c8a8f90e7e6b7abf5c1) |
| JAKARTA SELATAN | `LAYANAN ATAU JASA DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 3.494 | 958 | [layer](https://geo.mapid.io/layer/68706cb06637c4000c068a2e) |
| JAKARTA TIMUR | `LAYANAN ATAU JASA DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 3.665 | 1.253 | [layer](https://geo.mapid.io/layer/68706cc5e962496bc7671c3c) |
| JAKARTA UTARA | `LAYANAN ATAU JASA DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 2.261 | 690 | [layer](https://geo.mapid.io/layer/68706cd9e962496bc7672153) |

### PERAWATAN DAN PERBAIKAN OTOMOTIF — menutup `bengkel`

| Kota | Dataset | Fitur | Terpakai | Buka |
|---|---|--:|--:|---|
| JAKARTA PUSAT | `PERAWATAN DAN PERBAIKAN OTOMOTIF DI KOTA ADMINISTRASI JAKARTA PUSAT TAHUN 2025` | 138 | 138 | [layer](https://geo.mapid.io/layer/6898777375e26a15bb7c58aa) |
| JAKARTA BARAT | `PERAWATAN DAN PERBAIKAN OTOMOTIF DI KOTA ADMINISTRASI JAKARTA BARAT TAHUN 2025` | 199 | 199 | [layer](https://geo.mapid.io/layer/6898776b4f6ff4f55cd0b285) |
| JAKARTA SELATAN | `PERAWATAN DAN PERBAIKAN OTOMOTIF DI KOTA ADMINISTRASI JAKARTA SELATAN TAHUN 2025` | 197 | 197 | [layer](https://geo.mapid.io/layer/6898777b6e7e42814b076606) |
| JAKARTA TIMUR | `PERAWATAN DAN PERBAIKAN OTOMOTIF DI KOTA ADMINISTRASI JAKARTA TIMUR TAHUN 2025` | 206 | 206 | [layer](https://geo.mapid.io/layer/68987783dd94b8be2bbbd27f) |
| JAKARTA UTARA | `PERAWATAN DAN PERBAIKAN OTOMOTIF DI KOTA ADMINISTRASI JAKARTA UTARA TAHUN 2025` | 168 | 168 | [layer](https://geo.mapid.io/layer/6898778cdd94b8be2bbbd47b) |

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
| minuman | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| roti | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| warung | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| minimarket | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| kelontong | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| laundry | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| bengkel | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |
| apotek | 5/5 | JAKARTABARAT, JAKARTAPUSAT, JAKARTASELATAN, JAKARTATIMUR, JAKARTAUTARA |

Cakupan ditulis dari dataset yang berhasil dibaca, **bukan** disimpulkan dari titik
yang lolos klasifikasi. Dataset yang ada tapi kebetulan kosong tetap terhitung
"sudah dicek"; kota yang datasetnya tidak ada sama sekali tetap **belum dicek** dan
tidak boleh diberi nilai nol pesaing.
