# IG2 — Design Review Brief

## What is IG2?

A **print-ready hex map generator** for board-game wargaming cartography. Users position a viewport over a real-world slippy map, choose paper format and hex size, then generate and hand-edit a hex grid with terrain, elevation, settlements, roads, rails, rivers, and highlights — all sourced from OpenStreetMap. Output is a styled SVG/canvas render exported as PDF.

**Target user:** Wargame cartographer / tabletop game designer, desktop-only (minimum ~1200px), likely technical but not necessarily a developer.

---

## Application Flow

```
Setup Landing  →  Area Select (OSM map)  →  Terrain Generation  →  Main Editor
   (paper config)    (browse + confirm)        (streaming SSE)       (everything else)
```

After generation the user never returns to Setup — it is locked.

---

## Screen: Setup Landing

**Purpose:** Configure the physical output before any data is fetched.

**Layout:** Three columns in a modal-style card:
- **Left** — live paper preview (sheet + hex grid + margin visualisation, updates in real time)
- **Middle (210px)** — settings
- **Right (280px)** — start mode cards + CTA button

**Controls:**
| Group | Controls |
|---|---|
| Paper size | Pill buttons: A4 / A3 / A2 / A1 |
| Orientation | Icon toggle: portrait / landscape |
| Map mode | Single sheet vs. Diptych (2-sheet) |
| Seam direction (diptych) | Side-by-side or stacked |
| Hex size | Slider 5–50 mm |
| Hex orientation | Flat-top / Pointy-top |
| Advanced (collapsed) | Print margin 0–25 mm; Edge hex mode (Full / Partial) |
| Start mode | Cards: OSM Data / Blank / Reference image |

**Computed info shown:** Hex count, hex size in km, grid dimensions (based on current zoom).

**Issues / observations:**
- Three columns feel cramped on smaller desktops.
- Advanced section collapses but there is no visual affordance that it exists until discovered.
- "Start mode" cards compete for prominence with the paper settings — unclear hierarchy.

---

## Screen: Area Select

**Purpose:** Pan/zoom an OSM slippy map to choose the region to capture.

**Layout:**
- **Left sidebar (252px)** — AreaSelectPanel
- **Main area** — MapView (MapLibre-GL canvas)

**Canvas overlays:**
- Orange border + darkened surround = paper frame
- Green hex grid preview inside frame
- Orange dashed margin guide
- Diptych seam line (if diptych mode)

**Sidebar controls:**
- ← Back
- Hex count, dimensions, scale, bearing, zoom, location hint (read-only info)
- Generate button (disabled during generation)
- Progress messages + elapsed time per step + overall % bar

**Issues / observations:**
- The info panel and generate button are far apart visually.
- No indication of what "bearing" means for a new user.
- Progress bar appears inline in the sidebar — can feel cramped.

---

## Screen: Main Editor

This is the primary screen. It consists of:

```
┌─────────────────────────────────────────────────────┐
│  TopBar  (44px)                                     │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │                                          │
│ (200px)  │   TerrainViewCanvas (flex: 1)            │
│          │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

Optional: 3px progress bar between TopBar and content during generation.

---

### TopBar

**Height:** 44px. Fixed at top.

| Section | Controls |
|---|---|
| Navigation | ← Setup |
| Tab bar (8 tabs) | Terrain · Roads · Rivers · Settlements · Overlays · Areas · Elevation · Display |
| Map style | Standard · Historical · Basic (3 toggle buttons) |
| File ops | Load · Save · Export PDF |
| Presets | Styles button → PresetsPanel overlay |

**Active tab:** bottom border highlight.

**Issues / observations:**
- 8 tabs + style toggle + file ops all in one 44px bar is dense — especially on 1280px screens.
- "Overlays" tab label is generic; it covers Highlights + Icons + Labels.
- Map style selector is sandwiched between tabs and file ops with no clear grouping.
- The "← Setup" return path is destructive (locks setup) but looks like a normal nav button.

---

### Left Sidebar (200px)

Content changes based on active tab. All sidebars share:
- Scrollable flex column
- Sections separated by 1px dividers
- 10px padding per section
- `SectionLabel` (uppercase, dim, 10px, spaced) headings
- Controls: sliders, ToolButtons, checkboxes, color pickers

---

#### Tab: Terrain

**Tool buttons (keyboard shortcuts 1–9):**
- Terrain brushes (dynamic — OSM-sourced + manual + custom)
- Elevation brushes: Flat · Hills · Mountains

**Each tool button:**
- Color swatch | label | settings cog (hover) | shortcut badge (right edge)
- Active = green highlighted background + border

**Other controls:**
- Edge painting checkbox (enables edge-blob tool) + hint text
- Realistic coastline toggle
- Default blob shape button
- Render Style: terrain layers checkbox

**Flyout (TerrainSettingsFlyout):**
- Blob shape: smooth / offset / bump (radio pills)
- Sweep freq, lobe freq, amplitude, threshold, direction — sliders
- Anchored at left: 204px, z-index 100

**Custom terrains section (if any):**
- Color swatch (editable) · name (editable text input) · delete button

**Issues / observations:**
- Terrain list can grow very long (OSM sources many terrain types) — no search/filter.
- Edge painting checkbox is buried below the terrain list; users miss it.
- "Default blob shape" and per-terrain blob settings duplicate controls — confusing which is global vs. per-terrain.

---

#### Tab: Roads

**Sections:**

1. **Fetch** (OSM mode only): button + status dot + progress; motorway fast-mode toggle; OSM tier highlight selector; Apply button
2. **Paint**: Tier buttons (Motorway / Primary / Secondary) with color swatches; each has settings cog; Eraser (E key); shortcut badges 1/2/3
3. **Rail**: Fetch + Paint + node-edit toggle
4. **Segment properties** (contextual — shown when road segment selected): wiggle amp/freq sliders; reset
5. **Hop properties** (contextual — shown when a hop is selected): same, yellow accent border
6. **Bridges**: tier list with colors; add/remove tier; settings cog per tier

**Issues / observations:**
- Roads and Rails sections are interleaved — unclear separation.
- Contextual panels appear in-place in the sidebar; users don't know to select a segment to unlock them.
- Bridges section is buried at the bottom and easily missed.

---

#### Tab: Rivers

**Sections:**

1. **Fetch** (OSM mode): button + status
2. **Paint**: Rivers / Canals toggle; Paint / Erase buttons; Selection mode toggle
3. **Segment properties** (contextual): width %, taper %, taper direction flip, wiggle amp/freq, path smoothing, reset
4. **Hop properties** (contextual, yellow accent): same controls
5. **Default style**: button → RiversSettingsFlyout; lake override controls

**Flyout (RiversSettingsFlyout):** width scale, curve steps, wobble, detail, wiggle params.

**Issues / observations:**
- "Rivers / Canals" toggle is the first control but unlabelled — looks like a section toggle not a mode selector.
- Selection mode is a third button after Paint/Erase with no visual distinction that it's a different category.

---

#### Tab: Settlements

**Sections:**

1. **Place**: Tier I–IV tool buttons (icon swatches, cogs, shortcuts 1–4); manual-place mode indicator
2. **Load from OSM**: Fetch button + status; paginated list of OSM settlements (checkbox · population · tier badge · move/delete buttons); tier reassignment dropdown
3. **Tier settings**: cog per tier → SettlementsSettingsFlyout (shape, size, colors)
4. **Urban areas**: paint tool toggle + cog → UrbanSettingsFlyout
5. **Settlement list** (custom/placed): editable names (double-click) · delete · population display

**Issues / observations:**
- Two settlement lists (OSM-imported and manually placed) with different UX idioms side by side.
- The OSM list can be long with no virtualization.
- "Urban areas" is a sub-feature hidden below the settlement list.

---

#### Tab: Overlays (Highlights + Icons + Labels)

**Three sub-sections:**

**Highlights:**
- Create button + list (color swatch · name · settings cog · delete)
- When active: Paint / Erase buttons

**Icons:**
- Create button + list (shape swatch · name · settings cog · delete)
- Place mode toggle
- Placed icons list (coords + delete)

**Labels:**
- Create button + list (text swatch · name · settings cog · delete)
- Place mode toggle
- Placed labels list (text + coords + edit/delete)

**Issues / observations:**
- Three fundamentally different overlay types share one sidebar tab with no visual hierarchy between them.
- "Highlights" (hex-fill overlays) is a misleading name — it's more like "custom terrain regions."
- Creating any item and then configuring it requires two steps (create → click settings cog) that aren't obvious.

---

#### Tab: Areas

**Purpose:** Auto-generate or hand-paint named hexagon regions.

**Sections:**

1. **Mode toggle** (on/off) + Draw / Erase tools
2. **Generate**: target size slider; river/terrain border weight sliders; Generate + Clear all buttons
3. **Area list**: color picker (click = active) · editable name · hex count badge · delete

**Issues / observations:**
- On/off toggle is the first control but looks like a regular checkbox — not prominent enough for a mode gate.
- Generate parameters are advanced but shown at the same visual level as the basic draw tool.

---

#### Tab: Elevation

**Sections:**

1. **Fetch** (OSM mode): button + status + progress; "X/Y hexes" count
2. **Classification**: Mountains % / Hills % sliders; min ruggedness / min altitude sliders; warning if mountains+hills > 95%; flat/hills/mountains count grid (color-coded)
3. **Hachure settings** (if map style uses elevation): spacing, length, wobble, jitter, hill width, mountain width, smoothing — sliders; reset
4. **Paint overrides**: manual elevation brushes (same as Terrain tab brushes, same shortcuts)

**Issues / observations:**
- Elevation brushes are duplicated from the Terrain tab but live in a different tab — users lose context.
- "Classification" changes what the elevation data means but there's no preview of the effect until re-rendering.

---

#### Tab: Display

**Sections:**

1. **Hex borders**: Full / Stubs / None buttons; opacity slider; color (dark/light/custom picker); auto-contrast toggle
2. **Hex numbers**: on/off; starting corner picker (2×2 grid); edge picker (clickable hex with 6 edge + center dots); font size slider; color picker
3. **Map shape**: + Add / − Remove tools; Reset; hex count display
4. **Impassable hexes**: "Auto-disable ocean hexes" button; + Enable / − Disable tools; Reset; count display
5. **Map frame**: background color palette (9 presets + custom); clip-to-hex toggle; border on/off + color + width
6. **Mega hex grid**: on/off; size slider (R1–R5 with labels); color + opacity + line width; Set origin tool
7. **Terrain legend**: read-only list of terrain types with color swatches

**Issues / observations:**
- 7 sections in one sidebar — the longest and most complex tab; nothing is collapsible.
- Hex borders, hex numbers, map shape, and impassable hexes are conceptually separate but share identical visual weight.
- The terrain legend at the bottom is purely informational but styled identically to interactive controls.

---

## Flyout Panels (global pattern)

Flyouts are fixed-position panels anchored at `left: 204px` (just right of the sidebar), 200px wide, z-index 100. They appear on top of the canvas.

**Structure:**
- Dark background (`#0e0f18`), thin border, box shadow
- Header: title + optional reset button + × close
- Body: sliders, checkboxes, color pickers, radio pills

**Active flyouts include:**
- TerrainSettingsFlyout, EdgeBlobShapeFlyout, CoastlineSettingsFlyout
- RiversSettingsFlyout, RoadGeomFlyout
- SettlementsSettingsFlyout, UrbanSettingsFlyout
- IconSettingsFlyout, LabelSettingsFlyout, HighlightSettingsFlyout
- ClassificationFlyout, ElevationFlyout

**Issues / observations:**
- Only one flyout can be open at a time (implicitly — no enforcement shown).
- Flyouts clip behind the canvas on small screens.
- No animation/transition — appear/disappear instantly.
- Reset button behavior: two-step ("Sure?" → reset) — but not consistent across all flyouts.

---

## Canvas: TerrainViewCanvas

The primary interaction surface. Renders all map layers onto an HTML5 canvas.

**Layers (bottom → top):**
1. Terrain fills + blobs + textures + lakes + coastlines
2. Elevation hachures / relief shading
3. Road and rail splines (tiered, styled)
4. River and canal splines (variable width, tapered)
5. Settlement footprints (urban areas)
6. Settlement icons + 8-candidate label placement
7. Highlight fills + borders + line patterns
8. Area region fills
9. Icons (manual)
10. Labels (manual)
11. Hex numbers
12. Bridges
13. Hex border grid (full / stubs / none)
14. Mega-hex overlay
15. Paper frame + margin + map border (screen space)
16. OSM reference raster (optional, with opacity)
17. Reference image (optional, for tracing)
18. Edit handles (roads/rivers/rails when in node-edit mode)

**Painting interaction:**
- Click = paint single hex
- Drag = paint stroke
- Brush tool changes based on active sidebar tool

**Selection interaction:**
- Click road/river segment to select (properties panel appears in sidebar)
- Drag segment node to reposition
- Escape to deselect

**Keyboard shortcuts:**
- `1`–`9` → select terrain/elevation/road/settlement brush
- `E` → eraser
- `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` → undo / redo
- `Escape` → deselect / cancel

---

## Visual Design System

**Color palette:**
| Role | Value |
|---|---|
| Background | `#0e0f18` (very dark blue-black) |
| Surface | `#13141f` |
| Border (dim) | `#1e1f2e` |
| Border (mid) | `#2a2a3a` |
| Text (primary) | `#d0d0d8` |
| Text (muted) | `#a0a0c0` |
| Text (dim) | `#4a4a6a` |
| Accent (terrain/active) | `#5a9e6f` / `#7de0a0` |
| Accent (elevation) | `#4a7a9a` / `#5a9aba` |
| Accent (roads) | `#b07820` / `#8a5c2a` |
| Accent (hop/selection) | yellow-orange |

**Typography:**
- Font: `ui-monospace, monospace` everywhere
- Sizes: 10px (labels), 11px (buttons/body), 12px (default), 13px (headers)
- Section labels: uppercase, 1–2.5px letter-spacing, dim color

**Spacing:**
- Sidebar section padding: 10px
- Control gaps: 2–10px (flex gap)
- Between sections: 1px divider

**Interactive patterns:**
- Buttons: no background by default → colored background + border on active/hover
- Two-step reset: first click = "Sure?", second = execute
- Hover on tool button = show settings cog (appears in-place)
- Shortcut badge = absolute-positioned right edge of button

**No animations or transitions** anywhere in the current UI.

---

## Known Pain Points (summary for design review)

| Area | Issue |
|---|---|
| TopBar | Too dense — 8 tabs + style selector + file ops + setup nav in 44px |
| Tab naming | "Overlays" is ambiguous; "Areas" and "Highlights" overlap conceptually |
| Terrain list | No search/filter; grows unbounded with OSM terrain types |
| Contextual panels | Roads/rivers segment properties appear inline with no onboarding hint |
| Flyouts | No animation, can clip canvas, no focus management |
| Display tab | Most complex tab, nothing collapsible — 7 sections |
| Elevation tab | Classification sliders have no live preview |
| OSM settlement list | Long list, no virtualization |
| Settings cog discoverability | Only visible on hover — easy to miss entirely |
| No empty states | All sections assume data exists (no guidance if e.g. no roads fetched) |
| Mobile | Entirely unusable (intentional desktop-only, but worth noting) |
| Undo/redo | Available but not surfaced in UI (no buttons, keyboard-only) |
| Keyboard shortcuts | Available but entirely undiscovered — no tooltip or legend |

---

## What's working well

- Consistent sidebar structure across all 8 tabs
- Flyout panel pattern keeps advanced settings out of the main flow
- Monospace font gives a purposeful "technical tool" character
- Two-step reset prevents accidental data loss
- Active tool state is clear (green highlight + border)
- Canvas layering is powerful — full control over output appearance
- OSM integration gives a real-world data foundation without manual entry
