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


# The survey site, which is a decision rather than a measurement: one point,
# Stasiun Sudirman, at the Dukuh Atas interchange. The cell is named here because
# the alternative was an h3 dependency in a document builder, and `collect()`
# proves the choice instead by testing that the station's coordinate really does
# fall inside that hexagon.
SITE_STATION = "Stasiun Sudirman"
SITE_LAT, SITE_LON = -6.20241, 106.82345
SITE_CELL = "888c1078a5fffff"


def _inside(lat, lon, boundary):
    """Ray casting against an H3 cell's [lon, lat] ring."""
    inside = False
    n = len(boundary)
    for i in range(n):
        x0, y0 = boundary[i]
        x1, y1 = boundary[(i + 1) % n]
        if (y0 > lat) != (y1 > lat):
            cross = x0 + (lat - y0) / (y1 - y0) * (x1 - x0)
            if lon < cross:
                inside = not inside
    return inside


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
    f.update(_site(cells, mission))
    return f


def _site(cells, mission):
    """Everything the PRD says about the survey site, read off that one cell."""
    cell = next((c for c in cells if c["id"] == SITE_CELL), None)
    if cell is None:
        raise SystemExit(f"survey site {SITE_CELL} is not in the grid")
    if not _inside(SITE_LAT, SITE_LON, cell["boundary"]):
        raise SystemExit(f"{SITE_STATION} does not fall inside {SITE_CELL}")

    transit = cell["transit"]
    at800 = cell["prop"]["r"]["800"]
    hours = cell["hours"]["r"]["800"]
    field = cell.get("field") or {}

    # OSM cannot count four of the thirteen business types at all: they carry no
    # usable tag, which is the same blind spot the survey is going to look at.
    src = _read("src/lib/domain/categories.ts")
    no_tag = len(re.findall(r"^\t\tosmTag: null,", src, re.M))

    carts = [r for r in mission["records"] if r.get("kind") == "Kaki Lima/Gerobak"]
    here = [r for r in carts if _inside(r["lat"], r["lon"], cell["boundary"])]

    return {
        "site_station": SITE_STATION,
        "site_cell": SITE_CELL,
        "site_name": cell["name"],
        "site_city": cell["city"],
        "site_nodes": sum(transit.values()),
        "site_mrt": transit["mrt"],
        "site_krl": transit["krl"],
        "site_lrt": transit["lrt"],
        "site_brt": transit["brt"],
        "site_access": cell["access"],
        "site_osm": cell["dens"]["osm"],
        "site_mapid": cell["dens"]["mapid"],
        "site_listings": at800["n"],
        "site_units": at800["u"],
        "site_hours_counted": hours["n"],
        "site_hours_published": hours["p"],
        "site_menu": field.get("menu", 0),
        "site_catatan": field.get("catatan", 0),
        "site_struk": field.get("struk", 0),
        "site_properti": field.get("properti", 0),
        "site_price": field.get("harga"),
        "no_osm_tag": no_tag,
        "carts_all": len(carts),
        "carts_here": len(here),
    }


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()
