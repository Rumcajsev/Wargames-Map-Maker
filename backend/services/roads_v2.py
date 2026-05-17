"""
New OSM → hex graph pipeline for roads.

Entry points (called from routers/generate.py):
  generate_road_hexes(config: RoadsConfig) -> dict
  generate_settlement_roads(config: SettlementRoadsConfig) -> dict

Expected return shape (same contract as roads.py so the frontend needs no changes):
  {
    "raw_ways":  [{"highway": str, "coords": [[lon, lat], ...]}, ...],
    "hex_paths": [{"highway": str, "hexes": [[q, r], ...]}, ...],
    "road_hexes": [{"q": int, "r": int, "highway": str,
                    "connections": [{"q": int, "r": int}, ...]}, ...],
  }
"""

import math
from services.geometry import compute_bbox, make_lonlat_to_hex, METERS_PER_DEGREE
from services.overpass import post_overpass

HIGHWAY_PRIORITY: list[str] = ["motorway", "trunk", "primary", "secondary", "tertiary"]


async def _fetch_ways(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    highway_types: list[str],
) -> list[tuple[str, list[tuple[float, float]]]]:
    type_pattern = "|".join(highway_types)
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    query = (
        f'[out:json][timeout:45][maxsize:52428800];\n'
        f'way["highway"~"^({type_pattern})$"]({bbox});\n'
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
        hw_type = el.get("tags", {}).get("highway", "primary")
        ways.append((hw_type, [(p["lon"], p["lat"]) for p in geom]))
    return ways


def _hw_rank(hw: str) -> int:
    try:
        return HIGHWAY_PRIORITY.index(hw)
    except ValueError:
        return len(HIGHWAY_PRIORITY)


def _ways_to_hex_graph(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    lonlat_to_hex,
) -> dict:
    """Convert OSM ways to the road_hexes / hex_paths / raw_ways response dict."""
    # TODO: new hex graph construction logic goes here.
    raise NotImplementedError


async def generate_road_hexes(config) -> dict:
    R_m = config.R_m
    cos_lat = math.cos(math.radians(config.center_lat))

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.highway_types)
    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _ways_to_hex_graph(typed_ways, lonlat_to_hex)


async def generate_settlement_roads(config) -> dict:
    # TODO: settlement road routing using new hex graph.
    raise NotImplementedError
