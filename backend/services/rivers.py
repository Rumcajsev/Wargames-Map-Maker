import math

from models import RiversConfig
from services.geometry import compute_bbox, make_lonlat_to_hex, polyline_to_hex_sequence, smooth_hex_path, METERS_PER_DEGREE
from services.overpass import post_overpass


def _extract_ways(members: list[dict]) -> list[list[tuple[float, float]]]:
    """Pull main-stream way geometries out of a relation's member list."""
    ways = []
    for m in members:
        if m.get("type") != "way":
            continue
        if m.get("role", "") not in ("", "main_stream"):
            continue
        geom = m.get("geometry", [])
        if len(geom) < 2:
            continue
        ways.append([(p["lon"], p["lat"]) for p in geom])
    return ways


def _chain_ways(ways: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """Greedily join way segments end-to-end into one ordered polyline."""
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
            break

        used.add(best_idx)
        nxt = list(ways[best_idx])
        if best_reversed:
            nxt = nxt[::-1]
        chain.extend(nxt[1:])

    return chain


def _count_tributaries(
    relation_coords: list[tuple[float, float]],
    way_endpoints: list[tuple[float, float]],
    cos_lat: float,
    threshold_m: float = 100.0,
) -> int:
    """Count how many way endpoints fall within threshold_m of the relation polyline."""
    count = 0
    for ep_lon, ep_lat in way_endpoints:
        for i in range(len(relation_coords) - 1):
            lon1, lat1 = relation_coords[i]
            lon2, lat2 = relation_coords[i + 1]
            # Closest point on segment to endpoint
            dE1 = (ep_lon - lon1) * cos_lat * METERS_PER_DEGREE
            dN1 = (ep_lat - lat1) * METERS_PER_DEGREE
            dE2 = (lon2 - lon1) * cos_lat * METERS_PER_DEGREE
            dN2 = (lat2 - lat1) * METERS_PER_DEGREE
            seg_len_sq = dE2 * dE2 + dN2 * dN2
            if seg_len_sq > 0:
                t = max(0.0, min(1.0, (dE1 * dE2 + dN1 * dN2) / seg_len_sq))
            else:
                t = 0.0
            closest_E = dE1 - t * dE2
            closest_N = dN1 - t * dN2
            dist = math.hypot(closest_E, closest_N)
            if dist < threshold_m:
                count += 1
                break
    return count


async def fetch_rivers(config: RiversConfig) -> list[dict]:
    """Fetch named river/canal relations from OSM, compute hex paths and auto-width."""
    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )
    types = config.types
    hex_size_km = config.hex_size_km

    if not types:
        return []

    allowed = {"river", "canal"}
    active_types = [t for t in types if t in allowed]
    if not active_types:
        return []

    name_filter = "[name]" if hex_size_km > 20 else ""
    type_pattern = "|".join(active_types)
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"

    # Query 1: named river/canal relations with full geometry and tags
    relation_query = (
        f'[out:json][timeout:45][maxsize:52428800];\n'
        f'relation["waterway"~"^({type_pattern})$"]{name_filter}({bbox});\n'
        f'out tags geom;\n'
    )

    # Query 2: all waterway ways for tributary counting (endpoints only via geom)
    way_query = (
        f'[out:json][timeout:30][maxsize:26214400];\n'
        f'way["waterway"~"^(river|stream|canal|ditch|drain|creek)$"]({bbox});\n'
        f'out geom qt;\n'
    )

    relation_data, way_data = await _fetch_both(relation_query, way_query)

    # Collect endpoints of all tributary ways
    cos_lat = math.cos(math.radians(config.center_lat))
    way_endpoints: list[tuple[float, float]] = []
    for el in way_data.get("elements", []):
        geom = el.get("geometry", [])
        if len(geom) >= 2:
            way_endpoints.append((geom[0]["lon"], geom[0]["lat"]))
            way_endpoints.append((geom[-1]["lon"], geom[-1]["lat"]))

    # Build hex converter
    lonlat_to_hex = make_lonlat_to_hex(config, config.R_m)

    rivers = []
    for el in relation_data.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        ways = _extract_ways(el.get("members", []))
        if not ways:
            continue
        coords = _chain_ways(ways)
        if len(coords) < 2:
            continue

        # Hex path
        raw_hexes = polyline_to_hex_sequence(coords, lonlat_to_hex, config.R_m, cos_lat)
        raw_hexes = smooth_hex_path(raw_hexes)
        if len(raw_hexes) < 2:
            continue

        # Tributary count
        trib_count = _count_tributaries(coords, way_endpoints, cos_lat)

        rivers.append({
            "name": tags.get("name", ""),
            "type": tags.get("waterway", "river"),
            "coords": [[lon, lat] for lon, lat in coords],
            "hexes": [[q, r] for q, r in raw_hexes],
            "tributary_count": trib_count,
            "osm_width_m": _parse_width(tags.get("width")),
        })

    # Normalize tributary counts to width multipliers
    _apply_width_multipliers(rivers)

    return rivers


async def _fetch_both(relation_query: str, way_query: str):
    """Run both Overpass queries concurrently."""
    import asyncio
    results = await asyncio.gather(
        post_overpass(relation_query, timeout=55.0),
        post_overpass(way_query, timeout=40.0),
    )
    return results


def _parse_width(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw.split()[0])
    except (ValueError, IndexError):
        return None


def _apply_width_multipliers(rivers: list[dict]) -> None:
    """Set width_multiplier on each river in-place."""
    if not rivers:
        return

    # Compute log-scaled tributary scores
    scores = [math.log(r["tributary_count"] + 1) for r in rivers]
    max_score = max(scores) if scores else 1.0

    for river, score in zip(rivers, scores):
        explicit = river.pop("osm_width_m")
        if explicit is not None:
            multiplier = max(0.2, min(4.0, explicit / 40.0))
        elif max_score > 0:
            normalized = score / max_score  # 0..1
            multiplier = 0.3 + normalized * 1.7  # 0.3..2.0
        else:
            multiplier = 1.0 if river["type"] == "river" else 0.6
        river["width_multiplier"] = round(multiplier, 3)
