from __future__ import annotations

from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Static


class BootScreen(Screen):
    """Fast VOID boot splash."""

    STEPS = [
        "[ ] initializing modules",
        "[ ] loading signal",
        "[ ] ready",
    ]

    def compose(self) -> ComposeResult:
        yield Static("VOID SHELL", id="boot-title")
        yield Static("", id="boot-log")

    def on_mount(self) -> None:
        self._step_index = 0
        self._timer = self.set_interval(0.22, self._advance_boot)

    def _advance_boot(self) -> None:
        log = self.query_one("#boot-log", Static)
        visible = self.STEPS[: self._step_index + 1]
        if self._step_index >= 0:
            checked = [line.replace("[ ]", "[x]") for line in visible[:-1]]
            if visible:
                checked.append(visible[-1])
            log.update("\n".join(checked))

        if self._step_index >= len(self.STEPS):
            self._timer.stop()
            self.app.switch_screen("home")
            return

        self._step_index += 1
