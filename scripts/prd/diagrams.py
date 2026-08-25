"""The three drawings the template asks for, plus the SpotOn mark.

The template requires a *bagan* for the AI flow (section 7) and a diagram of
User, Frontend, Backend, Database, MAPID API and AI Router (section 9), and asks
for a simple wireframe (section 10). All three are drawn as vectors in the
template's own palette and in Figtree, so nothing here introduces a typeface or
a colour the document does not already use.

Every box is a rounded rectangle in `TABLE_CELL` on a `RULE_LIGHT` hairline, the
same two values the template's own tables are built from.
"""

import math

from reportlab.pdfbase import pdfmetrics

from . import theme as T

LABEL = 8.0
CAPTION = 7.2


# --- The mark --------------------------------------------------------------


def logo(c, x, y_bottom, size, color=T.INK):
    """The SpotOn mark: a lot with its corner clipped.

    Reproduced from `src/lib/components/ui/BrandMark.svelte`, which is the one
    definition of it: a rounded square border with the bottom right corner cut
    away by a clip path, so that edge is open rather than chamfered. The stroke
    and the corner radius ride the size there, and they ride it here, using the
    same two ratios.
    """
    stroke = max(1.5, size * 0.115)
    radius = max(3.0, size * 0.23)

    c.saveState()
    p = c.beginPath()
    # The clip polygon, carried over from the component's `clip-path` and
    # flipped into PDF's upward y: (0 0, 100% 0, 100% 62%, 62% 100%, 0 100%).
    p.moveTo(x, y_bottom + size)
    p.lineTo(x + size, y_bottom + size)
    p.lineTo(x + size, y_bottom + size * 0.38)
    p.lineTo(x + size * 0.62, y_bottom)
    p.lineTo(x, y_bottom)
    p.close()
    c.clipPath(p, stroke=0, fill=0)

    c.setStrokeColor(color)
    c.setLineWidth(stroke)
    c.roundRect(
        x + stroke / 2,
        y_bottom + stroke / 2,
        size - stroke,
        size - stroke,
        max(0.4, radius - stroke / 2),
        stroke=1,
        fill=0,
    )
    c.restoreState()


def lockup(doc, cx, y_bottom, mark=26.0, gap=9.0, size=20.0, color=T.INK):
    """The mark and the name together, centred on `cx`.

    The wordmark is set in Figtree because the document is set in Figtree, and
    the brief was to change no typeface. In the product itself the name is
    Albert Sans.
    """
    c = doc.c
    name = "SpotOn"
    name_w = pdfmetrics.stringWidth(name, T.F_BOLD, size)
    total = mark + gap + name_w
    x = cx - total / 2
    logo(c, x, y_bottom, mark, color)
    c.setFillColor(color)
    c.setFont(T.F_BOLD, size)
    # Optically centre the name against the mark rather than sitting it on the
    # mark's baseline: the mark is a box, the name has no descender here.
    c.drawString(x + mark + gap, y_bottom + (mark - size * 0.72) / 2, name)


# --- Drawing primitives ----------------------------------------------------


def box(c, x, y_top, w, h, title, lines=(), fill=T.TABLE_CELL, ink=T.INK, at=None):
    """A labelled rounded box. `at` converts top-down y for the caller."""
    y = at(y_top + h)
    c.setFillColor(fill)
    c.setStrokeColor(T.RULE_LIGHT)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 3.5, stroke=1, fill=1)
    c.setFillColor(ink)
    c.setFont(T.F_BOLD, LABEL)
    c.drawCentredString(x + w / 2, at(y_top + 12.0), title)
    c.setFont(T.F_REG, CAPTION)
    c.setFillColor(T.MUTED)
    for i, line in enumerate(lines):
        c.drawCentredString(x + w / 2, at(y_top + 23.0 + i * 8.6), line)


def arrow(c, x0, y0, x1, y1, at, dashed=False, color=T.BLUE_MID, head=4.0):
    """A straight arrow between two top-down points."""
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(0.9)
    c.setDash(2, 2) if dashed else c.setDash()
    ax, ay, bx, by = x0, at(y0), x1, at(y1)
    ang = math.atan2(by - ay, bx - ax)
    # Stop the shaft short so the head is the tip, not an overlay on it.
    sx, sy = bx - head * math.cos(ang), by - head * math.sin(ang)
    c.line(ax, ay, sx, sy)
    c.setDash()
    p = c.beginPath()
    p.moveTo(bx, by)
    p.lineTo(
        bx - head * 1.9 * math.cos(ang) + head * 0.75 * math.sin(ang),
        by - head * 1.9 * math.sin(ang) - head * 0.75 * math.cos(ang),
    )
    p.lineTo(
        bx - head * 1.9 * math.cos(ang) - head * 0.75 * math.sin(ang),
        by - head * 1.9 * math.sin(ang) + head * 0.75 * math.cos(ang),
    )
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def elbow(c, x0, y0, x1, y1, at, color=T.BLUE_MID, head=4.0):
    """A right-angled connector: across, then down or up, then into the target."""
    c.setStrokeColor(color)
    c.setLineWidth(0.9)
    c.setDash()
    mid = x0 + (x1 - x0) * 0.45
    c.line(x0, at(y0), mid, at(y0))
    c.line(mid, at(y0), mid, at(y1))
    arrow(c, mid, y1, x1, y1, at, color=color, head=head)


def band(doc, y_top, title, body, height=None):
    """A full width note in the template's callout colours, under a drawing.

    The body wraps rather than running off the right edge, which is why it goes
    through `draw_text` instead of `drawString`.
    """
    c, at = doc.c, doc._at
    inner = T.WIDTH - 18.0
    body_h = doc.text_height(body, CAPTION, CAPTION + 2.2, inner)
    h = height or (body_h + 20.0)
    c.setFillColor(T.BOX_FILL)
    c.setStrokeColor(T.RULE_LIGHT)
    c.setLineWidth(0.8)
    c.roundRect(T.LEFT, at(y_top + h), T.WIDTH, h, 3.5, stroke=1, fill=1)
    c.setFillColor(T.INK)
    c.setFont(T.F_BOLD, LABEL)
    c.drawString(T.LEFT + 9.0, at(y_top + 11.0), title)
    doc.draw_text(
        body, T.LEFT + 9.0, y_top + 14.0, inner, CAPTION, CAPTION + 2.2, T.F_REG, T.MUTED
    )
    return h


def caption(doc, text, after=10.0):
    """The italic grey line under a drawing, in the template's note style."""
    h = doc.draw_text(
        text, T.LEFT, doc.y, T.WIDTH, T.S_NOTE - 1.0, T.LEAD_NOTE - 1.0, T.F_ITAL, T.MUTED
    )
    doc.y += h + after


# --- 1. The AI flow (section 7) -------------------------------------------


def ai_flow(doc):
    """Four stages left to right, with the keyless fallback hanging below."""
    c, at = doc.c, doc._at
    H = 60.0
    NOTE_H = 26.0
    total = H + 30.0 + NOTE_H
    doc.ensure(total + 8.0)
    top = doc.y

    n = 4
    gap = 17.5
    w = (T.WIDTH - gap * (n - 1)) / n
    xs = [T.LEFT + i * (w + gap) for i in range(n)]

    stages = [
        ("1. Input", ["Pertanyaan bahasa", "alami, kategori,", "bobot, radius"]),
        ("2. Pemahaman", ["LLM lewat OpenRouter,", "function calling", "memilih 1 operasi"]),
        ("3. Perhitungan", ["scoring.ts membaca", "grid dan menghitung", "setiap angka"]),
        ("4. Output", ["Peringkat petak,", "sorotan peta, alasan,", "N titik, parsedBy"]),
    ]
    for i, (title, lines) in enumerate(stages):
        box(c, xs[i], top, w, H, title, lines, at=at)
        if i:
            arrow(c, xs[i] - gap + 1.5, top + H / 2, xs[i] - 2.0, top + H / 2, at)

    # The fallback. Dashed, because it is the path taken only when there is no
    # key, and the interface says which path it took either way.
    note_top = top + H + 30.0
    arrow(c, xs[1] + w / 2, top + H + 2.0, xs[1] + w / 2, note_top - 2.0, at, dashed=True)
    h = band(
        doc,
        note_top,
        "Tanpa kunci OPENROUTER_API_KEY",
        "Parser aturan di domain/nlq.ts mengambil alih tahap 2. Tahap 3 dan 4 tidak berubah, dan "
        "jawaban ditandai parsedBy = aturan.",
    )
    doc.y = note_top + h + 10.0


# --- 2. Technology architecture (section 9) --------------------------------


def architecture(doc):
    c, at = doc.c, doc._at
    doc.ensure(196.0)
    top = doc.y

    maps_h, main_h, side_h, side_gap = 28.0, 62.0, 30.0, 10.0
    stack_h = side_h * 3 + side_gap * 2
    row_top = top + maps_h + 22.0
    mid = row_top + (stack_h - main_h) / 2

    user_x, user_w = T.LEFT, 72.0
    fe_x, fe_w = 151.2, 120.0
    be_x, be_w = 289.2, 120.0
    side_x, side_w = 427.2, T.RIGHT - 427.2

    box(c, user_x, mid + 8.0, user_w, main_h - 16.0, "Pengguna", ["peramban", "desktop", "dan ponsel"], at=at)
    box(c, fe_x, mid, fe_w, main_h, "Frontend", ["SvelteKit 2, Svelte 5", "MapLibre GL", "peta, panel, tabel"], at=at)
    box(c, be_x, mid, be_w, main_h, "Backend", ["SvelteKit server routes", "di Vercel", "/api/*"], at=at)

    # Centred over the frontend, because the basemap is served to the browser
    # and not through the backend, and a vertical arrow says that plainly.
    maps_w = fe_w + 44.0
    box(c, fe_x + (fe_w - maps_w) / 2, top, maps_w, maps_h, "MAPID MAPS (basemap wajib)", [], at=at)
    arrow(c, fe_x + fe_w / 2, top + maps_h + 2.0, fe_x + fe_w / 2, mid - 2.0, at)

    sides = [
        ("MAPID API", ["Data Premium, MAPID APPS"]),
        ("AI Router", ["OpenRouter, function calling"]),
        ("Database", ["MongoDB: akun, sesi, kuota"]),
    ]
    for i, (title, lines) in enumerate(sides):
        y = row_top + i * (side_h + side_gap)
        box(c, side_x, y, side_w, side_h, title, lines, at=at)
        elbow(c, be_x + be_w + 1.5, mid + main_h / 2, side_x - 2.0, y + side_h / 2, at)

    # Both directions between the three columns: the browser asks and is answered.
    for x0, x1 in ((user_x + user_w, fe_x), (fe_x + fe_w, be_x)):
        arrow(c, x0 + 1.5, mid + main_h / 2 - 5.0, x1 - 2.0, mid + main_h / 2 - 5.0, at)
        arrow(c, x1 - 2.0, mid + main_h / 2 + 5.0, x0 + 1.5, mid + main_h / 2 + 5.0, at)

    band_top = row_top + stack_h + 12.0
    h = band(
        doc,
        band_top,
        "Waktu build, bukan waktu permintaan",
        "scripts/*.mjs membaca Overpass, katalog Data Premium MAPID dan misi MAPID APPS, lalu "
        "menulis grid H3 ke dalam bundel. Peramban menerima grid yang sudah jadi, sehingga "
        "menggeser peta dan mengganti kategori tidak memanggil server sama sekali.",
    )
    doc.y = band_top + h + 10.0


# --- 3. Wireframe (section 10) ---------------------------------------------


def _frame(c, x, y_top, w, h, at, label):
    c.setFillColor(T.WHITE)
    c.setStrokeColor(T.RULE_MID)
    c.setLineWidth(0.9)
    c.roundRect(x, at(y_top + h), w, h, 4.0, stroke=1, fill=1)
    c.setFillColor(T.BLUE_DEEP)
    c.setFont(T.F_BOLD, LABEL)
    c.drawString(x, at(y_top - 4.0), label)


def _pane(c, x, y_top, w, h, at, title, lines=(), fill=T.TABLE_CELL):
    c.setFillColor(fill)
    c.setStrokeColor(T.RULE_LIGHT)
    c.setLineWidth(0.7)
    c.rect(x, at(y_top + h), w, h, stroke=1, fill=1)
    c.setFillColor(T.INK)
    c.setFont(T.F_BOLD, 6.9)
    c.drawString(x + 4.0, at(y_top + 9.0), title)
    c.setFont(T.F_REG, 6.4)
    c.setFillColor(T.MUTED)
    for i, line in enumerate(lines):
        c.drawString(x + 4.0, at(y_top + 18.0 + i * 7.6), line)


def _hexes(c, x, y_top, w, h, at):
    """A patch of the H3 grid, so the map pane reads as the product's own map."""
    r = 9.0
    dx, dy = r * 1.5, r * math.sqrt(3)
    ramp = [T.TABLE_CELL, T.RULE_LIGHT, T.RULE_MID, T.RULE_COVER, T.BLUE_MID]
    col = 0
    px = x + 12.0
    while px < x + w - 10.0:
        row = 0
        py = y_top + 14.0 + (dy / 2 if col % 2 else 0)
        while py < y_top + h - 8.0:
            p = c.beginPath()
            for i in range(6):
                a = math.pi / 3 * i
                vx, vy = px + r * math.cos(a), at(py) + r * math.sin(a)
                p.moveTo(vx, vy) if i == 0 else p.lineTo(vx, vy)
            p.close()
            c.setFillColor(ramp[(col * 3 + row * 2) % len(ramp)])
            c.setStrokeColor(T.WHITE)
            c.setLineWidth(0.5)
            c.drawPath(p, stroke=1, fill=1)
            py += dy
            row += 1
        px += dx
        col += 1


def wireframe(doc):
    c, at = doc.c, doc._at
    landing_h, app_h = 96.0, 196.0
    doc.ensure(landing_h + app_h + 46.0)
    top = doc.y + 10.0

    # (a) The landing page.
    _frame(c, T.LEFT, top, T.WIDTH, landing_h, at, "a. Halaman utama  /")
    _pane(c, T.LEFT + 6.0, top + 6.0, T.WIDTH - 12.0, 14.0, at, "SpotOn      Metode   Cakupan   Tanya      ID/EN   Tema")
    _pane(
        c, T.LEFT + 6.0, top + 24.0, 226.0, 44.0, at,
        "Maket isometrik, digerakkan gulir",
        ["Jam mengikuti waktu setempat.", "Ditandai permanen: data contoh."],
    )
    _pane(
        c, T.LEFT + 238.0, top + 24.0, T.WIDTH - 244.0, 44.0, at,
        "Pertanyaan, jawaban, alasan",
        ["Percakapan contoh dihitung", "mesin skor yang sama."],
    )
    _pane(c, T.LEFT + 6.0, top + 72.0, T.WIDTH - 12.0, 18.0, at, "Tiga sinyal   |   Cakupan data dan yang belum terdata   |   Masuk ke aplikasi")

    # (b) The WebGIS.
    app_top = top + landing_h + 26.0
    _frame(c, T.LEFT, app_top, T.WIDTH, app_h, at, "b. Aplikasi WebGIS  /app")
    _pane(c, T.LEFT + 6.0, app_top + 6.0, T.WIDTH - 12.0, 14.0, at, "SpotOn   Kopi Minuman Roti Warteg ...   Sumber: OSM | MAPID   Radius 800 m   Akun")

    left_w, right_w = 126.0, 126.0
    map_x = T.LEFT + 6.0 + left_w + 6.0
    map_w = T.WIDTH - 12.0 - left_w - right_w - 12.0
    body_top, body_h = app_top + 24.0, 118.0

    _pane(
        c, T.LEFT + 6.0, body_top, left_w, body_h, at,
        "Pengaturan lanjutan",
        [
            "Bobot permintaan  wd",
            "Bobot kompetisi   ws",
            "Gerbang ruang     on/off",
            "Radius 400 - 800 m",
            "",
            "Layer",
            "  Skor peluang",
            "  Simpul transit",
            "  Listing properti",
            "  Catatan lapangan",
            "",
            "Legenda skor",
        ],
    )

    c.setFillColor(T.WHITE)
    c.setStrokeColor(T.RULE_LIGHT)
    c.rect(map_x, at(body_top + body_h), map_w, body_h, stroke=1, fill=1)
    _hexes(c, map_x, body_top, map_w, body_h, at)
    c.setFillColor(T.INK)
    c.setFont(T.F_BOLD, 6.9)
    c.drawString(map_x + 4.0, at(body_top + 9.0), "Peta MAPID MAPS, grid H3 r8")

    _pane(
        c, map_x + map_w + 6.0, body_top, right_w, body_h, at,
        "Tapak",
        [
            "\"Usaha apa yang masuk",
            "akal di sekitar sini?\"",
            "",
            "Query terstruktur",
            "ditampilkan apa adanya.",
            "",
            "1. Petak A   skor 0,78",
            "2. Petak B   skor 0,71",
            "3. Petak C   skor 0,66",
            "",
            "Kenapa di sini?  N = 42",
            "parsedBy: model",
        ],
    )
    _pane(
        c, T.LEFT + 6.0, body_top + body_h + 6.0, T.WIDTH - 12.0, 36.0, at,
        "Tabel atribut, dapat diurutkan per kolom",
        [
            "Petak | Nama | Skor | Permintaan | Kompetisi | Akses transit | Listing | Harga per m2 | N",
            "Petak tanpa data ditandai belum terdata, tidak diinterpolasi.",
        ],
    )
    doc.y = app_top + app_h + 12.0
