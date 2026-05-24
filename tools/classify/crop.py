"""
Slices a hex map image into overlapping section crops.
Linear pixel mapping: image width / cols = pixels per hex column.
"""
import math
from pathlib import Path
from PIL import Image

SECTION_COLS = 8
SECTION_ROWS = 6
OVERLAP = 1


def compute_sections(total_cols: int, total_rows: int) -> list[dict]:
    stride_c = SECTION_COLS - OVERLAP
    stride_r = SECTION_ROWS - OVERLAP
    sections = []
    row = 0
    while row < total_rows:
        col = 0
        while col < total_cols:
            c_end = min(col + SECTION_COLS, total_cols)
            r_end = min(row + SECTION_ROWS, total_rows)
            sections.append({
                'id': f'c{col:03d}_r{row:03d}',
                'origin_col': col,
                'origin_row': row,
                'cols': c_end - col,
                'rows': r_end - row,
            })
            col += stride_c
        row += stride_r
    return sections


def slice_image(image_path: Path, total_cols: int, total_rows: int, out_dir: Path) -> list[dict]:
    img = Image.open(image_path).convert('RGB')
    W, H = img.size
    hex_w = W / total_cols
    hex_h = H / total_rows

    out_dir.mkdir(parents=True, exist_ok=True)
    sections = compute_sections(total_cols, total_rows)

    results = []
    for sec in sections:
        c0, r0 = sec['origin_col'], sec['origin_row']
        c1 = c0 + sec['cols']
        r1 = r0 + sec['rows']

        x0 = int(math.floor(c0 * hex_w))
        y0 = int(math.floor(r0 * hex_h))
        x1 = int(math.ceil(c1 * hex_w))
        y1 = int(math.ceil(r1 * hex_h))

        crop = img.crop((x0, y0, x1, y1))
        crop_path = out_dir / f"{sec['id']}.png"
        crop.save(crop_path)

        results.append({**sec, 'file': str(crop_path)})

    return results
