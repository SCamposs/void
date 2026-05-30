from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.screen import Screen
from textual.widgets import Static

from void.ui.widgets.shell import VoidFooter, VoidHeader


class StackerScreen(Screen):
    BINDINGS = [
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("STACKER // planned scaffold", id="stacker-title")
        yield Static("[h] home  [q] quit", id="stacker-hint")
        yield Static(
            "\n".join(
                [
                    "MODULE STATUS",
                    "-------------",
                    "- local sprint mode planned",
                    "- board engine planned",
                    "- piece queue and hold planned",
                    "- stats and replay planned",
                    "",
                    "This slot is active as a product scaffold.",
                ]
            ),
            id="stacker-body",
        )
        yield VoidFooter()

    def action_home(self) -> None:
        self.app.switch_screen("home")
