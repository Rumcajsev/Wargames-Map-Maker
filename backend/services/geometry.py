import math

METERS_PER_DEGREE = 111_319.0


def compute_bbox(
    center_lon: float,
    center_lat: float,
    bearing: float,
    width_m: float,
    height_m: float,
    buffer: float = 0.05,
) -> tuple[float, float, float, float]:
    """Compute geographic bounding box with a fractional buffer.

    Returns (min_lat, min_lon, max_lat, max_lon).
    buffer=0.05 expands each half-dimension by 5% before applying rotation.
    """
    β = math.radians(bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(center_lat))
    hw = width_m / 2 * (1 + buffer)
    hh = height_m / 2 * (1 + buffer)
    lons, lats = [], []
    for px, py in [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]:
        E_m = px * cos_β + py * sin_β
        N_m = -px * sin_β + py * cos_β
        lats.append(center_lat + N_m / METERS_PER_DEGREE)
        lons.append(center_lon + E_m / (cos_lat * METERS_PER_DEGREE))
    return min(lats), min(lons), max(lats), max(lons)


def _round_hex(q_f: float, r_f: float) -> tuple[int, int]:
    x, z = q_f, r_f
    y = -x - z
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        pass
    else:
        rz = -rx - ry
    return rx, rz


def make_lonlat_to_hex(config, R_m: float):
    """Return a closure that maps (lon, lat) → (q, r) hex coordinates."""
    β = math.radians(config.bearing)
    cos_β, sin_β = math.cos(β), math.sin(β)
    cos_lat = math.cos(math.radians(config.center_lat))
    flat_top = config.hex_orientation == "flat"

    def lonlat_to_hex(lon: float, lat: float) -> tuple[int, int]:
        E_m = (lon - config.center_lon) * cos_lat * METERS_PER_DEGREE
        N_m = (lat - config.center_lat) * METERS_PER_DEGREE
        px = cos_β * E_m - sin_β * N_m
        py = sin_β * E_m + cos_β * N_m
        if flat_top:
            q_f = 2 * px / (3 * R_m)
            r_f = py / (R_m * math.sqrt(3)) - px / (3 * R_m)
        else:
            r_f = 2 * py / (3 * R_m)
            q_f = px / (R_m * math.sqrt(3)) - py / (3 * R_m)
        return _round_hex(q_f, r_f)

    return lonlat_to_hex


def polyline_to_hex_sequence(
    coords: list[tuple[float, float]],
    lonlat_to_hex,
    R_m: float,
    cos_lat: float,
) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        dE = (lon2 - lon1) * cos_lat * METERS_PER_DEGREE
        dN = (lat2 - lat1) * METERS_PER_DEGREE
        dist = math.hypot(dE, dN)
        n_samples = max(2, int(dist / (R_m / 3)) + 1)
        for j in range(n_samples):
            t = j / (n_samples - 1)
            h = lonlat_to_hex(lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1))
            if not result or result[-1] != h:
                result.append(h)
    return result


def smooth_hex_path(path: list[tuple[int, int]]) -> list[tuple[int, int]]:
    changed = True
    while changed:
        changed = False
        new_path: list[tuple[int, int]] = [path[0]]
        i = 1
        while i < len(path):
            if i + 1 < len(path) and path[i + 1] == new_path[-1]:
                i += 2
                changed = True
            else:
                new_path.append(path[i])
                i += 1
        path = new_path
    return path
