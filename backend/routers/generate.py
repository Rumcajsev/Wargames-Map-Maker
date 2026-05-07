import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models import GridConfig, ReclassifyRequest, SettlementsConfig, RoadsConfig, RiversConfig, ElevationConfig, HexLookupConfig
from services.hex_grid import generate_hex_grid
from services.terrain import generate_terrain, compute_geo_bbox, classify_hex
from services.worldcover import load_worldcover_window, compute_hex_coverage
from shapely.geometry import Polygon

router = APIRouter()


@router.post("/grid")
async def generate_grid(config: GridConfig) -> dict:
    return generate_hex_grid(config)


@router.post("/terrain")
async def generate_terrain_endpoint(config: GridConfig) -> dict:
    return await generate_terrain(config, slider=config.slider)


@router.post("/settlements")
async def generate_settlements(config: SettlementsConfig) -> dict:
    from services.settlements import fetch_settlements

    # Build a minimal GridConfig so we can reuse compute_geo_bbox (bearing-aware, 10% buffer).
    # Use dummy hex fields — they are not touched by compute_geo_bbox.
    grid_cfg = GridConfig(
        center_lon=config.center_lon,
        center_lat=config.center_lat,
        bearing=config.bearing,
        width_m=config.width_m,
        height_m=config.height_m,
        hex_size_mm=20,
        paper_size=config.paper_size,
        orientation=config.orientation,
        hex_orientation="flat",
    )
    min_lat, min_lon, max_lat, max_lon = compute_geo_bbox(grid_cfg)

    # Apply a 5% buffer instead of the 10% already baked in by compute_geo_bbox.
    # compute_geo_bbox uses 10%; reduce by dividing the excess back.
    # Simpler: just compute bbox directly with 5% buffer.
    import math
    MPDEG = 111_319.0
    cos_lat = math.cos(math.radians(config.center_lat))
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    hw = config.width_m / 2 * 1.05
    hh = config.height_m / 2 * 1.05
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    lons, lats = [], []
    for px, py in corners:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lats.append(config.center_lat + N_m / MPDEG)
        lons.append(config.center_lon + E_m / (cos_lat * MPDEG))
    min_lat = min(lats)
    max_lat = max(lats)
    min_lon = min(lons)
    max_lon = max(lons)

    settlements = await fetch_settlements(
        min_lat, min_lon, max_lat, max_lon,
        limit=config.limit,
        types=config.types,
    )
    return {"settlements": settlements}


@router.post("/settlement-hex-lookup")
async def settlement_hex_lookup(config: HexLookupConfig) -> dict:
    from services.settlements import fetch_settlements_in_hex
    results = await fetch_settlements_in_hex(config.vertices, config.types)
    return {"settlements": results}


@router.post("/rivers")
async def generate_rivers(config: RiversConfig) -> dict:
    from services.rivers import fetch_rivers
    import math

    MPDEG = 111_319.0
    cos_lat = math.cos(math.radians(config.center_lat))
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    hw = config.width_m / 2 * 1.05
    hh = config.height_m / 2 * 1.05
    lons, lats = [], []
    for px, py in [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lats.append(config.center_lat + N_m / MPDEG)
        lons.append(config.center_lon + E_m / (cos_lat * MPDEG))

    try:
        rivers = await fetch_rivers(min(lats), min(lons), max(lats), max(lons), config.types, config.hex_size_km)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Overpass API error: {exc}")
    return {"rivers": rivers}


@router.post("/roads")
async def generate_roads(config: RoadsConfig) -> dict:
    from services.roads import generate_road_hexes
    try:
        return await generate_road_hexes(config)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Overpass API error: {exc}")


@router.post("/elevation-stream")
async def elevation_stream(config: ElevationConfig) -> StreamingResponse:
    from services.elevation import generate_elevation
    import asyncio

    thresholds = {
        "hills_relief_m": config.hills_relief_m,
        "mountains_relief_m": config.mountains_relief_m,
        "hills_absolute_m": config.hills_absolute_m,
        "mountains_absolute_m": config.mountains_absolute_m,
    }

    async def event_generator():
        try:
            yield f"data: {json.dumps({'step': 'progress', 'message': 'Starting elevation fetch…', 'progress': 2})}\n\n"

            hexes = [dict(h) for h in config.hexes]
            progress_queue: asyncio.Queue = asyncio.Queue()

            async def cb(message: str, pct: int):
                await progress_queue.put((message, pct))  # kind=message, payload=pct

            async def run():
                try:
                    result = await generate_elevation(hexes, thresholds, progress_cb=cb)
                    await progress_queue.put(("__done__", result))
                except Exception as exc:
                    await progress_queue.put(("__error__", str(exc)))

            asyncio.create_task(run())

            updated_hexes = None
            while True:
                item = await progress_queue.get()
                kind, payload = item
                if kind == "__done__":
                    updated_hexes = payload
                    break
                elif kind == "__error__":
                    raise RuntimeError(payload)
                else:
                    msg, pct = kind, payload
                    yield f"data: {json.dumps({'step': 'progress', 'message': msg, 'progress': pct})}\n\n"
            yield f"data: {json.dumps({'step': 'done', 'message': 'Done', 'progress': 100, 'hexes': updated_hexes})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e), 'progress': 0})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/reclassify")
def reclassify(req: ReclassifyRequest) -> dict:
    from services.terrain import classify_hex
    for hex_data in req.hexes:
        if hex_data.get("manual_override"):
            continue
        hex_data["terrain"] = classify_hex(hex_data.get("coverage", {}), req.slider)
    return {"hexes": req.hexes}


@router.get("/terrain-stream")
async def terrain_stream(
    center_lon: float,
    center_lat: float,
    width_m: float,
    height_m: float,
    hex_size_mm: float,
    paper_size: str,
    orientation: str,
    hex_orientation: str,
    bearing: float = 0.0,
    margin_mm: float = 0.0,
    slider: float = 0.4,
) -> StreamingResponse:
    config = GridConfig(
        center_lon=center_lon,
        center_lat=center_lat,
        bearing=bearing,
        width_m=width_m,
        height_m=height_m,
        hex_size_mm=hex_size_mm,
        paper_size=paper_size,
        orientation=orientation,
        hex_orientation=hex_orientation,
        margin_mm=margin_mm,
        slider=slider,
    )

    async def event_generator():
        try:
            # Step 1: hex grid
            yield f"data: {json.dumps({'step': 'grid', 'message': 'Computing hex grid…', 'progress': 5})}\n\n"
            grid = generate_hex_grid(config)
            hexes = grid["hexes"]
            meta = grid["metadata"]
            n_hexes = len(hexes)

            # Step 2: load WorldCover raster
            yield f"data: {json.dumps({'step': 'raster', 'message': 'Loading WorldCover raster…', 'progress': 15})}\n\n"
            min_lat, min_lon, max_lat, max_lon = compute_geo_bbox(config)
            data, transform = await load_worldcover_window(min_lat, min_lon, max_lat, max_lon)

            # Step 3: classify hex by hex with progress
            for i, hex_data in enumerate(hexes):
                if i % 10 == 0:
                    pct = 20 + int(75 * i / max(n_hexes, 1))
                    msg = f"Classifying hexes… {i}/{n_hexes}"
                    yield f"data: {json.dumps({'step': 'classify', 'message': msg, 'progress': pct})}\n\n"

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

            yield f"data: {json.dumps({'step': 'done', 'message': 'Done', 'progress': 100, 'hexes': hexes, 'metadata': meta})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e), 'progress': 0})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
