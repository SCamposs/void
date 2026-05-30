from __future__ import annotations

import random

from textual.app import ComposeResult
from textual.binding import Binding
from textual.screen import Screen
from textual.widgets import Static

from void.ui.widgets.shell import VoidFooter, VoidHeader


class AmbientScreen(Screen):
    BINDINGS = [
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    NOISE = " .:-=+*#%@"

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("Ambient Mode", id="ambient-title")
        yield Static("[h] home  [q] quit", id="ambient-hint")
        yield Static("", id="ambient-noise")
        yield VoidFooter()

    def on_mount(self) -> None:
        self.set_interval(0.08, self._tick)

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def _tick(self) -> None:
        width = max(24, self.size.width - 2)
        height = max(8, self.size.height - 8)
        rows = []
        for _ in range(height):
            row = "".join(random.choice(self.NOISE) for _ in range(width))
            rows.append(row)
        self.query_one("#ambient-noise", Static).update("\n".join(rows))
