"""The MAPID PRD template's design system, measured off the template itself.

Every constant here was read out of
`Template_PRD_MAPID_WebGIS_Competition_2026.pdf` with pdfplumber rather than
guessed from a screenshot: page box, margins, the four Figtree cuts, every fill
and stroke colour, the table column stops, and the row heights. Nothing in this
file is a designer's choice. If the organisers reissue the template, re-measure
and change it here, and the whole document follows.

Coordinates are kept the way the template stores them: y measured DOWN from the
top of the page, because that is what pdfplumber reports and what makes the
measured numbers checkable against the source. `layout.Doc` flips once, on the
way into reportlab, so no other file has to think about it.
"""

from reportlab.lib.colors import Color

# The page box, verbatim. Google Docs wrote 595.5 x 842.2 rather than the exact
# A4 595.276 x 841.89, and the difference is what keeps a diff against the
# original at zero.
PAGE_W = 595.5
PAGE_H = 842.2

# Content column: the template's text starts at 61.2 and every table's right
# edge lands on 533.7.
LEFT = 61.2
RIGHT = 533.7
WIDTH = RIGHT - LEFT

# Running head and foot. The rules sit at these y values, the text baselines at
# the tops recorded beside them.
HEAD_TEXT_TOP = 28.7
HEAD_RULE_Y = 41.5
FOOT_RULE_Y = 803.5
FOOT_TEXT_TOP = 809.1

# Where body text may live between them.
BODY_TOP = 57.0
BODY_BOTTOM = 795.0


def _c(r, g, b):
    return Color(r, g, b)


# --- Colours, all lifted from the template's own fills and strokes ----------

INK = _c(0.0667, 0.0667, 0.0667)  # body text and section headings
BLACK = _c(0.0, 0.0, 0.0)  # cover title, cover kicker
MUTED = _c(0.349, 0.349, 0.349)  # the template's italic notes
SUBTLE = _c(0.2, 0.2, 0.2)  # cover subtitle
GREY = _c(0.498, 0.498, 0.498)  # running head and foot

BLUE_DEEP = _c(0.1216, 0.3059, 0.4706)  # bold blue sub-headings
BLUE_MID = _c(0.2118, 0.3765, 0.5686)
BLUE_DARK = _c(0.0902, 0.2118, 0.3647)

TABLE_HEAD = _c(0.0, 0.4392, 0.7529)  # header row fill
TABLE_CELL = _c(0.9569, 0.9725, 0.9882)  # body row fill
BOX_FILL = _c(0.9176, 0.9451, 0.9804)  # the template's callout background
BOX_BAR = _c(0.1804, 0.4588, 0.7137)  # its left accent bar

RULE_LIGHT = _c(0.851, 0.8863, 0.9529)  # table grid, head and foot rules
RULE_MID = _c(0.6627, 0.7686, 0.9098)  # rule above a callout
RULE_COVER = _c(0.5529, 0.7059, 0.8863)  # the cover's one rule
WHITE = _c(1.0, 1.0, 1.0)

# --- Type ------------------------------------------------------------------
#
# The template embeds four cuts of Figtree plus ArialMT for the running head and
# foot. Helvetica stands in for Arial: it is metric-compatible, it is built into
# every PDF reader, and at 8pt grey the two are indistinguishable.

F_REG = "Figtree"
F_BOLD = "Figtree-Bold"
F_ITAL = "Figtree-Italic"
F_BOLDITAL = "Figtree-BoldItalic"
F_RUN = "Helvetica"

# Sizes, each one measured on the template page that uses it.
S_HEAD = 14.0  # "1. Ringkasan Eksekutif"
S_SUB = 12.5  # "Poin yang harus dijelaskan:"
S_SUB2 = 12.0  # blue sub-sub-heading
S_BODY = 11.0  # body text and lists
S_NOTE = 10.5  # the template's italic notes
S_TABLE = 9.0  # table header row
S_CELL = 9.5  # table body
S_RUN = 8.0  # running head and foot
S_COVER_TITLE = 27.0
S_COVER_KICK = 10.5
S_COVER_SUB = 11.0
S_COVER_LABEL = 9.5
S_COVER_TABLE = 8.5

# Leading, from the template's line pitch: 13.6pt at 10.5, 14.7pt at 11.
LEAD_BODY = 14.7
LEAD_NOTE = 13.6
LEAD_CELL = 12.0

# --- Tables ----------------------------------------------------------------
#
# Column stops for the two grids the template draws, and the two row heights.

COLS_3 = [61.2, 218.7, 376.2, 533.7]
COLS_2 = [61.2, 297.4, 533.7]

# Three-column variants on the same outer edges. The template draws its grids in
# equal thirds because its cells are empty. Filled cells are not equal, and a
# week label given 157pt while its target output is squeezed into the same width
# would set rows four lines deep for no reason. Only the interior stops move, so
# every table still starts at 61.2 and ends at 533.7.
COLS_DATA = [61.2, 190.0, 300.0, 533.7]
COLS_WEEK = [61.2, 116.0, 330.0, 533.7]
COLS_RISK = [61.2, 205.0, 335.0, 533.7]
ROW_HEAD_H = 18.7
ROW_PAD_X = 5.2
ROW_PAD_TOP = 6.3
