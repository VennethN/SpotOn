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
| [mapid-layers.md](mapid-layers.md) | The list of MAPID datasets SpotOn reads, with a link to each layer. **Script-generated** — do not edit by hand. |
| [mapid-missions-api.md](mapid-missions-api.md) | The missions API (Properti Go, Menu Go, Struck Go) and the Activities feed, transcribed from `maps.mapid.io/docs`, with what the endpoints actually answered when called. |

## The PRD

`assets/TripleT_SpotOn_PRD.pdf` is the Product Requirement Document for the competition,
and it is **built, not written by hand**. `python3 scripts/build-prd.py` regenerates it.

It follows the organisers' template exactly: the same A4 page box, the same four cuts of
Figtree, the same palette, the same section order. Those constants were measured off the
template PDF with pdfplumber rather than eyeballed, and they live in
[`scripts/prd/theme.py`](../scripts/prd/theme.py) with a note on where each came from.

Every figure in the copy is read at build time from `src/lib/data/hexes.json` and from the
scoring engine's own constants, which is the same rule the landing page follows: a number
copied into prose goes stale in silence. Rebuild the grid and the document's numbers move
with it. The builder reads the finished PDF back before it claims to be done, and fails if
a line ran past the running foot or a glyph came out blank.

```bash
pip install reportlab pdfplumber   # pdfplumber is only needed for the check
python3 scripts/build-prd.py
```

| File | Contents |
|---|---|
| [`scripts/build-prd.py`](../scripts/build-prd.py) | Entry point. Builds, then verifies. |
| [`scripts/prd/theme.py`](../scripts/prd/theme.py) | The template's measurements. Change these if the organisers reissue it. |
| [`scripts/prd/layout.py`](../scripts/prd/layout.py) | Typesetting: wrapping, page breaks, tables. |
| [`scripts/prd/figures.py`](../scripts/prd/figures.py) | Every number, read from the data that produced it. |
| [`scripts/prd/diagrams.py`](../scripts/prd/diagrams.py) | The three drawings the template asks for, and the SpotOn mark on the cover. |
| [`scripts/prd/content.py`](../scripts/prd/content.py) | The copy. |
| [`scripts/prd/verify.py`](../scripts/prd/verify.py) | What the builder checks about its own output. |
| `scripts/prd/fonts/` | Figtree, vendored as TTF so the build needs no network. |

## Assets

| File | Contents |
|---|---|
| `assets/Proposal_SpotOn.pdf` | The PDF version of the proposal sent to the organisers. |
| `assets/TripleT_SpotOn_PRD.pdf` | The PRD. **Script-generated** by `scripts/build-prd.py` — do not edit by hand. |
| `assets/fig1_peta.png` … `fig4_pipeline.png` | The figures used in the proposal (map, AI panel, detail panel, end-to-end flow). |
| `assets/mockup-proposal.html` | The single-file mockup built for the proposal. This application's scoring engine and sample dataset originate here. |

## Deliberately not copied

- **`datas.txt`** — contains team members' national ID numbers, phone numbers, and home addresses.
- **The signed declaration** (`Surat Pernyataan … FILLED.pdf`) — contains signatures and personal data.

Both are personal data that must not travel into a code repository, least of all if
this repository is ever made public. Leave them where they are, in `MapID/`.
