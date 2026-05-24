from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Static

from void.modules.ascii_orbit.renderer import render_orbit_frame
from void.ui.widgets.shell import VoidFooter, VoidHeader


class AsciiOrbitScreen(Screen):
    BINDINGS = [
        Binding("p", "pause", "Pause"),
        Binding("r", "reset", "Reset"),
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("ASCII Orbit v0.1", id="orbit-title")
        yield Static("[p] pause/resume  [r] reset  [h] home  [q] quit", id="orbit-hint")
        with Horizontal(id="orbit-layout"):
            yield Static("", id="orbit-frame", classes="void-panel")
            with Vertical(id="orbit-side"):
                yield Static("", id="orbit-status", classes="void-panel")
        yield VoidFooter()

    def on_mount(self) -> None:
        self._tick = 0
        self._paused = False
        self._timer = self.set_interval(0.08, self._advance)
        self._render_now()

    def action_pause(self) -> None:
        self._paused = not self._paused
        self._render_status()

    def action_reset(self) -> None:
        self._tick = 0
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
        width = max(20, frame_widget.size.width - 2)
        height = max(8, frame_widget.size.height - 2)
        frame_widget.update(render_orbit_frame(width, height, self._tick))
        self._render_status(width, height)

    def _render_status(self, width: int = 0, height: int = 0) -> None:
        status = "paused" if self._paused else "tracking"
        self.query_one("#orbit-status", Static).update(
            "SIGNAL\n"
            "------\n"
            f"tick: {self._tick}\n"
            "mode: ORBIT\n"
            f"status: {status}\n"
            f"resolution: {width}x{height}"
        )
