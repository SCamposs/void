from __future__ import annotations

from typing import TYPE_CHECKING, cast

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Input, Static
from textual.screen import Screen

from void.ui.widgets.shell import StatusPanel, VoidFooter, VoidHeader

if TYPE_CHECKING:
    from void.app import VoidApp


class HomeScreen(Screen):
    def compose(self) -> ComposeResult:
        from void.core.registry import list_modules

        yield VoidHeader(show_clock=True)
        yield Static("VOID", id="home-title")
        yield Static("shell // monochrome dev playground", id="home-subtitle")

        module_lines = ["Available modules:"]
        for module in list_modules():
            if module.id == "home":
                continue
            module_lines.append(
                f"[{module.command}] {module.name} - {module.description}"
            )

        with Horizontal(id="home-shell"):
            with Vertical(id="home-left"):
                yield Static(
                    "\n".join(module_lines), id="home-modules", classes="void-panel"
                )
                yield Static(
                    "Examples\n--------\nopen json\nopen ambient\nopen typing\nmodules\nhelp\nclear\nquit",
                    id="home-commands",
                    classes="void-panel",
                )
            with Vertical(id="home-right"):
                yield StatusPanel("", id="home-status", classes="void-panel")
                yield Static(
                    "Keys\n----\n[j] JSON Tools\n[a] Ambient Mode\n[t] Typing Test\n[h] Home\n[q] Quit",
                    id="home-keys",
                    classes="void-panel",
                )
                yield Static(
                    "VOID SHELL\n----------\nA small terminal-first module hub.",
                    id="home-hints",
                    classes="void-panel",
                )

        yield Input(placeholder="> command", id="home-command-input")
        yield VoidFooter()

    def on_mount(self) -> None:
        self.query_one("#home-status", StatusPanel).update_status("ready")
        self.query_one("#home-command-input", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        message = cast(VoidApp, self.app).run_shell_command(event.value)
        self.query_one("#home-status", StatusPanel).update_status(message)

        command_input = self.query_one("#home-command-input", Input)
        command_input.value = ""
        command_input.focus()
