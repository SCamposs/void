from __future__ import annotations

from textual.app import ComposeResult
from textual.message import Message
from textual.containers import Vertical
from textual.widgets import Button, Static

from void.core.modules import ShellModule


class Sidebar(Vertical):
    class ModuleSelected(Message):
        def __init__(self, module_id: str) -> None:
            self.module_id = module_id
            super().__init__()

    def __init__(self, modules: tuple[ShellModule, ...]) -> None:
        super().__init__(id="sidebar")
        self._modules = modules

    def compose(self) -> ComposeResult:
        yield Static(
            "[bold #5adace]VOID_CORE[/]\n[#bdcabd]v4.2.0-STABLE[/]\n[#bdcabd]ID: User System ID[/]"
        )
        yield Button("NEW_INSTANCE", classes="side-button", id="new-instance-button")
        with Vertical(id="sidebar-modules"):
            for module in self._modules:
                yield Button(
                    f"{module.icon} {module.display_name}",
                    id=f"module-btn-{module.module_id}",
                    classes="module-item",
                )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id is None:
            return
        if not event.button.id.startswith("module-btn-"):
            return
        module_id = event.button.id.removeprefix("module-btn-")
        self.post_message(self.ModuleSelected(module_id))

    def set_active(self, module_id: str) -> None:
        for module in self._modules:
            item = self.query_one(f"#module-btn-{module.module_id}", Button)
            item.remove_class("module-active")
            if module.module_id == module_id:
                item.add_class("module-active")
