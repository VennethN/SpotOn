# Konteks proyek SpotOn

Berkas rujukan yang menjadi dasar produk ini. Semuanya disalin dari repositori
penyusunan proposal (`MapID/`) agar konteksnya hidup berdampingan dengan kodenya.

| Berkas | Isi |
|---|---|
| [00-ketentuan-kompetisi.md](00-ketentuan-kompetisi.md) | Salinan verbatim panduan resmi panitia: ketentuan data, komponen wajib WebGIS, peran AI, penilaian, dan larangan. **Sumber kebenaran untuk semua keputusan produk.** |
| [01-proposal-spoton.md](01-proposal-spoton.md) | Proposal SpotOn yang diajukan (versi final). Berisi masalah, metode, indikator, peran AI, dan kelayakan teknis. |
| [02-konteks-eksplorasi.md](02-konteks-eksplorasi.md) | Catatan eksplorasi ide: realitas dataset MAPID, enam konsep yang dipertimbangkan, dan alasan SpotOn dipilih. |
| [03-status-implementasi.md](03-status-implementasi.md) | Pemetaan tiap komponen wajib panitia ke bagian kode yang mengimplementasikannya, beserta yang belum dikerjakan. |

## Aset

| Berkas | Isi |
|---|---|
| `assets/Proposal_SpotOn.pdf` | Proposal versi PDF yang dikirim ke panitia. |
| `assets/fig1_peta.png` … `fig4_pipeline.png` | Gambar yang dipakai di proposal (peta, panel AI, panel detail, alur end-to-end). |
| `assets/mockup-proposal.html` | Mockup satu berkas yang dibuat untuk proposal. Mesin skor dan dataset contoh pada aplikasi ini berasal dari sini. |

## Yang sengaja tidak disalin

- **`datas.txt`** — memuat NIK, nomor telepon, dan alamat rumah anggota tim.
- **Surat pernyataan yang sudah ditandatangani** (`Surat Pernyataan … FILLED.pdf`) — memuat tanda tangan dan data pribadi.

Keduanya data pribadi yang tidak boleh ikut ke repositori kode, apalagi kalau
repositori ini nantinya publik. Simpan tetap di `MapID/`.
