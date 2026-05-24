from __future__ import annotations

import math


def rotate_point(
    x: float, y: float, z: float, angle: float
) -> tuple[float, float, float]:
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    rx = x * cos_a - z * sin_a
    rz = x * sin_a + z * cos_a
    return rx, y, rz


def project_point(
    x: float,
    y: float,
    z: float,
    *,
    width: int,
    height: int,
    scale: float,
) -> tuple[int, int] | None:
    depth = 2.4 + z
    if depth <= 0.1:
        return None
    px = int(width / 2 + (x / depth) * scale)
    py = int(height / 2 + (y / depth) * scale * 0.55)
    if 0 <= px < width and 0 <= py < height:
        return px, py
    return None


def generate_sphere_points(
    lat_steps: int = 13, lon_steps: int = 24
) -> list[tuple[float, float, float]]:
    points: list[tuple[float, float, float]] = []
    for lat_index in range(lat_steps):
        lat = -math.pi / 2 + (lat_index / max(1, lat_steps - 1)) * math.pi
        for lon_index in range(lon_steps):
            lon = (lon_index / lon_steps) * 2 * math.pi
            x = math.cos(lat) * math.cos(lon)
            y = math.sin(lat)
            z = math.cos(lat) * math.sin(lon)
            points.append((x, y, z))
    return points


def render_orbit_frame(width: int, height: int, tick: int) -> str:
    width = max(8, width)
    height = max(4, height)
    canvas = [[" " for _ in range(width)] for _ in range(height)]

    for y in range(height):
        for x in range(width):
            value = (x * 11 + y * 17 + tick * 13) % 97
            if value == 0:
                canvas[y][x] = "."

    cx = width / 2
    cy = height / 2
    rx = max(3.0, width * 0.32)
    ry = max(2.0, height * 0.22)
    for step in range(160):
        a = (step / 160) * 2 * math.pi
        ox = cx + math.cos(a) * rx
        oy = cy + math.sin(a) * ry
        ix = int(ox)
        iy = int(oy)
        if 0 <= ix < width and 0 <= iy < height:
            if canvas[iy][ix] == " ":
                canvas[iy][ix] = "-"

    angle = tick * 0.13
    shades = " .:-=+*#%@"
    scale = min(width, height) * 0.95
    for x, y, z in generate_sphere_points():
        rxp, ryp, rzp = rotate_point(x, y, z, angle)
        projected = project_point(
            rxp, ryp, rzp, width=width, height=height, scale=scale
        )
        if projected is None:
            continue
        px, py = projected
        brightness = (rzp + 1.0) / 2.0
        shade_index = int(brightness * (len(shades) - 1))
        char = shades[shade_index]
        if char != " ":
            canvas[py][px] = char

    return "\n".join("".join(row) for row in canvas)
