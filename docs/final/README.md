# Final-stage materials

Everything the organisers asked for in *Informasi Persiapan Final Top 10 WebGIS
Competition 2026*, built from the product itself: every figure in the copy is read
from the grid file's metadata or computed by the scoring engine, and every screenshot
is the real interface.

| Deliverable | File | Rule it answers |
| --- | --- | --- |
| Pitch deck, 8 slides, English, no text under 18 pt | `SpotOn_Pitch_Deck.pptx` | PPT: max 8 slides including opener and closer, min 18 pt, English. Speaker notes carry a 5-minute script. |
| A2 poster, English, 9 mandated sections plus QR code | `SpotOn_Poster_A2.pdf` (print), `SpotOn_Poster_A2_preview.png` (screen) | Poster: title and team, background and problem, objective and solution, data and methodology, WebGIS and features, results and insights, benefits and applications, conclusion, QR code and link. |
| Product video, 59 seconds, 1080p with narration | `SpotOn_Product_Video.mp4` | Video: at most one minute, a short overview of the product. |
| QR code to the live WebGIS | `qr-spot-on-three.png` | Links to https://spot-on-three.vercel.app |

## Before submitting

- **Canva.** The rules ask for the deck to be designed in Canva. Upload the `.pptx`
  there (Create a design, Import file) and it opens as an editable Canva design. The
  fonts are Calibri, which Canva substitutes cleanly.
- **Institution logo.** The rules allow the BINUS logo on the deck and the poster
  requires "logo" under team identity. The SpotOn mark is in place. Add the BINUS
  logo at the top right of the title and closing slides, and beside the team block
  in the poster header, from the university's official file.
- **Basemap in the screenshots.** The screenshots were captured on a machine with no
  route to the tile servers, so the map shows the grid, transit lines and labels on a
  plain ground rather than on MAPID MAPS. If you want the basemap visible, re-shoot
  the same states on the live site and drop the images over the placeholders: they
  are ordinary pictures in the deck, and files under `poster/img/` for the poster.
- **Narration.** The video voice is synthetic (Piper, en_US lessac). Re-record it with
  a team member's voice if you prefer: the sentences are in `video/narration.json`.
- **Print.** The poster PDF is exactly 420 × 594 mm with no bleed. Print at 100%,
  no scaling, on HVS.

## Regenerating

The deck reads its figures from `deck/figures.json`, which is produced from
`src/lib/data/hexes.json` and the `/api/scores` endpoint. Rebuild the grid and
regenerate that file before rebuilding the deck.

```bash
# deck (needs pptxgenjs, react-icons, react, react-dom in a scratch folder)
node deck/icons.cjs && node deck/build.cjs

# poster (Playwright's Chromium prints the HTML at A2)
node poster/render.mjs

# video (records the running dev server, then cuts and narrates)
node video/record.mjs && python3 video/assemble.py
```

`deck/preview.py` is a rough renderer that draws every slide with a font wider than
Calibri, so any text that fits there fits in PowerPoint. LibreOffice Impress renders
the deck too, once installed.
