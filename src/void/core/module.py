from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from textual.screen import Screen


@dataclass(frozen=True, slots=True)
class ModuleDefinition:
    id: str
    name: str
    command: str
    description: str
    screen_factory: Callable[[], Screen]
