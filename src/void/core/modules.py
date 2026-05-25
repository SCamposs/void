from __future__ import annotations

from dataclasses import dataclass

from void.core.registry import list_modules


@dataclass(frozen=True, slots=True)
class ShellModule:
    module_id: str
    code: str
    label: str
    icon: str
    command: str

    @property
    def display_name(self) -> str:
        return f"[{self.code}] {self.label}"


_SHELL_META: dict[str, tuple[str, str, str]] = {
    "home": ("MOD-01", "SHELL", ">"),
    "json-tools": ("MOD-02", "JSON_TOOLS", "{}"),
    "typing": ("MOD-03", "TYPING", "::"),
    "typing-stats": ("MOD-04", "TYPING_STATS", "[]"),
    "ambient": ("MOD-05", "AMBIENT", "~~"),
    "ascii-orbit": ("MOD-06", "ASCII_ORBIT", "##"),
}

_COMMAND_TO_MODULE_ID: dict[str, str] = {
    "h": "home",
    "j": "json-tools",
    "t": "typing",
    "s": "typing-stats",
    "a": "ambient",
    "o": "ascii-orbit",
}


def list_shell_modules() -> tuple[ShellModule, ...]:
    modules = []
    for module in list_modules():
        if module.id not in _SHELL_META:
            continue
        code, label, icon = _SHELL_META[module.id]
        modules.append(
            ShellModule(
                module_id=module.id,
                code=code,
                label=label,
                icon=icon,
                command=module.command,
            )
        )
    modules.sort(key=lambda item: item.code)
    return tuple(modules)


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
