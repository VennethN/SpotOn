#!/usr/bin/env python3
"""Build the PRD for the MAPID WebGIS Competition 2026.

    python3 scripts/build-prd.py [output.pdf]

The document follows the organisers' template exactly: same A4 page box, same
Figtree cuts, same palette, same section order. `scripts/prd/theme.py` records
where each of those came from. Every figure in the copy is read from
`src/lib/data/hexes.json` and from the scoring engine's own constants at build
time, so rebuilding the grid rebuilds the document's numbers with it.

The template's own instruction boxes are gone, as page 2 of the template
directs: *hapus kotak petunjuk dan isi bagian yang tersedia dengan konten tim*.
The box style itself stays and carries the team's notes instead.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from prd import content, figures, verify  # noqa: E402
from prd.layout import Doc, register_fonts  # noqa: E402

RUNNING_HEAD = "PRD SpotOn  |  Maps That Think! - Mass Transportation Edition"
DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "docs", "assets", "TripleT_SpotOn_PRD.pdf"
)


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    register_fonts()
    f = figures.collect()

    doc = Doc(out, RUNNING_HEAD)
    content.cover(doc, f)

    for i, section in enumerate(content.SECTIONS):
        # Each numbered section opens a page, the way the template does. It also
        # keeps the document stable: adding a sentence to section 4 cannot push
        # section 5's heading to the foot of a page.
        doc.new_page()
        section(doc, f)

    doc.save()
    print(f"wrote {out} ({doc.page_no} pages)")

    problems = verify.check(out)
    if problems is None:
        print("verify: skipped, pdfplumber is not installed")
    elif problems:
        for p in problems:
            print(f"verify: {p}")
        raise SystemExit(f"verify: {len(problems)} problem(s) in the layout")
    else:
        print("verify: layout clean")


if __name__ == "__main__":
    main()
