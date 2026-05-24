"""Fetch and merge OSM natural=coastline ways into continuous chains.

OSM coastline ways are directed (land on left, sea on right) and connect
end-to-end to form closed rings globally. For a map viewport we fetch all
ways that intersect the bounding box, merge connected segments into chains,
and clip the result to the bbox so the frontend receives only what is visible.
"""
from shapely.geometry import LineString, box
from shapely.ops import unary_union

from services.overpass import post_overpass


def _coord_key(lon: float, lat: float) -> tuple[int, int]:
    """Quantised key for endpoint matching (0.1 m precision at equator)."""
    return (round(lon * 1_000_00), round(lat * 1_000_00))


def _merge_ways(ways: list[dict]) -> list[list[list[float]]]:
    """Merge OSM way geometries into continuous directed chains.

    Each way element must have a `geometry` list of {lat, lon} dicts (Overpass
    `out geom` format).  Connected ways share an endpoint coordinate; we match
    on a quantised key so floating-point noise doesn't prevent joins.
    """
    segments: list[dict] = []
    for way in ways:
        geom = way.get("geometry", [])
        if len(geom) < 2:
            continue
        coords = [[round(pt["lon"], 7), round(pt["lat"], 7)] for pt in geom]
        segments.append({
            "start": _coord_key(coords[0][0], coords[0][1]),
            "end":   _coord_key(coords[-1][0], coords[-1][1]),
            "coords": coords,
        })

    if not segments:
        return []

    start_map: dict[tuple, int] = {s["start"]: i for i, s in enumerate(segments)}
    used = [False] * len(segments)
    chains: list[list[list[float]]] = []

    for i, seg in enumerate(segments):
        if used[i]:
            continue
        chain = list(seg["coords"])
        used[i] = True
        current_end = seg["end"]

        while True:
            next_i = start_map.get(current_end)
            if next_i is None or used[next_i]:
                break
            nxt = segments[next_i]
            chain.extend(nxt["coords"][1:])   # first point == current_end, skip it
            used[next_i] = True
            current_end = nxt["end"]

        chains.append(chain)

    return chains


def _clip_chains(
    chains: list[list[list[float]]],
    min_lon: float, min_lat: float,
    max_lon: float, max_lat: float,
) -> list[list[list[float]]]:
    """Clip chains to the bbox.  A chain may split into multiple pieces."""
    clip_box = box(min_lon, min_lat, max_lon, max_lat)
    out: list[list[list[float]]] = []

    for chain in chains:
        if len(chain) < 2:
            continue
        line = LineString([(c[0], c[1]) for c in chain])
        try:
            clipped = line.intersection(clip_box)
        except Exception:
            continue
        if clipped.is_empty:
            continue

        # intersection may produce LineString or MultiLineString
        pieces = (
            [clipped]
            if clipped.geom_type == "LineString"
            else list(clipped.geoms)
            if clipped.geom_type == "MultiLineString"
            else []
        )
        for piece in pieces:
            coords = [[round(x, 7), round(y, 7)] for x, y in piece.coords]
            if len(coords) >= 2:
                out.append(coords)

    return out


async def fetch_osm_coastline_chains(
    min_lat: float, min_lon: float,
    max_lat: float, max_lon: float,
    fetch_buffer: float = 0.15,
) -> list[list[list[float]]]:
    """Fetch OSM coastline ways and return merged, clipped chains.

    Each chain is a list of [lon, lat] pairs.  Returns [] for areas with no
    coastline (entirely land or entirely ocean).

    fetch_buffer: degrees to expand the Overpass query bbox so that ways
    which cross the edge are fetched in full and merged correctly before
    clipping back to the original bbox.
    """
    fb = fetch_buffer
    query = (
        f"[out:json][timeout:60];\n"
        f"way[\"natural\"=\"coastline\"]"
        f"({min_lat - fb},{min_lon - fb},{max_lat + fb},{max_lon + fb});\n"
        f"out geom;"
    )
    data = await post_overpass(query, timeout=60.0)
    ways = [e for e in data.get("elements", []) if e.get("type") == "way"]

    if not ways:
        return []

    chains = _merge_ways(ways)
    return _clip_chains(chains, min_lon, min_lat, max_lon, max_lat)
