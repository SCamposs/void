from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widget import Widget
from textual.widgets import Static

from void.core.modules import list_void_modules


class Sidebar(Widget):
    def __init__(self) -> None:
        super().__init__(id="sidebar")

    def compose(self) -> ComposeResult:
        yield Static(
            "[bold #5adace]VOID_CORE[/]\n[#bdcabd]v4.2.0-STABLE[/]\n[#bdcabd]ID: User System ID[/]"
        )
        yield Static("NEW_INSTANCE", classes="side-button")
        with Vertical():
            for index, module in enumerate(list_void_modules()):
                classes = "module-item module-active" if index == 0 else "module-item"
                yield Static(f"{module.icon} {module.display_name}", classes=classes)
