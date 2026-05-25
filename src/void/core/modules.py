from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VoidModule:
    code: str
    label: str
    icon: str

    @property
    def display_name(self) -> str:
        return f"[{self.code}] {self.label}"


VOID_MODULES: tuple[VoidModule, ...] = (
    VoidModule(code="MOD-01", label="SHELL", icon=">"),
    VoidModule(code="MOD-02", label="JSON_TOOLS", icon="{}"),
    VoidModule(code="MOD-03", label="TYPING", icon="::"),
    VoidModule(code="MOD-04", label="SNIPPETS", icon="<>"),
    VoidModule(code="MOD-05", label="AMBIENT", icon="~~"),
    VoidModule(code="MOD-06", label="ASCII_ORBIT", icon="##"),
    VoidModule(code="MOD-07", label="ASSIST", icon="++"),
)


def list_void_modules() -> tuple[VoidModule, ...]:
    return VOID_MODULES
