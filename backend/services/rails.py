import math
from shapely.geometry import LineString

from services.geometry import METERS_PER_DEGREE, make_lonlat_to_hex, polyline_to_hex_sequence, smooth_hex_path, compute_bbox
from services.overpass import post_overpass

# Lower index = higher priority (rail beats light_rail beats narrow_gauge …)
RAIL_PRIORITY: list[str] = ["rail", "light_rail", "narrow_gauge", "tram"]


def _rt_rank(rt: str) -> int:
    try:
        return RAIL_PRIORITY.index(rt)
    except ValueError:
        return len(RAIL_PRIORITY)


def _build_rail_data(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> dict:
    """Map rail ways onto hexes, returning all three representations with railway type."""
    raw_ways = []
    hex_paths = []
    hex_connections: dict[tuple[int, int], set[tuple[int, int]]] = {}
    hex_railway: dict[tuple[int, int], str] = {}  # highest-priority type per hex

    for rt_type, coords in typed_ways:
        raw_ways.append({"railway": rt_type, "coords": [[lon, lat] for lon, lat in coords]})

        path = polyline_to_hex_sequence(coords, lonlat_to_hex, R_m, cos_lat)
        if len(path) < 2:
            continue
        path = smooth_hex_path(path)
        if len(path) < 2:
            continue
        hex_paths.append({"railway": rt_type, "hexes": [[q, r] for q, r in path]})

        for i, hx in enumerate(path):
            if hx not in hex_connections:
                hex_connections[hx] = set()
            # Assign highest-priority railway type to this hex
            if hx not in hex_railway or _rt_rank(rt_type) < _rt_rank(hex_railway[hx]):
                hex_railway[hx] = rt_type
            if i > 0:
                prev = path[i - 1]
                hex_connections[hx].add(prev)
                hex_connections[prev].add(hx)
                if prev not in hex_railway or _rt_rank(rt_type) < _rt_rank(hex_railway[prev]):
                    hex_railway[prev] = rt_type

    rail_hexes = [
        {
            "q": q,
            "r": r,
            "railway": hex_railway.get((q, r), "rail"),
            "connections": [{"q": nq, "r": nr} for nq, nr in sorted(conns)],
        }
        for (q, r), conns in hex_connections.items()
    ]

    return {
        "raw_ways": raw_ways,
        "hex_paths": hex_paths,
        "rail_hexes": rail_hexes,
    }


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


def _simplify_ways(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    tolerance: float,
) -> list[tuple[str, list[tuple[float, float]]]]:
    result = []
    for rt_type, coords in typed_ways:
        simplified = LineString(coords).simplify(tolerance, preserve_topology=False)
        pts = list(simplified.coords)
        if len(pts) >= 2:
            result.append((rt_type, pts))
    return result


async def generate_rail_hexes(config) -> dict:
    R_m = config.R_m
    cos_lat = math.cos(math.radians(config.center_lat))

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.rail_types)

    tolerance = (R_m * 1.5) / METERS_PER_DEGREE
    typed_ways = _simplify_ways(typed_ways, tolerance)

    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _build_rail_data(typed_ways, lonlat_to_hex, R_m, cos_lat)
