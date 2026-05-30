from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Static

from void.modules.ascii_orbit.renderer import (
    OrbitMode,
    OrbitRenderConfig,
    build_telemetry,
    render_orbit_frame_with_config,
    resolve_orbit_dimensions,
)
from void.ui.widgets.shell import VoidFooter, VoidHeader


class AsciiOrbitScreen(Screen):
    BINDINGS = [
        Binding("p", "pause", "Pause"),
        Binding("m", "mode", "Mode"),
        Binding("plus", "more_detail", "+Detail"),
        Binding("minus", "less_detail", "-Detail"),
        Binding("r", "reset", "Reset"),
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("ASCII Orbit v0.2 // Tech Scanner", id="orbit-title")
        yield Static(
            "[p] pause  [m] mode  [+/-] detail  [r] reset  [h] home  [q] quit",
            id="orbit-hint",
        )
        with Horizontal(id="orbit-layout"):
            yield Static("", id="orbit-frame", classes="void-panel")
            with Vertical(id="orbit-side"):
                yield Static("", id="orbit-status", classes="void-panel")
        yield VoidFooter()

    def on_mount(self) -> None:
        self._tick = 0
        self._paused = False
        self._mode = OrbitMode.GLOBE
        self._detail = 2
        self._timer = self.set_interval(0.08, self._advance)
        self._render_now()

    def action_pause(self) -> None:
        self._paused = not self._paused
        self._render_status()

    def action_reset(self) -> None:
        self._tick = 0
        self._render_now()

    def action_mode(self) -> None:
        modes = [OrbitMode.GLOBE, OrbitMode.SCANNER, OrbitMode.FIELD]
        next_index = (modes.index(self._mode) + 1) % len(modes)
        self._mode = modes[next_index]
        self._render_now()

    def action_more_detail(self) -> None:
        self._detail = min(6, self._detail + 1)
        self._render_now()

    def action_less_detail(self) -> None:
        self._detail = max(1, self._detail - 1)
        self._render_now()

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def _advance(self) -> None:
        if self._paused:
            return
        self._tick += 1
        self._render_now()

    def _render_now(self) -> None:
        frame_widget = self.query_one("#orbit-frame", Static)
        width, height = resolve_orbit_dimensions(
            container_width=frame_widget.size.width,
            container_height=frame_widget.size.height,
            padding_x=2,
            padding_y=2,
            min_width=48,
            min_height=18,
        )
        frame_widget.update(
            render_orbit_frame_with_config(
                OrbitRenderConfig(
                    width=width,
                    height=height,
                    tick=self._tick,
                    mode=self._mode,
                    detail_level=self._detail,
                )
            )
        )
        self._render_status(width, height)

    def _render_status(self, width: int = 0, height: int = 0) -> None:
        telemetry = build_telemetry(
            tick=self._tick,
            mode=self._mode,
            width=width,
            height=height,
            detail_level=self._detail,
            paused=self._paused,
        )
        self.query_one("#orbit-status", Static).update(
            "SIGNAL\n"
            "------\n"
            f"tick: {telemetry.tick}\n"
            f"mode: {telemetry.mode.value.upper()}\n"
            f"status: {telemetry.status}\n"
            f"resolution: {telemetry.width}x{telemetry.height}\n"
            f"rotation: {telemetry.rotation_angle:.2f} rad\n"
            f"scan phase: {telemetry.scan_phase}%\n"
            f"signal: {telemetry.signal_strength}%\n"
            f"noise: {telemetry.noise_level}%\n"
            f"target: {telemetry.target_id}\n"
            f"coord: ({telemetry.coord_x:+d}, {telemetry.coord_y:+d})\n"
            f"lock: {telemetry.lock_quality}%\n"
            f"detail: {telemetry.detail_level}"
        )
