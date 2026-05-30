from __future__ import annotations

from dataclasses import dataclass

from void.core.registry import list_modules


@dataclass(frozen=True, slots=True)
class ShellModule:
    module_id: str
    screen_id: str
    code: str
    label: str
    icon: str
    command: str
    enabled: bool = True

    @property
    def display_name(self) -> str:
        return f"[{self.code}] {self.label}"


_SHELL_META: tuple[ShellModule, ...] = (
    ShellModule(
        module_id="shell",
        screen_id="home",
        code="MOD-01",
        label="SHELL",
        icon=">",
        command="shell",
    ),
    ShellModule(
        module_id="typing",
        screen_id="typing",
        code="MOD-02",
        label="TYPING_TEST",
        icon="::",
        command="typing",
    ),
    ShellModule(
        module_id="ascii-orbit",
        screen_id="ascii-orbit",
        code="MOD-03",
        label="ASCII_ORBIT",
        icon="##",
        command="orbit",
    ),
    ShellModule(
        module_id="stacker",
        screen_id="stacker",
        code="MOD-04",
        label="STACKER",
        icon="[]",
        command="stacker",
    ),
)

_COMMAND_TO_MODULE_ID: dict[str, str] = {
    "h": "shell",
    "t": "typing",
    "o": "ascii-orbit",
    "k": "stacker",
}


def list_shell_modules() -> tuple[ShellModule, ...]:
    installed_ids = {module.id for module in list_modules()}
    visible_modules: list[ShellModule] = []
    for module in _SHELL_META:
        if module.screen_id in installed_ids:
            visible_modules.append(module)
    return tuple(visible_modules)


def get_shell_module_by_id(module_id: str) -> ShellModule | None:
    for module in list_shell_modules():
        if module.module_id == module_id:
            return module
    return None


def get_shell_module_by_shortcut(shortcut: str) -> ShellModule | None:
    module_id = _COMMAND_TO_MODULE_ID.get(shortcut)
    if module_id is None:
        return None
    return get_shell_module_by_id(module_id)
