# Hex Map Generator — Rendering Reference

## Overview

The renderer is SVG-based. The same rendering logic is used in both the browser (interactive preview) and server-side (PDF export). Styles are configuration — switching styles does not require code changes, only a different theme object.

The renderer is built in layers, applied in order:
1. Background
2. Hex terrain fills
3. Terrain edge blending
4. Elevation overlay
5. River edge strokes
6. Road strokes
7. Railway strokes
8. Settlement icons
9. Labels
10. Hex grid lines
11. Decorative overlays (paper grain, vignette etc.)

---

## Theme System

Each style is a theme object. The renderer consumes the theme and produces SVG. Creating a new style = creating a new theme object.

### Theme Structure

```typescript
interface Theme {
  name: string

  background: {
    color: string
    texture?: string        // reference to SVG pattern or filter id
    opacity?: number
  }

  grid: {
    stroke: string
    stroke_width: number
    opacity: number
    dash?: string           // e.g. "4,2" for dashed grid
  }

  terrain: {
    [terrainType: string]: TerrainStyle
  }

  elevation: {
    hills: ElevationOverlay
    mountains: ElevationOverlay
  }

  rivers: {
    edge: StrokeStyle
    wide_border: StrokeStyle  // border between river terrain and land
  }

  roads: {
    highway: StrokeStyle
    road: StrokeStyle
    track: StrokeStyle
  }

  railways: {
    railway: StrokeStyle
    abandoned: StrokeStyle
  }

  settlements: {
    city: SettlementStyle
    town: SettlementStyle
    village: SettlementStyle
    font_family: string
    label_color: string
    label_size: number      // relative to hex size
  }

  blending: {
    default: "none" | "level_1" | "level_2" | "level_3"
    overrides?: {
      [scaleRange: string]: "none" | "level_1" | "level_2" | "level_3"
    }
    bleed_amount: number    // fraction of hex width, e.g. 0.10
    terrain_pairs: TerrainPairRule[]
  }

  filters?: SVGFilter[]     // global SVG filters (paper grain, etc.)
}

interface TerrainStyle {
  fill: "solid" | "pattern" | "gradient"
  color: string             // base color, always required
  pattern_id?: string       // reference to SVG <pattern> definition
  gradient_id?: string      // reference to SVG <radialGradient> definition
}

interface ElevationOverlay {
  type: "hachure" | "shading" | "contour" | "none"
  pattern_id?: string
  color?: string
  opacity: number
}

interface StrokeStyle {
  stroke: string
  stroke_width: number      // relative to hex size
  style: "single" | "double" | "dashed" | "wavy"
  opacity?: number
}

interface SettlementStyle {
  icon: "dot" | "square" | "tower" | "cross" | string  // string = custom SVG symbol id
  color: string
  size: number              // relative to hex size
}

interface TerrainPairRule {
  from: string              // dominant terrain type (bleeds into subordinate)
  to: string                // subordinate terrain type
  enabled: boolean
}
```

---

## Three Built-in Styles

### Style 1 — Classic Wargame

Functional and readable. Flat colors, high contrast, minimal decoration. Optimized for play rather than aesthetics.

```typescript
const classicWargame: Theme = {
  name: "classic_wargame",
  background: { color: "#e8e8d8" },
  grid: { stroke: "#aabbcc", stroke_width: 0.6, opacity: 0.8 },
  terrain: {
    clear:  { fill: "solid", color: "#d4c87a" },
    woods:  { fill: "pattern", color: "#4a7a3a", pattern_id: "dot_woods" },
    rough:  { fill: "pattern", color: "#b09060", pattern_id: "hatch_rough" },
    marsh:  { fill: "pattern", color: "#6a8f5a", pattern_id: "tick_marsh" },
    river:  { fill: "solid", color: "#4a90c8" },
    lake:   { fill: "solid", color: "#5aaad8" },
    sea:    { fill: "solid", color: "#2a5f8f" },
    urban:  { fill: "solid", color: "#cc8844" },
  },
  elevation: {
    hills:     { type: "hachure", pattern_id: "hachure_light", opacity: 0.3 },
    mountains: { type: "hachure", pattern_id: "hachure_dense", opacity: 0.5 },
  },
  rivers: {
    edge:        { stroke: "#4a90c8", stroke_width: 1.5, style: "single" },
    wide_border: { stroke: "#2a6090", stroke_width: 0.5, style: "single" },
  },
  roads: {
    highway: { stroke: "#cc3333", stroke_width: 1.2, style: "double" },
    road:    { stroke: "#996633", stroke_width: 0.8, style: "single" },
    track:   { stroke: "#996633", stroke_width: 0.6, style: "dashed" },
  },
  railways: {
    railway:  { stroke: "#333333", stroke_width: 1.0, style: "double" },
    abandoned: { stroke: "#999999", stroke_width: 0.6, style: "dashed" },
  },
  settlements: {
    city:    { icon: "dot", color: "#cc3333", size: 0.15 },
    town:    { icon: "dot", color: "#333333", size: 0.10 },
    village: { icon: "dot", color: "#333333", size: 0.07 },
    font_family: "Arial, sans-serif",
    label_color: "#111111",
    label_size: 0.12,
  },
  blending: {
    default: "level_1",
    overrides: { "20km+": "none" },
    bleed_amount: 0.05,
    terrain_pairs: [
      { from: "sea", to: "clear", enabled: true },
      { from: "sea", to: "marsh", enabled: true },
      { from: "woods", to: "clear", enabled: true },
      { from: "woods", to: "rough", enabled: true },
      { from: "marsh", to: "clear", enabled: true },
      { from: "urban", to: "clear", enabled: false },
    ]
  }
}
```

### Style 2 — Historical Cartographic

Looks like an 1800s military survey map. Aged paper, hand-drawn symbols, hachure elevation, period typography.

Key differences from Classic:
- Background: aged paper texture (#e8d5b0) + paper grain SVG filter
- Woods: hand-drawn tree symbol pattern (not dots)
- Marsh: hand-drawn tick marks
- Elevation: traditional hachure lines (thicker and more visible than Classic)
- Rivers: wavy stroke using SVG feTurbulence displacement
- Roads: double-line period style with lighter center
- Grid: thin, desaturated, low opacity
- Fonts: IM Fell English (serif, period-appropriate)
- Blending: level_2 default, level_3 for coastlines
- Global filters: paper grain, aged yellowing overlay

```typescript
// Key overrides from classic:
{
  name: "historical_cartographic",
  background: { color: "#e8d5b0", texture: "aged_paper", opacity: 1.0 },
  grid: { stroke: "#8a7a5a", stroke_width: 0.4, opacity: 0.45 },
  terrain: {
    woods: { fill: "pattern", color: "#c8bfa0", pattern_id: "hand_trees" },
    marsh: { fill: "pattern", color: "#b8c8a0", pattern_id: "hand_marsh" },
    // ... others similar to classic with more muted colors
  },
  rivers: {
    edge: { stroke: "#5a8ab0", stroke_width: 1.5, style: "wavy" },
  },
  settlements: {
    city:    { icon: "square", color: "#2a1a0a", size: 0.14 },
    font_family: "'IM Fell English', serif",
    label_color: "#2a1a0a",
  },
  blending: {
    default: "level_2",
    bleed_amount: 0.10,
    // coastlines get level_3
  },
  filters: ["paper_grain", "aged_yellowing"]
}
```

### Style 3 — Modern Board Game

Rich illustrated style. Radial gradients, strong terrain blending, decorative hex borders, stylized icons.

Key differences from Classic:
- Background: dark (#0d1a0d or similar dark tone per theme)
- Terrain fills: radial gradients not flat colors
- Hex borders: double-line with color-coded inner glow per terrain type
- Blending: level_2 to level_3, larger bleed amount (15-20%)
- Rivers: thick stroke with lighter highlight stroke on top
- Settlements: circular icon with nested rings
- Fonts: clean modern sans-serif (DM Sans or similar)

```typescript
{
  name: "modern_board_game",
  background: { color: "#0d1a0d" },
  grid: { stroke: "#000000", stroke_width: 1.5, opacity: 1.0 },
  terrain: {
    woods: { fill: "gradient", color: "#4a8a38", gradient_id: "grad_woods" },
    clear: { fill: "gradient", color: "#c8a840", gradient_id: "grad_clear" },
    // ... all terrain use radial gradients
  },
  blending: {
    default: "level_2",
    overrides: { "100m-2km": "level_3" },
    bleed_amount: 0.18,
  }
}
```

---

## Terrain Blending

### Level 1 — Edge Gradient
Simple linear gradient along the shared edge between two terrain hexes. Color transitions from terrain A to terrain B over a short distance.

Implementation: for each pair of adjacent hexes with different terrain, add a thin gradient rect along the shared edge, clipped to the subordinate hex.

Use for: Classic Wargame, large scale maps, fast rendering.

### Level 2 — Texture Bleed with Feathered Mask
The dominant terrain's fill pattern extends slightly beyond its hex boundary into the adjacent hex. The bleed fades using a Gaussian blur mask.

Implementation:
```svg
<!-- Dominant hex fill (e.g. woods) -->
<polygon ... fill="url(#woods-pattern)" clip-path="url(#hex-clip-N)"/>

<!-- Bleed layer into adjacent hex -->
<polygon ... fill="url(#woods-pattern)" 
  opacity="0.4"
  filter="url(#feather-mask)"
  clip-path="url(#adjacent-hex-clip-M)"/>
```

Where feather-mask is:
```svg
<filter id="feather-mask">
  <feGaussianBlur stdDeviation="4"/>
</filter>
```

Use for: Historical Cartographic default, Modern Board Game, medium scale maps.

### Level 3 — Irregular Edge
Same as Level 2 but the bleed uses an SVG turbulence displacement to create an irregular organic edge instead of a uniform fade.

Implementation:
```svg
<filter id="irregular-edge-filter">
  <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" seed="7"/>
  <feDisplacementMap in="SourceGraphic" scale="12" xChannelSelector="R" yChannelSelector="G"/>
</filter>

<!-- Apply to bleed layer -->
<polygon ... fill="url(#woods-pattern)"
  opacity="0.4"
  filter="url(#irregular-edge-filter)"
  clip-path="url(#adjacent-hex-clip-M)"/>
```

Use for: Coastlines in all styles, Modern Board Game at small scales, Historical Cartographic coastlines.

### Blending Scale Defaults
| Scale | Classic | Historical | Modern |
|---|---|---|---|
| 100m-500m | level_1 | level_3 | level_3 |
| 1-2km | level_1 | level_2 | level_2 |
| 5-10km | level_1 | level_2 | level_2 |
| 20-50km | none | level_1 | level_1 |
| 100km | none | none | none |

Coastlines (sea/land boundary) always use level_3 regardless of scale or style — hard coastline edges look particularly bad.

### Terrain Pair Priority for Blending
When two terrain types are adjacent, the higher-priority type bleeds into the lower-priority one. Same priority order as classification:
sea > lake > marsh > urban > woods > rough > clear

Urban never bleeds into anything (cities have defined edges). Sea always bleeds into adjacent land.

---

## SVG Patterns

Patterns defined once in SVG `<defs>`, referenced by id in theme. Each pattern tiles seamlessly.

### dot_woods (Classic Wargame)
```svg
<pattern id="dot_woods" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
  <rect width="8" height="8" fill="#4a7a3a"/>
  <circle cx="2" cy="2" r="1.2" fill="#2d5a1f"/>
  <circle cx="6" cy="5" r="1.2" fill="#2d5a1f"/>
</pattern>
```

### tick_marsh (Classic Wargame)
```svg
<pattern id="tick_marsh" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
  <rect width="10" height="10" fill="#6a8f5a"/>
  <line x1="0" y1="3" x2="4" y2="3" stroke="#3a5f2a" stroke-width="0.8"/>
  <line x1="2" y1="1" x2="2" y2="5" stroke="#3a5f2a" stroke-width="0.5"/>
  <line x1="5" y1="7" x2="9" y2="7" stroke="#3a5f2a" stroke-width="0.8"/>
  <line x1="7" y1="5" x2="7" y2="9" stroke="#3a5f2a" stroke-width="0.5"/>
</pattern>
```

### hand_trees (Historical Cartographic)
```svg
<pattern id="hand_trees" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
  <rect width="14" height="14" fill="#c8bfa0"/>
  <!-- Stylized hand-drawn tree -->
  <path d="M3,10 L3,6 M3,6 L1,8 M3,6 L5,8 M3,4 L2,6 M3,4 L4,6"
        stroke="#4a6a35" stroke-width="0.7" fill="none" stroke-linecap="round"/>
  <path d="M10,11 L10,7 M10,7 L8,9 M10,7 L12,9 M10,5 L9,7 M10,5 L11,7"
        stroke="#4a6a35" stroke-width="0.7" fill="none" stroke-linecap="round"/>
</pattern>
```

### hachure_light / hachure_dense (elevation overlays)
```svg
<pattern id="hachure_light" x="0" y="0" width="8" height="6" patternUnits="userSpaceOnUse">
  <line x1="0" y1="3" x2="8" y2="0" stroke="#8a7a5a" stroke-width="0.5" opacity="0.6"/>
</pattern>

<pattern id="hachure_dense" x="0" y="0" width="6" height="5" patternUnits="userSpaceOnUse">
  <line x1="0" y1="2.5" x2="6" y2="0" stroke="#8a7a5a" stroke-width="0.7" opacity="0.8"/>
  <line x1="0" y1="5" x2="6" y2="2.5" stroke="#8a7a5a" stroke-width="0.5" opacity="0.5"/>
</pattern>
```

---

## River Rendering

Rivers are strokes, not fills. Drawn after terrain fills but before hex grid lines.

### Edge river stroke
Drawn along the hex edge. For each river_edge index, calculate the midpoint of that edge and draw a stroke along it extending slightly into both adjacent hexes.

For wavy style (Historical Cartographic), apply feTurbulence displacement to the path:
```svg
<filter id="wavy">
  <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="5"/>
  <feDisplacementMap in="SourceGraphic" scale="3"/>
</filter>
```

### Multi-hex river continuity
When a river edge connects two hexes that both have the same river edge in their river_edges arrays, draw the stroke as a continuous path through both hexes rather than two separate segments. This requires a path-building pass before rendering.

---

## Road and Railway Rendering

Roads and railways are strokes drawn through hexes. Each hex stores entry and exit edge indices.

### Path building
For each road connection (series of hexes), build a continuous SVG path:
1. Start at entry edge midpoint of first hex
2. Draw to hex centre
3. Draw to exit edge midpoint
4. Continue to entry edge midpoint of next hex
5. Smooth the path using cubic bezier curves through each hex centre

### Road stroke styles
- **single**: one stroke at road width
- **double**: two parallel strokes with gap, gives casing effect
- **dashed**: single stroke with dash pattern
- **wavy**: feTurbulence displacement (not used for roads, only rivers)

Railway double stroke with tick marks (standard railway symbol):
```svg
<!-- Main double line -->
<path d="..." stroke="#333" stroke-width="1.5" fill="none"/>
<path d="..." stroke="#fff" stroke-width="0.7" fill="none"/>
<!-- Tick marks perpendicular to path at intervals -->
```

---

## Settlement Rendering

Settlements are rendered after roads/railways but before labels.

### Icon types
- **dot**: simple filled circle
- **square**: filled rectangle (used for towns in Historical style — represents town walls/buildings)
- **tower**: stylized tower shape for historical fortifications
- **cross**: simple cross mark

Icon size is relative to hex_size_mm. At 20mm hex, city icon might be 3mm diameter.

### Label placement
Labels placed below settlement icon by default. Auto-collision detection: if two labels would overlap, offset one. Labels always rendered after icons so they appear on top.

---

## Rendering Pipeline (Code Structure)

```typescript
function renderMap(state: MapState, theme: Theme, svgElement: SVGElement) {
  const ctx = buildRenderContext(state, theme)
  
  renderBackground(ctx)
  renderTerrainFills(ctx)          // solid/pattern/gradient fills per hex
  renderElevationOverlays(ctx)     // hachure or shading overlays
  renderTerrainBlending(ctx)       // edge bleeding between terrain types
  renderRiverStrokes(ctx)          // river edge strokes
  renderRoadStrokes(ctx)           // road paths through hexes
  renderRailwayStrokes(ctx)        // railway paths through hexes
  renderSettlementIcons(ctx)       // icons at settlement hexes
  renderSettlementLabels(ctx)      // text labels with collision avoidance
  renderHexGrid(ctx)               // hex border lines
  renderDecorations(ctx)           // paper grain, vignette, etc.
}
```

Each render function takes the full context and appends SVG elements to the SVG document. Functions are independent and can be skipped or reordered for debugging.

---

## Performance Notes

SVG is used for both browser preview and server-side export. Performance considerations:

**Browser:**
- For maps under ~2000 hexes: SVG renders fine in browser
- Above ~2000 hexes: consider Canvas 2D for preview, keep SVG for export only
- Pattern elements in SVG defs are reused across all hexes — define once
- Blending filters (feTurbulence) are expensive — apply only to boundary hexes, not all

**Server-side export:**
- Full resolution A1 at 300dpi: ~70 megapixel equivalent
- SVG is vector so resolution is free — same SVG file renders at any size
- Use CairoSVG for SVG-to-PDF conversion (faster than headless Chromium for pure SVG)
- If SVG has many filter effects, headless Chromium may produce better results

**SVG file size:**
- Each hex = ~3-5 SVG elements
- 2000 hexes = ~8000-10000 elements — manageable
- 10000 hexes = ~40000-50000 elements — SVG file gets large, consider chunking or Canvas fallback
