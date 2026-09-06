<!-- Transcribed from https://maps.mapid.io/docs/missions and /docs/activities on
     22 August 2026. The pages themselves say "last updated 4 August 2026" (missions)
     and "5 August 2026" (activities). See "How this was obtained" at the bottom. -->

# The MAPID missions API

The competition's mission data — **Properti Go**, **Menu Go** and **Struck Go** — plus the
**Activities** feed, as MAPID publishes them at `maps.mapid.io/docs`. This file is a
transcription of those pages, with a section on top recording what the endpoints actually
did when they were called on 22 August 2026, because the two do not agree.

It was written to answer one question: can Struck Go's receipts give the area panel the
hour that OpenStreetMap opening hours cannot — see the activity section in
[`AGENTS.md`](../AGENTS.md). The documentation says yes, and the data says no. That is the
whole of the first section, and the short answer is that the `waktu` field the docs
promise is written on none of the 429 records published for Jakarta.

---

## What actually answers today

Every row below was produced by calling the endpoint on 22 August 2026. The polygon is
SpotOn's own bounding box, `-6.42,106.65` to `-6.05,107.05`.

| Call | Key | Result |
|---|---|---|
| `POST /web/competition/{mission-type}` | none | `400 {"message":"x-api-key header is required"}` |
| `POST /web/competition/{mission-type}` | ours, or one deliberately invalid | `500 {"message":"Internal server error"}` |
| `POST /web/competition/activities` | none, then any | the same 400, then the same 500 |
| `POST /web/survei/competition/{mission-type}` | — | `404 Cannot POST` |
| `POST /web/survei/public/{mission-type}` | none | `200`, features with **empty** properties |
| `GET /web/survei/public/{mission-type}?_id=…` | none | `200`, one feature **with** its properties |

### The documented endpoint is broken, and it is not our key

`/web/competition/…` refuses a request with no key correctly, and then answers 500 to
every request that carries one. Four things were varied and none of them changed it:

- **The key.** Ours and a deliberately invalid one get the identical 500.
- **The header spelling.** `x-api-key`, `X-API-KEY` and `X-Api-Key` all reach the 500,
  which is the header being matched case-insensitively as HTTP requires. `api-key`,
  `Authorization: Bearer` and `?api_key=` all fall back to the 400, so `x-api-key` is the
  only name the route honours.
- **The body.** An empty `{}` gets the same 500, so the polygon is not being rejected.
- **The mission.** All three mission types, and `activities`.

`MAPID_API_KEY` is live. The control is the premium catalogue call the data scripts
already make: `GET geoserver.mapid.io/layers_new/get_layer_list` with our key answers
`200` and real content, and the same call with a made-up key answers `404 {}`. So the key
is being accepted somewhere else on the same day, and there is nothing to fix on our side.

### There is an undocumented keyless path, in two halves

`/web/survei/public/…` is what the MAPID Maps front end calls itself — it is in the
shipped bundle as `` `${BASE}/web/survei/public/propertigo` `` — and it needs no key at
all. Sending our key changes nothing about the answer.

It comes in two halves, and only together are they useful:

- **`POST /web/survei/public/{mission-type}`** takes the same polygon body and returns
  the list, paginated the documented way. Every feature carries `_id`, `mission`, `key`,
  `type` and a Point `geometry`, and `properties: {}`. It answers *where*, never *what*.
- **`GET /web/survei/public/{mission-type}?_id=…`** returns that one feature with its
  properties filled in. This is the detail call the front end makes when a point is
  clicked, and it is the only route to the attributes that answers at all today.

```json
{
  "_id": "…", "mission": "struk", "key": "…",
  "geometry": { "type": "Point", "coordinates": [106.8218, -6.2236] },
  "properties": {
    "nama_tempat": "Nasi Uduk Bu May",
    "kategori_tempat": "Warung/kaki lima",
    "tanggal": "2026-08-20T00:00:00.000Z",
    "metode_pembayaran": "QRIS",
    "foto_struk": "https://mapid-app-chat.cdn.mapid.io/…"
  },
  "type": "Feature"
}
```

One list call per mission plus one detail call per feature is 429 requests for the whole
of Jakarta, which is what was done to produce the next section.

### What is actually in the data

All 429 records inside the bounding box, fetched one by one. Not a sample.

| Mission | Records | Distinct coordinates |
|---|--:|--:|
| Struck Go | 198 | 161 |
| Menu Go | 99 | 82 |
| Properti Go | 132 | 117 |

**Fields documented but not present in a single record:**

| Mission | Missing |
|---|---|
| Struck Go | `waktu`, `catatan` |
| Menu Go | `waktu`, `jam_buka`, `jam_tutup`, `link_menu`, `catatan` |
| Properti Go | none (`catatan` is present on 1 of 132) |

Nothing undocumented turned up. Everything else the docs promise is on every record.

**There is no time of day anywhere.** `tanggal` is present on all 429 and every one of
them is midnight UTC exactly — `00:00:00.000Z`, 429 times out of 429. It is a date field,
not a timestamp, and the `waktu` that would have carried the hour is not being written.
That is the single most consequential fact in this file, and the reason is in the last
section.

Date ranges: Struck Go 13 May to 20 August 2026, Menu Go 2 June to 21 August, Properti Go
13 February to 19 August.

**What the categorical fields hold**, across every record:

```
struckgo.metode_pembayaran   QRIS 132 · Tunai 24 · E-wallet 21 · Debit 14 · Kartu Kredit 7
struckgo.kategori_tempat     Restoran/kafe 74 · Minimarket/supermarket 42 · Warung/kaki lima 22 · E-commerce 19 · …
menugo.kondisi_tempat        Sedang (1-3 pembeli menunggu/makan) 50 · Sepi 28 · Ramai (antrean >3) 21
menugo.jenis_tempat          Warung/Tenda 27 · Kafe 26 · Restoran 20 · Fast Food 17 · Kaki Lima/Gerobak 9
menugo.mobilitas             Menetap 97 · Berkeliling 2
propertigo.kategori_properti Ruko 83 · Rumah 23 · Tanah 15 · Kos 5 · Retail 3 · Kantor 1
propertigo.jenis_properti    Dijual 83 · Disewa 49
```

Two of those are worth stopping on.

`menugo.kondisi_tempat` is a **surveyor's observation of the crowd**: how many people were
waiting or eating when the photograph was taken. It is the closest thing in any MAPID
dataset to a footfall reading, and there are 99 of them.

`propertigo.jenis_properti` contains **49 Disewa**, which is to say rental listings, in a
product that says at length that MAPID publishes no rent for Jakarta. That statement is
about the premium property catalogue and it is still exactly true: `fetch-property.mjs`
re-tallies its sale-or-rent column on every run and it comes back sale every time.
Properti Go is a different dataset, gathered a different way, and it does record that a
property is for rent. It records no price of any kind, for rent or for sale, so it still
cannot produce a monthly rent figure. What it changes is smaller and worth knowing: "no
listing in Jakarta is for rent" was never the claim, and this is the data that shows why
the claim was written as narrowly as it was.

---

# Missions

MAPID Apps generates mission data in three categories: **Properti Go**, **Menu Go**, and
**Struck Go**. Each mission type provides GeoJSON Feature data filtered by a polygon area.

All mission endpoints share the same authentication and request structure.

## Authentication

All mission endpoints require an API key via the `x-api-key` header.

```
x-api-key: {{API_KEY}}
```

## Common request structure

All mission endpoints accept a POST request with a JSON body containing a GeoJSON Polygon
and optional pagination.

**Endpoint:**

```
POST https://server.mapid.io/web/competition/{mission-type}
```

Mission types:

- `propertigo` — Properti Go
- `menugo` — Menu Go
- `struckgo` — Struck Go

**Headers:**

```
Content-Type: application/json
x-api-key: {{API_KEY}}
```

**Body:**

```json
{
  "feature": {
    "type": "Polygon",
    "coordinates": [
      [
        [106.7, -6.3],
        [107.0, -6.3],
        [107.0, -6.1],
        [106.7, -6.1],
        [106.7, -6.3]
      ]
    ]
  },
  "offset": 0
}
```

**Body parameters:**

```
feature   (GeoJSON Polygon, required) - The polygon area to search within
offset    (Number, optional) - Number of missions to skip for pagination
```

- `feature` — must be a Polygon type (not MultiPolygon, Point, or LineString). Each ring
  must have at least 4 points, and the first and last points must be the same (closed ring).
- `offset` — default `0`.

> **Note:** the `limit` parameter is fixed at `100` and cannot be changed via the request body.

**How to use offset:**

- Each request will return a maximum of 100 items.
- If total data exceeds 100, the response will include `hasMore: true` and the `total` field
  will contain the total count.
- To get the next page, increment the offset by the number of items already retrieved.
- Example: first request with `offset: 0`, response returns total 120 items with
  `hasMore: true`. To get the next page, send a second request with `offset: 100`.
- If the offset exceeds the total data (e.g. offset 120 when total is only 120), the server
  will return a 400 error.

## Common response structure

All mission endpoints return GeoJSON Features with pagination info.

**Success (HTTP 200):**

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "features": [
    {
      "_id": "...",
      "mission": "mission-type",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [106.75, -6.2] },
      "key": "...",
      "properties": { }
    }
  ],
  "pagination": { "total": 100, "limit": 100, "offset": 0, "hasMore": false }
}
```

**No data (HTTP 200):**

```json
{
  "success": true,
  "message": "No features found",
  "features": [],
  "pagination": { "total": 0, "limit": 100, "offset": 0, "hasMore": false }
}
```

**Error (HTTP 400):**

```json
{ "success": false, "message": "feature is required in body" }
```

**Offset out of range (HTTP 400):**

```json
{
  "success": false,
  "message": "offset (150) is out of range, must be between 0 and 99 (total data: 100)"
}
```

## Behaviour

- Geometry filtering uses a spatial index for efficient polygon queries.
- Only missions with status "Diterima" are returned (hardcoded server-side, cannot be
  overridden).
- The status field is **not** included in the response.
- Results are sorted by `_id` descending, with pagination.

---

## Properti Go

Property mission data.

```
POST https://server.mapid.io/web/competition/propertigo
```

**Response properties:**

```
kategori_properti     (String) - Property category
jenis_properti        (String) - Property type
tanggal               (String) - Date
alamat                (String) - Address
foto_tampak_depan     (String) - Front photo URL
foto_spanduk          (String) - Banner photo URL
catatan               (String) - Notes
```

**Example response:**

```json
{
  "success": true,
  "message": "Propertigo data retrieved successfully",
  "features": [
    {
      "_id": "...",
      "mission": "properti",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [106.75, -6.2] },
      "key": "...",
      "properties": {
        "kategori_properti": "...",
        "jenis_properti": "...",
        "alamat": "...",
        "foto_tampak_depan": "https://...cdn.mapid.io/..."
      }
    }
  ],
  "pagination": { "total": 0, "limit": 100, "offset": 0, "hasMore": false }
}
```

---

## Menu Go

Menu and food mission data.

```
POST https://server.mapid.io/web/competition/menugo
```

**Response properties:**

```
nama_tempat           (String) - Place name
jenis_tempat          (String) - Place type
tanggal               (String) - Date
waktu                 (String) - Time
jam_buka              (String) - Opening hours
jam_tutup             (String) - Closing hours
foto_tempat           (String) - Place photo URL
foto_menu_1           (String) - Menu photo 1 URL
foto_menu_2           (String) - Menu photo 2 URL
link_menu             (String) - Menu link
menu_utama            (String) - Main menu
harga_rata_rata       (Number) - Average price
kondisi_tempat        (String) - Place condition
mobilitas             (String) - Mobility
catatan               (String) - Notes
```

**Example response:**

```json
{
  "success": true,
  "message": "Menugo data retrieved successfully",
  "features": [
    {
      "_id": "...",
      "mission": "menu",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [106.75, -6.2] },
      "key": "...",
      "properties": {
        "nama_tempat": "...",
        "harga_rata_rata": 25000,
        "foto_tempat": "https://...cdn.mapid.io/..."
      }
    }
  ],
  "pagination": { "total": 0, "limit": 100, "offset": 0, "hasMore": false }
}
```

---

## Struck Go

Receipt (struk) mission data.

```
POST https://server.mapid.io/web/competition/struckgo
```

**Response properties:**

```
nama_tempat           (String) - Place name
kategori_tempat       (String) - Place category
tanggal               (String) - Date
waktu                 (String) - Time
metode_pembayaran     (String) - Payment method
foto_struk            (String) - Receipt photo URL
catatan               (String) - Notes
```

**Example response:**

```json
{
  "success": true,
  "message": "Struckgo data retrieved successfully",
  "features": [
    {
      "_id": "...",
      "mission": "struk",
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [106.75, -6.2] },
      "key": "...",
      "properties": {
        "nama_tempat": "...",
        "kategori_tempat": "...",
        "metode_pembayaran": "...",
        "foto_struk": "https://...cdn.mapid.io/..."
      }
    }
  ],
  "pagination": { "total": 0, "limit": 100, "offset": 0, "hasMore": false }
}
```

---

# Activities

Activity data shared by MAPID Apps users through the application: community posts with
photos, descriptions, and locations.

## Authentication

```
x-api-key: {{API_KEY_MISSION}}
```

The docs name a different placeholder here (`API_KEY_MISSION` rather than `API_KEY`).
Whether that is a second key or the same one written twice could not be established: the
endpoint answers 500 to every key, so there is nothing to tell the two apart with.

## Request

```
POST https://server.mapid.io/web/competition/activities
```

**Headers:**

```
Content-Type: application/json
x-api-key: {{API_KEY_MISSION}}
```

**Body:**

```json
{
  "feature": {
    "type": "Polygon",
    "coordinates": [
      [
        [106.7, -6.3],
        [107.0, -6.3],
        [107.0, -6.1],
        [106.7, -6.1],
        [106.7, -6.3]
      ]
    ]
  },
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "hashtag": ["kuliner"],
  "author": "budi"
}
```

**Body parameters:**

```
feature     (GeoJSON Polygon, required) - The polygon area to search within
start_date  (String, optional) - Filter start date (format: YYYY-MM-DD)
end_date    (String, optional) - Filter end date (format: YYYY-MM-DD)
hashtag     (Array String, optional) - Filter by description (case-insensitive, partial match)
author      (String, optional) - Filter by user name or full_name (case-insensitive, partial match)
```

- `feature` — same polygon rules as the missions endpoints.
- `start_date` and `end_date` — must be sent together. If only one is provided the server
  returns an error. `start_date` must be less than or equal to `end_date`.
- `hashtag` — array of strings filtered against the description, case-insensitive and
  partial match.
- `author` — filtered against the user's `name` or `full_name`. If no user matches, the
  response is still HTTP 200 with empty activities.

> **Note:** there are no `offset` or `limit` parameters. The limit is fixed at 60 (12 × 5)
> without a date range. With a date range, all data within the range is returned.

## Response

**Success (HTTP 200):**

```json
{
  "success": true,
  "message": "Community MAPS - Activities retrieved successfully",
  "data": {
    "activities": [
      {
        "_id": "...",
        "title": "...",
        "description": "...",
        "geometry": { "type": "Point", "coordinates": [106.75, -6.2] },
        "medias": ["https://...cdn.mapid.io/..."],
        "user_name": "budi",
        "user_full_name": "Budi Santoso",
        "user_profile_picture": "https://...cdn.mapid.io/...",
        "community_name": "...",
        "community_picture": "https://...cdn.mapid.io/...",
        "community_description": "...",
        "created_at": "2024-06-01T10:00:00.000Z",
        "likes": [
          {
            "_id": "...",
            "user_name": "andi",
            "full_name": "Andi Wijaya",
            "profile_picture": "https://...cdn.mapid.io/...",
            "created_at": "2024-06-01T11:00:00.000Z"
          }
        ],
        "total_comment": 5
      }
    ]
  },
  "meta": {
    "filters": {
      "feature": { "type": "Polygon", "coordinates": [] },
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-12-31T23:59:59.999Z",
      "hashtag": ["kuliner"],
      "author": "budi"
    },
    "total": 1
  }
}
```

**No data, or author not found (HTTP 200):** the same shape with `activities: []` and
`total: 0`.

**Invalid feature (HTTP 400):**

```json
{ "success": false, "message": "feature is required in body" }
```

**Date range mismatch (HTTP 500):**

```json
{ "success": false, "message": "start_date and end_date must be provided together" }
```

## Behaviour

- Geometry filtering uses `$geoWithin` with `$geometry` polygon (2dsphere index).
- Hardcoded filter: `deleted_at = null`.
- If `author` is sent and no user matches, the response is still HTTP 200 with
  `activities: []` and `total: 0`.
- If `hashtag` is sent, filtering uses `$or` on the `description` field
  (case-insensitive regex).
- If a date range is sent, `created_at` is filtered `$gte` start (00:00:00) and `$lte` end
  (23:59:59.999).
- Aggregate pipeline: lookup community, user, likes, and like_users.
- S3 URLs in `medias`, `user_profile_picture`, `community_picture` and
  `likes.profile_picture` are automatically replaced with CDN URLs.
- Sorted by `created_at` descending.

## Response fields, per activity

- `_id` (String) — unique activity ID
- `title` (String) — activity title
- `description` (String) — activity description
- `geometry` (GeoJSON Point) — activity location
- `medias` (Array String) — photo and video URLs (CDN)
- `user_name` (String) — creator username
- `user_full_name` (String) — creator full name
- `user_profile_picture` (String) — profile picture URL (CDN)
- `community_name` (String) — community name
- `community_picture` (String) — community picture URL (CDN)
- `community_description` (String) — community description
- `created_at` (String) — creation timestamp (ISO 8601)
- `likes` (Array) — list of likes
- `total_comment` (Number) — comment count

---

## Getting an API key

From the docs site's own API Key page, unchanged: register at
[geo.mapid.io](https://geo.mapid.io) with a licence attached to the account, log in as the
team representative, and on the Dashboard click **MAP SERVICES**. Give the key a name and a
description, then **Create New Key**, and copy it from the list that appears.

This is the same key `MAPID_API_KEY` already holds for the premium catalogue reads in
`scripts/fetch-mapid.mjs`. Whether the missions endpoint wants that key or a separate one is
untestable while it answers 500 to every key.

---

## What this changes for SpotOn

Less than the reachability suggests, and the reason is worth stating plainly rather than
being rediscovered later.

`scripts/fetch-mission.mjs` was written against a different assumption: that the mission
datasets would arrive as MAPID **layers**, discoverable by layer id, and its `probe()`
re-checks on every run that they are not in the catalogue. That is still true, and it is
now beside the point. The missions have their own endpoint, and that script cannot find
it because it is not looking for a route.

**The hourly demand signal is not there.** Struck Go was going to be the receipt behind
the hour: 198 receipts across Jakarta, each with a payment method, a place category and a
date. And no time. `waktu` is documented and written on none of the 198, and `tanggal` is
midnight on all of them. A receipt with no time on it cannot say when a street is busy, so
the area panel's curve stays counted from OpenStreetMap opening hours, which do carry the
hour. Menu Go was the second route to the same figure through `jam_buka` and `jam_tutup`,
and those are absent from all 99 records too.

**The counts are thin even where the fields are complete.** 198 receipts and 99 menus over
a grid of 562 cells is well under one observation per cell, before any of them are asked
to fall inside a particular 800 m catchment. Compare the layers already in use: 24,630
competitor points and 3,547 property listings. Nothing here is dense enough to carry a
per-cell figure, and a per-cell figure resting on nought-point-something observations is
the kind of number this product exists not to print.

So: nothing to wire in today. What would be worth doing the day `waktu` starts being
written, in rough order of value:

- **Struck Go, once it carries a time.** `tanggal` plus `waktu` per receipt is the
  measurement the activity chart cannot make. It would sit beside the door-count curve
  rather than replacing it, because doors open and money spent are different things, and
  the panel already says which one it is drawing.
- **`menugo.kondisi_tempat`.** Sepi, Sedang, Ramai, as observed by a person standing
  there. Real crowding, already collected. Undated by hour like everything else, so it is
  a reading of a place rather than of an hour, and it would need far more than 99 records
  before it could be shown per cell.
- **`struckgo.metode_pembayaran`.** A cashless share, which is one of the columns this
  repository once generated with a PRNG and deleted for it. It is real now. It is also 198
  rows.

Two rules for whoever picks this up.

Do not build against the keyless list call alone. Empty `properties` is not a thin version
of the real payload, it is a different question being answered, and a fetch script that
counted those features would be counting locations while reporting attributes.

Do not read the detail endpoint as a bulk source without asking first. It is one HTTP
request per record, undocumented, and the front end uses it for one point at a time. 429
requests to characterise the data once is reconnaissance. A rebuild loop over it is
something else, and the documented bulk endpoint is the one to use once it answers.

---

## How this was obtained

`maps.mapid.io/docs/missions` is a client-rendered single-page app served from S3, and it
answers HTTP 404 with the app shell for every route, so fetching the URL gets you the shell
and no documentation. Nothing is wrong with the site: the router fills the page in the
browser.

What was done instead: the shell and its eight bundled assets were fetched with `curl`,
served from a local static server with a fallback to `index.html`, and rendered in headless
Chromium against that mirror. The prose above is extracted from the rendered DOM rather than
retyped, so it is what the page says. The endpoint behaviour in the first section is from
calling `server.mapid.io` directly.

The `/web/survei/public/…` path is not in the documentation. It was found by searching the
site's own JavaScript bundle for the mission type names, list call and detail call alike.
The field tallies come from fetching all 429 records once, one detail request each, spaced
200 ms apart.
