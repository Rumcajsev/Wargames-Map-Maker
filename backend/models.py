from pydantic import BaseModel
from typing import Optional


class GridConfig(BaseModel):
    center_lon: float
    center_lat: float
    bearing: float = 0.0       # degrees clockwise from north (MapLibre convention)
    width_m: float             # geographic width of paper frame in metres
    height_m: float            # geographic height of paper frame in metres
    hex_size_mm: float         # flat-to-flat diameter in mm
    paper_size: str            # "A4" | "A3" | "A2" | "A1"
    orientation: str           # "portrait" | "landscape"
    hex_orientation: str       # "flat" | "pointy"
    margin_mm: float = 0.0     # print margin in mm
    slider: float = 0.4        # terrain classification sensitivity (0.0–1.0)


class ReclassifyRequest(BaseModel):
    hexes: list[dict]
    slider: float = 0.4


class SettlementsConfig(BaseModel):
    center_lon: float
    center_lat: float
    bearing: float = 0.0
    width_m: float
    height_m: float
    paper_size: str
    orientation: str
    limit: int = 30
    types: list[str] = ["city", "town", "village"]


class RiversConfig(BaseModel):
    center_lon: float
    center_lat: float
    bearing: float = 0.0
    width_m: float
    height_m: float
    paper_size: str
    orientation: str
    types: list[str] = ["river"]
    hex_size_km: float = 10.0


class RoadsConfig(BaseModel):
    center_lon: float
    center_lat: float
    bearing: float = 0.0
    width_m: float
    height_m: float
    hex_orientation: str       # "flat" | "pointy"
    R_m: float                 # hex outer radius in metres (outer_radius_m from metadata)
    highway_types: list[str] = ["motorway", "trunk", "primary"]


class RailsConfig(BaseModel):
    center_lon: float
    center_lat: float
    bearing: float = 0.0
    width_m: float
    height_m: float
    hex_orientation: str       # "flat" | "pointy"
    R_m: float                 # hex outer radius in metres (outer_radius_m from metadata)
    rail_types: list[str] = ["rail"]


class ElevationConfig(BaseModel):
    hexes: list[dict]
    hills_relief_m: float = 80.0
    mountains_relief_m: float = 300.0
    hills_absolute_m: float = 600.0
    mountains_absolute_m: float = 1500.0


class HexLookupConfig(BaseModel):
    vertices: list[list[float]]   # [[lon, lat], ...] hex polygon
    types: Optional[list[str]] = None
