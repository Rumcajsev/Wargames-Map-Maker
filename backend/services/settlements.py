"""Fetch OSM place nodes (settlements) via Overpass API."""
from services.overpass import post_overpass as _post_overpass


def _parse_population(raw) -> int | None:
    """Return integer population or None if unparseable / missing."""
    if raw is None:
        return None
    try:
        return int(str(raw).replace(",", "").replace(" ", "").split(".")[0])
    except (ValueError, TypeError):
        return None


async def fetch_settlements(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    limit: int = 50,
    types: list[str] | None = None,
) -> list[dict]:
    """Fetch OSM place nodes within the given bounding box.

    Returns a list of dicts sorted descending by population (nodes without a
    population tag are included but ranked last), up to `limit` entries.
    Each dict has: name, type, population, lon, lat.
    """
    if types is None:
        types = ["city", "town", "village"]

    type_re = "|".join(types)

    # Query without requiring population tag so we get results everywhere.
    query = (
        f'[out:json][timeout:30][bbox:{min_lat},{min_lon},{max_lat},{max_lon}];\n'
        f'node["place"~"{type_re}"]["name"];\n'
        f'out body;\n'
    )

    data = await _post_overpass(query)

    settlements: list[dict] = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        place_type = tags.get("place")
        if place_type not in types:
            continue

        population = _parse_population(tags.get("population"))

        settlements.append({
            "name": name,
            "type": place_type,
            "population": population if population is not None else 0,
            "lon": element.get("lon"),
            "lat": element.get("lat"),
            "_has_pop": population is not None,
        })

    # Sort: nodes with known population first (desc), then unknown (alphabetical)
    settlements.sort(key=lambda s: (not s["_has_pop"], -s["population"], s["name"]))
    for s in settlements:
        del s["_has_pop"]

    return settlements[:limit]


def _point_in_polygon(lon: float, lat: float, vertices: list[list[float]]) -> bool:
    n = len(vertices)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = vertices[i][0], vertices[i][1]
        xj, yj = vertices[j][0], vertices[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


async def fetch_settlements_in_hex(
    vertices: list[list[float]],
    types: list[str] | None = None,
) -> list[dict]:
    """Return all named OSM settlements inside the given hex polygon, sorted by population."""
    if types is None:
        types = ["city", "town", "village"]

    lons = [v[0] for v in vertices]
    lats = [v[1] for v in vertices]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    pad = 0.005
    type_re = "|".join(types)

    query = (
        f'[out:json][timeout:20]'
        f'[bbox:{min_lat - pad},{min_lon - pad},{max_lat + pad},{max_lon + pad}];\n'
        f'node["place"~"{type_re}"]["name"];\n'
        f'out body;\n'
    )

    data = await _post_overpass(query, timeout=30.0)

    results: list[dict] = []
    for element in data.get("elements", []):
        lon = element.get("lon")
        lat = element.get("lat")
        if lon is None or lat is None:
            continue
        if not _point_in_polygon(lon, lat, vertices):
            continue
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        place_type = tags.get("place")
        if place_type not in types:
            continue
        population = _parse_population(tags.get("population")) or 0
        results.append({"name": name, "type": place_type, "population": population, "lon": lon, "lat": lat})

    results.sort(key=lambda s: -s["population"])
    return results
