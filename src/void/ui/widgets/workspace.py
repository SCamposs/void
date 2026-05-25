from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widget import Widget
from textual.widgets import Static

from void.ui.theme import VOID_LOGO
from void.ui.widgets.terminal_panel import TerminalPanel


class Workspace(Widget):
    def __init__(self) -> None:
        super().__init__(id="workspace")

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static("[ WORKSPACE_MAIN ]", id="workspace-label")
            yield Static(
                f"{VOID_LOGO}\n[#6bdc96][ SYS_CORE_ONLINE ][/]", id="workspace-viewport"
            )
            yield TerminalPanel()
