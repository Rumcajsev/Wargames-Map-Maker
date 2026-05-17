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


def _way_to_hex_path(
    coords: list[tuple[float, float]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> list[tuple[int, int]]:
    """Convert one OSM way to an ordered, no-revisit hex sequence.

    Samples the polyline at R_m / 2 intervals. Each hex is recorded at most
    once, so oscillation and loops are impossible by construction.
    """
    if not coords:
        return []

    step_m = R_m / 2
    result: list[tuple[int, int]] = []
    seen: set[tuple[int, int]] = set()

    def add(h: tuple[int, int]) -> None:
        if h not in seen:
            seen.add(h)
            result.append(h)

    add(lonlat_to_hex(coords[0][0], coords[0][1]))

    accumulated = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        dE = (lon2 - lon1) * cos_lat * METERS_PER_DEGREE
        dN = (lat2 - lat1) * METERS_PER_DEGREE
        seg_m = math.hypot(dE, dN)
        if seg_m == 0:
            continue
        pos = step_m - accumulated
        while pos <= seg_m:
            t = pos / seg_m
            add(lonlat_to_hex(lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)))
            pos += step_m
        accumulated = (accumulated + seg_m) % step_m

    add(lonlat_to_hex(coords[-1][0], coords[-1][1]))
    return result


def _ways_to_hex_graph(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> dict:
    raw_ways: list[dict] = []
    hex_paths: list[dict] = []
    hex_connections: dict[tuple[int, int], set[tuple[int, int]]] = {}
    hex_highway: dict[tuple[int, int], str] = {}

    for hw_type, coords in typed_ways:
        raw_ways.append({"highway": hw_type, "coords": [[lon, lat] for lon, lat in coords]})

        path = _way_to_hex_path(coords, lonlat_to_hex, R_m, cos_lat)
        if len(path) < 2:
            continue

        hex_paths.append({"highway": hw_type, "hexes": [[q, r] for q, r in path]})

        for i, hx in enumerate(path):
            if hx not in hex_connections:
                hex_connections[hx] = set()
            if hx not in hex_highway or _hw_rank(hw_type) < _hw_rank(hex_highway[hx]):
                hex_highway[hx] = hw_type
            if i > 0:
                prev = path[i - 1]
                hex_connections[hx].add(prev)
                hex_connections[prev].add(hx)
                if prev not in hex_highway or _hw_rank(hw_type) < _hw_rank(hex_highway[prev]):
                    hex_highway[prev] = hw_type

    road_hexes = [
        {
            "q": q,
            "r": r,
            "highway": hex_highway.get((q, r), "primary"),
            "connections": [{"q": nq, "r": nr} for nq, nr in sorted(conns)],
        }
        for (q, r), conns in hex_connections.items()
    ]

    return {"raw_ways": raw_ways, "hex_paths": hex_paths, "road_hexes": road_hexes}


async def generate_road_hexes(config) -> dict:
    R_m = config.R_m
    cos_lat = math.cos(math.radians(config.center_lat))

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.highway_types)
    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _ways_to_hex_graph(typed_ways, lonlat_to_hex, R_m, cos_lat)


async def generate_settlement_roads(config) -> dict:
    # TODO: settlement road routing using new hex graph.
    raise NotImplementedError
