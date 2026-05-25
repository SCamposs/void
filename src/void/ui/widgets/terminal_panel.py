from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widget import Widget
from textual.widgets import Static


class TerminalPanel(Widget):
    def __init__(self) -> None:
        super().__init__(id="terminal-panel")
        self._cursor_on = True

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static(
                "\n".join(
                    [
                        "[#6bdc96]>[/] init system_boot",
                        "[OK] Kernel loaded (0.002s)",
                        "[OK] Mounting virtual drives...",
                        "[OK] /usr/void/local mounted.",
                        "[#6bdc96]>[/] load_modules --all",
                        "[OK] MOD-01 to MOD-07 initialized.",
                        "[#5adace][SYS][/] SIGNAL FIELD ACTIVE",
                        "[#5adace][SYS][/] VAULT INDEX READY",
                    ]
                ),
                id="terminal-log",
            )
            yield Static("", id="prompt-line")

    def on_mount(self) -> None:
        self.set_interval(0.5, self._blink_cursor)

    def _blink_cursor(self) -> None:
        cursor = "[#6bdc96]_[/]" if self._cursor_on else " "
        self.query_one("#prompt-line", Static).update(
            f"[#6bdc96]>[/] open orbit {cursor}"
        )
        self._cursor_on = not self._cursor_on
