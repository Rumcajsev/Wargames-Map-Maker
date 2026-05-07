import math
from typing import Optional

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation"
BATCH_SIZE = 100  # Open-Meteo hard limit
SKIP_TERRAINS = {"sea", "lake"}


def _calc_local_relief(hex_data: dict, hex_index: dict) -> float:
    q, r = hex_data["q"], hex_data["r"]

    neighbour_elevs = []
    for dq, dr in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)]:
        nb = hex_index.get(f"{q + dq},{r + dr}")
        if nb and nb.get("elevation_m") is not None:
            neighbour_elevs.append(nb["elevation_m"])

    if not neighbour_elevs:
        return 0.0

    neighbour_avg = sum(neighbour_elevs) / len(neighbour_elevs)

    extended_elevs = []
    for dq in range(-3, 4):
        for dr in range(-3, 4):
            dist = (abs(dq) + abs(dr) + abs(dq + dr)) // 2
            if dist < 2 or dist > 3:
                continue
            nb = hex_index.get(f"{q + dq},{r + dr}")
            if nb and nb.get("elevation_m") is not None:
                extended_elevs.append(nb["elevation_m"])

    extended_avg = (
        sum(extended_elevs) / len(extended_elevs) if extended_elevs else neighbour_avg
    )
    weighted_avg = 0.7 * neighbour_avg + 0.3 * extended_avg
    return max(0.0, hex_data["elevation_m"] - weighted_avg)


def classify_elevation_mode_a(
    elevation_m: float, local_relief: float, thresholds: dict
) -> str:
    rank = {"flat": 0, "hills": 1, "mountains": 2}

    local_class = (
        "mountains" if local_relief >= thresholds["mountains_relief_m"]
        else "hills" if local_relief >= thresholds["hills_relief_m"]
        else "flat"
    )
    abs_class = (
        "mountains" if (elevation_m or 0.0) >= thresholds["mountains_absolute_m"]
        else "hills" if (elevation_m or 0.0) >= thresholds["hills_absolute_m"]
        else "flat"
    )
    return max(local_class, abs_class, key=lambda x: rank[x])


async def generate_elevation(
    hexes: list[dict],
    thresholds: dict,
    progress_cb=None,
):
    # Initialise all hexes — sea/lake stay null throughout
    for h in hexes:
        h["elevation_m"] = None
        h["elevation_relief_m"] = None
        h["elevation_class"] = None

    active = [i for i, h in enumerate(hexes) if h.get("terrain") not in SKIP_TERRAINS]
    if not active:
        return hexes

    lats = [hexes[i]["center"][1] for i in active]
    lons = [hexes[i]["center"][0] for i in active]

    # Fetch from Open-Meteo in batches
    elevations: list[Optional[float]] = [None] * len(active)
    n_batches = math.ceil(len(active) / BATCH_SIZE)

    async with httpx.AsyncClient(timeout=30.0) as client:
        for b in range(n_batches):
            s, e = b * BATCH_SIZE, min((b + 1) * BATCH_SIZE, len(active))
            if progress_cb:
                msg = (
                    "Fetching elevation data…"
                    if n_batches == 1
                    else f"Fetching elevation {b + 1}/{n_batches}…"
                )
                await progress_cb(msg, int(5 + 70 * b / n_batches))

            resp = await client.post(
                OPEN_METEO_URL,
                json={
                    "latitude": [round(lat, 5) for lat in lats[s:e]],
                    "longitude": [round(lon, 5) for lon in lons[s:e]],
                },
            )
            if not resp.is_success:
                raise RuntimeError(f"Open-Meteo {resp.status_code}: {resp.text}")
            for j, val in enumerate(resp.json()["elevation"]):
                elevations[s + j] = float(val) if val is not None else None

    for idx, hex_i in enumerate(active):
        hexes[hex_i]["elevation_m"] = elevations[idx]

    if progress_cb:
        await progress_cb("Computing local relief…", 80)

    hex_index = {f"{h['q']},{h['r']}": h for h in hexes}

    if progress_cb:
        await progress_cb("Classifying…", 90)

    for h in hexes:
        if h.get("terrain") in SKIP_TERRAINS or h.get("elevation_m") is None:
            continue
        relief = _calc_local_relief(h, hex_index)
        h["elevation_relief_m"] = round(relief, 1)
        h["elevation_class"] = classify_elevation_mode_a(
            h["elevation_m"], relief, thresholds
        )

    return hexes
