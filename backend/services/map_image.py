import asyncio
import base64
import json
import math
import os
from io import BytesIO
from pathlib import Path
from typing import AsyncGenerator

import anthropic
from PIL import Image

# Read API key directly from .env file, bypassing shell environment
_env_file = Path(__file__).parent.parent / '.env'
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        if _line.startswith('ANTHROPIC_API_KEY='):
            os.environ['ANTHROPIC_API_KEY'] = _line.split('=', 1)[1].strip()
            break

_COORD_HEADER = """\
The map covers a grid of {cols} columns × {rows} rows of hexes.
Coordinates: (0.0, 0.0) = top-left corner, ({cols}.0, {rows}.0) = bottom-right corner.
IGNORE all military symbols: unit counters, coloured rectangles, infantry/cavalry/artillery
markers, formation labels, tactical arrows. Map only the underlying geography.\
"""

TERRAIN_PROMPT = _COORD_HEADER + """

Identify all non-clear terrain regions as polygons. Omit open/clear ground — it is the default.
  light_woods — forest edges, orchards, scattered trees
  woods       — dense continuous forest
  rough       — rocky, scrub, heath, broken terrain
  marsh       — wetland, reed symbols, waterlogged ground
  sea         — open water, large lake, estuary

Use 4–12 polygon vertices per region. Output JSON only:

{{"terrain_regions": [{{"terrain": "woods", "polygon": [[12.0, 3.0], [18.0, 3.5], [17.5, 8.0], [12.5, 7.5]]}}]}}

JSON only."""

ELEVATION_PROMPT = _COORD_HEADER + """

Identify elevated terrain regions as polygons. Omit flat ground — it is the default.
  hills       — rolling terrain, moderate hachures or contour density
  mountains   — dominant terrain, dense hachures, movement-restricting

Use 4–12 polygon vertices per region. Output JSON only:

{{"elevation_regions": [{{"elevation": "hills", "polygon": [[5.0, 10.0], [15.0, 9.0], [14.0, 18.0], [6.0, 17.0]]}}]}}

JSON only."""

ROADS_PROMPT = _COORD_HEADER + """

Trace all roads and tracks as polylines from one map edge to the other (or to terminus).
  0 — major: paved, double-line, prominently marked
  1 — secondary: single line, country road
  2 — track: dotted, dashed, or faint

Output JSON only:

{{"roads": [{{"tier": 0, "points": [[0.0, 15.0], [8.0, 14.5], [{cols}.0, 12.0]]}}]}}

JSON only."""

RIVERS_PROMPT = _COORD_HEADER + """

Trace all rivers and canals as polylines from one map edge to the other (or to source).
  river — natural watercourse
  canal — straight artificial waterway

Output JSON only:

{{"rivers": [{{"type": "river", "points": [[0.0, 8.0], [10.0, 9.5], [{cols}.0, 19.0]]}}]}}

JSON only."""

SETTLEMENTS_PROMPT = _COORD_HEADER + """

Identify all settlements as points.
  city    — large town, multiple streets, possibly fortified
  town    — recognisable named settlement with street detail
  village — small cluster of buildings or a single dot/symbol

Output JSON only:

{{"settlements": [{{"type": "town", "name": "Waterloo", "point": [14.5, 15.0]}}, {{"type": "village", "name": null, "point": [8.0, 11.0]}}]}}

JSON only."""


def _compress(img: Image.Image, max_width: int = 2000) -> str:
    if img.width > max_width:
        h = int(img.height * max_width / img.width)
        img = img.resize((max_width, h), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


async def _call(client: anthropic.AsyncAnthropic, prompt: str, image_b64: str) -> dict:
    resp = await client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
            {"type": "text", "text": prompt},
        ]}],
    )
    text = resp.content[0].text
    print(f"[map_image] {text[:200]!r}", flush=True)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        start = text.index('{')
        end = text.rindex('}')
        return json.loads(text[start:end + 1])
    except (ValueError, json.JSONDecodeError):
        pass
    raise ValueError(f"Cannot parse JSON: {text[:200]!r}")


def _point_in_polygon(px: float, py: float, polygon: list) -> bool:
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _assign_terrain(terrain_regions: list, total_cols: int, total_rows: int) -> list[dict]:
    hexes = []
    for col in range(total_cols):
        for row in range(total_rows):
            cx, cy = col + 0.5, row + 0.5
            terrain = "clear"
            for region in terrain_regions:
                if _point_in_polygon(cx, cy, region.get("polygon", [])):
                    terrain = region.get("terrain", "clear")
            q = col - total_cols // 2
            r = row - total_rows // 2
            hexes.append({"q": q, "r": r, "terrain": terrain})
    return hexes


def _assign_elevation(elevation_regions: list, total_cols: int, total_rows: int) -> list[dict]:
    hexes = []
    for col in range(total_cols):
        for row in range(total_rows):
            cx, cy = col + 0.5, row + 0.5
            elevation = "flat"
            for region in elevation_regions:
                if _point_in_polygon(cx, cy, region.get("polygon", [])):
                    elevation = region.get("elevation", "flat")
            q = col - total_cols // 2
            r = row - total_rows // 2
            hexes.append({"q": q, "r": r, "elevation_class": elevation})
    return hexes


def _polyline_to_hex_pairs(points: list, total_cols: int, total_rows: int) -> list[tuple]:
    samples = []
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        dist = math.hypot(x1 - x0, y1 - y0)
        n = max(2, int(dist / 0.4))
        for t in range(n):
            frac = t / n
            samples.append((x0 + frac * (x1 - x0), y0 + frac * (y1 - y0)))
    if points:
        samples.append(points[-1])
    hex_path = []
    for x, y in samples:
        col = int(min(max(math.floor(x), 0), total_cols - 1))
        row = int(min(max(math.floor(y), 0), total_rows - 1))
        if not hex_path or hex_path[-1] != (col, row):
            hex_path.append((col, row))
    return [(hex_path[i], hex_path[i + 1]) for i in range(len(hex_path) - 1)]


def _build_road_edges(roads_data: list, total_cols: int, total_rows: int) -> list[dict]:
    edges, seen = [], set()
    for rd in roads_data:
        pts = rd.get("points", [])
        if len(pts) < 2:
            continue
        for (c1, r1), (c2, r2) in _polyline_to_hex_pairs(pts, total_cols, total_rows):
            q1, rr1 = c1 - total_cols // 2, r1 - total_rows // 2
            q2, rr2 = c2 - total_cols // 2, r2 - total_rows // 2
            key = tuple(sorted([(q1, rr1), (q2, rr2)]))
            if key not in seen:
                seen.add(key)
                edges.append({"q1": q1, "r1": rr1, "q2": q2, "r2": rr2,
                               "tier": rd.get("tier", 1), "manual": True})
    return edges


def _build_river_edges(rivers_data: list, total_cols: int, total_rows: int) -> list[dict]:
    edges, seen = [], set()
    for rv in rivers_data:
        pts = rv.get("points", [])
        if len(pts) < 2:
            continue
        for (c1, r1), (c2, r2) in _polyline_to_hex_pairs(pts, total_cols, total_rows):
            q1, rr1 = c1 - total_cols // 2, r1 - total_rows // 2
            q2, rr2 = c2 - total_cols // 2, r2 - total_rows // 2
            key = tuple(sorted([(q1, rr1), (q2, rr2)]))
            if key not in seen:
                seen.add(key)
                edges.append({"q1": q1, "r1": rr1, "q2": q2, "r2": rr2})
    return edges


def _build_settlements(settlements_data: list, total_cols: int, total_rows: int) -> list[dict]:
    tier_map = {"city": 0, "town": 1, "village": 2}
    out = []
    for s in settlements_data:
        pt = s.get("point", [0, 0])
        col = int(min(max(round(pt[0]), 0), total_cols - 1))
        row = int(min(max(round(pt[1]), 0), total_rows - 1))
        q = col - total_cols // 2
        r = row - total_rows // 2
        out.append({"q": q, "r": r, "tier": tier_map.get(s.get("type", "village"), 2),
                    "name": s.get("name") or ""})
    return out


async def map_image_stream_generator(
    image_b64: str,
    cols: int,
    rows: int,
) -> AsyncGenerator[str, None]:
    def emit(step: str, message: str, progress: int, **extra) -> str:
        return f"data: {json.dumps({'step': step, 'message': message, 'progress': progress, **extra})}\n\n"

    try:
        yield emit("progress", "Loading image…", 2)
        img_bytes = base64.b64decode(image_b64)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        img_b64 = _compress(img, max_width=2000)

        client = anthropic.AsyncAnthropic()

        # Inject cols/rows into prompts
        def fmt(p: str) -> str:
            return p.format(cols=cols, rows=rows)

        # Five concurrent calls — yield results as each arrives via a queue
        queue: asyncio.Queue = asyncio.Queue()

        async def run(name: str, prompt: str) -> None:
            try:
                result = await _call(client, prompt, img_b64)
                await queue.put((name, result, None))
            except Exception as exc:
                await queue.put((name, None, exc))

        tasks = [
            asyncio.create_task(run("terrain",     fmt(TERRAIN_PROMPT))),
            asyncio.create_task(run("elevation",   fmt(ELEVATION_PROMPT))),
            asyncio.create_task(run("roads",       fmt(ROADS_PROMPT))),
            asyncio.create_task(run("rivers",      fmt(RIVERS_PROMPT))),
            asyncio.create_task(run("settlements", fmt(SETTLEMENTS_PROMPT))),
        ]

        category_labels = {
            "terrain":     "terrain regions",
            "elevation":   "elevation regions",
            "roads":       "roads",
            "rivers":      "rivers",
            "settlements": "settlements",
        }

        for i in range(len(tasks)):
            name, result, error = await queue.get()
            label = category_labels.get(name, name)
            progress = 15 + int(70 * (i + 1) / len(tasks))

            if error:
                print(f"[map_image] {name} call failed: {error}", flush=True)
                yield emit("progress", f"{label} failed — skipping", progress)
                continue

            if name == "terrain":
                raw = result.get("terrain_regions", [])
                hexes = _assign_terrain(raw, cols, rows)
                yield f"data: {json.dumps({'step': 'partial', 'category': 'terrain', 'message': f'Terrain done', 'progress': progress, 'hexes': hexes, 'raw_data': raw})}\n\n"

            elif name == "elevation":
                raw = result.get("elevation_regions", [])
                hexes = _assign_elevation(raw, cols, rows)
                yield f"data: {json.dumps({'step': 'partial', 'category': 'elevation', 'message': f'Elevation done', 'progress': progress, 'hexes': hexes, 'raw_data': raw})}\n\n"

            elif name == "roads":
                raw = result.get("roads", [])
                road_edges = _build_road_edges(raw, cols, rows)
                yield f"data: {json.dumps({'step': 'partial', 'category': 'roads', 'message': f'Roads done', 'progress': progress, 'road_edges': road_edges, 'raw_data': raw})}\n\n"

            elif name == "rivers":
                raw = result.get("rivers", [])
                river_edges = _build_river_edges(raw, cols, rows)
                yield f"data: {json.dumps({'step': 'partial', 'category': 'rivers', 'message': f'Rivers done', 'progress': progress, 'river_edges': river_edges, 'raw_data': raw})}\n\n"

            elif name == "settlements":
                raw = result.get("settlements", [])
                settlements = _build_settlements(raw, cols, rows)
                yield f"data: {json.dumps({'step': 'partial', 'category': 'settlements', 'message': f'Settlements done', 'progress': progress, 'settlements': settlements, 'raw_data': raw})}\n\n"

        await asyncio.gather(*tasks, return_exceptions=True)

        yield emit("progress", "Done", 100)
        yield f"data: {json.dumps({'step': 'done', 'progress': 100})}\n\n"

    except Exception as exc:
        yield f"data: {json.dumps({'step': 'error', 'message': str(exc), 'progress': 0})}\n\n"
