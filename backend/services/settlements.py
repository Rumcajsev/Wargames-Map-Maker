"""Fetch OSM place nodes (settlements) via Overpass API."""
import httpx
from urllib.parse import urlencode

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


async def fetch_settlements(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    limit: int = 30,
    types: list[str] | None = None,
) -> list[dict]:
    """Fetch OSM place nodes within the given bounding box.

    Returns a list of dicts sorted descending by population, up to `limit` entries.
    Each dict has: name, type, population, lon, lat.
    """
    if types is None:
        types = ["city", "town", "village"]

    query = (
        f'[out:json][timeout:30][bbox:{min_lat},{min_lon},{max_lat},{max_lon}];\n'
        f'node["place"~"city|town|village"]["population"];\n'
        f'out body;\n'
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            OVERPASS_URL,
            content=urlencode({"data": query}).encode(),
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "User-Agent": "IG2HexMap/1.0",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    settlements: list[dict] = []
    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        place_type = tags.get("place")
        if place_type not in types:
            continue

        pop_raw = tags.get("population")
        if pop_raw is None:
            continue
        try:
            # population may have commas or spaces in some locales
            population = int(str(pop_raw).replace(",", "").replace(" ", "").split(".")[0])
        except (ValueError, TypeError):
            continue

        settlements.append({
            "name": name,
            "type": place_type,
            "population": population,
            "lon": element.get("lon"),
            "lat": element.get("lat"),
        })

    settlements.sort(key=lambda s: s["population"], reverse=True)
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
        f'node["place"~"{type_re}"];\n'
        f'out body;\n'
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            OVERPASS_URL,
            content=urlencode({"data": query}).encode(),
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "User-Agent": "IG2HexMap/1.0",
            },
        )
        resp.raise_for_status()
        data = resp.json()

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
        pop_raw = tags.get("population")
        try:
            population = int(str(pop_raw).replace(",", "").replace(" ", "").split(".")[0]) if pop_raw else 0
        except (ValueError, TypeError):
            population = 0
        results.append({"name": name, "type": place_type, "population": population, "lon": lon, "lat": lat})

    results.sort(key=lambda s: s["population"], reverse=True)
    return results
