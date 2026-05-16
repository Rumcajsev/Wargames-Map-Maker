import math

from models import RiversConfig
from services.geometry import compute_bbox
from services.overpass import post_overpass


def _extract_ways(members: list[dict]) -> list[list[tuple[float, float]]]:
    """Pull main-stream way geometries out of a relation's member list."""
    ways = []
    for m in members:
        if m.get("type") != "way":
            continue
        # Accept empty role or explicit main_stream role
        if m.get("role", "") not in ("", "main_stream"):
            continue
        geom = m.get("geometry", [])
        if len(geom) < 2:
            continue
        ways.append([(p["lon"], p["lat"]) for p in geom])
    return ways


def _chain_ways(ways: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """Greedily join way segments end-to-end into one ordered polyline.

    Uses the relation's member ordering as the starting sequence, then fills
    gaps by proximity (≤ 0.005° ≈ 500 m).  Returns [] if nothing to chain.
    """
    if not ways:
        return []

    chain: list[tuple[float, float]] = list(ways[0])
    used = {0}

    for _ in range(len(ways) - 1):
        tail = chain[-1]
        best_idx, best_reversed, best_dist = -1, False, math.inf

        for i, way in enumerate(ways):
            if i in used:
                continue
            d_s = math.hypot(way[0][0] - tail[0], way[0][1] - tail[1])
            d_e = math.hypot(way[-1][0] - tail[0], way[-1][1] - tail[1])
            if d_s < best_dist:
                best_dist, best_idx, best_reversed = d_s, i, False
            if d_e < best_dist:
                best_dist, best_idx, best_reversed = d_e, i, True

        if best_idx == -1 or best_dist > 0.005:
            break  # gap too large — stop here, don't include disconnected tail

        used.add(best_idx)
        nxt = list(ways[best_idx])
        if best_reversed:
            nxt = nxt[::-1]
        chain.extend(nxt[1:])  # skip duplicate endpoint

    return chain


async def fetch_rivers(config: RiversConfig) -> list[dict]:
    """Fetch named river *relations* from OSM Overpass and return ordered polylines.

    Using relations (not raw ways) gives us pre-grouped, ordered geometry for
    each named river, dramatically reducing fragmentation.

    hex_size_km drives an automatic importance filter:
      > 20 km  →  only named rivers  (Rhine / Danube class)
      8–20 km  →  all rivers
      < 8 km   →  rivers + canals (if requested)
    """
    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )
    types = config.types
    hex_size_km = config.hex_size_km

    if not types:
        return []

    # Only river / canal from relations; streams are not reliably in relations
    allowed = {"river", "canal"}
    active_types = [t for t in types if t in allowed]
    if not active_types:
        return []

    # Large hexes: require a name tag to keep only significant waterways
    name_filter = "[name]" if hex_size_km > 20 else ""

    type_pattern = "|".join(active_types)
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"

    query = (
        f'[out:json][timeout:45][maxsize:52428800];\n'
        f'relation["waterway"~"^({type_pattern})$"]{name_filter}({bbox});\n'
        f'out geom;\n'
    )

    data = await post_overpass(query, timeout=55.0)

    rivers = []
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        ways = _extract_ways(el.get("members", []))
        if not ways:
            continue
        coords = _chain_ways(ways)
        if len(coords) < 2:
            continue
        rivers.append({
            "name": tags.get("name", ""),
            "type": tags.get("waterway", "river"),
            "coords": [[lon, lat] for lon, lat in coords],
        })

    return rivers
