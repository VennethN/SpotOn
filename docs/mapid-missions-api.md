<!-- Transcribed from https://maps.mapid.io/docs/missions and /docs/activities on
     22 August 2026. The pages themselves say "last updated 4 August 2026" (missions)
     and "5 August 2026" (activities). See "How this was obtained" at the bottom. -->

# The MAPID missions API

The competition's mission data — **Properti Go**, **Menu Go** and **Struck Go** — plus the
**Activities** feed, as MAPID publishes them at `maps.mapid.io/docs`. This file is a
transcription of those pages, with a section on top recording what the endpoints actually
did when they were called on 22 August 2026, because the two do not agree.

This matters to SpotOn because Struck Go carries a transaction date **and time**, and Menu
Go carries opening and closing hours. That is the demand side of the hour the area panel
currently answers from OpenStreetMap opening hours alone — see the activity section in
[`AGENTS.md`](../AGENTS.md).

---

## What actually answers today

Every row below was produced by calling the endpoint. The polygon is SpotOn's own bounding
box, `-6.42,106.65` to `-6.05,107.05`.

| Path | Key | Result |
|---|---|---|
| `POST /web/competition/{mission-type}` | none | `400 {"message":"x-api-key header is required"}` |
| `POST /web/competition/{mission-type}` | ours, or a deliberately invalid one | `500 {"message":"Internal server error"}` |
| `POST /web/competition/activities` | none / any | same 400, then the same 500 |
| `POST /web/survei/competition/{mission-type}` | — | `404 Cannot POST` |
| `POST /web/survei/public/{mission-type}` | none | `200`, real features |

Three things follow, and each is worth knowing before writing a fetch script.

**The documented endpoint is the right one and it is currently broken.**
`/web/competition/…` rejects a request with no key correctly, and then answers 500 to every
request that carries one. A key we know to be wrong gets exactly the same 500 as ours, and
so does a request with an empty body, so this is not our key being refused and not our
polygon being rejected. There is nothing to work around on our side.

**There is an undocumented keyless path that works.** `/web/survei/public/{mission-type}`
is what the MAPID Maps front end calls itself — it is in the shipped bundle as
`` `${BASE}/web/survei/public/propertigo` `` — and it answers 200 with no key at all. Over
the Jakarta box it returns:

| Mission | Total features |
|---|--:|
| `propertigo` | 132 |
| `menugo` | 99 |
| `struckgo` | 198 |

**But that path returns no attributes.** Every feature comes back with `properties: {}`.
It carries `_id`, `mission`, `key`, `type` and a `geometry` Point, and nothing else. So the
public path answers *where*, and only the documented path can answer *what* — which is the
half SpotOn needs, and the half that is 500-ing.

```json
{
  "_id": "6a867bc7fcdb2a71e5feb6e0",
  "mission": "struk",
  "key": "427d610bb2d54a459934efbba17d315e",
  "geometry": { "type": "Point", "coordinates": [106.82180679136314, -6.223573648716149] },
  "type": "Feature",
  "properties": {}
}
```

One more discrepancy, noted so nobody loses an afternoon to it: the Playground page on the
docs site pre-fills its URL box with `https://server.mapid.io/web/survei/competition/propertigo`,
which is a fourth path and a 404. The prose on the Missions page is right and the
Playground's placeholder is wrong.

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

Nothing yet, and it is worth being precise about why.

`scripts/fetch-mission.mjs` was written against a different assumption: that the mission
datasets would arrive as MAPID **layers**, discoverable by layer id, and its `probe()`
re-checks on every run that they are not in the catalogue. That is still true, and it is
now beside the point — the missions have their own competition endpoint, which that script
does not know about.

What the endpoint gives us today is 429 locations across Jakarta with no attributes on
them. Locations alone cannot answer the hour: a Struck Go point with no `waktu` is a
receipt with no time on it. So the activity signal stays where it is, counted from
OpenStreetMap opening hours, until `/web/competition/…` stops answering 500.

When it does, two things become possible and both are small:

- **Struck Go → the demand side of the hour.** `tanggal` plus `waktu` per receipt is the
  measurement the area panel's chart currently cannot make. It would sit beside the
  door-count curve rather than replacing it, because they measure different things.
- **Menu Go → published hours from a second survey.** `jam_buka` and `jam_tutup` are the
  same fact `opening_hours` carries in OpenStreetMap, from a different surveyor. The rules
  in `domain/activity` already handle two surveys of one city without adding them together.

Neither should be built against the public keyless path. Empty `properties` is not a thin
version of the real payload, it is a different endpoint answering a different question.

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
site's own JavaScript bundle for the mission type names.
