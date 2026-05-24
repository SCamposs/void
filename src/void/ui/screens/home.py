from __future__ import annotations

from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Footer, Header, Static


class HomeScreen(Screen):
    def compose(self) -> ComposeResult:
        from void.core.registry import list_modules

        yield Header(show_clock=True)
        yield Static("VOID", id="home-title")
        yield Static("Terminal-first dev playground", id="home-subtitle")

        module_lines = ["Available modules:"]
        for module in list_modules():
            if module.id == "home":
                continue
            module_lines.append(
                f"[{module.command}] {module.name} - {module.description}"
            )
        yield Static("\n".join(module_lines), id="home-modules")

        yield Static(
            "Keys: [j] JSON Tools  [a] Ambient Mode  [h] Home  [q] Quit",
            id="home-hints",
        )
        yield Footer()
