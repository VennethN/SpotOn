# Implementation status against the organisers' rules

Compared directly against [00-ketentuan-kompetisi.md](00-ketentuan-kompetisi.md),
sections B.2 (mandatory components), B.5 (structure), and C (the role of AI).

Key: ✅ done · 🟡 partial · ⬜ not started

## B.2 Mandatory WebGIS components

| Component | Status | Where |
|---|---|---|
| Interactive map as the primary element | ✅ | [`MapView.svelte`](../src/lib/components/app/MapView.svelte) — full-bleed map, panels floating above it |
| **MAPID MAPS** basemap | 🟡 | The basemap can be swapped via the `PUBLIC_MAPID_STYLE_URL` env var; currently an open raster basemap, because there is no MAPID style key yet |
| Zoom | ✅ | Custom zoom controls + scroll/pinch |
| Click on objects | ✅ | Click a catchment → detail panel |
| Data filtering | ✅ | Business category, demand/competition weights, commercial-space gate |
| Location table & attribute table | ✅ | [`AttributeTable.svelte`](../src/lib/components/app/AttributeTable.svelte), sortable by column |
| Layer control | ✅ | [`ControlPanel.svelte`](../src/lib/components/app/ControlPanel.svelte); the score legend is always visible via [`MapLegend.svelte`](../src/lib/components/app/MapLegend.svelte) |
| Data visualisation (graphs/charts) | ✅ | 24-hour transaction profile + cross-category opportunity bars in [`DetailPanel.svelte`](../src/lib/components/app/DetailPanel.svelte) |
| **AI inside the interface** | ✅ | [`TapakPanel.svelte`](../src/lib/components/app/TapakPanel.svelte) → `POST /api/ai/query`; a sample conversation also plays on the landing page, driven by the same scoring engine |
| Public access (Vercel) | 🟡 | The Vercel adapter is installed; not deployed yet |

## B.5 Recommended WebGIS structure

| Section | Status | Where |
|---|---|---|
| Home / Overview | ✅ | Landing page at `/` — the problem, the method, and a summary of the insight |
| Interactive Map | ✅ | `/app` |
| Analysis and Insight | ✅ | Detail panel + attribute table |
| AI interaction inside the interface | ✅ | The Tapak panel |
| AI Insight (summary, comparison, recommendation) | ✅ | The `RANK`, `COMPARE`, `FLAG_SATURATED`, and `COVERAGE` intents in [`nlq.ts`](../src/lib/domain/nlq.ts) |
| Survey Activities | ⬜ | So far only a priority list of "not yet surveyed" catchments; there is no dedicated page |
| Methodology and Data Sources | 🟡 | Summarised in the provenance panel and on the landing page; there is no full methodology page |
| Recommendations | ✅ | Ranked list + a "Why here?" justification |

## C. The role of AI

| Requirement | Status | Notes |
|---|---|---|
| AI produces spatial output | ✅ | The AI's answer changes the highlight on the map and ranks catchments — it is not merely text |
| The input → processing → output → validation flow is explained | ✅ | The structured query is shown verbatim; every claim carries the N data points behind it |
| **Layer A — enriching data from photographs** | ⬜ | Classifying formality tier and storefront quality is not built; it needs the real mission dataset |
| **Layer B — recommendation engine in the interface** | 🟡 | Intent parsing is still rule-based on the server; the contract is already shaped so an LLM + function-calling can be swapped in without touching the UI |

## Technical debt still to clear

1. **MAPID MAPS basemap** — mandatory for the final product. All that is needed is to fill in `PUBLIC_MAPID_STYLE_URL`.
2. **Real data source** — replace `loadCatchments()` in [`src/lib/server/source.ts`](../src/lib/server/source.ts)
   with a call to the MAPID API. The `Catchment` contract does not need to change.
3. **A real LLM on `/api/ai/query`** — replace `parseQuestion()` with function-calling.
   Score computation stays on the server, so no figure ever comes from the model.
4. **Survey activities and methodology pages**, per B.5.
5. **Visual classification (Layer A)**, once the real mission dataset is available.
