"""Terrain classification for hex grid cells using OSM landcover data."""
import math
from shapely.geometry import Polygon

from models import GridConfig
from services.hex_grid import generate_hex_grid, PAPER_SIZES_MM
from services.osm import fetch_landcover, TERRAIN_PRIORITY

METERS_PER_DEGREE = 111_319.0


def compute_geo_bbox(config: GridConfig) -> tuple[float, float, float, float]:
    """Compute geographic bounding box of the paper area, with 10% buffer.

    Returns (min_lat, min_lon, max_lat, max_lon).
    """
    pw_mm, ph_mm = PAPER_SIZES_MM[config.paper_size]
    if config.orientation == "landscape":
        pw_mm, ph_mm = max(pw_mm, ph_mm), min(pw_mm, ph_mm)
    else:
        pw_mm, ph_mm = min(pw_mm, ph_mm), max(pw_mm, ph_mm)

    scale = config.width_m / pw_mm  # metres per mm
    hw = config.width_m / 2
    hh = config.height_m / 2

    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))

    def paper_m_to_lonlat(px: float, py: float) -> tuple[float, float]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lat = config.center_lat + N_m / METERS_PER_DEGREE
        lon = config.center_lon + E_m / (cos_lat * METERS_PER_DEGREE)
        return lon, lat

    # Four corners of the paper in paper-space, then convert to geo
    corners_paper = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    lons, lats = [], []
    for px, py in corners_paper:
        lon, lat = paper_m_to_lonlat(px, py)
        lons.append(lon)
        lats.append(lat)

    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    # Add 10% buffer
    dlon = (max_lon - min_lon) * 0.10
    dlat = (max_lat - min_lat) * 0.10
    return min_lat - dlat, min_lon - dlon, max_lat + dlat, max_lon + dlon


PRIORITY = ["sea", "lake", "marsh", "urban", "woods", "rough", "clear"]


def _compute_coverage(
    hex_poly: Polygon,
    features: list[tuple[Polygon, str]],
) -> dict[str, float]:
    """Compute terrain coverage fractions for a hex polygon."""
    hex_area = hex_poly.area
    if hex_area == 0:
        return {}

    coverage: dict[str, float] = {}
    for poly, terrain in features:
        try:
            inter = hex_poly.intersection(poly)
        except Exception:
            continue
        if inter.is_empty:
            continue
        frac = inter.area / hex_area
        if frac > 0.001:
            coverage[terrain] = coverage.get(terrain, 0.0) + frac

    return {k: min(v, 1.0) for k, v in coverage.items()}


def classify_hex(coverage: dict[str, float], threshold: float) -> str:
    """Classify terrain: first type in priority order that meets the coverage threshold wins.
    threshold is a fraction 0.0–1.0 (e.g. 0.25 = must cover 25% of hex).
    Clear is always the fallback.
    """
    for terrain in PRIORITY[:-1]:
        if coverage.get(terrain, 0) >= threshold:
            return terrain
    return "clear"


def classify_hex_terrain(
    hex_poly: Polygon,
    features: list[tuple[Polygon, str]],
    slider: float = 0.4,
) -> tuple[str, dict[str, float]]:
    """Classify a hex polygon's terrain based on OSM feature coverage.

    Returns (dominant_terrain, coverage_dict) where coverage values are 0-1 fractions.
    """
    coverage = _compute_coverage(hex_poly, features)
    terrain = classify_hex(coverage, slider)
    return terrain, coverage


async def generate_terrain(config: GridConfig, slider: float = 0.4) -> dict:
    from services.worldcover import load_worldcover_window, compute_hex_coverage

    grid = generate_hex_grid(config)
    hexes = grid["hexes"]

    min_lat, min_lon, max_lat, max_lon = compute_geo_bbox(config)
    data, transform = await load_worldcover_window(min_lat, min_lon, max_lat, max_lon)

    for hex_data in hexes:
        pts = [(v[0], v[1]) for v in hex_data["vertices"]]
        try:
            hex_poly = Polygon(pts)
            if not hex_poly.is_valid:
                hex_poly = hex_poly.buffer(0)
        except Exception:
            hex_data["terrain"] = "clear"
            hex_data["coverage"] = {}
            continue

        coverage = compute_hex_coverage(hex_poly, data, transform)
        hex_data["coverage"] = coverage
        hex_data["terrain"] = classify_hex(coverage, slider)

    return grid
