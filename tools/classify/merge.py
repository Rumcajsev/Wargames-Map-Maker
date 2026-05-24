"""
Merges section crop results into a single hex list.
On overlap conflicts, prefers the hex closest to its crop's center.
Converts col/row (0-indexed, top-left origin) to q/r (axial, center origin).
"""


def merge(
    crop_results: list[dict],
    total_cols: int,
    total_rows: int,
    road_edges: list[dict] | None = None,
) -> dict:
    best: dict[tuple, tuple[dict, float]] = {}

    for crop in crop_results:
        origin_col = crop['origin_col']
        origin_row = crop['origin_row']
        cols = crop['cols']
        rows = crop['rows']
        center_col = origin_col + (cols - 1) / 2
        center_row = origin_row + (rows - 1) / 2

        for hex_data in crop.get('hexes', []):
            col = hex_data.get('col')
            row = hex_data.get('row')
            if col is None or row is None:
                continue
            dist = ((col - center_col) ** 2 + (row - center_row) ** 2) ** 0.5
            key = (col, row)
            if key not in best or dist < best[key][1]:
                best[key] = (hex_data, dist)

    hexes = []
    for (col, row), (hex_data, _) in sorted(best.items()):
        q, r = _to_qr(col, row, total_cols, total_rows)
        hexes.append({
            'q': q,
            'r': r,
            **{k: v for k, v in hex_data.items() if k not in ('col', 'row')},
        })

    converted_roads = []
    for edge in (road_edges or []):
        col = edge.get('col')
        row = edge.get('row')
        if col is None or row is None:
            continue
        q, r = _to_qr(col, row, total_cols, total_rows)
        converted_roads.append({
            'q': q, 'r': r,
            **{k: v for k, v in edge.items() if k not in ('col', 'row')},
        })

    return {'hexes': hexes, 'road_edges': converted_roads}


def _to_qr(col: int, row: int, total_cols: int, total_rows: int) -> tuple[int, int]:
    return col - total_cols // 2, row - total_rows // 2
