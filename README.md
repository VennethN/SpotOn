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

Berkas dikelompokkan menurut perannya, jadi tempat mencarinya bisa ditebak dari
apa yang mau diubah.

```
src/lib/
  types.ts       bentuk data yang dipakai semua lapisan
  data/          kisi heksagon + simpul transit
  domain/        aturan bisnis murni — tanpa DOM, dipakai server maupun klien
    scoring.ts     mesin Opportunity Score
    weights.ts     bobot bawaan + pembersih nilai (satu pintu)
    nlq.ts         pertanyaan → query terstruktur → jawaban
    narrate.ts     hasil mesin skor → kalimat manusia
    categories.ts  sembilan jenis usaha, tag OSM dan dataset MAPID-nya
  server/        hanya berjalan di server (dijaga SvelteKit)
    source.ts      satu-satunya tempat sumber data ditentukan  ← tukar di sini saat API MAPID siap
    llm.ts         lapisan pemahaman bahasa (OpenRouter)
    params.ts      query string → argumen mesin skor
  state/         rune yang hidup selama sesi
    app.svelte.ts    status antarmuka, disebar lewat context
    tapak.svelte.ts  percakapan pemandu
    theme.svelte.ts  terang/gelap/ikut-sistem
    lang.svelte.ts   Bahasa Indonesia / English
  i18n/          naskah dua bahasa: id.ts menentukan bentuknya, en.ts mengisinya
  utils/         pembantu murni: format.ts (angka, jam, warna skala), geo.ts, motion.svelte.ts
  scene/         maket isometrik: street.ts (blok jalan) + grid.ts (kisi heksagon)
                 + daylight.ts (model cahaya 24 jam) + world.ts (kontrak adegan)
  components/
    app/           permukaan WebGIS — komponen yang membaca AppState
    landing/       susunan khas halaman depan
    ui/            komponen tanpa status, dipakai kedua permukaan
src/routes/
  +page.svelte     landing
  +page.server.ts  angka & percakapan contoh landing, dihitung mesin skor
  app/             WebGIS
  api/             endpoint
scripts/         pembangun data (Overpass + MAPID); helper bersamanya di scripts/lib/
docs/            ketentuan kompetisi, proposal, dan status implementasi
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

**Nyata (MAPID).** 15.835 POI pesaing dari 25 dataset katalog data premium MAPID —
kopi, warung, minimarket, dan apotek, lengkap untuk kelima kota administrasi DKI.
Dibaca langsung dari katalog, tanpa langkah impor manual:

```bash
node scripts/fetch-mapid.mjs    # cari + baca dari katalog  → src/lib/data/mapid-poi.json
node scripts/join-mapid.mjs     # gabungkan ke kisi         → src/lib/data/hexes.json
```

Saklar **OSM | MAPID** di bilah atas memilih sumber mana yang menilai; keduanya lepas
dan tidak pernah dicampur dalam satu skor. `laundry` tidak ada di katalog premium, jadi
pada sumber MAPID ia tetap **belum tercakup** — bukan nol pesaing. Daftar dataset yang
dibaca ada di [`docs/mapid-layers.md`](docs/mapid-layers.md); rinciannya di
[`docs/04-data-mapid.md`](docs/04-data-mapid.md).

**Contoh (mock).** Atribut khas dataset misi MAPID (Struk Go, Menu Go, Properti Go) karena
datasetnya baru dibuka untuk 50 tim terkurasi. Strukturnya mengikuti kolom asli, dan seluruh
akses data melewati `src/lib/server/source.ts` — jadi penggantian ke API MAPID tidak menyentuh UI.

Catchment tanpa data ditampilkan sebagai **"belum terdata"**, tidak pernah diinterpolasi.
Setiap skor disertai N titik data di baliknya.

## Bahasa

Antarmuka tersedia dalam Bahasa Indonesia (bawaan) dan English; tombol ID/EN ada
di bilah atas kedua halaman dan pilihannya disimpan di peramban. Naskahnya ada di
`src/lib/i18n/`: `id.ts` yang menentukan bentuk kamusnya, `en.ts` mengisi bentuk
yang sama, dan TypeScript menolak build kalau ada kalimat yang tertinggal.

Yang ikut berganti: seluruh halaman depan, seluruh antarmuka aplikasi, kalimat
Tapak, dan instruksi bahasa untuk model (jadi kalimat "tidak paham" keluar dalam
bahasa pembacanya). Yang tetap Bahasa Indonesia: keluaran API (`headline`, `why`,
`evidence`, provenans) — itu kontrak untuk pemakai API, bukan teks yang dibaca
pengguna.

## Konfigurasi

Salin `.env.example` menjadi `.env`, lalu isi.

| Variabel | Isi |
|---|---|
| `OPENROUTER_API_KEY` | Kunci OpenRouter untuk lapisan pemahaman bahasa. **Boleh kosong** — tanpa kunci, pertanyaan diurai pengurai aturan cadangan dan aplikasi tetap berjalan. |
| `OPENROUTER_MODEL` | Opsional — nama model apa pun yang dilayani OpenRouter, mis. `anthropic/claude-sonnet-5` atau `openai/gpt-5`. Dibaca saat runtime, jadi menggantinya di Vercel tidak perlu build ulang. Kosong → default `anthropic/claude-sonnet-5`. Model yang sedang aktif dapat diperiksa di `GET /api/meta` (kuncinya sendiri tidak pernah ikut). |
| `PUBLIC_MAPID_STYLE_URL` | URL gaya MAPID MAPS. Bila kosong, dipakai basemap raster terbuka (OpenStreetMap/CARTO) — **wajib diisi untuk produk final.** |
| `MAPID_API_KEY` | Kunci API MAPID (baca saja) — dipakai **skrip data**, bukan aplikasinya. Boleh diberikan lewat variabel lingkungan, dan yang dari lingkungan menang atas `.env`. Beda dari kunci Map Service untuk `PUBLIC_MAPID_STYLE_URL`. Lihat [`docs/04-data-mapid.md`](docs/04-data-mapid.md). |
| `MAPID_PROJECT_ID` | Opsional — proyek GEO MAPID yang dibaca skrip. Kosong → proyek bawaan. |

### Pembagian tugas model dan mesin skor

Model **hanya memahami** pertanyaan: ia memilih operasi dan mengisi argumennya lewat
function-calling, lalu berhenti. Seluruh angka — skor, permintaan, cacah pesaing, N —
dihitung `src/lib/domain/scoring.ts` dari data, sama persis dengan yang dipakai peta dan tabel.
Karena itu tidak ada nilai yang bisa dikarang model.

Bila pertanyaannya di luar jangkauan data, model memanggil `tidak_dimengerti` dan
antarmuka mengakuinya, bukan menjawab pertanyaan yang salah ditafsirkan. Setiap respons
menyertakan `parsedBy` (`model` atau `aturan`) supaya jalur yang dipakai tidak disamarkan.

## Deploy (Vercel)

Sudah memakai `@sveltejs/adapter-vercel`. Manual:

```bash
npx vercel deploy
```

### Otomatis lewat GitHub Actions

`.github/workflows/ci.yml` menjalankan typecheck dan build pada tiap pull request
dan tiap push. Khusus push ke `main`, setelah pemeriksaan itu lulus, hasilnya
langsung dideploy ke produksi. Kalau typecheck atau build gagal, tidak ada yang
naik — itu sebabnya keduanya satu alur, bukan dua yang berjalan sendiri-sendiri.

Isi tiga secret di **Settings → Secrets and variables → Actions**:

| Secret | Dari mana |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` setelah `npx vercel link` (atau Team Settings → General) |
| `VERCEL_PROJECT_ID` | sumber yang sama, `.vercel/project.json` |

Sebelum ketiganya terisi, job deploy berhenti dengan tenang dan menyebutkan apa
yang kurang — bukan gagal merah.

Environment Variables aplikasi (`PUBLIC_MAPID_STYLE_URL`, `OPENROUTER_API_KEY`,
`OPENROUTER_MODEL`) tetap tinggal di Vercel, bukan di GitHub. Alur ini menariknya
sendiri lewat `vercel pull`, jadi tidak ada kunci yang perlu disalin dua tempat.

> **Pilih satu.** Kalau repositori ini juga tersambung ke Vercel lewat Git
> integration bawaannya, tiap push akan dideploy dua kali. Matikan *Connected Git
> Repository* di Vercel, atau hapus job `deploy` dan biarkan Vercel yang mengurus.

## Perintah lain

```bash
npm run check    # typecheck + a11y
npm run build    # build produksi
npm run preview  # jalankan hasil build
```
