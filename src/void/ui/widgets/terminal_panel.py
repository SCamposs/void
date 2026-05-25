from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Input, Static


class TerminalPanel(Vertical):
    def __init__(self) -> None:
        super().__init__(id="terminal-panel")
        self._history: list[str] = [
            "[#6bdc96]>[/] init system_boot",
            "[OK] Kernel loaded (0.002s)",
            "[OK] Mounting virtual drives...",
            "[OK] /usr/void/local mounted.",
            "[#6bdc96]>[/] load_modules --all",
            "[OK] MOD-01 to MOD-07 initialized.",
        ]

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static("", id="terminal-log")
            with Horizontal(id="prompt-line"):
                yield Static("[#6bdc96]>[/]", id="prompt-prefix")
                yield Input(value="open orbit", id="prompt-input")

    def on_mount(self) -> None:
        self.refresh_log()

    def focus_prompt(self) -> None:
        self.query_one("#prompt-input", Input).focus()

    def pull_prompt_value(self) -> str:
        return self.query_one("#prompt-input", Input).value

    def clear_prompt(self) -> None:
        self.query_one("#prompt-input", Input).value = ""

    def append_log(self, line: str) -> None:
        self._history.append(line)
        self._history = self._history[-14:]
        self.refresh_log()

    def clear_log(self) -> None:
        self._history.clear()
        self.refresh_log()

    def refresh_log(self) -> None:
        self.query_one("#terminal-log", Static).update("\n".join(self._history))
