import math
from models import GridConfig

METERS_PER_DEGREE = 111_319.0

PAPER_SIZES_MM: dict[str, tuple[float, float]] = {
    "A4": (210, 297),
    "A3": (297, 420),
    "A2": (420, 594),
    "A1": (594, 841),
}


def generate_hex_grid(config: GridConfig) -> dict:
    # Paper dims in mm
    pw_mm, ph_mm = PAPER_SIZES_MM[config.paper_size]
    if config.orientation == "landscape":
        pw_mm, ph_mm = max(pw_mm, ph_mm), min(pw_mm, ph_mm)
    else:
        pw_mm, ph_mm = min(pw_mm, ph_mm), max(pw_mm, ph_mm)

    # Scale: frontend tells us geographic width of the paper frame in metres
    width_m: float = config.width_m
    height_m: float = config.height_m
    scale = width_m / pw_mm  # metres per mm

    # Apply margin: inner area shrinks by margin on each side
    inner_width_m = width_m - 2 * config.margin_mm * scale
    inner_height_m = height_m - 2 * config.margin_mm * scale

    # Hex circumradius (centre to vertex).
    # hex_size_mm is flat-to-flat (inner diameter = sqrt(3) * R → R = size / sqrt(3))
    inner_m = (config.hex_size_mm / 2) * scale
    R_m = inner_m * 2.0 / math.sqrt(3)

    flat_top = config.hex_orientation == "flat"

    # Bearing rotation.
    # MapLibre bearing β° (clockwise from north) means:
    #   paper-right in (East, North) = (cos β, −sin β)
    #   paper-up   in (East, North) = (sin β,  cos β)
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))

    def axial_to_paper_m(q: int, r: int) -> tuple[float, float]:
        """Hex centre offset from paper centre in paper-space metres (right, up)."""
        if flat_top:
            px = R_m * 1.5 * q
            py = R_m * (math.sqrt(3) / 2 * q + math.sqrt(3) * r)
        else:
            px = R_m * (math.sqrt(3) * q + math.sqrt(3) / 2 * r)
            py = R_m * 1.5 * r
        return px, py

    def paper_m_to_lonlat(px: float, py: float) -> tuple[float, float]:
        """Paper-space metres → geographic lon/lat."""
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lat = config.center_lat + N_m / METERS_PER_DEGREE
        lon = config.center_lon + E_m / (cos_lat * METERS_PER_DEGREE)
        return lon, lat

    def hex_vertices(px: float, py: float) -> list[list[float]]:
        base = 0 if flat_top else 30
        verts = []
        for i in range(6):
            angle = math.radians(base + 60 * i)
            vlon, vlat = paper_m_to_lonlat(
                px + R_m * math.cos(angle),
                py + R_m * math.sin(angle),
            )
            verts.append([round(vlon, 6), round(vlat, 6)])
        return verts

    hw = inner_width_m / 2
    hh = inner_height_m / 2
    sweep = int(max(width_m, height_m) / 2 / R_m) + 3

    hexes = []
    for q in range(-sweep, sweep + 1):
        for r in range(-sweep, sweep + 1):
            px, py = axial_to_paper_m(q, r)

            # Quick cull in paper space before building geometry
            if abs(px) > hw + R_m or abs(py) > hh + R_m:
                continue

            lon, lat = paper_m_to_lonlat(px, py)
            verts = hex_vertices(px, py)

            # Partial = any vertex outside the inner (margin) rectangle
            base = 0 if flat_top else 30
            verts_paper = [
                (px + R_m * math.cos(math.radians(base + 60 * i)),
                 py + R_m * math.sin(math.radians(base + 60 * i)))
                for i in range(6)
            ]
            partial = any(abs(vx) > hw or abs(vy) > hh for vx, vy in verts_paper)

            hexes.append({
                "q": q,
                "r": r,
                "center": [round(lon, 6), round(lat, 6)],
                "vertices": verts,
                "partial": partial,
                "terrain": "clear",
            })

    return {
        "hexes": hexes,
        "metadata": {
            "hex_count": len(hexes),
            "hex_size_km": round(config.hex_size_mm * scale / 1000, 3),
            "scale_m_per_mm": round(scale, 2),
            "outer_radius_m": round(R_m, 2),
            "center": [round(config.center_lon, 6), round(config.center_lat, 6)],
            "bearing": config.bearing,
            "paper_mm": [pw_mm, ph_mm],
            "margin_mm": config.margin_mm,
        },
    }
