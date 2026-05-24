"""
Prompt templates for the two-pass classification pipeline.
"""

_SECTION = """\
You are a wargame cartographer classifying a section of a historical map into a hex grid.

This crop covers cols {col_start}–{col_end}, rows {row_start}–{row_end}.
Grid is flat-top hexes. Col 0 is leftmost, row 0 is topmost. Odd columns are shifted down by half a hex.

YOUR JOB IS INTERPRETATION, NOT PIXEL DETECTION.

You are not asking "does this symbol appear inside this hex boundary."
You are asking: "What hex grid representation best captures the wargaming reality of this area?"

TERRAIN
Assign the type that best represents the hex for gameplay — movement cost, cover, visibility.

  clear       — open ground: fields, farmland, grassland, roads through open country
  light_woods — partial woodland: forest edges, orchards, vineyards, scattered trees,
                a woodlot that does not dominate the hex
  woods       — dense continuous forest that would significantly impair movement and visibility
  rough       — broken ground: rocky, scrub, heath, steep slopes without tree cover
  marsh       — wetland: reeds, waterlogged ground, flood plain
  sea         — open water, large lake, estuary

A hex that is mostly open with a small woodlot in one corner is clear.
A hex sitting on a forest edge where trees thin out is light_woods.
A hex of solid dense forest canopy is woods.
When in doubt between two types, choose the one that matters more for gameplay.

ELEVATION
Assign based on what a commander would notice — not precise contour counting.

  flat      — no meaningful relief; artillery and cavalry move freely
  hills     — rolling or hilly ground; affects movement and line of sight noticeably
  mountains — dominant terrain; severely restricts movement, defines the tactical picture

RIVERS
A river on the map is a geographic line. Your job is to represent it as hex edges —
the boundary between two adjacent hexes that the river most naturally separates.

Trace the river's path and assign the edge (or edges) of each hex where the river
best belongs. The river does not have to literally cross that boundary line; assign
the edge that best captures the river's course and the natural boundary it creates.

List all edges of this hex where a river runs. Empty array [] if none.
Edge labels: N, NE, SE, S, SW, NW

ROADS
Roads pass through hexes. Assign the two edges the road crosses as it passes through.
If a road terminates in a hex (at a settlement or map edge), it may have only one edge.

Road tiers:
  0 — major road: paved, double-line, prominently marked
  1 — secondary road: single line, country road
  2 — track or path: dotted, dashed, or faint

IGNORE all military symbols: unit counters, coloured rectangles, formation labels,
tactical arrows, order-of-battle annotations. Classify only the underlying geography.

SETTLEMENTS
  city    — large town, multiple streets visible, possibly fortified
  town    — recognisable named settlement with some street detail
  village — small cluster of buildings or a single dot/symbol

Output JSON only — no prose, no explanation, no code fences:

{
  "hexes": [
    {
      "col": 0,
      "row": 0,
      "terrain": "clear",
      "elevation": "flat",
      "settlement": null,
      "roads": [{"tier": 1, "enters": "SW", "exits": "NE"}],
      "rivers": ["SE"],
      "notes": "one sentence of visual evidence"
    }
  ]
}

settlement is null or {"type": "city"|"town"|"village", "name": "string or null"}.
roads and rivers are empty arrays [] if none present.
Include every hex in the crop, even fully default ones (clear, flat, null, [], []).
Output JSON only.\
"""

_ROADS = """\
You are tracing roads and tracks across a historical wargame map.

The full map covers a {cols}×{rows} hex grid (flat-top hexes, col 0 top-left,
row 0 top-left, odd columns shifted down half a hex).

IGNORE all military symbols. Focus only on roads, tracks, and paths as geographic features.

Trace each road continuously from one side of the map to the other (or to where it ends).
For each hex a road passes through, record the edge it enters and the edge it exits.

Roads pass THROUGH hexes — they connect two of the hex's six edges.
Edge labels: N, NE, SE, S, SW, NW

Road tiers:
  0 — major road: paved, double-line, prominently marked
  1 — secondary road: single line, country road
  2 — track or path: dotted, dashed, or faint

Output JSON only — no prose, no code fences:

{
  "roads": [
    {"col": 5, "row": 3, "tier": 1, "enters": "SW", "exits": "NE"}
  ]
}\
"""


def section_prompt(origin_col: int, origin_row: int, cols: int, rows: int) -> str:
    return _SECTION.format(
        col_start=origin_col,
        col_end=origin_col + cols - 1,
        row_start=origin_row,
        row_end=origin_row + rows - 1,
    )


def roads_prompt(cols: int, rows: int) -> str:
    return _ROADS.format(cols=cols, rows=rows)
