"""
Motorway-hex presence check — two modes:

  fast=False  full geometry: samples every OSM node, accurate to R_m/2
  fast=True   center-point: one center coord per way segment, ~10-100x less data
              good enough at country scale where hexes are large
"""

import math
from services.geometry import compute_bbox, make_lonlat_to_hex, METERS_PER_DEGREE
from services.overpass import post_overpass


def _timeouts(width_m: float, fast: bool) -> tuple[int, float]:
    width_km = width_m / 1000
    if fast:
        if width_km < 500:   return 20, 30.0
        elif width_km < 1500: return 40, 55.0
        else:                 return 70, 90.0
    else:
        if width_km < 300:   return 30, 40.0
        elif width_km < 700: return 60, 75.0
        else:                 return 100, 120.0


async def generate_motorway_hexes(config) -> dict:
    cos_lat = math.cos(math.radians(config.center_lat))
    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m,
    )

    opa_timeout, http_timeout = _timeouts(config.width_m, config.fast)
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"

    if config.fast:
        # center mode: one point per way segment, tiny response
        query = (
            f'[out:json][timeout:{opa_timeout}][maxsize:16777216];\n'
            f'way["highway"~"^(motorway|motorway_link)$"]({bbox});\n'
            f'out center;\n'
        )
        data = await post_overpass(query, timeout=http_timeout)
        lonlat_to_hex = make_lonlat_to_hex(config, config.R_m)
        seen: set[tuple[int, int]] = set()
        for el in data.get("elements", []):
            if el.get("type") != "way":
                continue
            c = el.get("center")
            if c:
                seen.add(lonlat_to_hex(c["lon"], c["lat"]))
        return {"hexes": [[q, r] for q, r in seen], "fast": True}

    # full geometry mode: sample along every way at R_m/2 intervals
    query = (
        f'[out:json][timeout:{opa_timeout}][maxsize:104857600];\n'
        f'way["highway"~"^(motorway|motorway_link)$"]({bbox});\n'
        f'out geom;\n'
    )
    data = await post_overpass(query, timeout=http_timeout)
    lonlat_to_hex = make_lonlat_to_hex(config, config.R_m)
    step_m = config.R_m / 2
    seen = set()

    for el in data.get("elements", []):
        if el.get("type") != "way":
            continue
        geom = el.get("geometry", [])
        if len(geom) < 2:
            continue

        coords = [(p["lon"], p["lat"]) for p in geom]
        seen.add(lonlat_to_hex(coords[0][0], coords[0][1]))

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
                seen.add(lonlat_to_hex(lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)))
                pos += step_m
            accumulated = (accumulated + seg_m) % step_m

        seen.add(lonlat_to_hex(coords[-1][0], coords[-1][1]))

    return {"hexes": [[q, r] for q, r in seen], "fast": False}
