# MAPID data — status, coverage, and how it is fetched

How MAPID data gets into SpotOn, which endpoints have been verified, how far coverage
reaches today, and what else the premium catalogue holds.

The list of datasets actually read lives in [`mapid-layers.md`](mapid-layers.md) —
script-generated, always current.

---

## 1. How it works

One command, no manual steps:

```bash
node scripts/fetch-mapid.mjs   # search + read from the catalogue  → mapid-poi.json, mapid-layers.md
node scripts/join-mapid.mjs    # join onto the grid                → hexes.json
```

`fetch-mapid.mjs` finds the datasets it needs in the premium catalogue by itself, reads
them directly, classifies every point into SpotOn's categories, then writes the point file
along with its coverage declaration. There is no id to copy by hand and no button to press.

Which datasets it looks for is decided by the `MANIFEST` inside that script. To explore
the catalogue before adding a new entry to the manifest:

```bash
node scripts/search-mapid.mjs                 # SpotOn's own categories
node scripts/search-mapid.mjs APOTEK ATM      # free-form terms
node scripts/search-mapid.mjs --kota "BANDUNG,SURABAYA" PASAR
```

### Correction: a manual import was never required after all

This document once stated the opposite, confidently, and it was wrong — worth recording,
because the mistake was not in the endpoint but in the way the conclusion was drawn.

The old conclusion: the contents of a premium layer could only be read once the dataset
had been imported into your own project through the GEO MAPID interface, because
`get_layer` rejects someone else's layer with `{"is_owner_project": false,
"is_owner_layer": false}`. The wording of that rejection does suggest a check on layer
ownership.

What was missed: the rejection comes from the **`project_id`** being sent, not from the
`layer_id`. The attempt at the time used MAPID Database's own `project_id` — a project
that genuinely is not ours, so of course it was refused. The server checks "does the
caller own this project", then serves the layer requested; it never checks whether that
layer is actually a member of that project.

A catalogue `layer_id` + **our own** `project_id` = 200 with the full contents.

One attempt with the wrong parameter produced a "not allowed" that survived for weeks and
forced every new city through the interface. The lesson is the same one as `admin_level=6`
quietly returning districts: a plausible-looking result is not evidence that the call was
correct.

### The GEO MAPID project is still read

No longer as the primary source, but because **the competition's mission datasets will
arrive as a separate shared project** — never as a catalogue entry. Layers in the project
that turn out to be copies of catalogue datasets are recognised by their name (the
`IMPORTED AT …` suffix) and skipped, so nothing is pulled in twice.

The project: `6a7c1672fb8d434002151fa7`, changed via `MAPID_PROJECT_ID`. Note that this
value now plays two roles at once: it decides which project gets scanned **and** it is the
read ticket into the catalogue. Set it to a project genuinely owned by the account holding
`MAPID_API_KEY`.

### Three traps, each already sprung once

**`get_layer` truncates at 200 features without saying so.** There is no "there is more"
marker anywhere in the response, so a truncated fetch looks perfectly successful. RESTORAN
Jakarta Barat is really 1,246 points; without an explicit `&limit=`, 84% vanishes
silently. This is fixed, and `readLayer` now **throws** when a result touches the limit —
so the next truncation cannot pass unnoticed.

**Do not guess the category from the `NAMA` column.** A TransJakarta stop was once counted
as a minimarket because its name contained "MART". A phantom competitor drags down the
score of a cell that is in fact empty — precisely the opposite of what we are looking for.
Classification reads `TIPE_1/2/3` and nothing else.

**Catalogue search uses `search_params`,** not `search`, `q`, or `keyword`. Unknown
parameters are silently ignored, so every guess returns the first unfiltered page and looks
like "search is not supported". This is the source of the old conclusion that the catalogue
could not be searched from a script.

### Prerequisites for running the scripts

**The key.** `MAPID_API_KEY` is read from the environment first, then from `.env` (see
`.env.example`). The environment wins, so a different key can be tried for a single run
without editing the file:

```bash
MAPID_API_KEY=<another key> node scripts/fetch-mapid.mjs
```

**The network.** The scripts need outbound access to `geoserver.mapid.io` and
`server.mapid.io`; `join-mapid.mjs` also needs the Overpass mirrors (`overpass-api.de` and
friends) for administrative boundaries. Both are frequently blocked in walled environments
— CI containers, remote sessions, office networks behind a proxy.

Worth watching for, because it is easy to misread: when the proxy refuses, what surfaces is
`Failed: get_layer_list: 403 Forbidden` — exactly as though the key had been rejected. Tell
the two apart before replacing the key:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://geoserver.mapid.io/
# "CONNECT tunnel failed, response 403" = the network, not the key.
```

---

## 2. Coverage today

55 premium catalogue datasets, **24,614 unique points** after 11,462 duplicates were
dropped. **All nine categories are fully covered across all five administrative cities.**

| SpotOn category | Central | West | South | East | North | Points | Source dataset |
|---|:--:|:--:|:--:|:--:|:--:|--:|---|
| kopi | ✅ | ✅ | ✅ | ✅ | ✅ | 2,351 | COFFEE SHOP + BRAND COFFEE SHOP |
| minuman | ✅ | ✅ | ✅ | ✅ | ✅ | 858 | MINUMAN |
| roti | ✅ | ✅ | ✅ | ✅ | ✅ | 1,869 | ROTI DAN KUE |
| warung | ✅ | ✅ | ✅ | ✅ | ✅ | 6,094 | RESTORAN |
| minimarket | ✅ | ✅ | ✅ | ✅ | ✅ | 2,928 | MINIMARKET |
| kelontong | ✅ | ✅ | ✅ | ✅ | ✅ | 2,698 | TOKO KELONTONG |
| laundry | ✅ | ✅ | ✅ | ✅ | ✅ | 3,714 | LAYANAN ATAU JASA → BINATU |
| bengkel | ✅ | ✅ | ✅ | ✅ | ✅ | 903 | PERAWATAN DAN PERBAIKAN OTOMOTIF |
| apotek | ✅ | ✅ | ✅ | ✅ | ✅ | 3,199 | APOTEK |

Two figures deserve attention, because both moved without a single new data point:

**`kopi` rose 895 → 2,351** once `BRAND COFFEE SHOP` entered the manifest. That dataset is
separate from `COFFEE SHOP` and is in fact the larger of the two — chain outlets (Kopi
Kenangan, Starbucks, Tomoro, Fore) are not in `COFFEE SHOP` at all. Two thirds of Jakarta's
coffee shops had not been counted as competitors.

**`warung` fell 8,813 → 6,094**, and that is an improvement, not a loss. The difference of
2,719 moved to `roti` and `minuman`. Before those two became categories, every bakery, boba
outlet, and ice-cream parlour fell into `warung` — because their `TIPE_1` reads "MAKANAN
DAN MINUMAN" and no more specific rule caught them first. Doughnut shops counted as warteg
competitors.

### `force`: for when the taxonomy cannot be read

`BRAND COFFEE SHOP` stores **brand names** in `TIPE_3` — "STARBUCKS", "KOPI KENANGAN",
"TOMORO COFFEE". The classification rules look for words like COFFEE or KOPI, and
"STARBUCKS" contains neither; what remains is `TIPE_2` = "MINUMAN", so every Starbucks
would be counted as a drinks stall.

A manifest entry may therefore carry `force`, which pins an entire dataset's contents to
one category. It is used only for datasets holding a single kind of business. Umbrella
datasets such as `MAKANAN DAN MINUMAN` or `LAYANAN ATAU JASA` must specifically not be
pinned — their contents are mixed, and pinning them throws away the very distinction we
want to see.

### Second correction: `laundry` does exist, and was once declared absent

This document once stated confidently that `laundry` was not in the premium catalogue. That
was wrong, and the mistake is the same species as the one in §1 — concluding too much from
a single way of searching.

What was searched at the time was only the **dataset name**. There is no dataset called
LAUNDRY, so the conclusion was "it does not exist". In fact laundry is held as a **subtype
inside another dataset**: `LAYANAN ATAU JASA` → `TIPE_3` = "BINATU (LAUNDRY)", 3,723 points
across all five cities. Not a small number, and not hidden — simply not named the way it
was guessed to be.

The same mistake once hid petrol stations, which the catalogue calls `PENGISIAN BAHAN
BAKAR`, along with tailors (`JAHIT`), massage (`PIJAT`), and water depots (`ISI AIR GALON`)
— all of them subtypes inside umbrella datasets.

The rule now held to: **not found by name is not the same as absent.** Before declaring
something unavailable, open the `TIPE_1/2/3` taxonomy of the relevant umbrella datasets.
And even then, say what was checked — not "it does not exist", but "it is not among the
things I checked".

Cells marked **—** are treated as **not yet covered**, not as zero competitors. This
follows directly from the project's principle: absence of data is not evidence of absence
of business. A cell must not score highly merely because its competitors have not been
surveyed.

The HALTE layer (606 points, project-specific) is deliberately unused — transit access is
already computed from OSM across four modes, and MAPID's HALTE covers only some cities.

### Coverage is declared, not inferred from points

The list of "which cities are covered" used to be worked backwards from the `KABKOT` of
whichever points survived classification. That conflated two things which are the very
heart of this project's promise: a dataset that **does not exist**, and a dataset that
**exists but happens to yield zero rows** after filtering. Both produce zero points, yet
the first means "not checked" and the second "checked, genuinely empty".

`fetch-mapid.mjs` now writes coverage from the manifest: once a city's dataset has been
read successfully, that city is covered for the categories that dataset promises — however
many points ultimately survive. `join-mapid.mjs` reads that declaration as it stands and
does not re-derive it.

Note that one dataset can cover two categories: `MAKANAN DAN MINUMAN` holds coffee shops
**and** eating places, so its existence covers `kopi` and `warung` at once.

### Join results (`node scripts/join-mapid.mjs`)

- 542 of 562 cells had their city determined (the remaining 20 lie outside the 14 areas
  fetched — the outer Bodetabek fringe).
- **4,158** cell×category pairs covered, 900 not. Before this session: 515 covered, across
  five categories.
- MAPID competitors counted: warung 11,240, laundry 6,278, apotek 5,751, minimarket 5,157,
  kopi 4,753, kelontong 4,597, roti 3,530, bengkel 1,397, minuman 1,412 observations.

Competitors are counted within an 800 m walking radius of the cell's centre point. The
total number of observations exceeds the number of points because one outlet can sit within
range of several cells at once — that is exactly what the definition says ("competitors
within walking distance of this cell"), not a partition of territory.

Coverage is decided **per administrative city** using OSM `admin_level=5` boundaries, not
from POI proximity. `admin_level=6` was used at one point and what came back was districts
(Kebon Jeruk, Cilincing, Pulo Gadung) — none of which matched `KABKOT`, so every cell was
wrongly marked "not covered" without a single error surfacing. The result has to be
inspected, not just the exit status.

**City assignment is reused.** Which cell sits in which city only changes when the grid
changes, whereas this script runs every time the MAPID data is refreshed. Re-fetching the
boundaries each time would hang the entire join on the most fragile service in the chain —
one round once burned seven minutes and then failed with `503` because every Overpass
mirror was full, while the answer was already stored in `hexes.json` and had not changed at
all. Re-fetch deliberately with:

```bash
node scripts/join-mapid.mjs --refresh-kota   # after build-hexes.mjs
```

On the map, three states are distinguished: a cell with a value is coloured on the
opportunity scale, a **not yet surveyed** cell is hatched, and a **not covered** cell is
merely outlined with a dashed stroke and left unfilled.

### What the source switch does to scoring

Of 562 cells, 90 are **not yet surveyed** and are never scored by either source. The
remaining 472 are scored by OSM and 385 by MAPID, **identically across all nine categories**
— the 87-cell difference is Bodetabek, which has no MAPID dataset because the catalogue
ships one dataset per DKI administrative city. That is coverage reflected faithfully, not
breakage.

Before this session the MAPID column read kopi 382, warung 46, and 0 for the rest.

### The two sources are not comparable in density, and that needs saying

POI counts where both cover Jakarta:

| Category | OSM | MAPID | Ratio |
|---|--:|--:|--:|
| warung | 3,206 | 6,094 | 1.9× |
| minimarket | 2,337 | 2,928 | 1.3× |
| kopi | 1,170 | 2,351 | 2.0× |
| apotek | 393 | 3,199 | 8.1× |
| roti | 295 | 1,869 | 6.3× |
| kelontong | 274 | 2,698 | 9.8× |
| laundry | 231 | 3,714 | 16.1× |
| bengkel | 187 | 903 | 4.8× |
| **minuman** | **65** | **858** | **13.2×** |

OSM is reasonable for warung and minimarket. For the rest it is not merely smaller — 65
drinks stalls across the whole of Jakarta is plainly not the real state of affairs but a
tagging hole. This differs in kind from "not covered", and is more dangerous: a cell with
no data is given a null value and left unranked, whereas a cell with *thin* data **still
gets a score** — with competition set too low, so it looks roomier than it really is.

Scores are normalised against the densest cell within the same source, so the ranking
between cells still reads. What must not be done is comparing competitor counts across
sources, or treating the OSM figure for a category with a large ratio as anything close to
a complete count.

### Not yet wired into the score

The MAPID data is already attached to `hexes.json` as `mapid` and `covered`, and the
**OSM | MAPID** switch in the top bar already chooses between them — the two are kept
separate and never mixed into one score.

What remains open: **which one is the default.** The old reason for staying on OSM has
gone — MAPID coverage is no longer lopsided towards one city but complete across four of
five categories, and denser than OSM in all of them. All that is left is `laundry`, which
would show as an empty column on the MAPID source. Settle that before switching the
default.

---

## 3. What is available beyond the nine categories

The premium catalogue has 16 categories (~90,000 datasets). All of them are now readable
through the same path — adding a business type means adding one row to `MANIFEST`, not a
manual import session.

What is interesting is no longer adding business types, but **patching demand** — the only
signal that is still entirely mock.

### How to search, after getting it wrong twice

Two "it does not exist" conclusions in this document turned out to be wrong, and both
because the search stopped at the dataset name. The correct order:

1. `node scripts/search-mapid.mjs <TERM>` — is there a dataset by that name.
2. If not, **open the relevant umbrella dataset and read its `TIPE_1/2/3`.**
   Umbrellas already known to be fat: `LAYANAN ATAU JASA` (2,528 points in Central Jakarta,
   ±22 kinds of service), `MAKANAN DAN MINUMAN`, `PERAWATAN DAN PERBAIKAN OTOMOTIF`.
3. Only once both come back empty, write "it does not exist" — and say what was checked.

### The demand side, verified across all five DKI cities

| Dataset | For SpotOn |
|---|---|
| `DEMOGRAFI` | 44 polygons per city. **The strongest candidate** for replacing `d` (demand), which is currently invented. |
| `HARGA PROPERTI` | 1,398 points per city, with a price per m². A signal of both purchasing power and rental cost. |
| `PROPERTI RUKO` | 399 per city, complete with `HARGA`, `LUAS TANAH/BANGUNAN`, `JUMLAH LANTAI`, `LEBAR JALAN`. A candidate to replace the commercial-space gate, which is currently mock — note that all of them are `TIPE_3 = JUAL`, for sale, not for rent. |
| `APARTEMEN`, `KOS`, `PROPERTI KOST` | Residential density = the buyers who live there. |
| `PUSAT PERBELANJAAN`, `PASAR` | Visit attractors; they explain busyness that does not come from local residents. |
| `ATM DAN BANK` | 840 per city. A proxy for commercial activity and the cash economy. |
| `RUMAH SAKIT`, `KLINIK`, `LABORATORIUM MEDIS` | Demand generators, and complements to the apotek category. |
| `SEKOLAH`, `KURSUS BAHASA` | A recurring, easily predicted daytime population. |
| `HOTEL`, `AGEN PERJALANAN` | Non-resident visits. |

### Other business types available but not yet categories

`LAYANAN LOGISTIK` (JNE/J&T/post office agents, 355 per city) · `PENGISIAN BAHAN BAKAR` ·
`DEALER MOTOR` · `TOKO PAKAIAN` · `TOKO ELEKTRONIK` · `TOKO HEWAN PELIHARAAN` · `TOKO
BUNGA DAN TANAMAN` · `BIOSKOP` · `KATERING` · `LAPANGAN PADEL`. From inside `LAYANAN ATAU
JASA`: `KONTRAKTOR`, `KANTOR PENGACARA`, `PEGADAIAN`, `NOTARIS`, `AGEN PROPERTI`, `SERVICE
LAPTOP/KOMPUTER`, `JAHIT`, `PIJAT`, `ISI AIR GALON`.

All of them have a MAPID dataset, but **not necessarily a workable OSM tag equivalent** —
and without both, a category would quietly read as zero on the source that lacks the data.
That requirement is explained in [`categories.ts`](../src/lib/domain/categories.ts).

Searched for and not found, either by name or inside the umbrellas already opened:
barbershop/salon, internet cafés, gold shops, opticians, bookshops, phone-credit kiosks,
photocopying, hardware shops, karaoke, tyre repair, car washes. Worth noting that 221
points in `LAYANAN ATAU JASA` carry the type `LAINNYA` and their contents have not been
opened — so this list is "not found yet", not "does not exist".

Catalogue categories not yet explored dataset by dataset, and their strongest candidates:

| Catalogue category | Count | For SpotOn |
|---|--:|---|
| Social | 23,254 | **Demographic statistics.** The strongest candidate for replacing `d` (demand), which is currently invented. |
| Retail | 19,980 | Brand-level minimarkets (`ALFAMART`, `212 MART`) — sharper than a single "minimarket" class. |
| Health | 7,206 | Already used for apotek; hospitals are demand generators too. |
| Transportation | 5,599 | Already covered by OSM across four modes; little to add. |
| Environment | 4,770 | A welfare indicator; only indirectly relevant. |
| Research | 4,134 | `NIGHT TIME LIGHT` — a proxy for economic activity from night-time imagery, well established in the literature, and present exactly where survey data is not. |
| Real Estate | 4,063 | The resident side of demand. |
| Government | 3,966 | Offices = a daytime working population. |
| IT & Services | 2,649 | `ATM` as a proxy for economic activity. |
| Tourism | 1,936 | A visit attractor. |
| City Planning | 719 | Clean administrative boundaries — useful for labelling cells and aggregating by district. |
| Manufacturing / Energy / Climate / Consumer Goods | — | No clear connection to retail site selection yet. |

### The demand side, now actually read (not just found)

Both candidates for replacing the invented `d` exist, complete for all five DKI cities, on
the same **kelurahan (`DESA`) polygons** — 261 across DKI, 11.3 M residents.

| Dataset | Jakarta Pusat layer id | Shape |
|---|---|---|
| `STATUS EKONOMI DAN SOSIAL - SOCIOECONOMIC STATUS (SES)` | `670cdb65016420edc8828109` | 44 MultiPolygon, ~28 columns |
| `DEMOGRAFI` | `68b4fd08278efb81183f673e` | 44 MultiPolygon, ~110 columns |

**`DEMOGRAFI` is the one to build on.** It carries `KEPADATAN PENDUDUK` and
`JUMLAH PENDUDUK` for 2020–2024 (so growth, not just level), `LUAS WILAYAH`, `JUMLAH KK`,
the full age ladder `USIA 0-4` … `USIA 75 TAHUN KE ATAS`, educational attainment, and an
occupation breakdown (`WIRASWASTA`, `PERDAGANGAN`, `PELAJAR DAN MAHASISWA`, …). The age
bands matter here specifically: `USIA 20-24` and `USIA 25-29` are the cohorts that carry
F&B demand, and they are available per kelurahan.

> **SES's headline column is useless inside Jakarta, and looks authoritative.** Of the 261
> kelurahan, `SOCIOECONOMIC STATUS` reads `Atas` for **260** and `Menengah Atas` for one.
> The class is computed against the whole of Indonesia, so within DKI it discriminates
> nothing — yet a choropleth of it would render, and would look like an answer. Its
> component scores are barely better: `SKOR PEKERJAAN` spans 1.693–1.819 across all of
> Jakarta, and `BOBOT AKHIR` 2.222–2.627.

What SES does add that DEMOGRAFI lacks: `PDRB 2023` (894 M – 41 B, a 46× spread) and
`SKOR PENDIDIKAN` (2.158–3.733). Worth pulling in as secondary signals; not worth building
demand on.

For contrast, `KEPADATAN PENDUDUK 2024` in Jakarta Pusat alone runs 1,049 – 83,489 per km²,
an 80× spread. That is a variable with something to say.

Both are polygons and the grid is H3 hexagons, so the join is an area-weighted
apportionment, not the point-in-radius count the POI datasets use — a different code path
from `join-mapid.mjs`, and the reason this is not simply another `MANIFEST` row.

### If three had to be chosen

1. **Social → `DEMOGRAFI`** — verified above, all five cities, per kelurahan. This is what
   stops `demand` being an invention. Take `SES` alongside it for `PDRB 2023` only.
2. **Research → NIGHT TIME LIGHT** — an activity proxy available evenly, including in cells
   with no survey data at all.
3. **Real Estate → APARTEMEN** — the resident side of demand, completing (1).

An important note: as soon as demand comes from real data, the **MOCK** marking in the
interface has to become per-signal — one stale label must not end up covering a mixture of
real and sample data.

---

## 4. What remains unavailable

Struk Go, Menu Go, and Properti Go are the competition's mission datasets, not part of the
premium catalogue. For as long as they are absent:

- **Buyer conditions** (how busy competitors are) — stays mock.
- **Commercial space for rent** — stays mock; the space-availability gate still runs as a
  clearly marked placeholder.

### Already investigated, and the result was nothing

Every route `MAPID_API_KEY` can reach has been tested, not assumed:

| Route | Result |
|---|---|
| `search_data_premium_v2` — `STRUK GO`, `MENU GO`, `PROPERTI GO`, `MISSION`, `CATALYST` | not one mission dataset |
| `search_layers_public` — all three names | not one mission dataset |
| `get_layer_list` on our own project | 12 layers, all catalogue copies |
| `missions/*`, `activities/*`, `forms/*`, project listings | all 404 — the endpoints simply do not exist |

This check is not a one-off note: `node scripts/fetch-mission.mjs` with no arguments
repeats it on every run, so the absence keeps being tested rather than quietly turning into
an assumption — the same pattern as `missing` in `fetch-mapid.mjs`.

Searched again from the public web once egress to `mapid.co.id` was opened, with the same
result:

| Route | Result |
|---|---|
| `mapid.co.id/data-catalog` | no mention of Struk, Menu, Properti Go, Mission, or Catalyst |
| `mapid.co.id/sitemap.xml` (500 URLs) | only MAPID Catalyst *news articles*; no data page |
| the two on-topic blog posts (MRT ASEAN property, Bekasi coffee competition) | 2021–2023, built on open POI data, no mission data |
| bare short links — `/StrukGo`, `/PropertiGo`, `/DataMission`, `/PropertiGoJakarta`, and six more | the shortener answers `Link not found!` |

So the four `Sample…` links in the rules are the only mission-data links that exist
publicly. There is no undocumented route: the full datasets are handed to curated teams,
and no amount of probing substitutes for that.

> **The naming trap.** The catalogue answers `STRUK` with nineteen `KONSTRUKSI` datasets —
> the word "STRUK" sits inside it. `PROPERTI GO` pulls in `HARGA PROPERTI DI KABUPATEN
> GOWA`. The name filter in the script therefore requires `GO` to be adjacent and uses a
> word boundary; both are locked down in `--selftest`.

### Correction: `MAPID_PROJECT_ID=<shared project>` will not work

An earlier edition advised: open the mission project in the editor, take the `project_id`
from the URL, run the script with `MAPID_PROJECT_ID=<id>`. **That procedure fails**, and it
fails in a way that quietly breaks something else too:

```
get_layer_list(someone else's project_id)          → 403 {"message":"Not owner"}
get_layer(their layer_id, our project_id)          → 200, full contents
get_layer(their layer_id, their project_id)        → 404 is_owner_project:false
```

Two things follow from that:

1. **The contents of someone else's project cannot be listed.** Sharing a project in GEO
   MAPID is *viewer mode* over a link; `get_layer_list` still refuses.
2. **The "read ticket" in `lib/mapid.mjs` turns out not to be a premium-catalogue trick at
   all.** Any layer can be read as long as the `project_id` sent is one we own. The limit is
   not permission but **discovery**: what we need is the `layer_id`, not ownership.

Setting `MAPID_PROJECT_ID` to someone else's project would in fact take the premium
catalogue reads down with it, because that ticket has to be a project of our own.

### The right way, once the data exists

All that is needed is each dataset's `layer_id` — the last segment of a layer URL,
`https://geo.mapid.io/layer/<LAYER_ID>`:

```bash
MAPID_STRUK_LAYER=<id> MAPID_MENU_LAYER=<id> MAPID_PROP_LAYER=<id> \
  node scripts/fetch-mission.mjs
```

The script also picks up layers named `STRUK GO` / `MENU GO` / `PROPERTI GO` by itself if
they happen to have been imported into our own project, so the manual import route still
works with no environment variables at all.

The schemas are transcribed from [§A.4 of the rules](00-ketentuan-kompetisi.md) and column
names are matched loosely through a list of aliases. A column that does not resolve is
**reported**, never read as zero — a renamed payment column will show up as "column not
found", not as a catchment that pays in cash. `node scripts/fetch-mission.mjs --selftest`
exercises the parser without touching the network.

### The organisers' samples — read, and the reader verified against them

The rules list a sample link per dataset. Each one redirects to a **Google Drive folder**,
not a GEO MAPID layer — so there is no `layer_id` to lift from them, and no API path to the
mission data. It is a hand-distributed drop:

| Link | Drive folder |
|---|---|
| `mapid.co.id/SampleStrukGo` | `1Bg0RrMyuCTOjv3szQ6UaU2BtytsScgYj` |
| `mapid.co.id/SampleMenuGo` | `1Mu2dAI6J7FgytYFBH1BpT9ON1r8P6SZr` |
| `mapid.co.id/SamplePropertiGo` | `16pzCdSrZnKDxyCXENYSpv9hQlD-cLcDk` |
| `mapid.co.id/SampleActivityMAPIDAPPS` | `1LmV72E5refgS5w-oJklMFm8BWiWQnoIi` |

Each folder holds the same 15 rows as CSV, GeoJSON, GeoPackage, and a full shapefile
bundle. The Properti Go folder also contains **`Properti Go Bandung.geojson`, 590 real
points** — not a sample, and the only mission data at real volume anyone outside the
curated set has seen.

**The data is Bandung, not Jakarta** (and one Menu Go point near Depok). It is good for
confirming the schema and nothing else — none of it can be scored by SpotOn.

Run the reader over them with:

```bash
node scripts/fetch-mission.mjs --verify <paths to the .geojson files>
```

All 635 features across the four files normalise with **zero unresolved columns**. Two
columns only resolved because of the alias list, and would have broken an exact-name match:

| Documented in §A.4 | Actually in the data |
|---|---|
| `Nama Tempat/Makan` | `Nama Tempat Makan` — no slash |
| `Tanggal` (Properti Go) | `' Tanggal'` — **with a leading space** |

Other differences worth knowing before the join is written:

- **`Jenis Properti` reads `Disewa` / `Dijual`**, not the `Sewa` / `Jual` the rules table
  gives. The current regexes match on the substrings, so both work.
- **`Kategori Properti` reads `Retail FnB`, while `categories.ts` says `Retail F&B`.**
  Nothing is broken today — `propertyCategory` is only used to write the narration text —
  but **seven of thirteen categories** map to that value, so an exact-string match in the
  join would silently return zero listings for all of them, and zero listings closes the
  availability gate. Normalise at the join boundary; do not change the display label, which
  is spelled correctly.
- Struk Go carries eleven columns not in §A.4, all suffixed `(Lama)` — legacy fields from
  an earlier version of the form, including `Total Pengeluaran (Tanpa PPN) (Lama)` and
  `Total Pengeluran per Orang (Lama)` (the typo is theirs). **Every one is null or 0.0.**
  So there is no spend figure in the data, only a photograph of the receipt — which is
  exactly the assumption the proposal was built on (§3.3: rupiah values on receipt
  photographs are not a core indicator).
- Struk Go and the Bandung Properti Go also carry `Kontributor`, `Pengecekan`,
  `Catatan Kesalahan`, and `ID data` / `ID Data` (the capitalisation differs between the
  two). None are needed, all are ignored.

The sample files themselves are **deliberately not committed.** Rules §B.7 forbids
redistributing raw MAPID data to outside parties, and this repository may become public.
`--verify` therefore takes a path to wherever they were downloaded, rather than reading a
fixture from the repo.

---

## 5. Verified endpoints

```
# search the PREMIUM CATALOGUE — no authentication, matches AND per word
GET https://server.mapid.io/moneys_bun/search_data_premium_v2
      ?search_params=<term>[&category_id=<id>]

# the contents of one layer — layer_id may belong to anyone as long as the layer is
# public, project_id MUST be your own, limit MUST be explicit (see §1)
GET https://geoserver.mapid.io/layers_new/get_layer
      ?api_key=<KEY>&layer_id=<LAYER_ID>&project_id=<YOUR_OWN_PROJECT_ID>&limit=100000

# list the layers inside a project you own
GET https://geoserver.mapid.io/layers_new/get_layer_list
      ?api_key=<KEY>&project_id=<PROJECT_ID>

# one layer's metadata without its contents — including category_id, is_premium, and
# the owning geo_project. Allowed for anyone's layer.
GET https://geoserver.mapid.io/layers/get_detail_wo_geojson_by_link/<LAYER_ID>
      ?api_key=<KEY>

# the number of datasets per catalogue category, with each category's category_id
GET https://server.mapid.io/moneys_bun/get_data_premium_count

# the premium datasets in one category, 20 rows per page
GET https://server.mapid.io/moneys_bun/get_data_premium_by_category_id
      ?category_id=<id>&skip=<n>
```

The ownership rules that apply across the three layer endpoints, each tested individually
(see §4):

| Call | Answer |
|---|---|
| `get_layer` someone else's layer + **your own** `project_id` | 200, full contents |
| `get_layer` someone else's layer + **their** `project_id` | 404, `is_owner_project:false` |
| `get_layer_list` on someone else's project | 403 `{"message":"Not owner"}` |
| `get_detail_wo_geojson_by_link` on anyone's layer | 200 |

In short: the `project_id` sent is **your own read ticket**, not a pointer to where the
layer lives. That is why one `layer_id` is enough to read any public dataset — and equally
why the contents of someone else's project cannot be listed.

No longer used:

- `layers_new/search_layers_public/<term>?skip=<n>` — indexes public layers only, does not
  include the premium catalogue, and returns other people's coursework projects whose names
  happen to look similar. This is the source of the false report that "APOTEK is not
  visible".
