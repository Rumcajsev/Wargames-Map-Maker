#!/usr/bin/env python3
"""
Hex map classifier — two-pass pipeline.

Pass 1: full image (compressed) → road routing, global continuity
Pass 2: section crops (8×6 hexes, 1-hex overlap) → terrain, elevation, rivers, settlements

Usage:
    python tools/classify/classify.py map.png --cols 30 --rows 20 --out hexes.json

Resume an interrupted run (progress auto-saved after each crop):
    python tools/classify/classify.py map.png --cols 30 --rows 20 --out hexes.json --resume

Requires:
    pip install anthropic pillow
    ANTHROPIC_API_KEY in environment or backend/.env
"""
import argparse
import base64
import json
import sys
import time
from io import BytesIO
from pathlib import Path

import anthropic
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from crop import slice_image
from prompts import section_prompt, roads_prompt
from merge import merge

DEFAULT_MODEL = 'claude-opus-4-7'


def _compress_to_b64(image_path: Path, max_width: int = 1500) -> str:
    img = Image.open(image_path).convert('RGB')
    if img.width > max_width:
        h = int(img.height * max_width / img.width)
        img = img.resize((max_width, h), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def _file_to_b64(path: Path) -> str:
    return base64.b64encode(Path(path).read_bytes()).decode()


def _call_claude(client: anthropic.Anthropic, model: str, prompt: str, image_b64: str, media_type: str = 'image/jpeg') -> dict:
    for attempt in range(3):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=8192,
                messages=[{
                    'role': 'user',
                    'content': [
                        {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': image_b64}},
                        {'type': 'text', 'text': prompt},
                    ],
                }],
            )
            text = response.content[0].text.strip()
            if '```' in text:
                parts = text.split('```')
                text = parts[1]
                if text.startswith('json'):
                    text = text[4:]
            return json.loads(text.strip())
        except json.JSONDecodeError as e:
            print(f'    JSON parse error (attempt {attempt + 1}/3): {e}')
            if attempt == 2:
                raise
            time.sleep(2)
        except anthropic.RateLimitError:
            wait = 30 * (attempt + 1)
            print(f'    Rate limited — waiting {wait}s…')
            time.sleep(wait)
    raise RuntimeError('All attempts failed')


def main() -> None:
    parser = argparse.ArgumentParser(description='Classify hex map from historical map image')
    parser.add_argument('image', type=Path, help='Input map image, pre-cropped to hex grid area')
    parser.add_argument('--cols', type=int, required=True, help='Number of hex columns')
    parser.add_argument('--rows', type=int, required=True, help='Number of hex rows')
    parser.add_argument('--out', type=Path, default=Path('hexes.json'), help='Output JSON path')
    parser.add_argument('--crops-dir', type=Path, default=Path('crops'), help='Directory for crop PNGs')
    parser.add_argument('--model', default=DEFAULT_MODEL, help='Claude model to use')
    parser.add_argument('--skip-roads-pass', action='store_true', help='Skip global roads pass')
    parser.add_argument('--resume', action='store_true', help='Resume from auto-saved progress file')
    args = parser.parse_args()

    if not args.image.exists():
        print(f'Error: image not found: {args.image}', file=sys.stderr)
        sys.exit(1)

    progress_path = args.out.with_name(args.out.stem + '.progress.json')

    # Load previous progress if resuming
    completed_crops: dict[str, list[dict]] = {}
    saved_road_edges: list[dict] = []
    if args.resume and progress_path.exists():
        saved = json.loads(progress_path.read_text())
        for crop in saved.get('crops', []):
            completed_crops[crop['id']] = crop.get('hexes', [])
        saved_road_edges = saved.get('road_edges', [])
        print(f'Resuming: {len(completed_crops)} crops already done')

    client = anthropic.Anthropic()

    # ── Pass 1: Global roads routing ──────────────────────────────────────────
    road_edges: list[dict] = saved_road_edges
    if not args.skip_roads_pass and not saved_road_edges:
        print('Pass 1: Roads routing (full image)…')
        b64 = _compress_to_b64(args.image, max_width=1500)
        result = _call_claude(client, args.model, roads_prompt(args.cols, args.rows), b64)
        road_edges = result.get('roads', [])
        print(f'  → {len(road_edges)} road segments')
    elif saved_road_edges:
        print(f'Pass 1: skipped (loaded {len(road_edges)} road segments from progress)')

    # ── Pass 2: Section crops ─────────────────────────────────────────────────
    print('Pass 2: Slicing into section crops…')
    sections = slice_image(args.image, args.cols, args.rows, args.crops_dir)
    total = len(sections)
    print(f'  → {total} crops for {args.cols}×{args.rows} = {args.cols * args.rows} hexes')

    crop_results: list[dict] = []

    for i, sec in enumerate(sections):
        crop_id = sec['id']

        if crop_id in completed_crops:
            print(f'  [{i+1}/{total}] {crop_id} — cached')
            crop_results.append({**sec, 'hexes': completed_crops[crop_id]})
            continue

        c0, r0 = sec['origin_col'], sec['origin_row']
        c1, r1 = c0 + sec['cols'] - 1, r0 + sec['rows'] - 1
        print(f'  [{i+1}/{total}] {crop_id}: cols {c0}–{c1}, rows {r0}–{r1}…', end=' ', flush=True)

        img_b64 = _file_to_b64(sec['file'])
        prompt = section_prompt(c0, r0, sec['cols'], sec['rows'])
        result = _call_claude(client, args.model, prompt, img_b64, media_type='image/png')
        hexes = result.get('hexes', [])
        print(f'{len(hexes)} hexes')

        crop_results.append({**sec, 'hexes': hexes})

        # Auto-save progress after every crop
        progress_path.write_text(json.dumps({
            'cols': args.cols,
            'rows': args.rows,
            'road_edges': road_edges,
            'crops': crop_results,
        }, indent=2))

    # ── Merge ─────────────────────────────────────────────────────────────────
    print('Merging…')
    output = merge(crop_results, args.cols, args.rows, road_edges)
    print(f'  → {len(output["hexes"])} hexes, {len(output["road_edges"])} road segments')

    args.out.write_text(json.dumps(output, indent=2))
    if progress_path.exists():
        progress_path.unlink()

    print(f'Done → {args.out}')


if __name__ == '__main__':
    main()
