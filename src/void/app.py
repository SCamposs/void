from __future__ import annotations

from textual.app import App
from textual.binding import Binding

from void.core.registry import get_module, get_module_by_command, list_modules


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

    #home-title, #json-title, #ambient-title {
      text-style: bold;
      padding: 1 2;
    }

    #home-subtitle, #home-hints, #json-hint, #ambient-hint {
      padding: 0 2;
    }

    #home-modules {
      padding: 1 2;
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
    """

    BINDINGS = [
        Binding("j", "open_by_command('j')", "JSON"),
        Binding("a", "open_by_command('a')", "Ambient"),
        Binding("h", "open_home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def on_mount(self) -> None:
        for module in list_modules():
            self.install_screen(module.screen_factory(), name=module.id)
        self.push_screen("home")

    def open_module(self, module_id: str) -> None:
        module = get_module(module_id)
        if module is None:
            return
        self.switch_screen(module.id)

    def action_open_home(self) -> None:
        self.open_module("home")

    def action_open_by_command(self, command: str) -> None:
        module = get_module_by_command(command)
        if module is None:
            return
        self.open_module(module.id)
