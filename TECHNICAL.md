# Hex Map Generator — Technical Reference

## Stack

**Frontend**
- React
- MapLibre GL JS (slippy map, viewport overlay)
- SVG renderer (custom, see RENDERING.md)
- No CSS framework — custom styles

**Backend**
- Python 3.11+
- FastAPI
- GeoPandas (polygon intersection, spatial operations)
- Shapely (hex geometry, polygon math)
- Rasterio (DEM tile reading and sampling)
- httpx (async HTTP for Overpass API and DEM fetching)

**External services**
- Overpass API (OSM data queries)
- Copernicus GLO-30 (DEM tiles, 30m resolution, free)
- CORINE Land Cover (EU landcover raster, used at 5km+ hex sizes)
- OSRM public API (road routing between settlements)

---

## API Endpoints

All endpoints accept and return JSON. Frontend calls these sequentially as user progresses through panels.

### POST /generate/terrain
Fetches OSM landcover for bbox, intersects with hex grid, returns raw coverage percentages per hex.

Request:
```json
{
  "bbox": [lat_min, lon_min, lat_max, lon_max],
  "rotation_degrees": 15,
  "hex_size_km": 4.3,
  "hex_orientation": "pointy-top",
  "hex_count_h": 28,
  "hex_count_v": 19,
  "edge_treatment": "full_only",
  "slider": 0.4
}
```

Response: full hex grid with terrain and coverage fields populated. elevation_m, elevation_class, river_edges, roads, railways, settlement all null/empty at this stage.

### POST /generate/elevation
Fetches DEM tiles for bbox, calculates elevation_m and local relief per hex.

Request:
```json
{
  "hexes": [...],
  "bbox": [lat_min, lon_min, lat_max, lon_max],
  "elevation_mode": "terrain_class",
  "terrain_class_thresholds": {
    "hills_relief_m": 80,
    "mountains_relief_m": 300,
    "hills_absolute_m": 600,
    "mountains_absolute_m": 1500
  }
}
```

Response: same hex array with elevation_m and elevation_class populated.

### POST /generate/rivers
Fetches OSM waterway data, classifies edges and wide river terrain.

Request:
```json
{
  "hexes": [...],
  "bbox": [lat_min, lon_min, lat_max, lon_max],
  "river_min_width_m": 30,
  "river_terrain_width_m": 100
}
```

Response: same hex array with river_edges populated, some hexes terrain updated to "river".

### POST /generate/settlements
Fetches OSM settlements filtered by population and type.

Request:
```json
{
  "bbox": [lat_min, lon_min, lat_max, lon_max],
  "population_min": 5000,
  "types": ["city", "town", "village"]
}
```

Response: list of settlement candidates (not yet placed on hexes):
```json
{
  "settlements": [
    {
      "osm_id": 123456,
      "name": "Namur",
      "type": "city",
      "population": 110000,
      "lat": 50.467,
      "lon": 4.867
    }
  ]
}
```

Frontend handles hex assignment (which hex each settlement falls in) and conflict resolution client-side.

### POST /generate/railways
Fetches OSM railway network, assigns to hex edges.

Request:
```json
{
  "hexes": [...],
  "bbox": [lat_min, lon_min, lat_max, lon_max],
  "include_abandoned": false,
  "min_length_km": 2
}
```

Response: same hex array with railways populated.

### POST /route/road
Routes a road between two points via OSRM, returns hex edge assignments.

Request:
```json
{
  "hexes": [...],
  "from": { "lat": 50.467, "lon": 4.867 },
  "to": { "lat": 50.850, "lon": 4.351 }
}
```

Response:
```json
{
  "road_type": "highway",
  "hex_segments": [
    { "q": 3, "r": -1, "type": "highway", "edges": [0, 3] },
    { "q": 3, "r": 0, "type": "highway", "edges": [0, 3] }
  ]
}
```

### POST /reclassify
Re-applies terrain slider or elevation thresholds to existing data. Fast, no external fetching.

Request:
```json
{
  "hexes": [...],
  "slider": 0.6,
  "elevation_mode": "terrain_class",
  "terrain_class_thresholds": { ... }
}
```

Response: same hex array with terrain and elevation_class reclassified.

### POST /export/pdf
Renders hex grid as SVG at full resolution, converts to PDF. Returns PDF file.

Request:
```json
{
  "map": { "meta": {...}, "hexes": [...] },
  "style": "historical_cartographic",
  "paper_width_mm": 594,
  "paper_height_mm": 420,
  "dpi": 300
}
```

Response: PDF binary.

---

## Data Model

### Hex Object
```json
{
  "q": 3,
  "r": -1,
  "partial": false,
  "terrain": "woods",
  "elevation_m": 312,
  "elevation_class": "hills",
  "coverage": {
    "woods": 0.58,
    "clear": 0.31,
    "marsh": 0.11
  },
  "settlement": {
    "name": "Waterloo",
    "type": "town",
    "population": 30000
  },
  "roads": [
    { "type": "highway", "edges": [0, 3] },
    { "type": "road", "edges": [1, 4] }
  ],
  "railways": [
    { "type": "railway", "edges": [2, 5] }
  ],
  "river_edges": [1, 2]
}
```

Field notes:
- q, r: axial hex coordinates. q increases right, r increases down-right for pointy-top.
- partial: true if hex extends beyond the canvas boundary
- terrain: one of clear, woods, rough, marsh, river, lake, sea, urban
- elevation_m: average elevation in meters within hex. null for sea and lake.
- elevation_class: flat, hills, mountains (mode A) or band label string (mode B). null for sea and lake.
- coverage: raw percentage coverage per terrain type. Always stored, used for instant reclassification.
- settlement: null if no settlement. One per hex maximum.
- roads: empty array if none. One entry per road type. edges are 0-5 clockwise from top.
- railways: empty array if none. One entry per railway type.
- river_edges: empty array if none. List of edge indices 0-5 where a river crosses.

### Edge Numbering
Edges numbered 0-5 clockwise:
- Pointy-top: 0=top, 1=top-right, 2=bottom-right, 3=bottom, 4=bottom-left, 5=top-left
- Flat-top: 0=top-right, 1=right, 2=bottom-right, 3=bottom-left, 4=left, 5=top-left

No cardinal direction names used anywhere in data. Grid may be rotated arbitrarily.

### Top-Level Map Object
```json
{
  "meta": {
    "version": "1.0",
    "paper_format": "A2",
    "paper_width_mm": 594,
    "paper_height_mm": 420,
    "paper_orientation": "landscape",
    "hex_size_mm": 20,
    "hex_size_km": 4.3,
    "hex_orientation": "pointy-top",
    "edge_treatment": "full_only",
    "hex_count_h": 28,
    "hex_count_v": 19,
    "total_hexes": 532,
    "bbox": [49.5, 2.5, 50.5, 4.5],
    "rotation_degrees": 15,
    "north_offset_degrees": -15,
    "projection": "EPSG:3857",
    "generated_at": "2026-05-01T12:00:00Z",
    "sources": ["OSM", "Copernicus GLO-30", "CORINE"],
    "slider": 0.4,
    "style": "historical_cartographic",
    "elevation": {
      "mode": "terrain_class",
      "terrain_class_thresholds": {
        "hills_relief_m": 80,
        "mountains_relief_m": 300,
        "hills_absolute_m": 600,
        "mountains_absolute_m": 1500
      },
      "bands": [
        { "max_m": 100, "label": "Lowland", "color": "#a8d878" },
        { "max_m": 300, "label": "Low hills", "color": "#c8c860" },
        { "max_m": 600, "label": "Hills", "color": "#d8a840" },
        { "max_m": 1000, "label": "High hills", "color": "#c88030" },
        { "max_m": 1500, "label": "Mountains", "color": "#a06030" },
        { "max_m": 99999, "label": "High mountains", "color": "#d0d0d0" }
      ]
    },
    "settlement_population_min": 5000,
    "river_min_width_m": 30,
    "river_terrain_width_m": 100,
    "include_abandoned_railways": false,
    "railway_min_length_km": 2
  },
  "hexes": [...]
}
```

---

## Hex Grid Geometry

### Coordinate System
Axial coordinates (q, r). Standard hex grid math applies.

Conversion from axial to pixel (pointy-top):
```
x = hex_size * (sqrt(3) * q + sqrt(3)/2 * r)
y = hex_size * (3/2 * r)
```

For flat-top:
```
x = hex_size * (3/2 * q)
y = hex_size * (sqrt(3)/2 * q + sqrt(3) * r)
```

### Geo Projection
Grid is constructed in projected coordinates (EPSG:3857, Web Mercator). Bbox corners converted from WGS84 lat/lon to EPSG:3857 before grid construction. Each hex centre has a projected coordinate which can be converted back to lat/lon for OSM queries.

### Rotation
The hex grid is constructed axis-aligned, then rotated by rotation_degrees around the canvas centre. This rotation is applied as a 2D affine transform to all hex centre coordinates before projecting to geo coordinates for data fetching.

The actual bbox sent to Overpass/DEM is the bounding box of the rotated canvas — always larger than the canvas itself. Fetched data covers the full rotated extent.

### Grid Construction Steps
1. Calculate canvas dimensions in projected meters from paper_width_mm, paper_height_mm, hex_size_mm, and hex_size_km
2. Determine hex count (hex_count_h x hex_count_v) from canvas dimensions and hex_size in meters
3. Construct axial grid from (0,0) to (hex_count_h, hex_count_v)
4. Apply rotation transform to all hex centres
5. For edge_treatment=full_only: filter out hexes whose corners extend beyond canvas boundary
6. For edge_treatment=clipped: keep all hexes, mark boundary-crossing ones as partial=true
7. Project hex centres to WGS84 lat/lon for data fetching

---

## Terrain Classification Algorithm

### Coverage Calculation
For each hex:
1. Get the hex polygon in projected coordinates
2. Intersect with each OSM/CORINE landcover polygon
3. Calculate intersection area / hex area = coverage fraction per terrain type
4. Store all fractions in coverage object (always, regardless of classification)

### Slider Classification
```python
PRIORITY = ["sea", "lake", "marsh", "urban", "woods", "rough", "clear"]

def classify_hex(coverage, slider):
    n = len(PRIORITY)
    for i, terrain in enumerate(PRIORITY[:-1]):  # skip clear, it's fallback
        priority_rank = (n - i) / n  # 1.0 for highest, lower for each step down
        threshold = slider * priority_rank * 0.6  # scale threshold by priority
        if coverage.get(terrain, 0) >= threshold:
            return terrain
    return "clear"  # fallback
```

Reclassification: iterate all hexes, re-run classify_hex with new slider, skip hexes with manual overrides.

---

## Elevation Classification Algorithm

### Local Relief Calculation
```python
def calc_local_relief(hex, all_hexes):
    neighbours = get_neighbours(hex, all_hexes)  # immediate ring
    neighbour_elevations = [h.elevation_m for h in neighbours if h.elevation_m is not None]
    if not neighbour_elevations:
        return 0
    neighbour_avg = sum(neighbour_elevations) / len(neighbour_elevations)
    
    # Secondary: 3-hex radius average
    extended = get_neighbours_radius(hex, all_hexes, radius=3)
    extended_elevations = [h.elevation_m for h in extended if h.elevation_m is not None]
    extended_avg = sum(extended_elevations) / len(extended_elevations) if extended_elevations else neighbour_avg
    
    # Weighted blend: 70% immediate, 30% extended
    weighted_avg = 0.7 * neighbour_avg + 0.3 * extended_avg
    return max(0, hex.elevation_m - weighted_avg)
```

### Mode A Classification
```python
def classify_elevation_terrain_class(hex, local_relief, thresholds):
    # Local relief classification
    if local_relief >= thresholds["mountains_relief_m"]:
        local_class = "mountains"
    elif local_relief >= thresholds["hills_relief_m"]:
        local_class = "hills"
    else:
        local_class = "flat"
    
    # Absolute elevation classification
    elev = hex.elevation_m or 0
    if elev >= thresholds["mountains_absolute_m"]:
        abs_class = "mountains"
    elif elev >= thresholds["hills_absolute_m"]:
        abs_class = "hills"
    else:
        abs_class = "flat"
    
    # Take maximum
    rank = {"flat": 0, "hills": 1, "mountains": 2}
    return max(local_class, abs_class, key=lambda x: rank[x])
```

### Mode B Classification
```python
def classify_elevation_bands(hex, bands):
    elev = hex.elevation_m or 0
    for band in sorted(bands, key=lambda b: b["max_m"]):
        if elev <= band["max_m"]:
            return band["label"]
    return bands[-1]["label"]  # fallback to highest band
```

---

## Road Routing

### OSRM Integration
Use OSRM route service: `http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?geometries=geojson&overview=full`

Extract geometry (GeoJSON LineString), convert to sequence of projected coordinates.

### Road to Hex Edge Assignment
For each line segment in the route geometry:
1. Find which hex the segment centre falls in
2. Find entry point: which hex edge the segment crosses coming in
3. Find exit point: which hex edge the segment crosses going out
4. Store entry edge and exit edge in that hex's roads array
5. Determine road type from OSRM response (check OSM tags via route steps)

### Road Type Detection
Map OSRM step road classes to internal types:
- motorway, trunk → highway
- primary, secondary, tertiary → road
- unclassified, track, path → track

### Aggregation
Per hex, per road type:
- If multiple segments of same type: keep the one with the most distinct edge pair (longest crossing)
- If same type already stored: only update if new segment has more distinct edges

---

## OSM Data Fetching

### Overpass Query (terrain)
```
[out:json][timeout:60][bbox:{lat_min},{lon_min},{lat_max},{lon_max}];
(
  way["landuse"~"forest|farmland|residential|commercial|industrial|meadow|grass|wetland|military"];
  way["natural"~"wood|scrub|heath|wetland|water|coastline|mud|beach|sand"];
  relation["natural"="water"];
  relation["landuse"="forest"];
);
out geom;
```

### Tag to Terrain Mapping
| OSM tag | Internal terrain |
|---|---|
| natural=wood, landuse=forest | woods |
| natural=scrub, natural=heath | rough |
| natural=wetland, landuse=wetland | marsh |
| natural=water, landuse=reservoir | lake |
| natural=coastline (sea side) | sea |
| landuse=residential/commercial/industrial | urban |
| landuse=farmland/meadow/grass + everything else | clear |

### Overpass Query (rivers)
```
[out:json][timeout:60][bbox:{lat_min},{lon_min},{lat_max},{lon_max}];
(
  way["waterway"~"river|stream|canal|drain"]["width"];
  way["waterway"~"river|stream|canal|drain"];
);
out geom;
```

Width taken from OSM width tag where available. For rivers without width tag, estimate from waterway type:
- river: 30m default
- canal: 15m default
- stream: 3m default

---

## DEM Fetching

Copernicus GLO-30 tiles are available as GeoTIFF files. Each tile is 1x1 degree at 30m resolution.

Fetching steps:
1. Determine which 1-degree tiles intersect the bbox
2. Download tiles from Copernicus S3 bucket (free, no auth required)
   URL pattern: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_{lat}_{lon}_DEM.tif`
3. Cache tiles locally (tiles are large, avoid re-downloading)
4. For each hex: sample all DEM pixels within hex polygon, take median as elevation_m

---

## Frontend State

### Map State Object
The complete map state is:
```typescript
interface MapState {
  meta: MapMeta
  hexes: Hex[]
}
```

This is what gets saved to JSON, loaded from JSON, and sent to the backend for export.

### Undo Stack
```typescript
const undoStack: MapState[] = []
const redoStack: MapState[] = []
const MAX_STACK = 50

function pushSnapshot(state: MapState) {
  undoStack.push(deepClone(state))
  redoStack.length = 0  // clear redo on new action
  if (undoStack.length > MAX_STACK) undoStack.shift()
}

function undo(current: MapState): MapState {
  if (undoStack.length === 0) return current
  redoStack.push(deepClone(current))
  return undoStack.pop()
}

function redo(current: MapState): MapState {
  if (redoStack.length === 0) return current
  undoStack.push(deepClone(current))
  return redoStack.pop()
}
```

### Debounced Snapshot for Sliders
```typescript
const debouncedSnapshot = debounce((state) => pushSnapshot(state), 500)
// Call on slider mouseup/touchend, not on every change event
```

---

## Data Source Selection by Scale

Backend auto-selects data source based on hex_size_km:

| hex_size_km | Landcover source | Notes |
|---|---|---|
| < 5 | OSM via Overpass | Best detail |
| 5-20 | OSM + CORINE blend | OSM for water/urban, CORINE for landcover |
| > 20 | CORINE only | OSM too granular |

CORINE Land Cover classes mapped to internal terrain types:
| CORINE class | Internal terrain |
|---|---|
| 111, 112, 121-142 | urban |
| 211-244 | clear |
| 311-313 | woods |
| 321-324 | rough |
| 411-412 | marsh |
| 511-512 | lake |
| 521-523 | sea |

---

## PDF Export Pipeline

1. Frontend sends complete MapState JSON + style name to POST /export/pdf
2. Backend reconstructs hex grid geometry from meta
3. Renders SVG at target resolution:
   - Canvas size = paper_width_mm / 25.4 * dpi x paper_height_mm / 25.4 * dpi (pixels)
   - For A1 at 300dpi: 9933 x 7016 pixels
4. SVG rendered using same logic as frontend renderer but server-side (Python svgwrite or equivalent)
5. Convert SVG to PDF using CairoSVG or headless Chromium
6. Return PDF binary

---

## Suggested Project Structure

```
/
  frontend/
    src/
      components/
        Map/           # MapLibre viewport
        HexGrid/       # SVG renderer
        Panels/        # Layer panel components
        Editor/        # Hex editing tools
      store/           # Map state, undo stack
      utils/
        hexMath.ts     # Axial coordinate math
        geoProjection.ts
        themeSystem.ts
      themes/          # Style configurations
  backend/
    app/
      routers/
        generate.py    # /generate/* endpoints
        route.py       # /route/road
        reclassify.py
        export.py
      services/
        overpass.py    # OSM fetching
        dem.py         # DEM fetching and sampling
        hexGrid.py     # Grid construction
        terrain.py     # Coverage calculation and classification
        elevation.py   # Relief calculation
        rivers.py      # Waterway classification
        railways.py    # Railway assignment
        routing.py     # OSRM integration
        renderer.py    # Server-side SVG rendering
      models/
        hex.py
        map.py
```
