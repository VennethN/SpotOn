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

## Assets

| File | Contents |
|---|---|
| `assets/Proposal_SpotOn.pdf` | The PDF version of the proposal sent to the organisers. |
| `assets/fig1_peta.png` … `fig4_pipeline.png` | The figures used in the proposal (map, AI panel, detail panel, end-to-end flow). |
| `assets/mockup-proposal.html` | The single-file mockup built for the proposal. This application's scoring engine and sample dataset originate here. |

## The demo deck

| File | Contents |
|---|---|
| [`deck/spoton-deck.pdf`](deck/spoton-deck.pdf) | The presentation, 16:9, one page per slide, written for a non-technical audience: the problem, the idea, the map, the evidence, what the score is made of, Tapak, the interface, one area, the model, the honesty promises, who it is for, and the demo script. |
| `deck/build.mjs`, `deck/slides.mjs`, `deck/deck.css` | What builds it. `npm run deck` reads the grid and runs the scoring engine, so every figure on every slide is computed rather than typed, then prints the PDF with headless Chromium. Rebuild it whenever the grid is. |
| `deck/area.json` | The basemap around the area the model slide stands up, the first area the front page models, read through the app's own reader and cut to the walking range, so that slide builds without the network. `node docs/deck/build.mjs --read-area` refreshes it, and `.github/workflows/deck-area.yml` does the same from a machine with the network whenever the reader changes on a branch. |

## Deliberately not copied

- **`datas.txt`** — contains team members' national ID numbers, phone numbers, and home addresses.
- **The signed declaration** (`Surat Pernyataan … FILLED.pdf`) — contains signatures and personal data.

Both are personal data that must not travel into a code repository, least of all if
this repository is ever made public. Leave them where they are, in `MapID/`.
