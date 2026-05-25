from __future__ import annotations

from textual.app import App
from textual.binding import Binding

from void.core.registry import list_modules
from void.ui.screens.shell import ShellScreen
from void.ui.theme import VOID_THEME_CSS


class VoidApp(App[None]):
    CSS = VOID_THEME_CSS
    TITLE = "VOID"
    SUB_TITLE = "Local-first cockpit"
    BINDINGS = [
        Binding("ctrl+x", "quit", "Exit", show=False),
        Binding("ctrl+c", "cancel", "Cancel", show=False),
        Binding("ctrl+s", "save", "Save", show=False),
    ]

    def on_mount(self) -> None:
        self.install_screen(ShellScreen(), name="home")
        for module in list_modules():
            if module.id == "home":
                continue
            self.install_screen(module.screen_factory(), name=module.id)
        self.push_screen("home")

    def action_cancel(self) -> None:
        self.notify("Cancel queued (placeholder)", timeout=1.5)

    def action_save(self) -> None:
        self.notify("Save queued (placeholder)", timeout=1.5)
