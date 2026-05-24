from __future__ import annotations

from textual.app import App
from textual.binding import Binding

from void.core.registry import get_module, get_module_by_command, list_modules
from void.ui.commands import execute_shell_command
from void.ui.screens.boot import BootScreen


class VoidApp(App[None]):
    CSS = """
    Screen {
      background: black;
      color: white;
    }

    Header {
      background: black;
      color: white;
      text-style: bold;
    }

    Footer {
      background: black;
      color: white;
    }

    #boot-title {
      text-style: bold;
      content-align: center middle;
      height: 3;
      margin-top: 8;
    }

    #boot-log {
      content-align: center top;
      color: #d0d0d0;
    }

    #home-title, #json-title, #ambient-title, #typing-title, #typing-stats-title {
      text-style: bold;
      padding: 1 2;
    }

    #home-subtitle, #home-hints, #json-hint, #ambient-hint, #typing-hint, #typing-stats-hint {
      padding: 0 2;
    }

    #home-shell {
      height: 1fr;
      padding: 0 1;
    }

    #home-left, #home-right {
      width: 1fr;
      height: 1fr;
      padding: 1;
    }

    .void-panel {
      border: round white;
      padding: 1;
      margin-bottom: 1;
    }

    #home-modules, #home-commands, #home-keys, #home-status {
      height: auto;
    }

    #home-command-bar {
      height: 3;
      padding: 0 2 1 2;
    }

    #home-command-input {
      border: tall white;
    }

    #json-layout {
      height: 1fr;
      padding: 0 1;
    }

    .json-column {
      width: 1fr;
      height: 1fr;
      padding: 0 1;
    }

    .json-label {
      text-style: bold;
      padding: 0 0 1 0;
    }

    TextArea {
      height: 1fr;
      border: tall white;
    }

    #ambient-noise {
      padding: 1 1;
      height: 1fr;
      color: white;
    }

    #typing-layout {
      height: 1fr;
      padding: 1;
    }

    #typing-target {
      height: auto;
    }

    #typing-stats {
      height: auto;
    }

    #typing-stats-layout {
      height: 1fr;
      padding: 1;
    }

    .typing-stats-col {
      width: 1fr;
      height: 1fr;
      padding: 0 1;
    }

    #typing-stats-table {
      height: 1fr;
      border: round white;
    }
    """

    BINDINGS = [
        Binding("j", "open_by_command('j')", "JSON"),
        Binding("a", "open_by_command('a')", "Ambient"),
        Binding("t", "open_typing", "Typing"),
        Binding("s", "open_typing_stats", "Stats"),
        Binding("h", "open_home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def on_mount(self) -> None:
        self.install_screen(BootScreen(), name="boot")
        for module in list_modules():
            self.install_screen(module.screen_factory(), name=module.id)
        self.push_screen("boot")

    def open_module(self, module_id: str) -> None:
        module = get_module(module_id)
        if module is None:
            return
        self.switch_screen(module.id)

    def action_open_home(self) -> None:
        self.open_module("home")

    def action_open_typing(self) -> None:
        self.open_module("typing")

    def action_open_typing_stats(self) -> None:
        self.open_module("typing-stats")

    def action_open_by_command(self, command: str) -> None:
        module = get_module_by_command(command)
        if module is None:
            return
        self.open_module(module.id)

    def run_shell_command(self, raw: str) -> str:
        result = execute_shell_command(raw)
        if result.action == "open" and result.target:
            self.open_module(result.target)
        elif result.action == "quit":
            self.exit()
        return result.message
