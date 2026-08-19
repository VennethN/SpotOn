# SpotOn project context

The reference files this product is built on. All of them were copied over from the
proposal-drafting repository (`MapID/`) so that the context lives alongside the code.

| File | Contents |
|---|---|
| [00-ketentuan-kompetisi.md](00-ketentuan-kompetisi.md) | Verbatim copy of the organisers' official guidance: data rules, mandatory WebGIS components, the role of AI, judging, and prohibitions. **The source of truth for every product decision.** |
| [01-proposal-spoton.md](01-proposal-spoton.md) | The SpotOn proposal as submitted (final version). Covers the problem, the method, the indicators, the role of AI, and technical feasibility. |
| [02-konteks-eksplorasi.md](02-konteks-eksplorasi.md) | Idea-exploration notes: the reality of the MAPID datasets, the six concepts considered, and why SpotOn was chosen. |
| [03-status-implementasi.md](03-status-implementasi.md) | Each mandatory component mapped to the part of the code that implements it, along with what is still outstanding. |
| [04-data-mapid.md](04-data-mapid.md) | How MAPID data is fetched, which endpoints have been verified, how far coverage reaches today, and what else the premium catalogue holds. |
| [05-prd-spoton.md](05-prd-spoton.md) | The Product Requirement Document, written into the organisers' official PRD template. In Bahasa Indonesia, because that is the language of the template and of the submission. |
| [mapid-layers.md](mapid-layers.md) | The list of MAPID datasets SpotOn reads, with a link to each layer. **Script-generated** — do not edit by hand. |

## Assets

| File | Contents |
|---|---|
| `assets/Proposal_SpotOn.pdf` | The PDF version of the proposal sent to the organisers. |
| `assets/fig1_peta.png` … `fig4_pipeline.png` | The figures used in the proposal (map, AI panel, detail panel, end-to-end flow). |
| `assets/mockup-proposal.html` | The single-file mockup built for the proposal. This application's scoring engine and sample dataset originate here. |

## Deliberately not copied

- **`datas.txt`** — contains team members' national ID numbers, phone numbers, and home addresses.
- **The signed declaration** (`Surat Pernyataan … FILLED.pdf`) — contains signatures and personal data.

Both are personal data that must not travel into a code repository, least of all if
this repository is ever made public. Leave them where they are, in `MapID/`.
