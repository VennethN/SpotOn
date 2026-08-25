"""The typesetting engine for the PRD.

It exists so `content.py` can read as the document rather than as drawing code:
every call in there is a heading, a paragraph, a list or a table, and where the
page breaks is decided here.

Two rules shape the whole file.

**The cursor runs downward.** `Doc.y` is distance from the top of the page, the
same direction `theme.py` records its measurements in, so a constant lifted off
the template can be compared with the cursor without a sign flip in the reader's
head. The single conversion to reportlab's upward y happens in `_at`.

**Nothing is drawn where it will not fit.** Every block asks `ensure()` for its
own height before it draws, so a table row, a list item or a heading either sits
whole on this page or starts the next one. A heading that would land at the foot
of a page pulls its first lines with it.
"""

import os
import re

from reportlab.lib.utils import simpleSplit  # noqa: F401  (kept for callers)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

from . import theme as T

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")


def register_fonts():
    """Register the four Figtree cuts the template embeds.

    Vendored as TTF beside this file rather than fetched: the document has to
    build the same way on a machine with no network, and a PRD that silently
    falls back to Helvetica would look like the template and not be it.
    """
    faces = {
        T.F_REG: "Figtree-400-normal.ttf",
        T.F_BOLD: "Figtree-700-normal.ttf",
        T.F_ITAL: "Figtree-400-italic.ttf",
        T.F_BOLDITAL: "Figtree-700-italic.ttf",
    }
    for name, filename in faces.items():
        path = os.path.join(FONT_DIR, filename)
        if not os.path.exists(path):
            raise SystemExit(f"missing font: {path}")
        pdfmetrics.registerFont(TTFont(name, path))
    pdfmetrics.registerFontFamily(
        T.F_REG, normal=T.F_REG, bold=T.F_BOLD, italic=T.F_ITAL, boldItalic=T.F_BOLDITAL
    )


# --- Inline markup ---------------------------------------------------------
#
# `**bold**` and `*italic*`, and nothing else. A full markdown parser would be a
# second way of writing this document, and the point of the copy living in
# `content.py` as plain strings is that there is only one.

_TOKEN = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*)")


def _runs(text, font, bold_font, ital_font):
    """Split marked-up text into (string, font) runs."""
    out = []
    for part in _TOKEN.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            out.append((part[2:-2], bold_font))
        elif part.startswith("*") and part.endswith("*"):
            out.append((part[1:-1], ital_font))
        else:
            out.append((part, font))
    return out


def _atoms(runs):
    """Split runs into breakable units.

    A *cluster* is one or more fragments with no whitespace between them, and it
    is never broken. That matters because the markup ends a run mid-word:
    "(*underserved*," is three fragments, and wrapping them independently would
    let a line end on the opening bracket with its word on the next line.
    """
    tokens = []
    for text, font in runs:
        # Keep the spaces: splitting on them and re-joining loses the run
        # boundaries, and "**A** b" would come back as "Ab".
        for part in re.split(r"(\s+)", text):
            if part:
                tokens.append((part, font))

    atoms, cluster = [], []
    for part, font in tokens:
        if "\n" in part:
            if cluster:
                atoms.append(("word", cluster))
                cluster = []
            atoms.append(("break", None))
        elif part.isspace():
            if cluster:
                atoms.append(("word", cluster))
                cluster = []
            atoms.append(("space", [(part, font)]))
        else:
            cluster.append((part, font))
    if cluster:
        atoms.append(("word", cluster))
    return atoms


def _trim(line):
    while line and line[-1][0].isspace():
        line.pop()
    return line


def _wrap(runs, size, width):
    """Greedy wrap over styled runs. Returns a list of lines of (text, font).

    A literal newline is a hard break, which is what lets a table cell carry a
    heading line above its body without a second call.
    """
    lines, line, x = [], [], 0.0
    for kind, payload in _atoms(runs):
        if kind == "break":
            lines.append(_trim(line))
            line, x = [], 0.0
            continue
        w = sum(pdfmetrics.stringWidth(t, fnt, size) for t, fnt in payload)
        if kind == "space":
            if line:  # never open a line with a space
                line.extend(payload)
                x += w
            continue
        if x + w > width and line:
            lines.append(_trim(line))
            line, x = [], 0.0
        line.extend(payload)
        x += w
    if line or not lines:
        lines.append(_trim(line))
    return lines


class Doc:
    """One PDF, one downward cursor."""

    def __init__(self, path, running_head):
        self.c = rl_canvas.Canvas(path, pagesize=(T.PAGE_W, T.PAGE_H))
        self.c.setTitle("Product Requirement Document (PRD)")
        self.running_head = running_head
        self.y = T.BODY_TOP
        self.page_no = 1
        self.chrome = False  # the cover carries no head or foot

    # -- geometry -----------------------------------------------------------

    def _at(self, y):
        """Top-down y to reportlab's bottom-up y."""
        return T.PAGE_H - y

    def new_page(self, chrome=True):
        self.c.showPage()
        self.page_no += 1
        self.chrome = chrome
        self.y = T.BODY_TOP
        if chrome:
            self.draw_chrome()

    def ensure(self, height):
        """Break the page if `height` will not fit below the cursor."""
        if self.y + height > T.BODY_BOTTOM:
            self.new_page(chrome=True)
            return True
        return False

    def space(self, h):
        self.y += h

    # -- running head and foot ---------------------------------------------

    def draw_chrome(self):
        c = self.c
        c.setFillColor(T.GREY)
        c.setFont(T.F_RUN, T.S_RUN)
        c.drawString(T.LEFT, self._at(T.HEAD_TEXT_TOP + T.S_RUN), self.running_head)
        c.setStrokeColor(T.RULE_LIGHT)
        c.setLineWidth(0.7)
        c.line(T.LEFT, self._at(T.HEAD_RULE_Y), T.RIGHT, self._at(T.HEAD_RULE_Y))
        c.line(T.LEFT, self._at(T.FOOT_RULE_Y), T.RIGHT, self._at(T.FOOT_RULE_Y))
        c.setFillColor(T.GREY)
        c.drawCentredString(
            (T.LEFT + T.RIGHT) / 2,
            self._at(T.FOOT_TEXT_TOP + T.S_RUN),
            f"Halaman {self.page_no}",
        )

    # -- text ---------------------------------------------------------------

    def text_height(self, text, size=T.S_BODY, lead=T.LEAD_BODY, width=None, font=T.F_REG):
        width = width or T.WIDTH
        runs = _runs(text, font, T.F_BOLD, T.F_ITAL)
        return len(_wrap(runs, size, width)) * lead

    def draw_text(
        self,
        text,
        x,
        y,
        width,
        size=T.S_BODY,
        lead=T.LEAD_BODY,
        font=T.F_REG,
        color=T.INK,
        bold_font=T.F_BOLD,
        ital_font=T.F_ITAL,
    ):
        """Draw wrapped, styled text at an absolute position. Returns its height."""
        runs = _runs(text, font, bold_font, ital_font)
        lines = _wrap(runs, size, width)
        self.c.setFillColor(color)
        for i, line in enumerate(lines):
            # The template sets its first baseline `size` below the line box top.
            cursor = x
            baseline = self._at(y + i * lead + size)
            for word, wf in line:
                self.c.setFont(wf, size)
                self.c.drawString(cursor, baseline, word)
                cursor += pdfmetrics.stringWidth(word, wf, size)
        return len(lines) * lead

    def flow(self, text, x, width, size, lead, font=T.F_REG, color=T.INK, marker=None, marker_x=0.0):
        """Draw wrapped text from the cursor, breaking the page between lines.

        This is what keeps a paragraph off the running foot. Reserving the whole
        block first and breaking early would leave half-empty pages all through
        a document this dense, and reserving only the first two lines, which is
        what this used to do, let the third line run over the rule.
        """
        lines = _wrap(_runs(text, font, T.F_BOLD, T.F_ITAL), size, width)
        # Orphan control: a lone first line stranded at the foot of a page is
        # worse than a page that breaks one line early, so a block of two or
        # more lines takes two with it or takes none.
        if len(lines) > 1 and self.y + lead * 2 > T.BODY_BOTTOM:
            self.new_page()
        for i, line in enumerate(lines):
            over = self.y + lead > T.BODY_BOTTOM
            # Widow control: never leave the last line of a paragraph alone at
            # the top of the next page. On reaching the second to last line with
            # room for only one of the two, both go over together.
            if not over and len(lines) - i == 2 and self.y + lead * 2 > T.BODY_BOTTOM:
                over = True
            if over:
                self.new_page()
            self.c.setFillColor(color)
            if i == 0 and marker:
                self.c.setFont(font, size)
                self.c.drawString(marker_x, self._at(self.y + size), marker)
            cursor = x
            baseline = self._at(self.y + size)
            for word, wf in line:
                self.c.setFont(wf, size)
                self.c.drawString(cursor, baseline, word)
                cursor += pdfmetrics.stringWidth(word, wf, size)
            self.y += lead
        return len(lines) * lead

    def para(
        self,
        text,
        size=T.S_BODY,
        lead=T.LEAD_BODY,
        font=T.F_REG,
        color=T.INK,
        after=6.0,
        indent=0.0,
        ital_font=T.F_ITAL,
    ):
        h = self.flow(text, T.LEFT + indent, T.WIDTH - indent, size, lead, font, color)
        self.y += after
        return h

    # -- headings -----------------------------------------------------------

    def heading(self, text, after=8.0, before=0.0):
        """A numbered section heading. Never left stranded at a page foot."""
        self.y += before
        self.ensure(T.S_HEAD + after + T.LEAD_BODY * 2)
        h = self.draw_text(text, T.LEFT, self.y, T.WIDTH, T.S_HEAD, T.S_HEAD + 4.0, T.F_BOLD, T.INK)
        self.y += h + after
        # The template underlines nothing, so neither does this.

    def subheading(self, text, after=5.0, before=6.0):
        self.y += before
        self.ensure(T.S_SUB + after + T.LEAD_BODY)
        h = self.draw_text(text, T.LEFT, self.y, T.WIDTH, T.S_SUB, T.S_SUB + 3.5, T.F_BOLD, T.INK)
        self.y += h + after

    def subsub(self, text, after=4.0, before=5.0, color=T.BLUE_DEEP):
        self.y += before
        self.ensure(T.S_SUB2 + after + T.LEAD_BODY)
        h = self.draw_text(text, T.LEFT, self.y, T.WIDTH, T.S_SUB2, T.S_SUB2 + 3.0, T.F_BOLD, color)
        self.y += h + after

    # -- lists --------------------------------------------------------------

    def bullets(self, items, after=6.0, indent=7.5, gap=3.0, marker="•"):
        """The template's bullet: a middot at +7.5, text at +19.5."""
        text_x = indent + 12.0
        for item in items:
            self.flow(
                item,
                T.LEFT + text_x,
                T.WIDTH - text_x,
                T.S_BODY,
                T.LEAD_BODY,
                marker=marker,
                marker_x=T.LEFT + indent,
            )
            self.y += gap
        self.y += after - gap

    def numbers(self, items, after=6.0, indent=7.5, gap=3.0, start=1):
        text_x = indent + 12.0
        for i, item in enumerate(items, start):
            self.flow(
                item,
                T.LEFT + text_x,
                T.WIDTH - text_x,
                T.S_BODY,
                T.LEAD_BODY,
                marker=f"{i}.",
                marker_x=T.LEFT + indent,
            )
            self.y += gap
        self.y += after - gap

    # -- the template's callout --------------------------------------------

    def callout(self, text, after=8.0, before=4.0):
        """The pale blue box with a left accent bar.

        The template uses it for its own instructions and tells the team to
        delete those. The box itself is part of the design, so it stays, and
        holds the notes that belong to the reader instead.
        """
        self.y += before
        inner = T.WIDTH - 16.0
        h = self.text_height(text, T.S_NOTE, T.LEAD_NOTE, inner, T.F_ITAL)
        self.ensure(h + 12.0)
        top = self.y
        box_h = h + 11.0
        self.c.setFillColor(T.BOX_FILL)
        self.c.rect(T.LEFT - 2.2, self._at(top + box_h), T.WIDTH + 2.2, box_h, stroke=0, fill=1)
        self.c.setStrokeColor(T.BOX_BAR)
        self.c.setLineWidth(2.0)
        self.c.line(T.LEFT - 3.2, self._at(top), T.LEFT - 3.2, self._at(top + box_h))
        self.draw_text(
            text,
            T.LEFT + 8.0,
            top + 5.5,
            inner,
            T.S_NOTE,
            T.LEAD_NOTE,
            T.F_ITAL,
            T.INK,
            bold_font=T.F_BOLDITAL,
            ital_font=T.F_ITAL,
        )
        self.y = top + box_h + after

    # -- tables -------------------------------------------------------------

    def table(self, headers, rows, cols, after=10.0, before=2.0, size=T.S_CELL, align=None):
        """A grid in the template's own two column geometry.

        Splits across pages and repeats the header row, because a headerless
        continuation of a five column table is unreadable and the template
        itself repeats its header on page 9.
        """
        self.y += before
        n = len(cols) - 1
        align = align or ["left"] * n
        widths = [cols[i + 1] - cols[i] - 2 * T.ROW_PAD_X for i in range(n)]

        def draw_header():
            self.c.setFillColor(T.TABLE_HEAD)
            for i in range(n):
                self.c.rect(
                    cols[i],
                    self._at(self.y + T.ROW_HEAD_H),
                    cols[i + 1] - cols[i],
                    T.ROW_HEAD_H,
                    stroke=0,
                    fill=1,
                )
            for i, head in enumerate(headers):
                self.draw_text(
                    head,
                    cols[i] + T.ROW_PAD_X,
                    self.y + T.ROW_PAD_TOP - 1.2,
                    widths[i],
                    T.S_TABLE,
                    T.S_TABLE + 2.0,
                    T.F_BOLD,
                    T.WHITE,
                )
            self.y += T.ROW_HEAD_H

        if self.y + T.ROW_HEAD_H + 24.0 > T.BODY_BOTTOM:
            self.new_page()
        draw_header()

        for index, row in enumerate(rows):
            heights = [
                self.text_height(cell, size, T.LEAD_CELL, widths[i]) for i, cell in enumerate(row)
            ]
            row_h = max(max(heights) + 8.0, 21.0)
            if self.y + row_h > T.BODY_BOTTOM:
                self.new_page()
                draw_header()
            # Zebra, in the template's own parity: the first body row is unfilled
            # and every second one after it carries the pale fill. The count runs
            # over the whole table, not over the page, so a table that breaks
            # carries its stripes across the break the way the template's does.
            if index % 2:
                self.c.setFillColor(T.TABLE_CELL)
                for i in range(n):
                    self.c.rect(
                        cols[i],
                        self._at(self.y + row_h),
                        cols[i + 1] - cols[i],
                        row_h,
                        stroke=0,
                        fill=1,
                    )
            for i, cell in enumerate(row):
                x = cols[i] + T.ROW_PAD_X
                if align[i] == "center":
                    # Only used for the cover's row numbers and the week column,
                    # both of which are single short words.
                    w = pdfmetrics.stringWidth(cell, T.F_REG, size)
                    x = cols[i] + (cols[i + 1] - cols[i] - w) / 2
                self.draw_text(cell, x, self.y + 4.0, widths[i], size, T.LEAD_CELL, T.F_REG, T.INK)
            # The template rules its rows in the palest blue, verticals included.
            self.c.setStrokeColor(T.RULE_LIGHT)
            self.c.setLineWidth(0.7)
            self.c.line(cols[0], self._at(self.y + row_h), cols[-1], self._at(self.y + row_h))
            for i in range(n + 1):
                self.c.line(cols[i], self._at(self.y), cols[i], self._at(self.y + row_h))
            self.y += row_h

        self.y += after

    # -- finishing ----------------------------------------------------------

    def save(self):
        self.c.save()
