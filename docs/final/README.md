# Final-stage materials

Everything the organisers asked for in *Informasi Persiapan Final Top 10 WebGIS
Competition 2026* (the announcement itself is here as
`Pengumuman_untuk_Tahapan_Final.pdf`: the deliverables, the rundown for 23 and 24
September, the dress code, and the 22 September 15.00 WIB submission deadline), written as a pitch rather than a report: one story, told in the
second person, with the product doing the showing. The few figures that remain are
read from the grid file's metadata or computed by the scoring engine, and every
screenshot is the real interface on MAPID MAPS.

| Deliverable | File | Rule it answers |
| --- | --- | --- |
| Pitch deck, 8 slides, English, no text under 18 pt | `SpotOn_Pitch_Deck.pptx` | PPT: max 8 slides including opener and closer, min 18 pt, English. Speaker notes carry a 5-minute script. |
| A2 poster, English, 9 mandated sections plus QR code | `SpotOn_Poster_A2.pdf` (print), `SpotOn_Poster_A2_preview.png` (screen) | Poster: title and team, background and problem, objective and solution, data and methodology, WebGIS and features, results and insights, benefits and applications, conclusion, QR code and link. |
| Product video, 56 seconds, 1080p at 25 frames a second, with narration | `SpotOn_Product_Video.mp4` | Video: at most one minute, a short overview of the product. |
| QR code to the live WebGIS | `qr-spot-on-three.png` | Links to https://spot-on-three.vercel.app |

## Before submitting

- **Canva.** The rules ask for the deck to be designed in Canva. Upload the `.pptx`
  there (Create a design, Import file) and it opens as an editable Canva design. The
  fonts are Calibri, which Canva substitutes cleanly.
- **Institution logo.** The rules allow the BINUS logo on the deck and the poster
  requires "logo" under team identity. The SpotOn mark is in place. Add the BINUS
  logo at the top right of the title and closing slides, and beside the team block
  in the poster header, from the university's official file.
- **The area model.** The video steps into the model of Rawa Selatan, the catchment
  Tapak names first for a coffee shop, and the landing page's model of Setiabudi
  Astra turns on its disc. Both are read off MAPID MAPS' own tiles, which is what
  the narration says.
- **Narration.** The video voice is synthetic (Piper, en_US lessac), spoken by
  `video/narrate.py` from the lines in `video/narration.json`. Re-record it with a
  team member's voice if you prefer: one WAV per line under `video/voice/`, named
  by the line's id, and `video/assemble.py` lays them in.
- **Print.** The poster PDF is exactly 420 × 594 mm with no bleed. Print at 100%,
  no scaling, on HVS.

## Regenerating

Every script here runs against the dev server with the MAPID Map Service key set
and no database, so signing in is one call and the demo account's small weekly
allowance of questions is what gets spent. Restart the server to reset it.

```bash
MAPID_MAPSERVICES_KEY=… PUBLIC_MAPID_MAP_KEY=… npm run dev -- --port 5173 --host 127.0.0.1
```

The public key is the same key: the landing page's model reads the basemap the
public configuration allows.

### The video

From `video/`:

```bash
node prepare.mjs                                  # fonts, mark, QR and hero picture for the two cards
python3 narrate.py path/to/en-us-lessac-medium.onnx   # voice/*.wav, needs pip install piper-tts
node record.mjs                                   # raw/*.mp4 and raw/log.json, about half an hour
python3 assemble.py                               # ../SpotOn_Product_Video.mp4, and parts/contact.png to check it
```

`record.mjs` shoots frame by frame rather than in real time. Without a GPU the page
draws its models at a frame or two a second, so the page's clock is taken over and
moved forty milliseconds per screenshot, which is why the takes are smooth on a
machine that cannot play them. `node record.mjs app` re-records one scene. Every
request to MAPID's tile server goes through `tilecache.mjs`, which fetches each one
with retries and keeps it, so a dropped tile cannot leave a model bare and a second
take needs no network. The Piper voice is the release asset
`voice-en-us-lessac-medium.tar.gz` from `rhasspy/piper` v0.0.2. `assemble.py` needs
`pip install imageio-ffmpeg`, whose ffmpeg has libx264, aac and xfade.

### The pictures in the deck and the poster

From this directory:

```bash
node shoot.mjs && python3 crops.py                # shots/, then crops/ and poster/img/*.jpg
python3 deck/swap-pictures.py                     # the crops into SpotOn_Pitch_Deck.pptx, in place
(cd poster && node render.mjs)                    # SpotOn_Poster_A2.pdf and poster-preview.png, to move up here
```

The deck's layout, text and notes come from `deck/build.cjs`, which reads its
figures from `deck/figures.json` (produced from `src/lib/data/hexes.json` and the
`/api/scores` endpoint) and its pictures from a `../crops` and `../assets` layout
beside it. Rebuilding it needs pptxgenjs in a scratch folder. `swap-pictures.py`
is the short way: it replaces the pictures inside the built deck, each keyed by its
slide and its size in pixels, and touches nothing else. `deck/preview.py` is a
rough renderer that draws every slide with a font wider than Calibri, so any text
that fits there fits in PowerPoint.
