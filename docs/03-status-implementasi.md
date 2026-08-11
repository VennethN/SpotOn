# Status implementasi terhadap ketentuan panitia

Dibandingkan langsung dengan [00-ketentuan-kompetisi.md](00-ketentuan-kompetisi.md),
bagian B.2 (komponen wajib), B.5 (struktur), dan C (peran AI).

Legenda: ✅ selesai · 🟡 sebagian · ⬜ belum

## B.2 Komponen wajib WebGIS

| Komponen | Status | Di mana |
|---|---|---|
| Peta interaktif jadi elemen utama | ✅ | [`MapView.svelte`](../src/lib/components/MapView.svelte) — peta full-bleed, panel mengambang di atasnya |
| Basemap **MAPID MAPS** | 🟡 | Basemap dapat ditukar lewat env `PUBLIC_MAPID_STYLE_URL`; sementara memakai raster terbuka karena kunci gaya MAPID belum ada |
| Zoom | ✅ | Kontrol zoom kustom + scroll/pinch |
| Klik objek | ✅ | Klik catchment → panel detail |
| Filter data | ✅ | Jenis usaha, bobot permintaan/persaingan, gerbang ruang usaha, radius |
| Tabel lokasi & tabel atribut | ✅ | [`AttributeTable.svelte`](../src/lib/components/AttributeTable.svelte), dapat diurutkan per kolom |
| Layer control | ✅ | [`ControlPanel.svelte`](../src/lib/components/ControlPanel.svelte) |
| Visualisasi data (grafik/chart) | ✅ | Profil 24 jam transaksi + bar peluang lintas kategori di [`DetailPanel.svelte`](../src/lib/components/DetailPanel.svelte) |
| **AI di dalam interface** | ✅ | [`AiPanel.svelte`](../src/lib/components/AiPanel.svelte) → `POST /api/ai/query` |
| Akses publik (Vercel) | 🟡 | Adapter Vercel sudah terpasang; belum dideploy |

## B.5 Struktur WebGIS yang direkomendasikan

| Bagian | Status | Di mana |
|---|---|---|
| Beranda / Overview | ✅ | Landing page di `/` — masalah, metode, dan ringkasan insight |
| Peta Interaktif | ✅ | `/app` |
| Analisis dan Insight | ✅ | Panel detail + tabel atribut |
| Interaksi AI di dalam interface | ✅ | Panel AI |
| AI Insight (ringkasan, perbandingan, rekomendasi) | ✅ | Intent `RANK`, `COMPARE`, `FLAG_SATURATED`, `COVERAGE` di [`nlq.ts`](../src/lib/nlq.ts) |
| Survey Activities | ⬜ | Baru muncul sebagai daftar prioritas catchment "belum terdata"; halaman khusus belum ada |
| Metodologi dan Sumber Data | 🟡 | Ringkas di panel provenans & landing; halaman metodologi penuh belum ada |
| Rekomendasi | ✅ | Daftar ter-ranking + justifikasi "Kenapa di sini?" |

## C. Peran AI

| Ketentuan | Status | Catatan |
|---|---|---|
| AI menghasilkan output spasial | ✅ | Jawaban AI mengubah highlight di peta dan me-ranking catchment, bukan sekadar teks |
| Alur input → proses → output → validasi dijelaskan | ✅ | Query terstruktur ditampilkan apa adanya; tiap klaim menyertakan N titik data |
| **Lapis A — pengayaan data dari foto** | ⬜ | Klasifikasi tier formalitas & kualitas storefront belum dikerjakan; butuh dataset misi asli |
| **Lapis B — mesin rekomendasi di interface** | 🟡 | Parsing niat masih rule-based di server; kontraknya sudah disiapkan agar bisa ditukar LLM + function-calling tanpa mengubah UI |

## Utang teknis yang perlu diselesaikan

1. **Basemap MAPID MAPS** — wajib pada produk final. Tinggal isi `PUBLIC_MAPID_STYLE_URL`.
2. **Sumber data asli** — ganti `loadCatchments()` di [`src/lib/server/source.ts`](../src/lib/server/source.ts)
   dengan pemanggilan API MAPID. Kontrak `Catchment` tidak perlu berubah.
3. **LLM sungguhan pada `/api/ai/query`** — ganti `parseQuestion()` dengan function-calling.
   Perhitungan skor tetap di server supaya angka tidak pernah datang dari model.
4. **Halaman survey activities & metodologi** sesuai B.5.
5. **Klasifikasi visual (Lapis A)** setelah dataset misi asli tersedia.
