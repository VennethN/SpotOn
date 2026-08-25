"""Every figure the PRD quotes, read from the data that produced it.

`AGENTS.md`: *figures in copy are read from the data, never typed in by hand.*
That rule is why this file exists. The PRD states 562 catchments, 1,105 transit
nodes and 24,630 catalogue points, and each of those is read out of
`src/lib/data/hexes.json` at build time, from the `meta` block the builder
re-measures on every run. Rebuild the grid and the document follows it.

The engine's constants (the balance point, the blocked gate, the transit floor
and span, the cost floor) are read the same way, out of the TypeScript that
applies them, so the method section cannot describe a formula the product has
stopped using.
"""

import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return json.load(f)


def _const(path, name):
    """Read `export const NAME = <number>` out of a TypeScript module."""
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        src = f.read()
    m = re.search(rf"export const {name}\s*=\s*([0-9.]+)", src)
    if not m:
        raise SystemExit(f"{name} not found in {path}")
    return float(m.group(1))


def n(value):
    """Indonesian thousands: a full stop, because the document is in Indonesian."""
    return f"{int(value):,}".replace(",", ".")


def rupiah(value):
    """Whole millions read better than nine digits on a page."""
    if value >= 1_000_000 and value % 1_000_000 == 0:
        return f"Rp {n(value // 1_000_000)} juta"
    return f"Rp {n(value)}"


def collect():
    hexes = _load("src", "lib", "data", "hexes.json")
    mission = _load("src", "lib", "data", "mission.json")
    meta = hexes["meta"]
    cells = hexes["hexes"]

    categories = len(re.findall(r"\n\t\tkey: '", _read("src/lib/domain/categories.ts")))

    covered = sum(
        1 for c in cells if c.get("covered") and all(c["covered"].get(k) for k in c["covered"])
    )
    with_field = sum(1 for c in cells if c.get("field"))

    mm = meta["mission"]
    counts = mission["meta"]["counts"]

    f = {
        # The grid
        "cells": meta["hexes"],
        "resolution": meta["resolution"],
        "radius": meta["walkRadius"],
        "categories": categories,
        # Transit
        "stops": meta["stops"],
        "mrt": meta["stopsByMode"]["mrt"],
        "krl": meta["stopsByMode"]["krl"],
        "lrt": meta["stopsByMode"]["lrt"],
        "brt": meta["stopsByMode"]["brt"],
        # Competitors
        "osm_pois": meta["pois"],
        "mapid_points": meta["mapid"]["points"],
        "mapid_covered": covered,
        "mapid_uncovered": meta["hexes"] - covered,
        # Space
        "listings": meta["property"]["listings"],
        "cells_priced": meta["property"]["cellsPriced"],
        "cells_prop_covered": meta["property"]["cellsCovered"],
        "median_price": meta["property"]["medianPrice"],
        # Field missions
        "field_records": mm["records"],
        "field_placed": mm["placed"],
        "field_cells": mm["cells"],
        "field_gap": meta["hexes"] - with_field,
        "struk": counts["struk"],
        "menu": counts["menu"],
        "properti": counts["properti"],
        "catatan": counts["catatan"],
        "sewa": mm["vocab"]["offer"]["sewa"],
        "jual": mm["vocab"]["offer"]["jual"],
        "qris": mm["vocab"]["pay"]["QRIS"],
        # Opening hours
        "biz": meta["hours"]["businesses"],
        "biz_published": meta["hours"]["published"],
        "biz_readable": meta["hours"]["readable"],
        "cells_readable": meta["hours"]["cellsReadable"],
        # Engine constants
        "balance": _const("src/lib/domain/scoring.ts", "BALANCE_POINT"),
        "gate_blocked": _const("src/lib/domain/scoring.ts", "GATE_BLOCKED"),
        "access_floor": _const("src/lib/domain/transit.ts", "ACCESS_FLOOR"),
        "access_span": _const("src/lib/domain/transit.ts", "ACCESS_SPAN"),
        "access_divisor": _const("src/lib/domain/transit.ts", "ACCESS_DIVISOR"),
        "cost_floor": _const("src/lib/domain/cost.ts", "COST_FLOOR"),
    }
    f["access_ceiling"] = round(f["access_floor"] + f["access_span"], 2)
    return f


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()
