# Hex Map Generator — Product Specification

## User Flow Overview

1. Landing screen — New Map or Load Map
2. Physical setup — paper format, hex size, orientation, edge treatment
3. Map positioning — drag viewport over slippy map, zoom to set scale, rotate
4. Generate — creates hex grid, triggers initial terrain fetch
5. Layer panels — configure each data layer independently, any order
6. Export — JSON and/or PDF

---

## Landing Screen

Two options:
- **New Map** — starts physical setup flow
- **Load Map** — upload previously saved JSON, restores full map state and re-renders

---

## Physical Setup

These settings define the hex grid geometry and are **locked after generation**. Everything else is adjustable post-generation.

### Paper Format
- Presets: A3, A2, A1
- Custom: width x height in mm
- Orientation: portrait or landscape

### Hex Size (physical)
- Size of one hex on the printed map, in mm
- Presets: 10mm, 15mm, 20mm, 25mm, 30mm + custom input
- App immediately shows derived info: hexes horizontal x vertical, total hex count

### Hex Orientation
- Pointy-top or flat-top
- Small visual preview showing which is which

### Edge Hex Treatment
- **Clipped** — hexes at canvas edge are cut by the page boundary. Fills page exactly.
- **Full only** — only fully contained hexes shown, slight margin around the hex grid. Cleaner for play.
- Default: Full only

---

## Map Positioning

Right panel shows a slippy map (MapLibre) with a viewport overlay representing the paper format. The hex grid is faintly visible inside the viewport.

### Controls
- **Drag** viewport to position over terrain
- **Zoom** slippy map to set real-world scale (hex count stays fixed, km-per-hex changes)
- **Rotate** viewport — free drag on a corner handle + degree input field for precision
- The hex grid is fixed to the canvas. Rotation is canvas-relative, not geo-north-relative.

### Live Readout (updates as user drags/zooms/rotates)
```
1 hex = 4.3 km
Map covers 187 x 241 km
Total hexes: 1,248
Est. generation time: ~45s
```

Show warning if total hexes exceeds ~50,000.

### North
True north offset is stored in meta (derived from rotation_degrees). Used later for north arrow rendering. Hex edges do NOT use cardinal direction names — they use neutral numbering 0-5.

### Generate Button
Prominent. On click: locks grid geometry settings, fetches initial terrain data, shows hex grid.

---

## Post-Generation UI

Left sidebar: six layer panel tabs (Terrain, Elevation, Rivers, Settlements, Roads, Railways).
Main area: rendered hex grid, interactive.
Top bar: undo/redo, save, export, style selector.

User can switch between panels in any order. Panels are independent. Settings within a panel that require a re-fetch are clearly marked with a warning icon. All other settings update instantly.

---

## Panel 1 — Terrain

### What it does
Fetches OSM landcover polygons for the bbox, intersects with hex grid, calculates raw coverage percentages per terrain type per hex, then classifies each hex using the slider + priority rules.

### Controls

**Terrain forcing slider (0.0 to 1.0)**
Controls how dominant a terrain type must be to claim a hex.

Logic:
- Terrain types evaluated in priority order (high to low)
- Slider sets minimum coverage fraction needed for each type to win
- At 0.0: very low threshold — minority terrain types can win
- At 1.0: high threshold — only clearly dominant terrain wins, everything else falls back to Clear
- First type in priority order that meets its threshold wins
- Clear is always the fallback if nothing else wins

Example — hex coverage: woods 0.45, marsh 0.20, clear 0.35
- Slider 0.0: marsh wins (any coverage sufficient, highest priority)
- Slider 0.5: threshold ~30%; marsh fails (20%), woods wins (45%)
- Slider 1.0: threshold ~60%; woods fails (45%), result is Clear (fallback)

Priority order (high to low):
1. Sea
2. Lake
3. Marsh
4. Urban
5. Woods
6. Rough
7. Clear (fallback)

Reclassification is instant — raw coverage data always stored, no re-fetch needed.

**Per-terrain visibility toggles**
Show/hide individual terrain types on the map for easier editing. Does not affect data.

**Hex paint tools**
- Click a hex to open terrain picker, select terrain type, applies override
- Drag across hexes to bulk paint
- Overridden hexes marked visually (small indicator)

**Hex info panel**
Click any hex to see:
- Current terrain classification
- Raw coverage percentages for all terrain types
- Whether the hex has a manual override

**Reset hex**
Click to revert a manually overridden hex back to slider-based auto-classification.

---

## Panel 2 — Elevation

### What it does
Fetches Copernicus GLO-30 DEM tiles for the bbox. Calculates elevation_m (average elevation within hex) and local relief (difference between hex and neighbours). Two classification modes available.

### Elevation Mode Toggle
Switch between modes at any time. No re-fetch required — both use same underlying elevation_m data.

---

**Mode A — Terrain Class**

Classifies each hex as flat, hills, or mountains. Best for operational and strategic scales.

Uses the maximum result of two independent calculations:

*Local relief classification*
- Calculate average elevation of immediate neighbours
- local_relief = hex elevation_m minus neighbours average
- Secondary: cumulative slope over 3-hex radius (catches long gentle slopes)
- Compare against hills_relief_m and mountains_relief_m thresholds

*Absolute elevation classification*
- Compare hex elevation_m directly against hills_absolute_m and mountains_absolute_m thresholds
- Catches plateaus and mountain range interiors where neighbours are equally high

*Final result*
```
final_class = max(local_class, absolute_class)
```
Where mountains > hills > flat. A hex classified as hills by one method and flat by the other becomes hills.

Controls (all instant, no re-fetch):
- Hills — local relief threshold (meters)
- Mountains — local relief threshold (meters)
- Hills — absolute elevation threshold (meters)
- Mountains — absolute elevation threshold (meters)
- Relief heatmap toggle — visualizes local relief as color gradient across all hexes, useful for tuning
- Elevation heatmap toggle — visualizes raw absolute elevation as color gradient

Default thresholds by scale:

| Scale | Hills relief | Mountains relief | Hills absolute | Mountains absolute |
|---|---|---|---|---|
| 100m-500m | 20m | 80m | 200m | 600m |
| 1-2km | 50m | 200m | 400m | 1000m |
| 5-10km | 80m | 300m | 600m | 1500m |
| 20-50km | 150m | 600m | 800m | 2000m |
| 100km | 300m | 1200m | 1000m | 2500m |

---

**Mode B — Elevation Bands**

Classifies each hex by absolute elevation into N user-defined bands. Best for tactical scales where exact height matters. Each band gets a label and color used in rendering.

Controls:
- Number of bands (3-8)
- Breakpoints in meters (user defines each boundary)
- Label per band (e.g. "Lowland", "Hills", "High Mountains")
- Color per band

Example default bands:
```
0-100m      Lowland
100-300m    Low hills
300-600m    Hills
600-1000m   High hills
1000-1500m  Mountains
1500m+      High mountains
```

---

**Shared elevation controls (both modes)**
- Individual hex override — click hex, manually set class or band
- Bulk paint — drag to set elevation class across multiple hexes
- Reset hex — revert to auto-classification

---

## Panel 3 — Rivers

### What it does
Fetches OSM waterway data for the bbox. Classifies rivers as either edge features (water crossing a hex boundary) or terrain (wide rivers that fill a hex). Uses two width thresholds.

### Controls

**Minimum river width (meters)**
Rivers narrower than this are ignored entirely. Default is scale-appropriate. Filters already-fetched data — instant, no re-fetch.

**Wide river threshold (meters)**
Rivers wider than this become River terrain type (fills the hex) rather than an edge feature. Instant, no re-fetch.

**Toggle individual river edge**
Click a hex edge on the map to add or remove a river crossing on that edge.

**Wide river hex paint**
Click a hex to manually mark it as River terrain type.

**River width info**
Click an existing river edge to see the OSM source width data.

**Reset**
Revert all manual changes back to auto-generated river placement.

### Notes
- The boundary between a River terrain hex and adjacent land hexes is implicitly a river bank. Do not add a separate river edge there.
- River edges by scale:

| Scale | What gets river edges |
|---|---|
| 100m-500m | Streams and small rivers |
| 1-2km | Small and medium rivers |
| 5-10km | Medium rivers |
| 20-50km | Major rivers only |
| 100km | Negligible |

---

## Panel 4 — Settlements

### What it does
Fetches OSM settlements within the bbox filtered by population threshold and type. User then curates which settlements to include on the map.

### Controls

**Minimum population threshold**
Only settlements with OSM population data >= this value are fetched. Settlements with no population data are always excluded.
Re-fetch required if changed.

**Settlement type checkboxes**
City / Town / Village — toggle which types to fetch.
Re-fetch required if changed.

Default population thresholds by scale:

| Scale | Default min population |
|---|---|
| 100m-500m | 500 |
| 1-2km | 1,000 |
| 5-10km | 5,000 |
| 20-50km | 50,000 |
| 100km | 500,000 |

**Include/exclude toggle**
After fetch, all qualifying settlements shown on map. Click to include or exclude. Excluded settlements shown greyed out so user can reconsider. Only included settlements appear in the final hex data.

**Search**
Type settlement name to find and jump to it on the map.

**Manual placement**
Click any hex on the map, enter name, select type. Creates a settlement not from OSM data.

**Edit settlement**
Click an included settlement to change its name or type.

**Remove settlement**
Delete an included or manually placed settlement.

**Settlement info panel**
Click a settlement to see: OSM name, type, population.

### Conflict resolution
If two settlements fall within the same hex, the one with the larger population is kept automatically. No user prompt.

---

## Panel 5 — Roads

### What it does
Roads are never auto-imported from the bbox. They are always derived from user-defined connections between settlements, routed via OSRM using the real OSM road network.

### Manual connection
Click one settlement, then click another. OSRM routes the real road between them. Road type (highway/road/track) is auto-detected from the OSM data used for routing. Road appears on all hexes along the route.

### Auto-connect options
Three modes:
- **N nearest** — connect each settlement to its N nearest neighbours (user sets N)
- **Within distance** — connect all settlements within X km of each other (user sets X)
- **Minimum spanning tree** — connect all settlements with minimum total road length, no redundant connections

Auto-connect generates connections which the user can then review and remove.

### Intermediate settlement insertion
For any connection longer than a user-defined maximum gap (km), auto-insert intermediate settlements along the route at approximately that spacing. Intermediates are pulled from OSM — the most significant settlement (by population) within a corridor of the route at each interval. User sets:
- Maximum gap distance (km)
- Minimum population for intermediate settlements (separate from main threshold)

### Editing
- **Remove connection** — click a road on the map to delete the whole connection
- **Manual road paint** — click hex edges to manually draw a road segment, select road type
- **Road type override** — click an existing road segment to change its type
- **Remove from hex** — remove road from a specific hex without deleting the whole connection

### Aggregation
Multiple roads of the same type through the same hex are collapsed to one entry (dominant direction wins). Different road types coexist (e.g. a highway and a track crossing the same hex are stored separately). A hex can have roads on all 6 edges. Loops that enter and exit the same edge are ignored.

### Edge cases
If no road exists in OSM between two settlements, OSRM routes via the closest available road. This is flagged visually to the user.

---

## Panel 6 — Railways

### What it does
Railways are auto-imported from the bbox (unlike roads). User then curates and edits.

### Controls

**Include abandoned lines**
Toggle on/off. Off by default. Re-fetch required if changed.

**Minimum line length (km)**
Ignore railway segments shorter than this (filters out industrial spurs, depot tracks). Instant filter on already-fetched data, no re-fetch.

**Toggle individual segment**
Click a railway segment on the map to remove it.

**Railway type override**
Click a segment to toggle between standard and abandoned.

**Manual railway paint**
Click hex edges to draw a railway manually. Select type.

**Remove all**
Clear all auto-generated railways. Manually painted railways are preserved.

**Re-fetch**
Re-import railway data with current settings.

### Types
- railway — all standard non-abandoned lines (no distinction between mainline/regional)
- abandoned — former railway lines

### Aggregation
Same rules as roads — collapsed by type per hex, different types can coexist.

### Scale-aware import
| Scale | Import |
|---|---|
| 100m-500m | All lines in bbox |
| 1-2km | All main lines |
| 5-10km | All main lines |
| 20-50km | Inter-city lines only |
| 100km | Negligible |

---

## Save / Load

**Save**
Downloads the complete map JSON to the user's machine. Contains all hex data plus all meta settings. No backend required.

**Load**
Upload a previously saved JSON. App restores full map state and re-renders. No backend required.

JSON is the single source of truth for everything.

---

## Undo / Redo

Snapshot-based. Full JSON state stored in memory stack.

Stack cap: 50 states. Resets on page reload.

Actions that push a snapshot:
- Any terrain paint (hex or bulk)
- Elevation class override
- River edge toggle or wide river paint
- Settlement add, remove, edit, include/exclude
- Road connection add or remove
- Manual road or railway paint
- Slider or threshold change (debounced — snapshot on release, not while dragging)

Actions that do NOT push a snapshot:
- Style change (visual only, no data change)
- Zoom or pan
- Hover states
- Heatmap toggle

---

## Export

**JSON export**
Full map data download. Reloadable. Can be edited externally.

**PDF export**
Print-ready PDF at 300dpi. Paper size matches setup (A1/A2/A3/custom). Rendered server-side: frontend sends final JSON to backend, backend renders SVG at full resolution and converts to PDF. User downloads the PDF.

---

## Terrain Types Reference

| Type | Source | Description |
|---|---|---|
| clear | OSM landuse | Farmland, grassland, open land |
| woods | OSM natural/landuse | Forest, dense trees |
| rough | OSM natural | Scrub, heath, rocky open ground |
| marsh | OSM natural/landuse | Wetland, bog |
| river | OSM waterway | Wide rivers (terrain-filling, small scales only) |
| lake | OSM natural/waterway | Lakes, large water bodies |
| sea | OSM natural/coastline | Ocean, sea |
| urban | OSM landuse/place | Towns, cities |

## Elevation Classes Reference

| Class | Description | Used in |
|---|---|---|
| flat | No significant relief | Mode A |
| hills | Moderate local relief or moderate absolute altitude | Mode A |
| mountains | High local relief or high absolute altitude | Mode A |
| [band label] | User-defined label e.g. "Lowland" | Mode B |

Sea and Lake hexes always have elevation_class: null.

## Road Types Reference

| Type | OSM equivalent |
|---|---|
| highway | motorway, trunk, primary |
| road | secondary, tertiary |
| track | unpaved, track |

## Railway Types Reference

| Type | Description |
|---|---|
| railway | All standard lines |
| abandoned | Former lines |
