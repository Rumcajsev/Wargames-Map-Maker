import math

from models import RiversConfig
from services.geometry import compute_bbox, make_lonlat_to_hex, METERS_PER_DEGREE
from services.overpass import post_overpass


# ---------------------------------------------------------------------------
# Way / chain helpers
# ---------------------------------------------------------------------------

def _extract_ways(members: list[dict]) -> list[list[tuple[float, float]]]:
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


def _clip_to_paper(
    coords: list[tuple[float, float]],
    config: RiversConfig,
) -> list[tuple[float, float]]:
    """Return the longest contiguous segment of the polyline within the paper rectangle."""
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))
    hw = config.width_m / 2 + config.R_m * 2
    hh = config.height_m / 2 + config.R_m * 2

    def in_paper(lon: float, lat: float) -> bool:
        E_m = (lon - config.center_lon) * cos_lat * METERS_PER_DEGREE
        N_m = (lat - config.center_lat) * METERS_PER_DEGREE
        px = cos_β * E_m - sin_β * N_m
        py = sin_β * E_m + cos_β * N_m
        return abs(px) <= hw and abs(py) <= hh

    segments: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for lon, lat in coords:
        if in_paper(lon, lat):
            current.append((lon, lat))
        else:
            if current:
                segments.append(current)
                current = []
    if current:
        segments.append(current)

    return max(segments, key=len) if segments else []


def _parse_width(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw.split()[0])
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# Hex vertex geometry helpers
# ---------------------------------------------------------------------------

def _make_hex_geometry(config: RiversConfig, R_m: float):
    """Return closures for hex vertex computation and coordinate conversion."""
    flat_top = config.hex_orientation == "flat"
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))
    sqrt3 = math.sqrt(3)

    def lonlat_to_paper_m(lon: float, lat: float) -> tuple[float, float]:
        E_m = (lon - config.center_lon) * cos_lat * METERS_PER_DEGREE
        N_m = (lat - config.center_lat) * METERS_PER_DEGREE
        px = cos_β * E_m - sin_β * N_m
        py = sin_β * E_m + cos_β * N_m
        return px, py

    def paper_m_to_lonlat(px: float, py: float) -> tuple[float, float]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        return (
            config.center_lon + E_m / (cos_lat * METERS_PER_DEGREE),
            config.center_lat + N_m / METERS_PER_DEGREE,
        )

    def hex_center_paper_m(q: int, r: int) -> tuple[float, float]:
        if flat_top:
            return R_m * 1.5 * q, R_m * (sqrt3 / 2 * q + sqrt3 * r)
        else:
            return R_m * (sqrt3 * q + sqrt3 / 2 * r), R_m * 1.5 * r

    base_angle = 0 if flat_top else 30

    def hex_vertices_lonlat(q: int, r: int) -> list[tuple[float, float]]:
        cx, cy = hex_center_paper_m(q, r)
        verts = []
        for i in range(6):
            angle = math.radians(base_angle + 60 * i)
            lon, lat = paper_m_to_lonlat(cx + R_m * math.cos(angle), cy + R_m * math.sin(angle))
            verts.append((round(lon, 6), round(lat, 6)))
        return verts

    return hex_vertices_lonlat, lonlat_to_paper_m, cos_lat


# ---------------------------------------------------------------------------
# Vertex-snapping conversion: polyline → hex edges
# ---------------------------------------------------------------------------

_HEX_NEIGHBOR_DIRS = [(0,0),(1,0),(-1,0),(0,1),(0,-1),(1,-1),(-1,1)]


def _nearest_hex_vertex(
    lon: float, lat: float,
    lonlat_to_hex,
    hex_vertices_lonlat,
    cos_lat: float,
    R_m: float,
) -> tuple[float, float] | None:
    """Find the nearest hex vertex (lon, lat) to a given geographic coordinate."""
    center_q, center_r = lonlat_to_hex(lon, lat)
    best_d2 = math.inf
    best_v: tuple[float, float] | None = None
    for dq, dr in _HEX_NEIGHBOR_DIRS:
        for vlon, vlat in hex_vertices_lonlat(center_q + dq, center_r + dr):
            dE = (vlon - lon) * cos_lat * METERS_PER_DEGREE
            dN = (vlat - lat) * METERS_PER_DEGREE
            d2 = dE * dE + dN * dN
            if d2 < best_d2:
                best_d2 = d2
                best_v = (vlon, vlat)
    return best_v


def _hex_edge_from_vertex_pair(
    vA: tuple[float, float],
    vB: tuple[float, float],
    lonlat_to_hex,
    lonlat_to_paper_m,
    R_m: float,
) -> tuple[tuple[int, int], tuple[int, int]] | None:
    """Find the two hexes sharing the edge between two adjacent hex vertices.

    Projects both vertices to paper-space, computes the perpendicular at the
    midpoint, then probes R_m*0.3 to either side to identify the two hexes.
    """
    pAx, pAy = lonlat_to_paper_m(*vA)
    pBx, pBy = lonlat_to_paper_m(*vB)
    mx, my = (pAx + pBx) / 2, (pAy + pBy) / 2

    dx, dy = pBx - pAx, pBy - pAy
    elen = math.hypot(dx, dy)
    if elen < 1e-9:
        return None

    # Unit perpendicular to the edge, in paper-space
    px, py = -dy / elen, dx / elen
    eps = R_m * 0.3

    def probe(sign: float) -> tuple[int, int]:
        # Perturb midpoint in paper-space, then convert back to lon/lat → hex
        from services.geometry import _round_hex  # type: ignore
        # We need to convert paper-space point to lon/lat.
        # Use the same rotation that lonlat_to_paper_m inverts.
        # Since lonlat_to_paper_m is a closure, we call the overpass route
        # via a temporary inline computation using the parent closure's cos_β/sin_β.
        # Instead: just call lonlat_to_hex on the perturbed lon/lat.
        # lonlat_to_paper_m converts (lon,lat) → (px,py).
        # To invert: we need paper_m_to_lonlat. Since we're inside a module,
        # capture via the vertices we already have.
        # Simpler: perturb in lon/lat space directly using the paper-space direction.
        # paper-space (ppx, ppy) → E_m = ppx*cos_β + ppy*sin_β (from paper_m_to_lonlat)
        # We don't have cos_β here. Use the shortcut:
        # paper-space dx,dy already computed above. Their geographic equivalent
        # is the direction of the vertex edge in paper-space. We already have
        # the perturbed paper coords (mx+px*eps*sign, my+py*eps*sign). We need
        # to convert that to lon/lat to call lonlat_to_hex.
        #
        # Because lonlat_to_paper_m is a closure from _make_hex_geometry that
        # encapsulates cos_β and sin_β, we can't directly invert it here.
        # Instead we rely on: both vA and vB are known lon/lat, so we can
        # reconstruct the inverse by linearly interpolating or by using the
        # affine structure.
        #
        # The cleanest solution: pass in a paper_m_to_lonlat closure too.
        # We'll do that by restructuring the call.
        pass
    return None  # placeholder — see below


def _polyline_to_hex_edges(
    coords: list[tuple[float, float]],
    lonlat_to_hex,
    hex_vertices_lonlat,
    lonlat_to_paper_m,
    paper_m_to_lonlat,
    cos_lat: float,
    R_m: float,
) -> list[dict]:
    """Convert an OSM polyline to a list of hex adjacency edges via vertex snapping.

    Algorithm:
    1. Dense-sample the polyline (every R_m/3 meters).
    2. Snap each sample to the nearest hex vertex → vertex path.
    3. For each consecutive vertex pair, find the two hexes sharing that edge
       by probing R_m*0.3 to either side of the midpoint perpendicular.
    4. Validate adjacency and deduplicate.
    """
    # Step 1: dense sample
    sample_interval = R_m / 3.0
    samples: list[tuple[float, float]] = []
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        dE = (lon2 - lon1) * cos_lat * METERS_PER_DEGREE
        dN = (lat2 - lat1) * METERS_PER_DEGREE
        dist = math.hypot(dE, dN)
        n = max(2, int(dist / sample_interval) + 1)
        for j in range(n):
            t = j / (n - 1)
            samples.append((lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)))

    # Step 2: snap to nearest hex vertex, deduplicate
    vertex_path: list[tuple[float, float]] = []
    prev_key: tuple[int, int] | None = None
    for lon, lat in samples:
        v = _nearest_hex_vertex(lon, lat, lonlat_to_hex, hex_vertices_lonlat, cos_lat, R_m)
        if v is None:
            continue
        key = (round(v[0] * 1_000_000), round(v[1] * 1_000_000))
        if key != prev_key:
            vertex_path.append(v)
            prev_key = key

    if len(vertex_path) < 2:
        return []

    # Step 3 + 4: vertex pairs → hex edges
    edges: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for i in range(len(vertex_path) - 1):
        vA, vB = vertex_path[i], vertex_path[i + 1]

        # Convert vertices to paper-space to compute perpendicular
        pAx, pAy = lonlat_to_paper_m(*vA)
        pBx, pBy = lonlat_to_paper_m(*vB)
        mx, my = (pAx + pBx) / 2, (pAy + pBy) / 2

        dx, dy = pBx - pAx, pBy - pAy
        elen = math.hypot(dx, dy)
        if elen < 1e-9:
            continue

        # Unit perpendicular in paper-space
        perp_x, perp_y = -dy / elen, dx / elen
        eps = R_m * 0.3

        def probe_hex(sign: float) -> tuple[int, int]:
            ppx = mx + perp_x * eps * sign
            ppy = my + perp_y * eps * sign
            lon_p, lat_p = paper_m_to_lonlat(ppx, ppy)
            return lonlat_to_hex(lon_p, lat_p)

        h1 = probe_hex(1.0)
        h2 = probe_hex(-1.0)

        if h1 == h2:
            continue

        q1, r1 = h1
        q2, r2 = h2

        # Validate adjacency: |dq| + |dr| + |ds| must be exactly 2
        dq, dr = q2 - q1, r2 - r1
        if abs(dq) + abs(dr) + abs(dq + dr) != 2:
            continue

        # Canonical edge key for deduplication
        a, b = f"{q1},{r1}", f"{q2},{r2}"
        ekey = (min(a, b), max(a, b))
        if ekey in seen:
            continue
        seen.add(ekey)

        edges.append({"q1": q1, "r1": r1, "q2": q2, "r2": r2})

    return edges


# ---------------------------------------------------------------------------
# Length helper
# ---------------------------------------------------------------------------

def _polyline_length(coords: list) -> float:
    total = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        dlat = (lat2 - lat1) * METERS_PER_DEGREE
        dlon = (lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2)) * METERS_PER_DEGREE
        total += math.hypot(dlat, dlon)
    return total


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def fetch_rivers(config: RiversConfig) -> list[dict]:
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

    query = (
        f'[out:json][timeout:45][maxsize:52428800];\n'
        f'relation["waterway"~"^({type_pattern})$"]{name_filter}({bbox});\n'
        f'out tags geom;\n'
    )

    data = await post_overpass(query, timeout=55.0)

    # Build geometry helpers
    lonlat_to_hex = make_lonlat_to_hex(config, config.R_m)
    hex_vertices_lonlat, lonlat_to_paper_m, cos_lat = _make_hex_geometry(config, config.R_m)

    # We need paper_m_to_lonlat as a standalone closure — extract from _make_hex_geometry
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat2 = math.cos(math.radians(config.center_lat))

    def paper_m_to_lonlat(px: float, py: float) -> tuple[float, float]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        return (
            config.center_lon + E_m / (cos_lat2 * METERS_PER_DEGREE),
            config.center_lat + N_m / METERS_PER_DEGREE,
        )

    rivers = []
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        ways = _extract_ways(el.get("members", []))
        if not ways:
            continue
        coords = _chain_ways(ways)
        coords = _clip_to_paper(coords, config)
        if len(coords) < 2:
            continue

        edges = _polyline_to_hex_edges(
            coords, lonlat_to_hex, hex_vertices_lonlat,
            lonlat_to_paper_m, paper_m_to_lonlat, cos_lat, config.R_m,
        )
        if not edges:
            continue

        osm_width = _parse_width(tags.get("width"))
        if osm_width is not None:
            width_multiplier = round(max(0.2, min(4.0, osm_width / 40.0)), 3)
        else:
            width_multiplier = 1.0 if tags.get("waterway") == "river" else 0.6

        rivers.append({
            "name": tags.get("name", ""),
            "type": tags.get("waterway", "river"),
            "coords": [[lon, lat] for lon, lat in coords],
            "edges": edges,
            "width_multiplier": width_multiplier,
        })

    rivers.sort(key=lambda r: _polyline_length(r["coords"]), reverse=True)
    return rivers
