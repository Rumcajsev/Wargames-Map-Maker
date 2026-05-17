"""
New OSM → hex graph pipeline for rails.

Entry point (called from routers/generate.py):
  generate_rail_hexes(config: RailsConfig) -> dict

Expected return shape (same contract as rails.py so the frontend needs no changes):
  {
    "raw_ways":  [{"railway": str, "coords": [[lon, lat], ...]}, ...],
    "hex_paths": [{"railway": str, "hexes": [[q, r], ...]}, ...],
    "rail_hexes": [{"q": int, "r": int, "railway": str,
                    "connections": [{"q": int, "r": int}, ...]}, ...],
  }
"""

import math
from services.geometry import compute_bbox, make_lonlat_to_hex
from services.overpass import post_overpass

RAIL_PRIORITY: list[str] = ["rail", "light_rail", "narrow_gauge", "tram"]


async def _fetch_ways(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    rail_types: list[str],
) -> list[tuple[str, list[tuple[float, float]]]]:
    type_pattern = "|".join(rail_types)
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    query = (
        f'[out:json][timeout:45][maxsize:52428800];\n'
        f'way["railway"~"^({type_pattern})$"]({bbox});\n'
        f'out tags geom;\n'
    )
    data = await post_overpass(query, timeout=55.0)
    ways = []
    for el in data.get("elements", []):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry", [])
        if len(geom) < 2:
            continue
        rt_type = el.get("tags", {}).get("railway", "rail")
        ways.append((rt_type, [(p["lon"], p["lat"]) for p in geom]))
    return ways


def _ways_to_hex_graph(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    lonlat_to_hex,
) -> dict:
    """Convert OSM ways to the rail_hexes / hex_paths / raw_ways response dict."""
    # TODO: new hex graph construction logic goes here.
    raise NotImplementedError


async def generate_rail_hexes(config) -> dict:
    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.rail_types)
    lonlat_to_hex = make_lonlat_to_hex(config, config.R_m)
    return _ways_to_hex_graph(typed_ways, lonlat_to_hex)
