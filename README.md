# Hex Map Generator

A browser-based tool for generating hex maps from real-world terrain data, targeted at board wargame designers. The user defines a physical map format, positions it over real European terrain, and generates a hex grid classified with real terrain data. The map can be edited manually and exported for print at up to A1 300dpi.

## Project Documents

- **SPEC.md** — Full product specification: user flow, all panels and settings, business logic, interaction design
- **TECHNICAL.md** — Architecture, stack, data model, API endpoints, data sources, generation pipeline
- **RENDERING.md** — Visual styles, SVG rendering approach, theme system, terrain blending

## Core Concept

The tool works in two phases:

**Setup (pre-generation):** User defines the physical artifact — paper size, hex size in mm, orientation, rotation. These are locked after generation.

**Generation + Editing:** Six independent data layers (terrain, elevation, rivers, settlements, roads, railways) each fetched and configured separately via layer panels. All settings except grid geometry are adjustable after generation. Changes that don't require re-fetching are instant.

## Tech Stack

- **Frontend:** React + MapLibre (slippy map) + SVG renderer
- **Backend:** Python / FastAPI
- **Data sources:** OpenStreetMap (Overpass API), Copernicus GLO-30 DEM, CORINE Land Cover, OSRM routing

## Key Design Decisions

- Physical map dimensions drive hex count, not the other way around
- All raw data stored in JSON — reclassification is instant without re-fetching
- Roads are always settlement-derived (keeps map clean), railways are auto-imported
- Elevation uses hybrid local relief + absolute elevation to handle both sharp hills and plateaus
- SVG renderer with theme system — styles are configuration, not code changes
- Save/load is just JSON download/upload — no user accounts or server-side storage
