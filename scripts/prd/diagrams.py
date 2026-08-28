"""The document's eight figures, plus the SpotOn mark.

Three are required. The template asks for a *bagan* of the AI flow (section 7),
a diagram naming User, Frontend, Backend, Database, MAPID API and AI Router
(section 9), and a wireframe (section 10). The other five are here because the
passages beside them were making visual arguments in prose: the three signals
read together (section 2), how far each source reaches across the grid (section
5), the survey cell and the nodes it captures (section 6), why the unit of
analysis is a grid rather than a catchment per stop, and what the score is
actually made of (both section 7).

Everything is drawn as vectors in the template's own palette and in Figtree, so
nothing here introduces a typeface or a colour the document does not already
use. Every box is a rounded rectangle in `TABLE_CELL` on a `RULE_LIGHT`
hairline, the two values the template's own tables are built from.

Two rules the charts follow, from the visualisation guidance rather than from
taste. Magnitude is one hue running light to dark, never a set of separate
colours, because the states being compared are ordered rather than different
things. And where identity really is the job, on the map's four transit modes,
it is carried by marker SHAPE, so the figure survives greyscale printing and a
colour-blind reader.

The maps and charts are drawn from `figures.collect()`, which reads the real
rings, the real stop coordinates and the real per-source coverage. None of it
is sketched.
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
        ("3. Perhitungan", ["Mesin skor membaca", "grid dan menghitung", "setiap angka"]),
        ("4. Output", ["Peringkat petak,", "sorotan peta, alasan,", "N titik, jalur jawaban"]),
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
        "Tanpa kunci API model bahasa",
        "Parser aturan mengambil alih tahap 2. Tahap 3 dan 4 tidak berubah, dan jawabannya "
        "ditandai sebagai hasil parser aturan.",
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
    box(c, be_x, mid, be_w, main_h, "Backend", ["SvelteKit server routes", "di Vercel", "rute API"], at=at)

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
        "Skrip pembangun data membaca Overpass, katalog Data Premium MAPID dan misi MAPID APPS, "
        "lalu menulis grid H3 ke dalam bundel. Peramban menerima grid yang sudah jadi, sehingga "
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
            "dijawab: model",
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


# --- 4. The three signals (section 2) --------------------------------------


def _hexagon(c, cx, cy_pdf, r, fill, stroke, lw=0.9):
    p = c.beginPath()
    for i in range(6):
        a = math.pi / 3 * i + math.pi / 6
        vx, vy = cx + r * math.cos(a), cy_pdf + r * math.sin(a)
        p.moveTo(vx, vy) if i == 0 else p.lineTo(vx, vy)
    p.close()
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    c.drawPath(p, stroke=1, fill=1)


def three_signals(doc, f):
    """The product's whole thesis: three signals read together in one cell.

    It is the one claim the document repeats most and the only one that was
    carried entirely in prose.
    """
    c, at = doc.c, doc._at
    doc.ensure(190.0)
    top = doc.y

    src_x, src_w, src_h, gap = T.LEFT, 158.0, 34.0, 12.0
    hex_cx, hex_r = 322.0, 40.0
    out_x, out_w = 392.0, T.RIGHT - 392.0
    mid = top + (src_h * 3 + gap * 2) / 2

    sources = [
        ("Permintaan", "Struk Go, kerapatan usaha"),
        ("Kompetisi", "Menu Go, katalog, OSM"),
        ("Ruang", "Properti Go, katalog"),
    ]
    for i, (title, note) in enumerate(sources):
        y = top + i * (src_h + gap)
        c.setFillColor(T.TABLE_CELL)
        c.setStrokeColor(T.RULE_LIGHT)
        c.setLineWidth(0.8)
        c.roundRect(src_x, at(y + src_h), src_w, src_h, 3.5, stroke=1, fill=1)
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, LABEL + 0.5)
        c.drawString(src_x + 9.0, at(y + 14.0), title)
        c.setFont(T.F_REG, CAPTION)
        c.setFillColor(T.MUTED)
        c.drawString(src_x + 9.0, at(y + 24.5), note)
        arrow(c, src_x + src_w + 2.0, y + src_h / 2, hex_cx - hex_r - 3.0, mid, at)

    _hexagon(c, hex_cx, at(mid), hex_r, T.BOX_FILL, T.BLUE_MID, 1.2)
    c.setFillColor(T.INK)
    c.setFont(T.F_BOLD, LABEL)
    c.drawCentredString(hex_cx, at(mid - 3.0), "Satu petak")
    c.setFont(T.F_REG, CAPTION)
    c.setFillColor(T.MUTED)
    c.drawCentredString(hex_cx, at(mid + 7.0), f"H3 r{f['resolution']}")
    c.drawCentredString(hex_cx, at(mid + 16.0), f"radius {f['radius']} m")

    arrow(c, hex_cx + hex_r + 3.0, mid, out_x - 2.0, mid, at)
    c.setFillColor(T.TABLE_CELL)
    c.setStrokeColor(T.RULE_LIGHT)
    c.roundRect(out_x, at(mid + 26.0), out_w, 52.0, 3.5, stroke=1, fill=1)
    c.setFillColor(T.INK)
    c.setFont(T.F_BOLD, LABEL + 0.5)
    c.drawCentredString(out_x + out_w / 2, at(mid - 12.0), "Opportunity Score")
    c.setFont(T.F_REG, CAPTION)
    c.setFillColor(T.MUTED)
    c.drawCentredString(out_x + out_w / 2, at(mid - 1.0), "per kategori usaha,")
    c.drawCentredString(out_x + out_w / 2, at(mid + 8.0), "dengan N titik di")
    c.drawCentredString(out_x + out_w / 2, at(mid + 17.0), "belakang tiap angka")

    band_top = top + src_h * 3 + gap * 2 + 14.0
    h = band(
        doc,
        band_top,
        "Ruang adalah gerbang, bukan bonus",
        f"Permintaan dikurangi kompetisi belum lengkap sampai disaring oleh ruang yang benar-benar "
        f"bisa ditempati. Petak tanpa unit yang ditawarkan turun ke "
        f"{str(f['gate_blocked']).replace('.', ',')} kali skornya, bukan ke nol.",
    )
    doc.y = band_top + h + 6.0


# --- 5. Source coverage (section 5) ----------------------------------------


def coverage(doc, f):
    """How much of the grid each source can speak for.

    One hue, light to dark, because the three states are ordered rather than
    separate identities. Only the strongest state is direct-labelled: the other
    two are read off the shared 562-cell track, and a number on every segment
    would be noise.
    """
    c, at = doc.c, doc._at
    cov = f["coverage"]
    rows = cov["rows"]
    total = cov["total"]

    legend_h, row_h, bar_h = 16.0, 27.0, 11.0
    H = legend_h + len(rows) * row_h + 6.0
    doc.ensure(H + 6.0)
    top = doc.y

    label_w = 152.0
    bar_x = T.LEFT + label_w + 8.0
    bar_w = T.RIGHT - bar_x - 46.0
    ramp = [T.TABLE_HEAD, T.RULE_COVER, T.TABLE_CELL]
    names = ["terbaca", "terbaca tipis", "belum terjangkau"]

    # Legend. Three states means identity is never carried by colour alone.
    lx = bar_x
    for i, name in enumerate(names):
        c.setFillColor(ramp[i])
        c.setStrokeColor(T.RULE_LIGHT)
        c.setLineWidth(0.6)
        c.rect(lx, at(top + 8.5), 9.0, 7.0, stroke=1, fill=1)
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        c.drawString(lx + 12.5, at(top + 8.0), name)
        lx += 12.5 + pdfmetrics.stringWidth(name, T.F_REG, CAPTION) + 16.0

    for i, (label, note, states) in enumerate(rows):
        y = top + legend_h + i * row_h
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, LABEL)
        c.drawString(T.LEFT, at(y + 8.0), label)
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        c.drawString(T.LEFT, at(y + 18.0), note)

        x = bar_x
        for j, (_, count) in enumerate(states):
            if count <= 0:
                continue
            w = bar_w * count / total
            c.setFillColor(ramp[j])
            # A 2pt surface gap separates the segments instead of a border.
            c.setStrokeColor(T.WHITE)
            c.setLineWidth(0.0)
            c.rect(x, at(y + 3.0 + bar_h), max(0.0, w - 2.0), bar_h, stroke=0, fill=1)
            if j == 2:  # the untouched remainder reads as a track, so outline it
                c.setStrokeColor(T.RULE_LIGHT)
                c.setLineWidth(0.6)
                c.rect(x, at(y + 3.0 + bar_h), max(0.0, w - 2.0), bar_h, stroke=1, fill=0)
            x += w

        # Direct-label the state that matters, and nothing else.
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, CAPTION + 0.6)
        c.drawString(bar_x + bar_w + 6.0, at(y + 11.5), f"{states[0][1]}")
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        c.drawString(
            bar_x + bar_w + 6.0 + pdfmetrics.stringWidth(str(states[0][1]), T.F_BOLD, CAPTION + 0.6),
            at(y + 11.5),
            f"/{total}",
        )
    doc.y = top + H + 4.0


# --- 6. The survey site, as a map (section 6) ------------------------------


def site_map(doc, f):
    """The survey cell drawn from its real ring, with the nodes it really captures.

    Mode is carried by marker SHAPE rather than colour, so the map survives a
    greyscale print and a colour-blind reader, and only the rail stops are
    labelled: eleven labels would cover the thing they annotate.
    """
    c, at = doc.c, doc._at
    g = f["geometry"]
    H = 232.0
    doc.ensure(H + 6.0)
    top = doc.y

    lat0, lon0 = g["centre"]
    kx = math.cos(math.radians(lat0))

    # Everything that has to be inside the frame, so the fit is measured rather
    # than guessed.
    pts = [(la, lo) for ring in [g["boundary"]] for lo, la in ring]
    for nb in g["neighbours"]:
        pts += [(la, lo) for lo, la in nb["boundary"]]
    span_lat = max(p[0] for p in pts) - min(p[0] for p in pts)
    span_lon = (max(p[1] for p in pts) - min(p[1] for p in pts)) * kx
    mid_lat = (max(p[0] for p in pts) + min(p[0] for p in pts)) / 2
    mid_lon = (max(p[1] for p in pts) + min(p[1] for p in pts)) / 2

    frame_w, frame_h = T.WIDTH, H - 30.0
    scale = min(frame_w * 0.92 / span_lon, frame_h * 0.92 / span_lat)
    cx0, cy0 = T.LEFT + frame_w / 2, top + frame_h / 2

    def px(lat, lon):
        return cx0 + (lon - mid_lon) * kx * scale, cy0 - (lat - mid_lat) * scale

    def ring(boundary, fill, stroke, lw=0.8):
        p = c.beginPath()
        for i, (lo, la) in enumerate(boundary):
            x, y = px(la, lo)
            p.moveTo(x, at(y)) if i == 0 else p.lineTo(x, at(y))
        p.close()
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(lw)
        c.drawPath(p, stroke=1, fill=1)

    for nb in g["neighbours"]:
        ring(nb["boundary"], T.WHITE, T.RULE_LIGHT, 0.7)
    ring(g["boundary"], T.BOX_FILL, T.BLUE_MID, 1.3)

    # The walking radius, drawn at true scale off the same centre the engine
    # measures from.
    ccx, ccy = px(lat0, lon0)
    metres = scale / 111_320.0
    c.setStrokeColor(T.RULE_COVER)
    c.setLineWidth(0.8)
    c.circle(ccx, at(ccy), f["radius"] * metres, stroke=1, fill=0)

    def marker(x, y, mode):
        c.setFillColor(T.TABLE_HEAD)
        c.setStrokeColor(T.WHITE)
        c.setLineWidth(1.2)
        if mode == "mrt":
            c.rect(x - 3.2, at(y) - 3.2, 6.4, 6.4, stroke=1, fill=1)
        elif mode == "krl":
            c.circle(x, at(y), 3.4, stroke=1, fill=1)
        elif mode == "lrt":
            p = c.beginPath()
            p.moveTo(x, at(y) + 4.0)
            p.lineTo(x + 3.6, at(y) - 2.6)
            p.lineTo(x - 3.6, at(y) - 2.6)
            p.close()
            c.drawPath(p, stroke=1, fill=1)
        else:
            c.setFillColor(T.WHITE)
            c.setStrokeColor(T.BLUE_MID)
            c.setLineWidth(1.1)
            c.circle(x, at(y), 2.6, stroke=1, fill=1)

    placed = {"left": [], "right": []}
    labelled = []
    for s in g["stops"]:
        x, y = px(s["lat"], s["lon"])
        marker(x, y, s["mode"])
        if s["mode"] in ("mrt", "krl", "lrt") and s["name"]:
            labelled.append((x, y, s["name"]))

    # Labels go on the outward side of the cluster and are nudged apart where
    # they would otherwise sit on top of each other. Eleven markers in a
    # 1.6 km circle leave no room for tidiness by luck.
    c.setFont(T.F_BOLD, 6.5)
    for x, y, name in sorted(labelled, key=lambda t: t[1]):
        # Anything sitting near the centre goes left, because the eastern half
        # is where the interchange piles up.
        side = "right" if x >= ccx + 12.0 else "left"
        ly_ = y
        for taken in placed[side]:
            if abs(ly_ - taken) < 10.0:
                ly_ = taken + 10.0
        placed[side].append(ly_)
        short = name if len(name) <= 24 else name.rsplit(" ", 1)[0]
        short = short if len(short) <= 24 else short[:23]
        c.setFillColor(T.INK)
        if side == "right":
            c.drawString(x + 6.5, at(ly_ + 2.2), short)
        else:
            c.drawRightString(x - 6.5, at(ly_ + 2.2), short)
        if abs(ly_ - y) > 1.0:  # a leader, so a nudged label still points home
            c.setStrokeColor(T.RULE_MID)
            c.setLineWidth(0.5)
            sx_ = x + 4.5 if side == "right" else x - 4.5
            c.line(sx_, at(y), sx_, at(ly_))

    sx, sy = px(*g["station"])
    c.setStrokeColor(T.BLUE_DARK)
    c.setLineWidth(1.4)
    c.circle(sx, at(sy), 6.6, stroke=1, fill=0)

    # Scale bar, in the metres the map is actually drawn at.
    bar_m = 400.0
    bx, by = T.LEFT + 6.0, top + frame_h - 6.0
    c.setStrokeColor(T.MUTED)
    c.setLineWidth(1.0)
    c.line(bx, at(by), bx + bar_m * metres, at(by))
    c.line(bx, at(by - 2.5), bx, at(by + 2.5))
    c.line(bx + bar_m * metres, at(by - 2.5), bx + bar_m * metres, at(by + 2.5))
    c.setFillColor(T.MUTED)
    c.setFont(T.F_REG, CAPTION)
    c.drawString(bx + bar_m * metres + 5.0, at(by + 2.5), "400 m")

    # Legend: shape carries the mode, so it is spelled out here.
    ly = top + frame_h + 12.0
    lx = T.LEFT
    counts = {"mrt": f["site_mrt"], "krl": f["site_krl"], "lrt": f["site_lrt"], "brt": f["site_brt"]}
    for mode, name in (("mrt", "MRT"), ("krl", "KRL"), ("lrt", "LRT"), ("brt", "TransJakarta")):
        marker(lx + 4.0, ly, mode)
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        text = f"{name} {counts[mode]}"
        c.drawString(lx + 11.0, at(ly + 2.4), text)
        lx += 11.0 + pdfmetrics.stringWidth(text, T.F_REG, CAPTION) + 18.0
    c.setStrokeColor(T.BLUE_DARK)
    c.setLineWidth(1.2)
    c.circle(lx + 4.0, at(ly), 5.0, stroke=1, fill=0)
    c.setFillColor(T.MUTED)
    c.drawString(lx + 12.0, at(ly + 2.4), f["site_station"])
    doc.y = top + H + 4.0


# --- 7. Why a hexagon grid (section 7) -------------------------------------


def grid_rationale(doc, f):
    """The argument for the grid, which is inherently a picture.

    Halte sit 400 to 500 m apart while the walking radius is 800 m, so per stop
    catchments overlap almost entirely and count the same shoppers several
    times. Two panels at the same scale say that faster than the paragraph
    beside them can.
    """
    c, at = doc.c, doc._at
    H = 156.0
    doc.ensure(H + 6.0)
    top = doc.y

    pw = (T.WIDTH - 20.0) / 2
    plot_h = 108.0
    metres = 46.0 / f["radius"]  # 800 m reads as 46pt in both panels
    spacing = 450.0 * metres

    def panel(x, title, note):
        c.setFillColor(T.WHITE)
        c.setStrokeColor(T.RULE_MID)
        c.setLineWidth(0.9)
        c.roundRect(x, at(top + plot_h), pw, plot_h, 4.0, stroke=1, fill=1)
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, LABEL)
        c.drawString(x + 8.0, at(top + 13.0), title)
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        c.drawString(x + 8.0, at(top + plot_h + 12.0), note)

    def stops(x, n=3):
        cx = x + pw / 2
        return [(cx + (i - (n - 1) / 2) * spacing, top + 62.0) for i in range(n)]

    # Left: overlapping per stop catchments.
    lx = T.LEFT
    panel(lx, "Catchment per halte", "Makin gelap, makin sering dihitung ulang.")
    # Alpha AFTER the colour: `setFillColor` carries its own alpha and resets it,
    # which is what turned three overlapping catchments into one solid shape.
    # Stacking translucent fills is the whole argument here, because the darker
    # the ground the more times the same shoppers have been counted.
    c.saveState()
    for sx, sy in stops(lx):
        c.setFillColor(T.BLUE_MID)
        c.setFillAlpha(0.16)
        c.setStrokeColor(T.BLUE_MID)
        c.setStrokeAlpha(0.65)
        c.setLineWidth(0.8)
        c.circle(sx, at(sy), f["radius"] * metres, stroke=1, fill=1)
    c.restoreState()
    for sx, sy in stops(lx):
        c.setFillColor(T.TABLE_HEAD)
        c.setStrokeColor(T.WHITE)
        c.setLineWidth(1.2)
        c.circle(sx, at(sy), 2.8, stroke=1, fill=1)

    # Right: the grid, each cell counted once.
    rx = T.LEFT + pw + 20.0
    panel(rx, f"Grid H3 resolusi {f['resolution']}", "Tiap petak dihitung sekali.")
    r = 15.0
    dx, dy = r * 1.5, r * math.sqrt(3)
    col = 0
    px_ = rx + 16.0
    while px_ < rx + pw - 8.0:
        row = 0
        py = top + 30.0 + (dy / 2 if col % 2 else 0)
        while py < top + plot_h - 12.0:
            _hexagon(c, px_, at(py), r, T.TABLE_CELL if (col + row) % 2 else T.WHITE, T.RULE_COVER, 0.7)
            py += dy
            row += 1
        px_ += dx
        col += 1
    for sx, sy in stops(rx):
        c.setFillColor(T.TABLE_HEAD)
        c.setStrokeColor(T.WHITE)
        c.setLineWidth(1.2)
        c.circle(sx, at(sy), 2.8, stroke=1, fill=1)

    band_top = top + plot_h + 18.0
    h = band(
        doc,
        band_top,
        "Akses transit menjadi sifat petak, bukan pusatnya",
        f"Karena itu petak yang dilayani MRT sekaligus TransJakarta bernilai lebih tinggi daripada "
        f"petak yang hanya dilayani salah satunya, dan itu terbaca sebagai satu indeks per petak.",
    )
    doc.y = band_top + h + 6.0


# --- 8. What the score is made of (section 7) ------------------------------


def score_anatomy(doc, f):
    """The four terms on one 0 to 1 axis.

    The point the prose cannot make at a glance: only the first term can raise a
    score. The other three are multipliers capped at 1, so they can shade a
    ranking and never invent one.

    Notes sit under the term name rather than beside the track, because beside
    the track there is no room for them and they ran off the page.
    """
    c, at = doc.c, doc._at
    rows_h, axis_h = 27.0, 20.0
    H = 4 * rows_h + axis_h + 34.0
    doc.ensure(H + 6.0)
    top = doc.y

    label_w = 158.0
    ax = T.LEFT + label_w
    aw = T.RIGHT - ax - 8.0

    def at_x(v):
        return ax + aw * v

    def dec(v):
        return str(v).replace(".", ",")

    gate = f["gate_blocked"]
    # `values` is what the term can actually be. A pair means a continuous range
    # between them; a list of separate points means those points and nothing in
    # between, which is the whole distinction the gate row has to carry.
    terms = [
        ("batas(Gap + 0,5)", "range", (0.0, 1.0), "satu-satunya suku yang bisa menaikkan"),
        ("gerbang_ruang", "states", (gate, 1.0), "dua nilai saja, bukan rentang"),
        (
            "akses_transit",
            "range",
            (f["access_floor"], f["access_ceiling"]),
            "dihitung dari simpul transit",
        ),
        ("biaya_ruang", "range", (f["cost_floor"], 1.0), "hanya pernah mengurangi"),
    ]

    for i, (name, kind, values, note) in enumerate(terms):
        y = top + i * rows_h
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, LABEL)
        c.drawString(T.LEFT, at(y + 9.0), name)
        c.setFillColor(T.MUTED)
        c.setFont(T.F_REG, CAPTION)
        c.drawString(T.LEFT, at(y + 18.5), note)

        if kind == "range":
            lo, hi = values
            # A filled track behind the reachable part, so every term is read
            # against the same 0 to 1 span.
            c.setFillColor(T.TABLE_CELL)
            c.setStrokeColor(T.RULE_LIGHT)
            c.setLineWidth(0.6)
            c.rect(ax, at(y + 14.0), aw, 8.0, stroke=1, fill=1)
            c.setFillColor(T.TABLE_HEAD)
            c.rect(at_x(lo), at(y + 14.0), aw * (hi - lo), 8.0, stroke=0, fill=1)
            marks = [lo] if lo > 0 else []
        else:
            # NO FILLED TRACK HERE. A block spanning the two states is a picture
            # of a range, and this row exists to say there is no range: the gate
            # is one value or the other and never anything between. So the span
            # is a hairline for registration against the axis, and the two
            # reachable values are the only ink with weight.
            c.setStrokeColor(T.RULE_LIGHT)
            c.setLineWidth(0.7)
            c.line(ax, at(y + 10.0), ax + aw, at(y + 10.0))
            for v in values:
                c.setFillColor(T.TABLE_HEAD)
                c.setStrokeColor(T.WHITE)
                c.setLineWidth(1.2)
                c.circle(at_x(v), at(y + 10.0), 3.8, stroke=1, fill=1)
            marks = list(values)

        # Label the values the axis does not already give away, each one sitting
        # against the mark it names.
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, CAPTION)
        for v in marks:
            c.drawRightString(at_x(v) - 6.0, at(y + 9.6), dec(v))

    # A single hairline axis, solid and one shade off the surface.
    ay = top + 4 * rows_h + 1.0
    c.setStrokeColor(T.RULE_LIGHT)
    c.setLineWidth(0.7)
    c.line(ax, at(ay), ax + aw, at(ay))
    c.setFillColor(T.MUTED)
    c.setFont(T.F_REG, CAPTION)
    for v in (0.0, 0.25, 0.5, 0.75, 1.0):
        c.line(at_x(v), at(ay), at_x(v), at(ay + 3.0))
        c.drawCentredString(at_x(v), at(ay + 12.0), dec(v))

    band_top = ay + 20.0
    h = band(
        doc,
        band_top,
        "Tiga dari empat suku hanya bisa mengurangi",
        "Semuanya dibatasi 1, sehingga tidak satu pun bisa mengangkat petak melewati apa yang "
        "dikatakan permintaan dan kompetisinya. Petak yang tidak punya bacaan pada sebuah suku "
        "menerima tepat 1 di suku itu, bukan angka yang dikarang untuknya.",
    )
    doc.y = band_top + h + 6.0
