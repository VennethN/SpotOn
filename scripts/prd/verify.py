"""What the builder checks about its own output before it claims to be done.

A layout engine fails quietly. A paragraph that runs past the running foot, a
table cell that spills out of its column, or a glyph the font does not carry all
produce a PDF that opens perfectly well and is wrong. This reads the finished
file back and refuses it, the same way `npm run selftest` reads the scoring
engine's output back rather than trusting that it ran.

Requires pdfplumber. When it is not installed the build says so and skips the
check rather than failing, because an unchecked document still beats no
document on a deadline.
"""

from . import theme as T

# Where the running head and foot legitimately sit. Everything else has to stay
# inside the body box.
HEAD_BAND = (T.HEAD_TEXT_TOP - 2.0, T.HEAD_RULE_Y)
FOOT_BAND = (T.FOOT_TEXT_TOP - 2.0, T.FOOT_TEXT_TOP + T.S_RUN + 3.0)

# A little slack on the sides: glyph bounding boxes are wider than their advance
# widths, and italic overhang is real.
SIDE_SLACK = 2.5


def _in_band(top, band):
    return band[0] <= top <= band[1]


def check(path):
    """Returns a list of complaints. Empty means the document is sound."""
    try:
        import pdfplumber
    except ImportError:
        return None

    problems = []
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            for ch in page.chars:
                top, bottom, x0, x1 = ch["top"], ch["bottom"], ch["x0"], ch["x1"]
                where = f"page {page_no}"
                if _in_band(top, HEAD_BAND) or _in_band(top, FOOT_BAND):
                    continue
                if bottom > T.FOOT_RULE_Y:
                    problems.append(f"{where}: text past the foot rule ({bottom:.1f}) {ch['text']!r}")
                if top < T.HEAD_RULE_Y and page_no > 1:
                    problems.append(f"{where}: text above the head rule ({top:.1f}) {ch['text']!r}")
                if x0 < T.LEFT - SIDE_SLACK or x1 > T.RIGHT + SIDE_SLACK:
                    problems.append(
                        f"{where}: text outside the column ({x0:.1f}..{x1:.1f}) {ch['text']!r}"
                    )

            # Every glyph must have come from a font that carries it. reportlab
            # draws a missing glyph as a blank, so this catches the arrows and
            # the maths signs Figtree's latin subset does not hold.
            for ch in page.chars:
                if ch["text"] not in (" ", "\xa0") and ch.get("width", 1) == 0:
                    problems.append(f"page {page_no}: zero-width glyph {ch['text']!r}")

    # Collapse runs of the same complaint on the same page: one overrunning line
    # is one problem, not forty characters' worth.
    seen, unique = set(), []
    for p in problems:
        key = p.rsplit(" ", 1)[0]
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique
