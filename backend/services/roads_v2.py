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
    # Track which edges are already owned by a higher-priority way so lower-priority
    # ways running the same corridor don't add redundant parallel edges.
    claimed_edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()

    # Process highest-priority ways first so they get first claim on edges.
    sorted_ways = sorted(typed_ways, key=lambda x: _hw_rank(x[0]))

    for hw_type, coords in sorted_ways:
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
                edge = (min(prev, hx), max(prev, hx))
                if edge not in claimed_edges:
                    claimed_edges.add(edge)
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
    import heapq

    settlements = config.settlements
    if len(settlements) < 2:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    R_m = config.R_m
    cos_lat = math.cos(math.radians(config.center_lat))

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.highway_types)
    if not typed_ways:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    _TIER_COST: dict[str, float] = {
        "motorway": 1.0, "trunk": 1.0,
        "primary": 2.0, "secondary": 3.0,
        "tertiary": 10.0,
    }

    # Thin each way so consecutive nodes are at least R_m apart — keeps the
    # routing graph small without shapely.
    def _thin(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
        out = [coords[0]]
        for pt in coords[1:]:
            prev = out[-1]
            dE = (pt[0] - prev[0]) * cos_lat * METERS_PER_DEGREE
            dN = (pt[1] - prev[1]) * METERS_PER_DEGREE
            if math.hypot(dE, dN) >= R_m:
                out.append(pt)
        if out[-1] != coords[-1]:
            out.append(coords[-1])
        return out

    # Build lon/lat routing graph: adj[node] = [(neighbour, cost, way_idx), ...]
    adj: dict[tuple, list] = {}
    thinned_ways: list[tuple[str, list[tuple[float, float]]]] = []
    for way_idx, (hw_type, coords) in enumerate(typed_ways):
        thinned = _thin(coords)
        thinned_ways.append((hw_type, thinned))
        mult = _TIER_COST.get(hw_type, 10.0)
        for i in range(len(thinned) - 1):
            a, b = thinned[i], thinned[i + 1]
            dE = (b[0] - a[0]) * cos_lat * METERS_PER_DEGREE
            dN = (b[1] - a[1]) * METERS_PER_DEGREE
            cost = math.hypot(dE, dN) * mult
            if cost == 0:
                continue
            adj.setdefault(a, []).append((b, cost, way_idx))
            adj.setdefault(b, []).append((a, cost, way_idx))

    if not adj:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    all_nodes = list(adj.keys())

    def snap(lon: float, lat: float) -> tuple:
        best, best_d2 = all_nodes[0], float("inf")
        for node in all_nodes:
            dE = (node[0] - lon) * cos_lat * METERS_PER_DEGREE
            dN = (node[1] - lat) * METERS_PER_DEGREE
            d2 = dE * dE + dN * dN
            if d2 < best_d2:
                best_d2 = d2
                best = node
        return best

    INF = float("inf")

    def dijkstra(start: tuple) -> tuple[dict, dict]:
        dist: dict = {start: 0.0}
        prev: dict = {start: (None, None)}  # prev[v] = (parent_node, way_idx)
        pq: list = [(0.0, start)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, INF):
                continue
            for v, w, wi in adj.get(u, []):
                nd = d + w
                if nd < dist.get(v, INF):
                    dist[v] = nd
                    prev[v] = (u, wi)
                    heapq.heappush(pq, (nd, v))
        return dist, prev

    snap_nodes = [snap(s["lon"], s["lat"]) for s in settlements]
    n = len(settlements)

    all_dists: list[dict] = []
    all_prevs: list[dict] = []
    for sn in snap_nodes:
        d, p = dijkstra(sn)
        all_dists.append(d)
        all_prevs.append(p)

    # Distance matrix between settlements.
    dist_matrix = [[INF] * n for _ in range(n)]
    for i in range(n):
        dist_matrix[i][i] = 0.0
        for j in range(i + 1, n):
            d = all_dists[i].get(snap_nodes[j], INF)
            dist_matrix[i][j] = dist_matrix[j][i] = d

    # Kruskal MST.
    mst_parent = list(range(n))

    def find(x: int) -> int:
        while mst_parent[x] != x:
            mst_parent[x] = mst_parent[mst_parent[x]]
            x = mst_parent[x]
        return x

    def union(x: int, y: int) -> bool:
        px, py = find(x), find(y)
        if px == py:
            return False
        mst_parent[px] = py
        return True

    candidate_edges = sorted(
        [(dist_matrix[i][j], i, j)
         for i in range(n) for j in range(i + 1, n)
         if dist_matrix[i][j] < INF]
    )
    connection_pairs: list[tuple[int, int]] = []
    for _, i, j in candidate_edges:
        if union(i, j):
            connection_pairs.append((i, j))
        if len(connection_pairs) == n - 1:
            break

    # Nearest-neighbour pass: guarantee each settlement's closest neighbour
    # has a direct path even if MST routes it via a hub.
    connected_set: set[tuple[int, int]] = {(min(i, j), max(i, j)) for i, j in connection_pairs}
    for i in range(n):
        best_j, best_d = -1, INF
        for j in range(n):
            if i != j and dist_matrix[i][j] < best_d:
                best_d = dist_matrix[i][j]
                best_j = j
        if best_j >= 0:
            key = (min(i, best_j), max(i, best_j))
            if key not in connected_set:
                connection_pairs.append((i, best_j))
                connected_set.add(key)

    # Walk each path and collect which original (unthinned) way indices were used.
    used_way_indices: set[int] = set()
    for i, j in connection_pairs:
        node = snap_nodes[j]
        while node is not None:
            parent_node, wi = all_prevs[i].get(node, (None, None))
            if wi is not None:
                used_way_indices.add(wi)
            node = parent_node

    if not used_way_indices:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    # Use original (unthinned) way geometries for hex conversion so road
    # corridors look smooth at hex resolution.
    selected_ways = [typed_ways[idx] for idx in sorted(used_way_indices)]
    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _ways_to_hex_graph(selected_ways, lonlat_to_hex, R_m, cos_lat)
