# SpotOn

WebGIS rekomendasi *site-selection* berbasis AI untuk ritel & F&B di kawasan transit Jakarta.
Dibuat untuk **MAPID WebGIS Competition 2026 — Maps That Think!** oleh tim **Triple T**
(Universitas Bina Nusantara).

> Jangan tebak lokasi usaha. Tanya petanya.

Untuk setiap catchment berjalan kaki di sekitar stasiun transit, SpotOn membaca tiga sinyal
yang biasanya terserak — **permintaan** (Struk Go), **persaingan** (Menu Go), dan
**ketersediaan ruang usaha** (Properti Go) — lalu menghitung *Opportunity Score* per jenis
usaha dan menjelaskan alasannya dalam bahasa manusia.

## Menjalankan

```bash
npm install
npm run dev
```

| Rute | Isi |
|---|---|
| `/` | Landing page |
| `/app` | WebGIS: peta, panel kontrol, rekomendasi AI, tabel atribut |
| `/api/catchments` | Indikator mentah per catchment |
| `/api/scores?kategori=kopi&wd=0.5&ws=0.5&gate=1&radius=800` | Opportunity Score terhitung |
| `/api/meta` | Kategori usaha, cakupan data, provenans, dan model bahasa yang sedang aktif |
| `/api/ai/query` | `POST { question, kategori, weights }` → rekomendasi ter-ranking |

## Struktur

```
src/lib/
  data/            kisi heksagon + simpul transit
  server/source.ts satu-satunya tempat sumber data ditentukan  ← tukar di sini saat API MAPID siap
  scoring.ts       mesin Opportunity Score (dipakai server dan klien)
  nlq.ts           pertanyaan bahasa natural → query terstruktur → jawaban
  narrate.ts       hasil mesin skor → kalimat Tapak (dipakai /app dan landing)
  tapak.svelte.ts  percakapan pemandu di dalam aplikasi
  three/           maket isometrik: adegan jalan + model cahaya 24 jam
  motion.svelte.ts pegas, proyeksi momentum, rubber-banding
  state.svelte.ts  status antarmuka (rune, disebar lewat context)
  components/      panel WebGIS + komponen landing
src/routes/
  +page.svelte     landing
  +page.server.ts  angka & percakapan contoh landing, dihitung mesin skor
  app/             WebGIS
  api/             endpoint
docs/              ketentuan kompetisi, proposal, dan status implementasi
```

## Data

**Nyata (OSM).** 1.110 simpul transit empat moda (MRT 20, KRL 64, LRT 33, TransJakarta 993),
geometri jalur keempatnya, dan 7.577 POI pesaing lima kategori — dari OpenStreetMap via
Overpass API (ODbL). Akses transit tiap petak dihitung dari data ini.

Satuan spasialnya **heksagon H3 resolusi 8** (sisi ±531 m), bukan catchment per halte:
halte TransJakarta berjarak 400–500 m sedangkan jangkauan jalan kaki 800 m, sehingga
catchment per halte akan bertumpuk dan menghitung pembeli yang sama berulang kali. Pada
kisi, tiap petak dihitung sekali dan akses transit jadi sifat petak — lokasi yang dilayani
MRT sekaligus TransJakarta memang bernilai lebih tinggi.

Bangun ulang datanya:

```bash
node scripts/build-hexes.mjs    # kisi + akses transit + pesaing  → src/lib/data/hexes.json
node scripts/build-routes.mjs   # geometri jalur 4 moda           → static/data/routes.json
```

**Contoh (mock).** Atribut khas dataset misi MAPID (Struk Go, Menu Go, Properti Go) karena
datasetnya baru dibuka untuk 50 tim terkurasi. Strukturnya mengikuti kolom asli, dan seluruh
akses data melewati `src/lib/server/source.ts` — jadi penggantian ke API MAPID tidak menyentuh UI.

Catchment tanpa data ditampilkan sebagai **"belum terdata"**, tidak pernah diinterpolasi.
Setiap skor disertai N titik data di baliknya.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu isi.

| Variabel | Isi |
|---|---|
| `OPENROUTER_API_KEY` | Kunci OpenRouter untuk lapisan pemahaman bahasa. **Boleh kosong** — tanpa kunci, pertanyaan diurai pengurai aturan cadangan dan aplikasi tetap berjalan. |
| `OPENROUTER_MODEL` | Opsional — nama model apa pun yang dilayani OpenRouter, mis. `anthropic/claude-sonnet-5` atau `openai/gpt-5`. Dibaca saat runtime, jadi menggantinya di Vercel tidak perlu build ulang. Kosong → default `anthropic/claude-sonnet-5`. Model yang sedang aktif dapat diperiksa di `GET /api/meta` (kuncinya sendiri tidak pernah ikut). |
| `PUBLIC_MAPID_STYLE_URL` | URL gaya MAPID MAPS. Bila kosong, dipakai basemap raster terbuka (OpenStreetMap/CARTO) — **wajib diisi untuk produk final.** |

### Pembagian tugas model dan mesin skor

Model **hanya memahami** pertanyaan: ia memilih operasi dan mengisi argumennya lewat
function-calling, lalu berhenti. Seluruh angka — skor, permintaan, cacah pesaing, N —
dihitung `src/lib/scoring.ts` dari data, sama persis dengan yang dipakai peta dan tabel.
Karena itu tidak ada nilai yang bisa dikarang model.

Bila pertanyaannya di luar jangkauan data, model memanggil `tidak_dimengerti` dan
antarmuka mengakuinya, bukan menjawab pertanyaan yang salah ditafsirkan. Setiap respons
menyertakan `parsedBy` (`model` atau `aturan`) supaya jalur yang dipakai tidak disamarkan.

## Deploy (Vercel)

Sudah memakai `@sveltejs/adapter-vercel`.

```bash
npx vercel deploy
```

Atau hubungkan repositori ini ke Vercel: framework SvelteKit terdeteksi otomatis, tanpa
konfigurasi build tambahan. Isi `PUBLIC_MAPID_STYLE_URL` di Environment Variables.

## Perintah lain

```bash
npm run check    # typecheck + a11y
npm run build    # build produksi
npm run preview  # jalankan hasil build
```
