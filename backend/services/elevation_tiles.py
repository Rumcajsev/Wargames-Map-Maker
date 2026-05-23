import asyncio
import json
import math
from pathlib import Path
from typing import AsyncGenerator

import httpx
import numpy as np
from rasterio.io import MemoryFile

from .geometry import compute_bbox, make_lonlat_to_hex

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
CACHE_DIR = Path.home() / ".cache" / "ig2" / "terrarium"
SKIP_TERRAINS = {"sea", "lake"}
METERS_PER_DEGREE = 111_319.0


def select_zoom(hex_diameter_m: float) -> int:
    """Pick zoom level targeting ~64 pixel samples across one hex diameter."""
    target_mpp = hex_diameter_m / 64
    z = math.log2(156_543 / target_mpp)
    return max(5, min(15, round(z)))


def _lon_to_tile_x(lon: float, z: int) -> int:
    return int((lon + 180) / 360 * 2**z)


def _lat_to_tile_y(lat: float, z: int) -> int:
    lat_r = math.radians(lat)
    return int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * 2**z)


def bbox_to_tiles(
    min_lon: float, min_lat: float, max_lon: float, max_lat: float, z: int
) -> list[tuple[int, int]]:
    x0 = _lon_to_tile_x(min_lon, z)
    x1 = _lon_to_tile_x(max_lon, z)
    y0 = _lat_to_tile_y(max_lat, z)  # tile y increases southward
    y1 = _lat_to_tile_y(min_lat, z)
    return [(tx, ty) for tx in range(x0, x1 + 1) for ty in range(y0, y1 + 1)]


def _decode_terrarium(png_bytes: bytes) -> np.ndarray:
    """Return (256, 256) float32 array of elevation in metres."""
    with MemoryFile(png_bytes) as mf:
        with mf.open() as ds:
            data = ds.read()
    r = data[0].astype(np.float32)
    g = data[1].astype(np.float32)
    b = data[2].astype(np.float32)
    return r * 256 + g + b / 256 - 32768


async def _fetch_tile(client: httpx.AsyncClient, z: int, tx: int, ty: int) -> bytes | None:
    cache_path = CACHE_DIR / str(z) / str(tx) / f"{ty}.png"
    if cache_path.exists():
        return cache_path.read_bytes()
    url = TILE_URL.format(z=z, x=tx, y=ty)
    try:
        resp = await client.get(url, timeout=30.0)
        if not resp.is_success:
            return None
        data = resp.content
    except Exception:
        return None
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return data


def _process_tiles(
    tiles_data: list[tuple[int, int, int, bytes]],
    hex_index: dict,
    config,
) -> dict[str, dict]:
    """CPU-bound: decode tiles, assign pixels to hexes, accumulate stats."""
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat_val = math.cos(math.radians(config.center_lat))
    flat_top = config.hex_orientation == "flat"
    R_m = config.outer_radius_m
    sqrt3 = math.sqrt(3)

    # Encode (q, r) as int64 for fast grouping; |q|, |r| won't exceed this for any real map
    QR_OFFSET = 50_000
    QR_STRIDE = 2 * QR_OFFSET

    buckets: dict[tuple[int, int], list] = {}

    for z, tx, ty, png_bytes in tiles_data:
        n = 2 ** z

        # Pixel column fractions → longitude (256,)
        px_frac = (np.arange(256, dtype=np.float64) + 0.5) / 256
        lon_arr = ((tx + px_frac) / n) * 360 - 180

        # Pixel row fractions → latitude (256,)
        py_frac = (np.arange(256, dtype=np.float64) + 0.5) / 256
        lat_arr = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (ty + py_frac) / n))))

        # Broadcast to (256 rows, 256 cols) grids
        lon_grid = lon_arr[np.newaxis, :]   # (1, 256)
        lat_grid = lat_arr[:, np.newaxis]   # (256, 1)

        # Geographic → rotated map → hex fractional coordinates
        E_m = (lon_grid - config.center_lon) * cos_lat_val * METERS_PER_DEGREE
        N_m = (lat_grid - config.center_lat) * METERS_PER_DEGREE
        px_m = cos_β * E_m - sin_β * N_m
        py_m = sin_β * E_m + cos_β * N_m

        if flat_top:
            q_f = 2 * px_m / (3 * R_m)
            r_f = py_m / (R_m * sqrt3) - px_m / (3 * R_m)
        else:
            r_f = 2 * py_m / (3 * R_m)
            q_f = px_m / (R_m * sqrt3) - py_m / (3 * R_m)

        # Vectorised hex rounding (cube coordinate constraint)
        s_f = -q_f - r_f
        q_r = np.round(q_f).astype(np.int32)
        s_r = np.round(s_f).astype(np.int32)
        r_r = np.round(r_f).astype(np.int32)

        dq = np.abs(q_r.astype(np.float32) - q_f)
        ds = np.abs(s_r.astype(np.float32) - s_f)
        dr = np.abs(r_r.astype(np.float32) - r_f)

        mask_q = (dq > ds) & (dq > dr)
        mask_r = (~mask_q) & (dr >= ds)
        q_final = np.where(mask_q, -s_r - r_r, q_r)
        r_final = np.where(mask_r, -q_r - s_r, r_r)

        # Encode (q, r) as single int64 key for groupby
        qr_key = (q_final + QR_OFFSET).astype(np.int64) * QR_STRIDE + (r_final + QR_OFFSET)

        elev_grid = _decode_terrarium(png_bytes)

        qr_flat = qr_key.flatten()
        elev_flat = elev_grid.flatten()

        # Sort-based groupby — O(n log n) but n=65536 and entirely in numpy
        sort_idx = np.argsort(qr_flat, kind="stable")
        qr_sorted = qr_flat[sort_idx]
        elev_sorted = elev_flat[sort_idx]

        boundaries = np.flatnonzero(np.diff(qr_sorted)) + 1
        groups_qr = np.split(qr_sorted, boundaries)
        groups_elev = np.split(elev_sorted, boundaries)

        for gqr, gelev in zip(groups_qr, groups_elev):
            encoded = int(gqr[0])
            q = encoded // QR_STRIDE - QR_OFFSET
            r = encoded % QR_STRIDE - QR_OFFSET
            key = f"{q},{r}"
            if key not in hex_index:
                continue
            if hex_index[key].get("terrain") in SKIP_TERRAINS:
                continue
            hk = (q, r)
            if hk not in buckets:
                buckets[hk] = []
            buckets[hk].extend(gelev.tolist())

    stats: dict[str, dict] = {}
    for (q, r), values in buckets.items():
        arr = np.array(values, dtype=np.float32)
        stats[f"{q},{r}"] = {
            "elevation_avg_m": round(float(arr.mean()), 1),
            "elevation_median_m": round(float(np.median(arr)), 1),
            "elevation_max_m": round(float(arr.max()), 1),
            "elevation_min_m": round(float(arr.min()), 1),
            "elevation_range_m": round(float(arr.max() - arr.min()), 1),
        }
    return stats


def classify_elevation(
    elevation_median_m: float,
    elevation_range_m: float,
    thresholds: dict,
) -> str:
    rank = {"flat": 0, "hills": 1, "mountains": 2}
    range_class = (
        "mountains" if elevation_range_m >= thresholds["mountains_range_m"]
        else "hills" if elevation_range_m >= thresholds["hills_range_m"]
        else "flat"
    )
    abs_class = (
        "mountains" if elevation_median_m >= thresholds["mountains_absolute_m"]
        else "hills" if elevation_median_m >= thresholds["hills_absolute_m"]
        else "flat"
    )
    return max(range_class, abs_class, key=lambda x: rank[x])


async def generate_elevation(
    hexes: list[dict],
    config,
    thresholds: dict,
    progress_cb=None,
) -> list[dict]:
    for h in hexes:
        h["elevation_avg_m"] = None
        h["elevation_median_m"] = None
        h["elevation_max_m"] = None
        h["elevation_min_m"] = None
        h["elevation_range_m"] = None
        h["elevation_class"] = None

    active = [h for h in hexes if h.get("terrain") not in SKIP_TERRAINS]
    if not active:
        return hexes

    if progress_cb:
        await progress_cb("Computing tile coverage…", 5)

    hex_diameter_m = 2 * config.outer_radius_m
    zoom = select_zoom(hex_diameter_m)

    min_lat, min_lon, max_lat, max_lon = compute_bbox(
        config.center_lon, config.center_lat, config.bearing,
        config.width_m, config.height_m, buffer=0.1,
    )
    tiles = bbox_to_tiles(min_lon, min_lat, max_lon, max_lat, zoom)

    if progress_cb:
        await progress_cb(f"Fetching {len(tiles)} elevation tiles (zoom {zoom})…", 10)

    FETCH_BATCH = 20
    tiles_data: list[tuple[int, int, int, bytes]] = []
    async with httpx.AsyncClient() as client:
        for i in range(0, len(tiles), FETCH_BATCH):
            batch = tiles[i:i + FETCH_BATCH]
            results = await asyncio.gather(
                *[_fetch_tile(client, zoom, tx, ty) for tx, ty in batch]
            )
            for (tx, ty), data in zip(batch, results):
                if data is not None:
                    tiles_data.append((zoom, tx, ty, data))
            if progress_cb:
                fetched = min(i + FETCH_BATCH, len(tiles))
                pct = 10 + int(60 * fetched / len(tiles))
                await progress_cb(f"Fetched tiles {fetched}/{len(tiles)}…", pct)

    if progress_cb:
        await progress_cb("Processing elevation pixels…", 72)

    hex_index = {f"{h['q']},{h['r']}": h for h in hexes}

    loop = asyncio.get_event_loop()
    stats = await loop.run_in_executor(None, _process_tiles, tiles_data, hex_index, config)

    if progress_cb:
        await progress_cb("Classifying…", 92)

    for h in hexes:
        s = stats.get(f"{h['q']},{h['r']}")
        if s is None:
            continue
        h.update(s)
        h["elevation_class"] = classify_elevation(
            s["elevation_median_m"], s["elevation_range_m"], thresholds
        )

    return hexes


async def elevation_stream_generator(
    hexes: list[dict],
    config,
    thresholds: dict,
) -> AsyncGenerator[str, None]:
    try:
        yield f"data: {json.dumps({'step': 'progress', 'message': 'Starting elevation fetch…', 'progress': 2})}\n\n"

        progress_queue: asyncio.Queue = asyncio.Queue()

        async def cb(message: str, pct: int) -> None:
            await progress_queue.put((message, pct))

        async def run() -> None:
            try:
                result = await generate_elevation(hexes, config, thresholds, progress_cb=cb)
                await progress_queue.put(("__done__", result))
            except Exception as exc:
                await progress_queue.put(("__error__", str(exc)))

        asyncio.create_task(run())

        while True:
            kind, payload = await progress_queue.get()
            if kind == "__done__":
                yield f"data: {json.dumps({'step': 'done', 'message': 'Done', 'progress': 100, 'hexes': payload})}\n\n"
                break
            if kind == "__error__":
                raise RuntimeError(payload)
            yield f"data: {json.dumps({'step': 'progress', 'message': kind, 'progress': payload})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'step': 'error', 'message': str(e), 'progress': 0})}\n\n"
