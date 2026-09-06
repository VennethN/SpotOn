# SpotOn

An AI-driven *site-selection* WebGIS for retail & F&B around Jakarta's transit network.
Built for the **MAPID WebGIS Competition 2026 — Maps That Think!** by team **Triple T**
(Universitas Bina Nusantara).

> Don't guess where to open. Ask the map.

For every walking catchment around a transit station, SpotOn reads three signals that are
normally scattered — **demand** (Struk Go), **competition** (Menu Go), and **available
commercial space** (Properti Go) — then computes an *Opportunity Score* per business
category and explains its reasoning in human language.

## Running it

```bash
npm install
npm run dev
```

| Route | Contents |
|---|---|
| `/` | Landing page |
| `/app` | The WebGIS: map, control panel, AI recommendations, attribute table |
| `/api/catchments` | Raw indicators per catchment |
| `/api/scores?kategori=kopi&wd=0.5&ws=0.5&gate=1&radius=800` | Computed Opportunity Score |
| `/api/meta` | Business categories, data coverage, provenance, and the language model currently active |
| `/api/ai/query` | `POST { question, kategori, weights }` → ranked recommendations |

## Structure

Files are grouped by the role they play, so where to look follows from what you
want to change.

```
src/lib/
  types.ts       the data shapes every layer uses
  data/          hexagon grid + transit nodes
  domain/        pure business rules — no DOM, used by server and client alike
    scoring.ts     the Opportunity Score engine
    composition.ts the same score taken apart again, step by step, for the panel
    transit.ts     what a cell reaches: stops, modes, and the access index explained
    weights.ts     default weights + value sanitiser (a single way in)
    nlq.ts         question → structured query → answer
    narrate.ts     scoring-engine output → human sentences
    categories.ts  thirteen business categories, their OSM tags and MAPID datasets
  server/        server-only (enforced by SvelteKit)
    source.ts      the one place the data source is decided  ← swap here when the MAPID API is ready
    llm.ts         the language-understanding layer (OpenRouter)
    params.ts      query string → scoring-engine arguments
  state/         runes that live for the length of a session
    app.svelte.ts    interface state, distributed via context
    tapak.svelte.ts  the guide's conversation
    theme.svelte.ts  light/dark/follow-system
    lang.svelte.ts   Bahasa Indonesia / English
  i18n/          the bilingual script: id.ts defines the shape, en.ts fills it
  utils/         pure helpers: format.ts (numbers, hours, scale colours), geo.ts, motion.svelte.ts
  scene/         the isometric maquette: street.ts (street block) + grid.ts (hexagon grid)
                 + daylight.ts (a 24-hour light model) + world.ts (the scene contract)
  components/
    app/           the WebGIS surface — components that read AppState
    landing/       the landing page's own composition
    ui/            stateless components, used by both surfaces
src/routes/
  +page.svelte     landing
  +page.server.ts  the landing page's figures and sample conversation, computed by the scoring engine
  app/             WebGIS
  api/             endpoints
scripts/         data builders (Overpass + MAPID); their helpers live in scripts/lib/
docs/            competition rules, the proposal, and implementation status
```

## Data

**Real (OSM).** 1,105 transit nodes across four modes (MRT 20, KRL 76, LRT 33,
TransJakarta 976), the geometry of all four networks, and 8,158 competitor POIs across nine
categories — from OpenStreetMap via the Overpass API (ODbL). Each cell's transit access is
computed from this.

The spatial unit is an **H3 hexagon at resolution 8** (±531 m edge), not a per-stop
catchment: TransJakarta stops sit 400–500 m apart while the walking range is 800 m, so
per-stop catchments would overlap and count the same shoppers over and over. On a grid each
cell is counted once and transit access becomes a property of the cell — a location served by
both MRT and TransJakarta genuinely is worth more.

Rebuild the data:

```bash
node scripts/build-hexes.mjs    # grid + transit access + competitors  → src/lib/data/hexes.json
node scripts/build-routes.mjs   # route geometry for 4 modes           → static/data/routes.json
```

**Real (MAPID).** 24,614 competitor POIs from 55 datasets in the MAPID premium data
catalogue — all nine categories, complete for all five administrative cities of DKI. Read
straight from the catalogue, with no manual import step:

```bash
node scripts/fetch-mapid.mjs    # search + read from the catalogue  → src/lib/data/mapid-poi.json
node scripts/join-mapid.mjs     # join onto the grid                → src/lib/data/hexes.json
```

The **OSM | MAPID** switch in the top bar picks which source does the scoring; the two are
kept separate and never mixed into one score. Their densities differ enormously — OSM records
65 drinks stalls across all of Jakarta, MAPID 858 — so competitor counts must not be compared
across sources. The full comparison is in [`docs/04-data-mapid.md`](docs/04-data-mapid.md),
and the dataset list in [`docs/mapid-layers.md`](docs/mapid-layers.md).

**Field surveys (MAPID APPS).** The three competition missions — Struk Go, Menu Go,
Properti Go — and the community notes filed beside them. They are not in the premium
catalogue and not in the public layer index, which is where this project spent a long time
looking for them. MAPID APPS serves them from its own public endpoints, and those need no
key at all:

```bash
node scripts/fetch-missions.mjs   # → src/lib/data/mission.json
node scripts/join-missions.mjs    # → adds `field` to hexes.json
node scripts/build-field.mjs      # → static/data/field.json
```

1,027 records across the grid's extent: 195 receipts, 99 eateries, 141 property records
and 592 community notes. **55 of the property records are offered for rent**, which is the
only rental data in the product: the premium catalogue publishes none for Jakarta.

They are used differently from everything else here, and the difference matters. The two
catalogues claim completeness for the city they cover, so a zero from them is a finding.
These are surveys somebody walked: 191 of the 562 catchments carry a record, and the rest
are not quiet streets, they are streets nobody has been down. **So none of it enters the
score.** It appears on the area card as evidence, every label says *recorded*, and the
panel says outright that it is not a census. Details in
[`docs/04-data-mapid.md`](docs/04-data-mapid.md) §4.

A catchment with no data is shown as **"belum terdata"** (not yet surveyed) and is never
interpolated. Every score comes with the N data points behind it.

## Language

The interface is available in Bahasa Indonesia (the default) and English; the ID/EN button
sits in the top bar of both pages and the choice is stored in the browser. The script lives in
`src/lib/i18n/`: `id.ts` defines the shape of the dictionary, `en.ts` fills that same shape,
and TypeScript refuses to build if a single sentence is left behind.

What switches: the whole landing page, the whole application interface, Tapak's sentences, and
the language instruction given to the model (so the "I don't understand" reply comes back in
the reader's language). What stays in Bahasa Indonesia: the API output (`headline`, `why`,
`evidence`, provenance) — that is a contract for API consumers, not text a user reads.

## Configuration

Copy `.env.example` to `.env`, then fill it in.

| Variable | Contents |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter key for the language-understanding layer. **May be left empty** — without a key, questions are parsed by the fallback rule parser and the application still runs. |
| `OPENROUTER_MODEL` | Optional — any model name OpenRouter serves, e.g. `anthropic/claude-sonnet-5` or `openai/gpt-5`. Read at runtime, so changing it on Vercel needs no rebuild. Empty → defaults to `anthropic/claude-sonnet-5`. Whichever is active can be checked at `GET /api/meta` (the key itself is never included). |
| `PUBLIC_MAPID_MAP_KEY` | The MAPID MAPS **Map Service key** from the MAPID Dashboard. The style URL is built from it and the light or dark style is picked to match the reader's theme. If empty, an open raster basemap is used (OpenStreetMap/CARTO) — **mandatory for the final product.** |
| `PUBLIC_MAPID_STYLE_URL` | Optional — a full style **URL**, for a style the app does not know about. Wins over the key, and pins one style regardless of theme. |
| `MAPID_API_KEY` | The MAPID API key (read-only) — used by the **data scripts**, not by the application. It may also be supplied as an environment variable, and the environment wins over `.env`. Different from the Map Service key in `PUBLIC_MAPID_MAP_KEY`. See [`docs/04-data-mapid.md`](docs/04-data-mapid.md). |
| `MAPID_PROJECT_ID` | Optional — the GEO MAPID project the scripts read. Empty → the default project. |

### The division of labour between model and scoring engine

The model **only understands** the question: it picks an operation and fills in its arguments
through function-calling, then stops. Every figure — score, demand, competitor count, N — is
computed by `src/lib/domain/scoring.ts` from the data, exactly the same figures the map and
the table use. That is why there is no value the model could invent.

If a question falls outside the reach of the data, the model calls `tidak_dimengerti` and the
interface admits it, rather than answering a misread question. Every response carries
`parsedBy` (`model` or `aturan`) so the path taken is never disguised.

## Deploy (Vercel)

`@sveltejs/adapter-vercel` is already in use. Manually:

```bash
npx vercel deploy
```

### Automatically via GitHub Actions

`.github/workflows/ci.yml` runs typecheck and build on every pull request and every
push. On a push to `main` specifically, once those checks pass, the result is deployed
straight to production. If typecheck or build fails, nothing ships — which is why the two
are one pipeline rather than two that run independently.

Fill in three secrets under **Settings → Secrets and variables → Actions**:

| Secret | Where from |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `npx vercel link` (or Team Settings → General) |
| `VERCEL_PROJECT_ID` | the same source, `.vercel/project.json` |

Until all three are filled in, the deploy job stops quietly and names what is missing —
it does not fail red.

The application's Environment Variables (`PUBLIC_MAPID_STYLE_URL`, `OPENROUTER_API_KEY`,
`OPENROUTER_MODEL`) stay on Vercel, not on GitHub. This pipeline pulls them itself via
`vercel pull`, so there is no key that needs copying into two places.

> **Pick one.** If this repository is also connected to Vercel through its built-in Git
> integration, every push will be deployed twice. Either turn off *Connected Git
> Repository* on Vercel, or delete the `deploy` job and let Vercel handle it.

## Other commands

```bash
npm run check    # typecheck + a11y
npm run selftest # the score breakdown against the scoring engine, no network
npm run build    # production build
npm run preview  # run the build
```

`selftest` scores 640 combinations of weights, demand, competition, transit access and
listings with the engine, takes each one apart with `domain/composition`, and holds the
two against each other: the steps have to add up to the score the engine printed, and
the transit share plus the rest has to equal it. It runs in CI alongside the typecheck.
