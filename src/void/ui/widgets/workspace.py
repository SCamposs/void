from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Static

from void.modules.ascii_orbit.renderer import (
    OrbitMode,
    OrbitRenderConfig,
    render_orbit_frame_with_config,
)
from void.modules.typing.repository import get_typing_summary
from void.ui.theme import VOID_LOGO
from void.ui.widgets.terminal_panel import TerminalPanel


class Workspace(Vertical):
    def __init__(self) -> None:
        super().__init__(id="workspace")

    def compose(self) -> ComposeResult:
        with Vertical(id="workspace-stack"):
            yield Static("[ WORKSPACE_MAIN ]", id="workspace-label")
            yield Static("", id="workspace-viewport")
            yield TerminalPanel()

    def terminal(self) -> TerminalPanel:
        return self.query_one(TerminalPanel)

    def render_module(self, module_id: str) -> None:
        viewport = self.query_one("#workspace-viewport", Static)
        if module_id == "home":
            viewport.update(f"{VOID_LOGO}\n[#6bdc96][ SYS_CORE_ONLINE ][/]")
            return

        if module_id == "json-tools":
            viewport.update(
                "[#5adace]JSON_TOOLS[/]\n\n"
                "[f] format [m] minify [v] validate\n"
                "Use CLI too: `uv run void json-format '{\"k\":1}'`"
            )
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

        if module_id == "typing-stats":
            summary = get_typing_summary()
            viewport.update(
                "[#5adace]TYPING STATS[/]\n\n"
                f"Total Sessions: {summary.total_sessions}\n"
                f"Avg WPM: {summary.average_wpm:.2f}\n"
                f"Avg Accuracy: {summary.average_accuracy:.2f}%"
            )
            return

        if module_id == "ambient":
            viewport.update(
                "[#5adace]AMBIENT MODE[/]\n\n"
                " .:-=+*#%@ .:-=+*#%@\n"
                " %@#*+=-:. %@#*+=-:.\n"
                " .:-=+*#%@ .:-=+*#%@"
            )
            return

        if module_id == "ascii-orbit":
            frame = render_orbit_frame_with_config(
                OrbitRenderConfig(
                    width=max(24, viewport.size.width - 4),
                    height=max(10, viewport.size.height - 6),
                    tick=12,
                    mode=OrbitMode.SCANNER,
                    detail_level=2,
                )
            )
            viewport.update(frame)
            return

        viewport.update(f"Unknown module: {module_id}")
