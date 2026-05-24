"""
Waterloo map dry-run classifier.
Maps the hex grid onto the Waterloo battle map by region and outputs
a browser console snippet to inject terrain + roads + rivers into the app.

Usage:
    python dryrun_waterloo.py | pbcopy
Then paste into the browser console.
"""
import json
import sys

# ── Hex grid (paste output of the console dump here, or pipe via stdin) ──────
HEX_JSON = r"""PASTE_HEX_JSON_HERE"""


def load_hexes():
    raw = HEX_JSON.strip()
    if raw == "PASTE_HEX_JSON_HERE":
        print("Reading hex JSON from stdin…", file=sys.stderr)
        raw = sys.stdin.read().strip()
    return json.loads(raw)


# ── Coordinate normalisation ──────────────────────────────────────────────────
# Flat-top axial hex → normalised image coords (0,0) = NW corner
# x increases west→east, y increases north→south
# Grid spans q: -19..19, visual-y (r + q/2): -12..12

def norm(q, r):
    x = (q + 19) / 38
    y = (r + q / 2 + 12) / 24
    return x, y


# ── Terrain classification ────────────────────────────────────────────────────
# Based on visual analysis of the Waterloo battle map image.
# The image covers roughly: Waterloo (N) → Charleroi (S), Nivelles (W) → Wavre (E)

def classify_terrain(q, r):
    x, y = norm(q, r)
    x = max(0, min(1, x))
    y = max(0, min(1, y))

    # Hougoumont woods — left-centre
    if 0.11 <= x <= 0.27 and 0.36 <= y <= 0.58:
        return "woods"

    # Bois de Paris — right-centre large forest
    if x >= 0.82 and 0.44 <= y <= 0.68:
        return "woods"

    # Plancenoit / Rossomme woods — centre-bottom
    if 0.42 <= x <= 0.64 and 0.64 <= y <= 0.84:
        return "woods"

    # Bois de Viers / Hubermont — bottom-right
    if x >= 0.71 and y >= 0.76:
        return "woods"

    # Scattered trees upper-left (Merbraine / Nivelles road area)
    if x <= 0.13 and 0.05 <= y <= 0.30:
        return "light_woods"

    # Light trees near Mon-Plaisir bottom-left
    if x <= 0.10 and y >= 0.72:
        return "light_woods"

    return "clear"


def classify_elevation(q, r):
    x, y = norm(q, r)
    # Wellington's ridge runs roughly E-W at y ≈ 0.28–0.42, centre of map
    if 0.08 <= x <= 0.88 and 0.27 <= y <= 0.43:
        return "hills"
    # Some rolling ground south of Plancenoit
    if 0.40 <= x <= 0.70 and 0.68 <= y <= 0.80:
        return "hills"
    return "flat"


# ── Road tracing ──────────────────────────────────────────────────────────────
# Flat-top adjacent directions: E=(+1,0), NE=(+1,-1), NW=(0,-1),
#                                W=(-1,0), SW=(-1,+1), SE=(0,+1)

def make_edges(path, tier, hexset):
    edges = []
    for i in range(len(path) - 1):
        q1, r1 = path[i]
        q2, r2 = path[i + 1]
        dq, dr = q2 - q1, r2 - r1
        # Only emit edge if hexes are adjacent (one step) and both in grid
        if abs(dq) <= 1 and abs(dr) <= 1 and (q1, r1) in hexset and (q2, r2) in hexset:
            edges.append({"q1": q1, "r1": r1, "q2": q2, "r2": r2, "tier": tier, "manual": True})
    return edges


def brussels_charleroi_road():
    """Main N-S road (tier 0). Runs along q=0 from r=11 (south) to r=-11 (north),
    then shifts NW toward Waterloo town."""
    path = [(0, r) for r in range(11, -12, -1)]
    # Branch toward Waterloo (NW)
    path += [(-1, r) for r in range(-11, -13, -1)]
    return path


def ridge_road():
    """E-W road along Wellington's ridge (tier 1), y ≈ 0.35.
    Alternates E and NE steps to stay roughly horizontal."""
    path = []
    q, r = -10, 1
    path.append((q, r))
    for _ in range(22):
        x, y = norm(q, r)
        # Choose east (q+1, r) or NE (q+1, r-1) — whichever stays closer to y=0.35
        y_e  = norm(q + 1, r)[1]
        y_ne = norm(q + 1, r - 1)[1]
        if abs(y_e - 0.35) <= abs(y_ne - 0.35):
            q, r = q + 1, r
        else:
            q, r = q + 1, r - 1
        path.append((q, r))
    return path


def nivelles_road():
    """Road going SW from the ridge crossroads (tier 1)."""
    # Starts at ridge junction ~(-1, -3), goes SW
    path = [(-1, -3), (-2, -2), (-3, -2), (-4, -1), (-5, -1),
            (-6, 0),  (-7, 0),  (-8, 1),  (-9, 1), (-10, 2)]
    return path


def wavre_road():
    """Road going NE from La Belle Alliance area (tier 1)."""
    # Starts at (1, -3), goes NE
    path = [(1, -3), (2, -4), (3, -5), (4, -6),
            (5, -7), (6, -8), (7, -9), (8, -10)]
    return path


# ── River tracing ─────────────────────────────────────────────────────────────

def eastern_stream():
    """Stream running roughly N-S on the eastern side of the map (x ≈ 0.73),
    corresponding to the Dyle tributary visible as a blue line."""
    # x=0.73 → q ≈ 0.73*38 - 19 = 8.7 → q=9
    # y=0.28 → r+q/2+12=0.28*24=6.72 → r=6.72-12-4.5=-9.78 → r≈-10
    # y=0.62 → r≈-2
    path = [(9, r) for r in range(-10, -1)]
    return path


def lasne_stream():
    """Stream near Plancenoit / Lasne running roughly E-W (x 0.55–0.82, y ≈ 0.78)."""
    # y=0.78 → r+q/2 = 0.78*24-12 = 6.72 → r = 6.72 - q/2
    path = []
    for q in range(2, 14):
        r = round(6.72 - q / 2)
        path.append((q, r))
    return path


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    hexes = load_hexes()
    hexset = {(h["q"], h["r"]) for h in hexes}

    # Terrain
    terrain_map = {}
    for h in hexes:
        q, r = h["q"], h["r"]
        terrain_map[f"{q},{r}"] = {
            "terrain": classify_terrain(q, r),
            "elevation_class": classify_elevation(q, r),
        }

    # Roads
    road_edges = []
    road_edges += make_edges(brussels_charleroi_road(), 0, hexset)
    road_edges += make_edges(ridge_road(),              1, hexset)
    road_edges += make_edges(nivelles_road(),           1, hexset)
    road_edges += make_edges(wavre_road(),              1, hexset)

    # Rivers
    river_edges = []
    for path in [eastern_stream(), lasne_stream()]:
        for i in range(len(path) - 1):
            q1, r1 = path[i]
            q2, r2 = path[i + 1]
            if (q1, r1) in hexset and (q2, r2) in hexset:
                river_edges.append({"q1": q1, "r1": r1, "q2": q2, "r2": r2})

    # JS snippet
    tm_json   = json.dumps(terrain_map)
    re_json   = json.dumps(road_edges)
    riv_json  = json.dumps(river_edges)

    snippet = f"""
(function() {{
  const s = window.__mapStore.getState();
  const tm = {tm_json};
  const updated = s.generatedHexes.map(h => {{
    const key = h.q + ',' + h.r;
    const cls = tm[key];
    if (!cls) return h;
    return {{ ...h, terrain: cls.terrain, elevation_class: cls.elevation_class }};
  }});
  window.__mapStore.setState({{
    generatedHexes: updated,
    generateStatus: 'done',
    roadEdges: {re_json},
    riverEdges: {riv_json},
    roadsStatus: 'done',
    riversStatus: 'done',
  }});
  console.log('Injected:', updated.length, 'hexes,', {len(road_edges)}, 'road edges,', {len(river_edges)}, 'river edges');
}})();
""".strip()

    print(snippet)
    print(f"\n// Stats: {len(hexes)} hexes | {len(road_edges)} road edges | {len(river_edges)} river edges",
          file=sys.stderr)


if __name__ == "__main__":
    main()
