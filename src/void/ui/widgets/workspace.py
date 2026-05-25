from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.message import Message
from textual.widgets import Button, Static

from void.modules.ascii_orbit.renderer import (
    OrbitMode,
    OrbitRenderConfig,
    render_orbit_frame_with_config,
    resolve_orbit_dimensions,
)
from void.modules.typing.repository import get_typing_summary
from void.ui.theme import VOID_LOGO
from void.ui.widgets.terminal_panel import TerminalPanel


class Workspace(Vertical):
    class QuickOpenRequested(Message):
        def __init__(self, module_id: str) -> None:
            self.module_id = module_id
            super().__init__()

    def __init__(self) -> None:
        super().__init__(id="workspace")
        self._active_module_id = "shell"

    def compose(self) -> ComposeResult:
        with Vertical(id="workspace-stack"):
            yield Static("[ WORKSPACE_MAIN ]", id="workspace-label")
            yield Static("", id="workspace-viewport")
            yield Button(
                "OPEN ACTIVE MODULE",
                id="open-active-module",
                classes="workspace-action",
            )
            yield Static("Quick Open", classes="tiny")
            yield Button("Open Typing", id="quick-typing", classes="workspace-quick")
            yield Button("Open Orbit", id="quick-orbit", classes="workspace-quick")
            yield Button("Open Stacker", id="quick-stacker", classes="workspace-quick")
            yield TerminalPanel()

    def terminal(self) -> TerminalPanel:
        return self.query_one(TerminalPanel)

    def render_module(self, module_id: str) -> None:
        self._active_module_id = module_id
        viewport = self.query_one("#workspace-viewport", Static)
        open_button = self.query_one("#open-active-module", Button)
        open_button.label = (
            "OPEN ACTIVE MODULE"
            if module_id == "shell"
            else f"OPEN {module_id.upper()}"
        )

        if module_id == "shell":
            viewport.update(f"{VOID_LOGO}\n[#6bdc96][ SYS_CORE_ONLINE ][/]")
            return

        if module_id == "typing":
            summary = get_typing_summary()
            viewport.update(
                "[#5adace]TYPING TEST // 60s PT-BR[/]\n\n"
                "Mode: word-flow-60s\n"
                f"Sessions: {summary.total_sessions}\n"
                f"Best WPM: {summary.best_wpm:.2f}\n"
                "Run full trainer via legacy screen/flow soon."
            )
            return

        if module_id == "ascii-orbit":
            width, height = resolve_orbit_dimensions(
                container_width=viewport.size.width,
                container_height=viewport.size.height,
                padding_x=1,
                padding_y=1,
                min_width=72,
                min_height=24,
            )
            frame = render_orbit_frame_with_config(
                OrbitRenderConfig(
                    width=width,
                    height=height,
                    tick=12,
                    mode=OrbitMode.SCANNER,
                    detail_level=2,
                )
            )
            viewport.update(frame)
            return

        if module_id == "stacker":
            viewport.update(
                "[#5adace]STACKER[/]\n\n"
                "planned scaffold\n"
                "- local sprint mode\n"
                "- board engine\n"
                "- hold + piece queue\n"
                "- stats/replay"
            )
            return

        viewport.update(f"Unknown module: {module_id}")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "open-active-module":
            self.post_message(self.QuickOpenRequested(self._active_module_id))
            return
        if event.button.id == "quick-typing":
            self.post_message(self.QuickOpenRequested("typing"))
            return
        if event.button.id == "quick-orbit":
            self.post_message(self.QuickOpenRequested("ascii-orbit"))
            return
        if event.button.id == "quick-stacker":
            self.post_message(self.QuickOpenRequested("stacker"))
