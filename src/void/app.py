from __future__ import annotations

from textual.app import App
from textual.binding import Binding

from void.ui.screens.shell import ShellScreen
from void.ui.theme import VOID_THEME_CSS


class VoidApp(App[None]):
    CSS = VOID_THEME_CSS
    TITLE = "VOID"
    SUB_TITLE = "Local-first cockpit"
    BINDINGS = [
        Binding("q", "quit", "Quit", show=False),
        Binding("ctrl+x", "quit", "Exit", show=False),
        Binding("ctrl+c", "cancel", "Cancel", show=False),
        Binding("ctrl+s", "save", "Save", show=False),
    ]

    def on_mount(self) -> None:
        self.install_screen(ShellScreen(), name="shell")
        self.push_screen("shell")

    def action_cancel(self) -> None:
        self.notify("Cancel queued (placeholder)", timeout=1.5)

    def action_save(self) -> None:
        self.notify("Save queued (placeholder)", timeout=1.5)
