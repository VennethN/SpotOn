# Shared Context — MAPID WebGIS Competition 2026 Idea Exploration

## The competition
- **Event:** MAPID WebGIS Competition 2026. **Theme:** *"Maps That Think! — Mass Transportation Edition."*
- **Focus city (our choice):** Jakarta (MRT, LRT, TransJakarta, KRL/commuter).
- **Teams:** 3–5 students. Flow: proposal (≤10-page PDF) → curated **top 50** → build WebGIS → final.
- **What wins (official guidance, verbatim intent):** the strongest proposal is the *clearest*, not the longest — **the problem is real, the data makes sense, the method is explainable, and the WebGIS is actually implementable and useful.**

## Mandatory WebGIS requirements (non-negotiable)
- Interactive map is the **main element**; **MAPID MAPS** is the required basemap; must support zoom, click, filter, attribute tables, layer control.
- **AI must live *inside* the interface** as part of user interaction, and must produce **SPATIAL output** (mappable / location-linked) — not just a hidden backend step. Team must explain AI input → process → output → validation.
- Output must be **insight + recommendations**, never raw data on a map.
- Must **substantively use ≥1 MAPID dataset** (Community Maps activity, or a Data Mission set below).
- Public deploy (Vercel/Netlify), responsive desktop+mobile. Spatial analysis should favor open-source (QGIS/GEE/PostGIS/geopandas).

## Datasets actually available
**MAPID core (must use ≥1):**
- **Community Maps (activity):** user activity in MAPID APPS — `title, description, latitude, longitude, medias/images/videos`. Good for participation/footfall signals + geolocated photos/text.
- **Data Mission — Properti Go:** properties for sale/rent — category (rumah, ruko, kos, tanah, kantor, gudang, retail F&B, hotel, coffee shop, minimarket, laundry…), jenis (sewa/jual), date, address, **foto tampak depan**, **foto spanduk/papan promosi (often shows price)**, lat/long.
- **Data Mission — Struk Go:** real transaction receipts — merchant name, category (restoran/warung/minimarket/apotek/**transportasi**/lainnya), date, time, **payment method**, **foto struk**, lat/long. Captures *real spending*.
- **Data Mission — Menu Go:** food places — name, type (restoran/kaki lima-gerobak/kafe/warung/fast food), date/time, foto tempat, foto menu, digital menu link, **main menu**, **avg price per porsi**, **crowd condition (sepi/sedang/ramai)**, **mobility (keliling vs menetap)**, lat/long.
- **Survey activities:** ONLY the curated top-50 collect their own field data via MAPID APPS (photos, field notes, facility condition, connectivity validation, condition scores, extra attributes). Survey plan defined *after* top-50. This is a primary way to fill data gaps and add proprietary signal.

**Secondary / open (optional enrichment):** MAPID Data Catalogue, **InaRISK** (hazard/flood risk), **BIG** (population/base maps), **KLHK**. Transit routes/stops from open sources (e.g. Jakarta open data / OSM).

## ⚠️ Critical data-reality wrinkle (weigh this hard)
The mission datasets currently ship as **~15 sample points each**; the **full dataset arrives via API only after making top-50**, and its **coverage/density across Jakarta is unknown and likely uneven**. Implication: a concept whose core value *requires* dense, city-wide mission data is **risky**. Robust concepts either (a) work at coarse/aggregate resolution, (b) lean on the team's own **survey activities** to guarantee data in a chosen study area, and/or (c) combine sparse mission data with open secondary layers. The proposal must be credible *at proposal stage* (judges see it before you have full data).

## The 6 existing concepts (our current portfolio to beat/improve)
1. **Transit Vitality** — composite "Transit Vitality Index" (TVI) per station catchment blending accessibility + economic intensity + amenity diversity + informal economy. Uses all four MAPID sets. Broad flagship.
2. **Last-Mile Living** — first/last-mile pedestrian experience + informal vendors (Menu Go mobility flag, Community Maps, survey). Walkability + vendor-support scoring per corridor.
3. **SpotOn** — AI site-selection engine for retail/F&B: demand (Struk Go) vs competition (Menu Go) vs cost (Properti Go). Ranked opportunity map + NL justification.
4. **Transit Comfort Index** — passenger experience & facility/accessibility scoring per station from survey photos + Community Maps. Disability-access gap map.
5. **Rasa Kota** — food access & affordability / food-desert mapping along transit (Menu Go price+crowd+mobility, Struk Go).
6. **Transit Value** — property market & TOD affordability/gentrification watch around transit (Properti Go price gradients vs transit access).

## Your job
Apply YOUR assigned lens (see your prompt). Be brutally honest, specific, and Jakarta-grounded. We want to discover a **more polished / higher-ceiling idea** than what we have — whether that's a sharpened version of an existing concept, a hybrid, or something new. Prioritize ideas that are **winnable given the data reality** and that make the **AI genuinely central** (the theme is literally *Maps That Think*).
