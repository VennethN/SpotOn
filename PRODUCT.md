# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: non-technical business owners and would-be owners in Jakarta.** A first-time
warung or kedai owner, a UMKM operator with limited capital, a home-business hopeful. They
are deciding where to open, they are not GIS-literate, and they have never read a choropleth.
They arrive asking a plain question — "usaha apa yang masuk akal di sekitar sini?" — and need
an answer they can act on plus a reason they can repeat to a spouse or a lender.

Secondary, and reading the same pages: **the MAPID WebGIS Competition 2026 jury**, evaluating
method, data honesty, and whether the AI does real work. Also retail/F&B investors, franchise
expansion teams, and property owners/agents.

The landing page is written for the primary audience first. Rigor is present for the jury, but
it lives beneath the plain-language layer rather than replacing it.

## Product Purpose

SpotOn recommends where to open a retail or F&B business in Jakarta's transit catchments, and
explains why. For every walking catchment around a transit station it reads three signals that
are normally scattered — demand (Struk Go), competition (Menu Go), and available commercial
space (Properti Go) — computes an Opportunity Score per business category, and states the
reasoning in human language.

Success is a non-technical user leaving with a ranked shortlist of stations they understand
and trust, not a map they have to interpret.

## Positioning

Three signals decide whether a location works. No existing tool reads all three together at
walking-catchment resolution. SpotOn's mechanism:

- Supply is not a competitor headcount — density is weighted by *Kondisi Pembeli* (how busy
  competitors actually are), so a crowded rival suppresses opportunity harder than an empty one.
- Available commercial space is a **gate**, not a bonus: opportunity that cannot be occupied is
  not opportunity.
- The AI selects operations and fills arguments; every number is computed by the scoring engine
  and linked to its source points. No figure is ever produced by the model.

## Operating Context

- Route `/` — landing page. Route `/app` — the WebGIS itself (map, control panel, AI panel,
  attribute table). API routes under `/api`.
- Users adjust weights (`wd`, `ws`) and toggle the space-availability gate; scores recompute
  live in the client using the same scoring module the server uses.
- Ask questions in natural language; the parsed structured query is displayed verbatim so the
  answer can be audited.
- Deployed on Vercel. Built for the MAPID WebGIS Competition 2026 ("Maps That Think!") by team
  Triple T, Universitas Bina Nusantara.

## Capabilities and Constraints

- Stack is settled: SvelteKit 2 + Svelte 5 (runes), TypeScript, MapLibre GL, `adapter-vercel`.
- **The spatial unit is an H3 hexagon (resolution 8, ~531 m edge), not a per-stop catchment.**
  558 cells cover everything within 800 m walking distance of a transit stop. Per-stop catchments
  were abandoned because TransJakarta halte sit 400–500 m apart while the walking radius is 800 m:
  adjacent catchments overlapped almost entirely and counted the same shoppers repeatedly. On a
  grid each cell is counted once, and transit access becomes a *property* of the cell — so a place
  served by both MRT and TransJakarta correctly outranks one served by either alone.
- Transit coverage is all four modes from OSM: 20 MRT, 64 KRL, 33 LRT, 993 TransJakarta
  (1,110 stops after de-duplication). 5 business categories (`kopi`, `warung`, `minimarket`,
  `laundry`, `apotek`).
- The walking radius is fixed at 800 m and baked in when the grid is built. There is deliberately
  no user-facing radius control: re-scaling pre-computed counts would produce plausible-looking
  but unfounded numbers.
- Rebuild the grid with `node scripts/build-hexes.mjs` (Overpass; paced for rate limits).
- Every catchment carries `jam: number[24]` — a 24-hour transaction profile. This is the
  activity heatmap and the only truthful basis for any time-of-day depiction of foot traffic.
- All data access passes through `src/lib/server/source.ts`. Swapping mock attributes for the
  MAPID API must not touch UI code.
- `PUBLIC_MAPID_STYLE_URL` configures the basemap. **The final product must use MAPID MAPS**;
  the open raster fallback is a development convenience only.
- Copy is Bahasa Indonesia throughout. Technical terms stay English where that is the
  ordinary usage (*site-selection*, *catchment*, *listing*).

## Brand Commitments

- Name: **SpotOn**. Tagline: *"Jangan tebak lokasi usaha. Tanya petanya."*
- Voice: plain, direct, unsold. States what is known and what is not. No hype adjectives,
  no invented precision.
- Team: Valent Nathanael, Farhan Aulianda, Anthony Gilles Rudolfo — Universitas Bina Nusantara.

Binding visual constraints the user set (recorded, not expanded here):

- **An isometric white maquette.** Orthographic top-side view of one block, built as a physical
  architectural model on a visible base slab. No saturated colour anywhere in the 3D — value
  differences are kept minimal and all colour arrives as light.
- **Figures are uniform white scale figures**, like the ones an architect puts on a model. No
  clothing colour, no individual identity beyond height.
- **Frozen in time.** No idle animation. Each figure is fixed in one pose — mid-stride, seated,
  queueing — and everything that moves is moved by scroll alone.
- **The café is the subject**, with its terrace crowd as the reading of busyness, a TransJakarta
  articulated bus and median halte as the transit anchor, and the rentable lot placed
  immediately beside the café so the two can be compared at a glance.
- **Time of day drives everything visible.** The hour sets sun angle, sky, fog, window and
  street lighting. It opens at the viewer's local time.
- The landing page is scroll-driven: hour and camera are both mapped from scroll position on a
  deliberately non-linear curve (passages that hold, passages that run a whole day).
- **Landing data is illustrative** by the user's decision — the landing does not need live
  reading and must stay visibly marked as sample. Live reading is the API's and `/app`'s job.
  Crowd density there is still derived from a real 24-hour profile shape rather than invented
  per frame, and the "data contoh" marker is permanent on that surface.

The `/app` surface is guided-first: **Tapak**, a white scale figure from the maquette, leads
the conversation — greeting first, asking clarifying questions, offering tappable answers, and
commenting when the user selects a cell themselves. Weight sliders, layers, and the attribute
table sit behind "Pengaturan lanjutan"; full numbers stay one click away everywhere.

Language understanding runs through an LLM (OpenRouter, function-calling) that only selects an
operation and fills arguments. Every number is computed by `src/lib/scoring.ts` from data. When
a question falls outside the data the model calls `tidak_dimengerti` and the interface admits it
rather than answering a misread question. Responses carry `parsedBy` (`model` or `aturan`) so the
path taken is never disguised; with no API key the rule-based parser takes over and the app still
works.

## Evidence on Hand

**Real.** 1,110 transit stops across MRT, KRL, LRT and TransJakarta; MRT line geometry; and
**7,577 competitor POIs** across the five categories, spatially joined to each hexagon at 800 m —
all OpenStreetMap via Overpass API (ODbL). Transit access per cell is computed from this.

**Sample (mock).** Struk Go, Menu Go, and Properti Go attributes — including `jam`, `nontunai`,
`ramai`, and `listing` — are illustrative, because the MAPID mission dataset opens only to 50
curated teams. Column structure follows the real schema.

Do not fabricate: user counts, testimonials, partnerships, accuracy benchmarks, press, pricing,
or any claim that the mission data is live. The mock/real split must stay visible to the viewer
wherever numbers appear.

Reference material: `docs/00-ketentuan-kompetisi.md` (competition rules),
`docs/01-proposal-spoton.md`, `docs/02-konteks-eksplorasi.md`,
`docs/03-status-implementasi.md`.

## Product Principles

1. **Never interpolate over a hole.** A cell with no mission points is shown as "belum terdata"
   and enters the survey queue. It is never filled with a plausible number. 89 of 558 cells are
   deliberately left without data.
2. **Every number carries its N.** Users judge how thick the ground is for themselves.
3. **The model chooses operations, the engine computes values.** Any figure a user sees is
   traceable to source points.
4. **A non-technical user must be able to act without learning GIS.** If a control needs a
   legend to be understood, the control is wrong.
5. **Opportunity requires occupiable space.** Demand minus competition is incomplete until it
   is gated by what can actually be rented.

## Accessibility & Inclusion

The interface already commits to `prefers-reduced-motion`, `prefers-reduced-transparency`, and
`prefers-contrast` — motion-heavy work must honor all three, and the product must remain fully
usable with motion off. Primary users are on mid-range Android phones over mobile data, so
weight and battery cost are accessibility concerns, not just performance ones.
