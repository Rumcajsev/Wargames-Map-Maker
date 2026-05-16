import math
from shapely.geometry import LineString

from services.geometry import METERS_PER_DEGREE, make_lonlat_to_hex, polyline_to_hex_sequence, smooth_hex_path, compute_bbox
from services.overpass import post_overpass

# Lower index = higher priority (motorway beats trunk beats primary …)
HIGHWAY_PRIORITY: list[str] = ["motorway", "trunk", "primary", "secondary", "tertiary"]


def _hw_rank(hw: str) -> int:
    try:
        return HIGHWAY_PRIORITY.index(hw)
    except ValueError:
        return len(HIGHWAY_PRIORITY)


def _build_road_data(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> dict:
    """Map road ways onto hexes, returning all three representations with highway type."""
    raw_ways = []
    hex_paths = []
    hex_connections: dict[tuple[int, int], set[tuple[int, int]]] = {}
    hex_highway: dict[tuple[int, int], str] = {}  # highest-priority type per hex

    for hw_type, coords in typed_ways:
        raw_ways.append({"highway": hw_type, "coords": [[lon, lat] for lon, lat in coords]})

        path = polyline_to_hex_sequence(coords, lonlat_to_hex, R_m, cos_lat)
        if len(path) < 2:
            continue
        path = smooth_hex_path(path)
        if len(path) < 2:
            continue
        hex_paths.append({"highway": hw_type, "hexes": [[q, r] for q, r in path]})

        for i, hx in enumerate(path):
            if hx not in hex_connections:
                hex_connections[hx] = set()
            # Assign highest-priority highway type to this hex
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

    return {
        "raw_ways": raw_ways,
        "hex_paths": hex_paths,
        "road_hexes": road_hexes,
    }


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


def _simplify_ways(
    typed_ways: list[tuple[str, list[tuple[float, float]]]],
    tolerance: float,
) -> list[tuple[str, list[tuple[float, float]]]]:
    result = []
    for hw_type, coords in typed_ways:
        simplified = LineString(coords).simplify(tolerance, preserve_topology=False)
        pts = list(simplified.coords)
        if len(pts) >= 2:
            result.append((hw_type, pts))
    return result


async def generate_settlement_roads(config) -> dict:
    """Connect settlements via MST + Dijkstra, returning original OSM way geometries."""
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

    # Simplify upfront for graph performance; we index back into these for output.
    tolerance = (R_m * 1.5) / METERS_PER_DEGREE
    typed_ways = _simplify_ways(typed_ways, tolerance)

    # Tier cost multipliers: make lower-priority roads artificially expensive so
    # Dijkstra strongly prefers motorways/trunks over back roads.
    _TIER_COST: dict[str, float] = {
        'motorway': 1.0, 'trunk': 1.0,
        'primary': 2.0, 'secondary': 2.0,
        'tertiary': 10.0,
    }

    # Build graph: node=(lon,lat) → [(neighbour, cost, hw_type, way_idx), ...]
    # way_idx lets us recover the original OSM way geometry after routing.
    adj: dict[tuple, list] = {}
    for way_idx, (hw_type, coords) in enumerate(typed_ways):
        multiplier = _TIER_COST.get(hw_type, 10.0)
        for i in range(len(coords) - 1):
            a: tuple = coords[i]
            b: tuple = coords[i + 1]
            dE = (b[0] - a[0]) * cos_lat * METERS_PER_DEGREE
            dN = (b[1] - a[1]) * METERS_PER_DEGREE
            dist = math.hypot(dE, dN)
            if dist == 0:
                continue
            cost = dist * multiplier
            if a not in adj:
                adj[a] = []
            if b not in adj:
                adj[b] = []
            adj[a].append((b, cost, hw_type, way_idx))
            adj[b].append((a, cost, hw_type, way_idx))

    if not adj:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    all_nodes = list(adj.keys())

    def snap(lon: float, lat: float) -> tuple:
        best, best_d = all_nodes[0], float('inf')
        for node in all_nodes:
            dE = (node[0] - lon) * cos_lat * METERS_PER_DEGREE
            dN = (node[1] - lat) * METERS_PER_DEGREE
            d = dE * dE + dN * dN
            if d < best_d:
                best_d = d
                best = node
        return best

    INF = float('inf')

    def dijkstra(start: tuple) -> tuple[dict, dict]:
        dist: dict = {start: 0.0}
        # prev[v] = (parent_node, hw_type, way_idx)
        prev: dict = {start: (None, None, None)}
        pq: list = [(0.0, start)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, INF):
                continue
            for v, w, ht, wi in adj.get(u, []):
                nd = d + w
                if nd < dist.get(v, INF):
                    dist[v] = nd
                    prev[v] = (u, ht, wi)
                    heapq.heappush(pq, (nd, v))
        return dist, prev

    snap_nodes = [snap(s['lon'], s['lat']) for s in settlements]
    n = len(settlements)

    all_dists: list[dict] = []
    all_prevs: list[dict] = []
    for sn in snap_nodes:
        d, p = dijkstra(sn)
        all_dists.append(d)
        all_prevs.append(p)

    # Settlement distance matrix
    dist_matrix = [[INF] * n for _ in range(n)]
    for i in range(n):
        dist_matrix[i][i] = 0.0
        for j in range(i + 1, n):
            d = all_dists[i].get(snap_nodes[j], INF)
            dist_matrix[i][j] = dist_matrix[j][i] = d

    # Kruskal MST
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

    # Nearest-neighbour pass: for each settlement, also ensure its single closest
    # reachable neighbour has a direct connection even if MST routes it via a hub.
    connected_set: set[tuple[int, int]] = {
        (min(i, j), max(i, j)) for i, j in connection_pairs
    }
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

    # Walk each Dijkstra path and collect the OSM way indices that were traversed.
    # Returning original way geometries produces real road corridors rather than
    # synthetic polylines stitched from individual graph hops.
    used_way_indices: set[int] = set()
    for i, j in connection_pairs:
        node = snap_nodes[j]
        while node is not None:
            parent_node, _, wi = all_prevs[i].get(node, (None, None, None))
            if wi is not None:
                used_way_indices.add(wi)
            node = parent_node

    if not used_way_indices:
        return {"raw_ways": [], "hex_paths": [], "road_hexes": []}

    selected_ways = [typed_ways[idx] for idx in sorted(used_way_indices)]
    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _build_road_data(selected_ways, lonlat_to_hex, R_m, cos_lat)


async def generate_road_hexes(config) -> dict:
    R_m = config.R_m
    cos_lat = math.cos(math.radians(config.center_lat))

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    typed_ways = await _fetch_ways(min_lat, min_lon, max_lat, max_lon, config.highway_types)

    tolerance = (R_m * 1.5) / METERS_PER_DEGREE
    typed_ways = _simplify_ways(typed_ways, tolerance)

    lonlat_to_hex = make_lonlat_to_hex(config, R_m)
    return _build_road_data(typed_ways, lonlat_to_hex, R_m, cos_lat)
