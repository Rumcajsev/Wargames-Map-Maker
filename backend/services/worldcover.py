"""ESA WorldCover terrain classification via COG raster streaming."""
import asyncio
import math
from typing import AsyncIterator

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio import features as rio_features
from shapely.geometry import Polygon, mapping

WORLDCOVER_TERRAIN: dict[int, str] = {
    10: "woods",   # Tree cover
    20: "rough",   # Shrubland
    30: "clear",   # Grassland
    40: "clear",   # Cropland
    50: "urban",   # Built-up
    60: "rough",   # Bare / sparse vegetation
    70: "rough",   # Snow and ice
    80: "lake",    # Permanent water bodies
    90: "marsh",   # Herbaceous wetland
    95: "marsh",   # Mangroves
    100: "rough",  # Moss and lichen
    0: "clear",    # No data
}

# ~100m resolution — plenty for hex classification, drastically cuts download size
TARGET_RES_DEG = 0.0009


def get_tile_ids(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> list[str]:
    tiles = []
    lat = math.floor(min_lat / 3) * 3
    while lat <= max_lat:
        lon = math.floor(min_lon / 3) * 3
        while lon <= max_lon:
            ns = "N" if lat >= 0 else "S"
            ew = "E" if lon >= 0 else "W"
            tiles.append(f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}")
            lon += 3
        lat += 3
    return tiles


def _tile_url(tile_id: str) -> str:
    return (
        "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com"
        f"/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile_id}_Map.tif"
    )


def _load_window(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float
) -> tuple[np.ndarray, object]:
    tile_ids = get_tile_ids(min_lat, min_lon, max_lat, max_lon)
    datasets = [rasterio.open(_tile_url(tid)) for tid in tile_ids]
    try:
        data, transform = merge(
            datasets,
            bounds=(min_lon, min_lat, max_lon, max_lat),
            res=(TARGET_RES_DEG, TARGET_RES_DEG),
            resampling=Resampling.mode,
            nodata=0,
        )
        return data[0], transform
    finally:
        for ds in datasets:
            ds.close()


async def load_worldcover_window(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float
) -> tuple[np.ndarray, object]:
    return await asyncio.to_thread(_load_window, min_lat, min_lon, max_lat, max_lon)


def compute_hex_coverage(
    hex_poly: Polygon,
    data: np.ndarray,
    transform: object,
) -> dict[str, float]:
    mask = rio_features.rasterize(
        [(mapping(hex_poly), 1)],
        out_shape=data.shape,
        transform=transform,
        fill=0,
        dtype=np.uint8,
    )
    pixels = data[mask == 1]
    if len(pixels) == 0:
        return {}

    terrain_counts: dict[str, int] = {}
    for val, count in zip(*np.unique(pixels, return_counts=True)):
        terrain = WORLDCOVER_TERRAIN.get(int(val), "clear")
        terrain_counts[terrain] = terrain_counts.get(terrain, 0) + int(count)

    total = sum(terrain_counts.values())
    return {t: round(c / total, 3) for t, c in terrain_counts.items() if c / total > 0.001}
