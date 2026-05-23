import asyncio
import base64
import json
import os
from io import BytesIO
from typing import AsyncGenerator

import anthropic
from PIL import Image

PATCH_PROMPT = """Classify this hex patch from a scanned historical map.

IGNORE completely: military unit symbols, coloured rectangles, infantry/cavalry/artillery markers, tactical arrows, flags, order-of-battle annotations. Classify only the underlying terrain and geography.

Return JSON only (no prose):
{
  "terrain": "clear"|"woods"|"light_woods"|"rough"|"marsh"|"sea",
  "elevation_class": "flat"|"hills"|"mountains",
  "road_tier": null or 0 or 1 or 2,
  "has_river": true or false,
  "settlement": null or "city" or "town" or "village",
  "confidence": 0.0-1.0,
  "notes": "one sentence of visual evidence"
}

Terrain:
  clear       — open fields, farmland, grassland
  woods       — dense forest, dark/filled tree symbols
  light_woods — scattered trees, orchards, sparse woodland
  rough       — rocky ground, scrub, heath, broken terrain
  marsh       — wetland, reed symbols, waterlogged ground
  sea         — open water, large lake

Road tier (null if no road visible):
  0 — major road, double-line or wide drawn road
  1 — secondary road, single solid line
  2 — track, path, dotted or thin line

Elevation (from hachures or contour lines):
  flat      — no relief marks
  hills     — moderate hachures or contour density
  mountains — dense hachures, prominent relief shading"""

FLAT_NEIGHBORS = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]


async def _classify_batch(
    client: anthropic.AsyncAnthropic,
    patches: list[dict],
) -> list[dict]:
    content = []
    for p in patches:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": p["image_b64"]},
        })
        content.append({"type": "text", "text": f"Hex ({p['q']},{p['r']}):"})

    content.append({
        "type": "text",
        "text": PATCH_PROMPT + f"\n\nReturn a JSON array with exactly {len(patches)} objects, one per hex in the same order.",
    })

    resp = await client.messages.create(
        model="claude-opus-4-7",
        max_tokens=400 * len(patches),
        messages=[{"role": "user", "content": content}],
    )

    text = resp.content[0].text.strip()
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1:
        start, end = text.find("{"), text.rfind("}") + 1
        results = [json.loads(text[start:end])]
    else:
        results = json.loads(text[start:end])

    out = []
    for i, p in enumerate(patches):
        r = results[i] if i < len(results) else {}
        out.append({
            "q": p["q"],
            "r": p["r"],
            "terrain": r.get("terrain", "clear"),
            "elevation_class": r.get("elevation_class", "flat"),
            "road_tier": r.get("road_tier"),
            "has_river": bool(r.get("has_river", False)),
            "settlement": r.get("settlement"),
            "confidence": float(r.get("confidence", 0.5)),
            "notes": r.get("notes", ""),
        })
    return out


def _crop_patch(img: Image.Image, cx: float, cy: float, size: int) -> bytes:
    half = size // 2
    left = max(0, int(cx - half))
    top = max(0, int(cy - half))
    right = min(img.width, int(cx + half))
    bottom = min(img.height, int(cy + half))
    patch = img.crop((left, top, right, bottom))
    if patch.width != size or patch.height != size:
        padded = Image.new("RGB", (size, size), (255, 255, 255))
        padded.paste(patch, ((size - patch.width) // 2, (size - patch.height) // 2))
        patch = padded
    buf = BytesIO()
    patch.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _build_road_edges(results: list[dict]) -> list[dict]:
    road_map = {(h["q"], h["r"]): h["road_tier"] for h in results if h.get("road_tier") is not None}
    seen: set[tuple] = set()
    edges = []
    for (q, r), tier in road_map.items():
        for dq, dr in FLAT_NEIGHBORS:
            nq, nr = q + dq, r + dr
            if road_map.get((nq, nr)) == tier:
                key = tuple(sorted([(q, r), (nq, nr)]))
                if key not in seen:
                    seen.add(key)
                    edges.append({"q1": key[0][0], "r1": key[0][1], "q2": key[1][0], "r2": key[1][1], "tier": tier, "manual": True})
    return edges


def _build_river_edges(results: list[dict]) -> list[dict]:
    river_set = {(h["q"], h["r"]) for h in results if h.get("has_river")}
    seen: set[tuple] = set()
    edges = []
    for (q, r) in river_set:
        for dq, dr in FLAT_NEIGHBORS:
            nq, nr = q + dq, r + dr
            if (nq, nr) in river_set:
                key = tuple(sorted([(q, r), (nq, nr)]))
                if key not in seen:
                    seen.add(key)
                    edges.append({"q1": key[0][0], "r1": key[0][1], "q2": key[1][0], "r2": key[1][1]})
    return edges


async def map_image_stream_generator(
    image_b64: str,
    hex_crops: list[dict],
) -> AsyncGenerator[str, None]:
    try:
        yield f"data: {json.dumps({'step': 'progress', 'message': 'Loading image…', 'progress': 2})}\n\n"

        img_bytes = base64.b64decode(image_b64)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY environment variable not set")
        client = anthropic.AsyncAnthropic(api_key=api_key)

        BATCH_SIZE = 6
        batches = [hex_crops[i : i + BATCH_SIZE] for i in range(0, len(hex_crops), BATCH_SIZE)]

        yield f"data: {json.dumps({'step': 'progress', 'message': f'Classifying {len(hex_crops)} hexes in {len(batches)} batches…', 'progress': 5})}\n\n"

        results: list[dict] = []
        done_count = 0
        lock = asyncio.Lock()
        progress_queue: asyncio.Queue = asyncio.Queue()
        sem = asyncio.Semaphore(8)

        async def process_batch(batch: list[dict]) -> None:
            nonlocal done_count
            prepared = []
            for hc in batch:
                patch_bytes = _crop_patch(img, hc["cx"], hc["cy"], int(hc.get("size", 64)))
                prepared.append({
                    "q": hc["q"],
                    "r": hc["r"],
                    "image_b64": base64.standard_b64encode(patch_bytes).decode(),
                })
            async with sem:
                try:
                    batch_results = await _classify_batch(client, prepared)
                except Exception as exc:
                    batch_results = [
                        {"q": hc["q"], "r": hc["r"], "terrain": "clear", "elevation_class": "flat",
                         "road_tier": None, "has_river": False, "settlement": None,
                         "confidence": 0.0, "notes": f"error: {exc}"}
                        for hc in batch
                    ]
            async with lock:
                results.extend(batch_results)
                done_count += 1
                pct = 8 + int(84 * done_count / len(batches))
                await progress_queue.put((f"Classified {min(done_count * BATCH_SIZE, len(hex_crops))}/{len(hex_crops)} hexes…", pct))

        async def run_all() -> None:
            await asyncio.gather(*[process_batch(b) for b in batches])
            await progress_queue.put(("__done__", 100))

        asyncio.create_task(run_all())

        while True:
            message, pct = await progress_queue.get()
            if message == "__done__":
                break
            yield f"data: {json.dumps({'step': 'progress', 'message': message, 'progress': pct})}\n\n"

        yield f"data: {json.dumps({'step': 'progress', 'message': 'Building road and river network…', 'progress': 95})}\n\n"

        road_edges = _build_road_edges(results)
        river_edges = _build_river_edges(results)

        yield f"data: {json.dumps({'step': 'done', 'hexes': results, 'road_edges': road_edges, 'river_edges': river_edges, 'progress': 100})}\n\n"

    except Exception as exc:
        yield f"data: {json.dumps({'step': 'error', 'message': str(exc), 'progress': 0})}\n\n"
