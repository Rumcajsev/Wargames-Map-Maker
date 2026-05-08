import asyncio
import math
import httpx
from urllib.parse import urlencode
from shapely.geometry import LineString

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
]

METERS_PER_DEGREE = 111_319.0

# Lower index = higher priority (rail beats light_rail beats narrow_gauge …)
RAIL_PRIORITY: list[str] = ["rail", "light_rail", "narrow_gauge", "tram"]


def _rt_rank(rt: str) -> int:
    try:
        return RAIL_PRIORITY.index(rt)
    except ValueError:
        return len(RAIL_PRIORITY)


def _round_hex(q_f: float, r_f: float) -> tuple[int, int]:
    x, z = q_f, r_f
    y = -x - z
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        pass
    else:
        rz = -rx - ry
    return rx, rz


def _make_lonlat_to_hex(config, R_m: float):
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))
    flat_top = config.hex_orientation == "flat"

    def lonlat_to_hex(lon: float, lat: float) -> tuple[int, int]:
        E_m = (lon - config.center_lon) * cos_lat * METERS_PER_DEGREE
        N_m = (lat - config.center_lat) * METERS_PER_DEGREE
        px = cos_β * E_m - sin_β * N_m
        py = sin_β * E_m + cos_β * N_m
        if flat_top:
            q_f = 2 * px / (3 * R_m)
            r_f = py / (R_m * math.sqrt(3)) - px / (3 * R_m)
        else:
            r_f = 2 * py / (3 * R_m)
            q_f = px / (R_m * math.sqrt(3)) - py / (3 * R_m)
        return _round_hex(q_f, r_f)

    return lonlat_to_hex


def _polyline_to_hex_sequence(
    coords: list[tuple[float, float]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        dE = (lon2 - lon1) * cos_lat * METERS_PER_DEGREE
        dN = (lat2 - lat1) * METERS_PER_DEGREE
        dist = math.hypot(dE, dN)
        n_samples = max(2, int(dist / (R_m / 3)) + 1)
        for j in range(n_samples):
            t = j / (n_samples - 1)
            h = lonlat_to_hex(lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1))
            if not result or result[-1] != h:
                result.append(h)
    return result


def _smooth_hex_path(path: list[tuple[int, int]]) -> list[tuple[int, int]]:
    changed = True
    while changed:
        changed = False
        new_path: list[tuple[int, int]] = [path[0]]
        i = 1
        while i < len(path):
            if i + 1 < len(path) and path[i + 1] == new_path[-1]:
                i += 2
                changed = True
            else:
                new_path.append(path[i])
                i += 1
        path = new_path
    return path


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

        path = _polyline_to_hex_sequence(coords, lonlat_to_hex, R_m, cos_lat)
        if len(path) < 2:
            continue
        path = _smooth_hex_path(path)
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
    payload = urlencode({"data": query}).encode()
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "IG2HexMap/1.0",
    }

    last_error: Exception | None = None
    data: dict = {}

    async with httpx.AsyncClient(timeout=55.0) as client:
        for attempt, endpoint in enumerate(OVERPASS_ENDPOINTS):
            try:
                resp = await client.post(endpoint, content=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as exc:
                last_error = exc
                if attempt < len(OVERPASS_ENDPOINTS) - 1:
                    await asyncio.sleep(1.5)
        else:
            raise RuntimeError(f"All Overpass mirrors failed. Last error: {last_error}")

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

    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    hw = config.width_m / 2 * 1.05
    hh = config.height_m / 2 * 1.05
    lons, lats = [], []
    for px, py in [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lats.append(config.center_lat + N_m / METERS_PER_DEGREE)
        lons.append(config.center_lon + E_m / (cos_lat * METERS_PER_DEGREE))

    typed_ways = await _fetch_ways(
        min(lats), min(lons), max(lats), max(lons),
        config.rail_types,
    )

    tolerance = (R_m * 1.5) / METERS_PER_DEGREE
    typed_ways = _simplify_ways(typed_ways, tolerance)

    lonlat_to_hex = _make_lonlat_to_hex(config, R_m)
    return _build_rail_data(typed_ways, lonlat_to_hex, R_m, cos_lat)
