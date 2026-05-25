from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Static

from void.core.modules import ShellModule


class Sidebar(Vertical):
    def __init__(self, modules: tuple[ShellModule, ...]) -> None:
        super().__init__(id="sidebar")
        self._modules = modules

    def compose(self) -> ComposeResult:
        yield Static(
            "[bold #5adace]VOID_CORE[/]\n[#bdcabd]v4.2.0-STABLE[/]\n[#bdcabd]ID: User System ID[/]"
        )
        yield Static("NEW_INSTANCE", classes="side-button")
        with Vertical(id="sidebar-modules"):
            for module in self._modules:
                yield Static(
                    f"{module.icon} {module.display_name}",
                    id=f"module-{module.module_id}",
                    classes="module-item",
                )

    def set_active(self, module_id: str) -> None:
        for module in self._modules:
            item = self.query_one(f"#module-{module.module_id}", Static)
            item.remove_class("module-active")
            if module.module_id == module_id:
                item.add_class("module-active")
