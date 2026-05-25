from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.screen import Screen

from void.ui.widgets.sidebar import Sidebar
from void.ui.widgets.status_bar import StatusBar
from void.ui.widgets.telemetry_panel import TelemetryPanel
from void.ui.widgets.top_bar import TopBar
from void.ui.widgets.workspace import Workspace


class ShellScreen(Screen):
    def compose(self) -> ComposeResult:
        with Vertical(id="shell-root"):
            yield TopBar()
            with Horizontal(id="main-layout"):
                yield Sidebar()
                yield Workspace()
                yield TelemetryPanel()
            yield StatusBar()
