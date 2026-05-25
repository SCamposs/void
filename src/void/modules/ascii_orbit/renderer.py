from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum


class OrbitMode(str, Enum):
    GLOBE = "globe"
    SCANNER = "scanner"
    FIELD = "field"


@dataclass(frozen=True, slots=True)
class OrbitRenderConfig:
    width: int
    height: int
    tick: int
    mode: OrbitMode = OrbitMode.GLOBE
    detail_level: int = 2


def rotate_point(
    x: float, y: float, z: float, angle_x: float, angle_y: float
) -> tuple[float, float, float]:
    cos_x = math.cos(angle_x)
    sin_x = math.sin(angle_x)
    y2 = y * cos_x - z * sin_x
    z2 = y * sin_x + z * cos_x

    cos_y = math.cos(angle_y)
    sin_y = math.sin(angle_y)
    x3 = x * cos_y - z2 * sin_y
    z3 = x * sin_y + z2 * cos_y
    return x3, y2, z3


def project_point(
    x: float,
    y: float,
    z: float,
    *,
    width: int,
    height: int,
    scale: float,
) -> tuple[int, int] | None:
    depth = 2.8 + z
    if depth <= 0.15:
        return None
    px = int(width / 2 + (x / depth) * scale)
    py = int(height / 2 + (y / depth) * scale * 0.55)
    if 0 <= px < width and 0 <= py < height:
        return px, py
    return None


def generate_sphere_points(
    lat_steps: int = 18, lon_steps: int = 40
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


def _char_strength(char: str) -> int:
    shades = " .:-=+*#%@"
    try:
        return shades.index(char)
    except ValueError:
        return len(shades)


def _plot(canvas: list[list[str]], x: int, y: int, char: str) -> None:
    current = canvas[y][x]
    if _char_strength(char) >= _char_strength(current):
        canvas[y][x] = char


def _add_star_field(
    canvas: list[list[str]], width: int, height: int, tick: int, density: int
) -> None:
    spread = max(30, 95 - density * 10)
    for y in range(height):
        for x in range(width):
            value = (x * 37 + y * 61 + tick * 17) % spread
            if value == 0:
                _plot(canvas, x, y, ".")


def _add_tech_grid(canvas: list[list[str]], width: int, height: int, tick: int) -> None:
    step_x = max(6, width // 18)
    step_y = max(3, height // 14)
    phase = tick % step_x
    for x in range(phase, width, step_x):
        for y in range(0, height, 2):
            _plot(canvas, x, y, "|")
    for y in range((tick // 2) % step_y, height, step_y):
        for x in range(0, width, 3):
            _plot(canvas, x, y, ":")


def _draw_orbit_ring(canvas: list[list[str]], width: int, height: int) -> None:
    cx = width / 2
    cy = height / 2
    rx = max(3.0, width * 0.45)
    ry = max(2.0, height * 0.30)
    for step in range(240):
        angle = (step / 240) * 2 * math.pi
        x = int(cx + math.cos(angle) * rx)
        y = int(cy + math.sin(angle) * ry)
        if 0 <= x < width and 0 <= y < height:
            _plot(canvas, x, y, "-")


def _draw_scan_overlay(
    canvas: list[list[str]],
    width: int,
    height: int,
    tick: int,
    mode: OrbitMode,
) -> None:
    if mode == OrbitMode.FIELD:
        return
    if mode == OrbitMode.SCANNER:
        x = (tick * 2) % width
        for y in range(height):
            _plot(canvas, x, y, "|")
        cx = width / 2
        cy = height / 2
        sweep = (tick * 0.11) % (2 * math.pi)
        for r in range(4, int(min(width, height) * 0.6)):
            sx = int(cx + math.cos(sweep) * r)
            sy = int(cy + math.sin(sweep) * r * 0.6)
            if 0 <= sx < width and 0 <= sy < height:
                _plot(canvas, sx, sy, "/")
            sx2 = int(cx + math.cos(sweep + 0.08) * r)
            sy2 = int(cy + math.sin(sweep + 0.08) * r * 0.6)
            if 0 <= sx2 < width and 0 <= sy2 < height:
                _plot(canvas, sx2, sy2, "\\")
        return
    y = tick % height
    for x in range(width):
        _plot(canvas, x, y, ":")


def render_orbit_frame_with_config(config: OrbitRenderConfig) -> str:
    width = max(8, config.width)
    height = max(4, config.height)
    detail = max(1, min(6, config.detail_level))
    tick = max(0, config.tick)

    canvas = [[" " for _ in range(width)] for _ in range(height)]

    star_density = 1 if config.mode == OrbitMode.GLOBE else detail + 1
    _add_star_field(canvas, width, height, tick, star_density)
    if config.mode in {OrbitMode.SCANNER, OrbitMode.FIELD}:
        _add_tech_grid(canvas, width, height, tick)
    _draw_orbit_ring(canvas, width, height)

    lat_steps = 10 + detail * 6
    lon_steps = 22 + detail * 14
    points = generate_sphere_points(lat_steps=lat_steps, lon_steps=lon_steps)

    angle_x = tick * 0.035
    angle_y = tick * 0.11
    scale = min(width * 0.80, height * 1.65)
    shades = " .:-=+*#%@"

    for x, y, z in points:
        rx, ry, rz = rotate_point(x, y, z, angle_x, angle_y)
        projected = project_point(rx, ry, rz, width=width, height=height, scale=scale)
        if projected is None:
            continue

        px, py = projected
        brightness = (rz + 1.0) / 2.0
        if config.mode == OrbitMode.FIELD:
            brightness *= 0.7
        elif config.mode == OrbitMode.SCANNER:
            brightness = min(1.0, brightness * 1.15)

        shade_index = int(brightness * (len(shades) - 1))
        char = shades[shade_index]

        if abs(math.sqrt(rx * rx + ry * ry + rz * rz) - 1.0) < 0.04:
            char = "#" if brightness > 0.5 else "+"

        if char != " ":
            _plot(canvas, px, py, char)

            if config.mode == OrbitMode.FIELD and rz > 0.35:
                trail_x = px - ((tick // 2) % 3)
                if 0 <= trail_x < width:
                    _plot(canvas, trail_x, py, "-")

    for lat in (-0.65, -0.3, 0.0, 0.3, 0.65):
        for lon_index in range(0, 360, 10):
            lon = math.radians(lon_index)
            x = math.cos(lat) * math.cos(lon)
            y = math.sin(lat)
            z = math.cos(lat) * math.sin(lon)
            rx, ry, rz = rotate_point(x, y, z, angle_x, angle_y)
            projected = project_point(
                rx, ry, rz, width=width, height=height, scale=scale
            )
            if projected is None:
                continue
            px, py = projected
            _plot(canvas, px, py, "=" if rz > 0 else ":")

    _draw_scan_overlay(canvas, width, height, tick, config.mode)

    if config.mode == OrbitMode.SCANNER:
        pulse_y = (tick * 3) % height
        for x in range(0, width, 2):
            _plot(canvas, x, pulse_y, "=")

    if config.mode == OrbitMode.FIELD:
        cx = width // 2
        cy = height // 2
        for ring in range(3, int(min(width, height) * 0.36), 4):
            for step in range(0, 360, 22):
                angle = math.radians(step + tick)
                x = int(cx + math.cos(angle) * ring)
                y = int(cy + math.sin(angle) * ring * 0.6)
                if 0 <= x < width and 0 <= y < height:
                    _plot(canvas, x, y, ".")

    return "\n".join("".join(row) for row in canvas)


def render_orbit_frame(width: int, height: int, tick: int) -> str:
    """Backward-compatible wrapper for v0.1 API."""
    return render_orbit_frame_with_config(
        OrbitRenderConfig(width=width, height=height, tick=tick, mode=OrbitMode.GLOBE)
    )
