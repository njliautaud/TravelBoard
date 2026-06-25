#!/usr/bin/env python3
"""Build LVGL RGB565 world map for ESP32 TravelBoard (744x564)."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "esp32-touch" / "src" / "world_map.c"
HDR = ROOT / "esp32-touch" / "include" / "world_map.h"
DATA_DIR = ROOT / "scripts" / "data"
GEOJSON = DATA_DIR / "ne_110m_land.geojson"
GEOJSON_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
    "geojson/ne_110m_land.geojson"
)

MAP_W = 744
MAP_H = 564

OCEAN_DEEP = (0x0a, 0x10, 0x1c)
OCEAN = (0x0f, 0x17, 0x28)
LAND_LOW = (0x2d, 0x3a, 0x4f)
LAND = (0x3a, 0x4a, 0x62)
COAST = (0x5a, 0x6d, 0x88)
GRID = (0x1a, 0x24, 0x36)
TROPIC = (0x22, 0x30, 0x48)


def lng_x(lng: float) -> float:
    return (lng + 180.0) / 360.0 * MAP_W


def lat_y(lat: float) -> float:
    return (90.0 - lat) / 180.0 * MAP_H


def poly(coords: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(int(lng_x(lng)), int(lat_y(lat))) for lng, lat in coords]


def rgb565(r: int, g: int, b: int) -> int:
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)


def ensure_geojson() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if GEOJSON.exists() and GEOJSON.stat().st_size > 1000:
        return GEOJSON
    print(f"Downloading Natural Earth land polygons…")
    try:
        urllib.request.urlretrieve(GEOJSON_URL, GEOJSON)
    except OSError as exc:
        print(f"Download failed ({exc}); using built-in fallback shapes.")
    return GEOJSON


def iter_rings(geometry: dict):
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon" and coords:
        yield coords[0]
    elif gtype == "MultiPolygon" and coords:
        for poly_coords in coords:
            if poly_coords:
                yield poly_coords[0]


def load_land_polygons() -> list[list[tuple[int, int]]]:
    path = ensure_geojson()
    if not path.exists() or path.stat().st_size < 1000:
        return fallback_polygons()

    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)

    shapes: list[list[tuple[int, int]]] = []
    for feature in data.get("features", []):
        geom = feature.get("geometry")
        if not geom:
            continue
        for ring in iter_rings(geom):
            pts = [(float(lng), float(lat)) for lng, lat in ring]
            if len(pts) < 3:
                continue
            shapes.append(poly(pts))
    if not shapes:
        return fallback_polygons()
    print(f"Loaded {len(shapes)} land polygons from GeoJSON")
    return shapes


def fallback_polygons() -> list[list[tuple[int, int]]]:
    """Detailed fallback if GeoJSON is unavailable."""
    raw = [
        [(-168, 71), (-140, 72), (-130, 70), (-125, 60), (-130, 55), (-123, 48), (-124, 42),
         (-117, 32), (-105, 25), (-97, 26), (-87, 22), (-82, 10), (-79, 9), (-77, 8), (-75, 10),
         (-80, 25), (-82, 30), (-75, 35), (-70, 42), (-67, 45), (-66, 44), (-60, 46), (-55, 50),
         (-52, 48), (-55, 60), (-65, 68), (-168, 71)],
        [(-168, 60), (-140, 72), (-168, 72), (-168, 60)],
        [(-52, 72), (-20, 82), (-15, 75), (-20, 60), (-45, 60), (-52, 72)],
        [(-82, 12), (-77, 10), (-75, 5), (-70, 1), (-55, 5), (-45, 2), (-35, 5), (-34, -5),
         (-38, -15), (-48, -25), (-58, -35), (-65, -45), (-72, -52), (-76, -56), (-82, 12)],
        [(-10, 72), (30, 72), (60, 70), (100, 72), (140, 72), (170, 68), (180, 60), (180, 10),
         (140, -8), (120, -5), (100, 0), (80, 5), (60, 12), (40, 36), (25, 38), (10, 44), (-5, 36),
         (-10, 36), (-10, 72)],
        [(-18, 38), (0, 36), (12, 32), (25, 32), (35, 30), (45, 12), (52, 12), (52, -35), (12, -35),
         (-18, 5), (-18, 38)],
        [(112, -10), (130, -12), (140, -15), (150, -25), (154, -35), (154, -44), (130, -44),
         (115, -35), (112, -10)],
        [(-180, -60), (180, -60), (180, -90), (-180, -90)],
        [(-8, 50), (-2, 50), (-2, 58), (-8, 58)],
        [(130, 30), (146, 30), (146, 42), (130, 42)],
        [(166, -34), (178, -34), (178, -48), (166, -48)],
        [(95, -2), (140, -2), (140, -10), (95, -10)],
        [(18, 35), (30, 32), (36, 28), (44, 12), (50, 12), (50, 24), (36, 36), (18, 35)],
        [(-6, 36), (3, 36), (3, 44), (-6, 44)],
    ]
    return [poly(shape) for shape in raw]


def draw_ocean_gradient(img: Image.Image) -> None:
    px = img.load()
    for y in range(MAP_H):
        t = y / max(MAP_H - 1, 1)
        r = int(OCEAN_DEEP[0] * (1 - t) + OCEAN[0] * t)
        g = int(OCEAN_DEEP[1] * (1 - t) + OCEAN[1] * t)
        b = int(OCEAN_DEEP[2] * (1 - t) + OCEAN[2] * t)
        for x in range(MAP_W):
            px[x, y] = (r, g, b)


def draw_world() -> Image.Image:
    img = Image.new("RGB", (MAP_W, MAP_H), OCEAN)
    draw_ocean_gradient(img)
    draw = ImageDraw.Draw(img)

    continents = load_land_polygons()
    for shape in continents:
        if len(shape) < 3:
            continue
        draw.polygon(shape, fill=LAND, outline=COAST)

    for lng in range(-180, 181, 30):
        x = int(lng_x(lng))
        draw.line([(x, 0), (x, MAP_H - 1)], fill=GRID, width=1)
    for lat in range(-60, 91, 30):
        y = int(lat_y(lat))
        draw.line([(0, y), (MAP_W - 1, y)], fill=GRID, width=1)

    # Equator & tropics
    for lat, color in ((0, TROPIC), (23.5, GRID), (-23.5, GRID)):
        y = int(lat_y(lat))
        draw.line([(0, y), (MAP_W - 1, y)], fill=color, width=1)

    return img


def emit_c(img: Image.Image) -> None:
    pixels = [rgb565(r, g, b) for r, g, b in img.getdata()]
    with OUT.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write('#include "world_map.h"\n\n')
        fh.write("#include <stdint.h>\n\n")
        fh.write(f"static const uint16_t kWorldMapPixels[{MAP_W * MAP_H}] = {{\n")
        for i in range(0, len(pixels), 12):
            chunk = ", ".join(f"0x{p:04X}" for p in pixels[i : i + 12])
            fh.write(f"  {chunk},\n")
        fh.write("};\n\n")
        fh.write("const lv_img_dsc_t kWorldMapImg = {\n")
        fh.write("  .header = {\n")
        fh.write("    .cf = LV_IMG_CF_TRUE_COLOR,\n")
        fh.write(f"    .w = {MAP_W},\n")
        fh.write(f"    .h = {MAP_H},\n")
        fh.write("  },\n")
        fh.write(f"  .data_size = {MAP_W * MAP_H * 2},\n")
        fh.write("  .data = (const uint8_t *)kWorldMapPixels,\n")
        fh.write("};\n")

    HDR.write_text(
        "#pragma once\n\n#include <lvgl.h>\n\n"
        f"#define kWorldMapW {MAP_W}\n"
        f"#define kWorldMapH {MAP_H}\n\n"
        "extern const lv_img_dsc_t kWorldMapImg;\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Wrote {OUT} ({len(pixels) * 2 // 1024} KB)")


def main() -> None:
    img = draw_world()
    emit_c(img)


if __name__ == "__main__":
    main()
