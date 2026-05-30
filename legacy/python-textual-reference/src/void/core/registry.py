from __future__ import annotations

from void.core.module import ModuleDefinition
from void.modules.ambient.screen import AmbientScreen
from void.modules.ascii_orbit.screen import AsciiOrbitScreen
from void.modules.json_tools.screen import JsonToolsScreen
from void.modules.stacker.screen import StackerScreen
from void.modules.typing.screen import TypingScreen
from void.modules.typing.stats_screen import TypingStatsScreen
from void.ui.screens.home import HomeScreen

MODULES: tuple[ModuleDefinition, ...] = (
    ModuleDefinition(
        id="home",
        name="Home",
        command="h",
        description="Return to home dashboard",
        screen_factory=HomeScreen,
    ),
    ModuleDefinition(
        id="json-tools",
        name="JSON Tools",
        command="j",
        description="Format, minify, and validate JSON",
        screen_factory=JsonToolsScreen,
    ),
    ModuleDefinition(
        id="ambient",
        name="Ambient Mode",
        command="a",
        description="Animated ASCII/noise vibe screen",
        screen_factory=AmbientScreen,
    ),
    ModuleDefinition(
        id="ascii-orbit",
        name="ASCII Orbit",
        command="orbit",
        description="Render a rotating ASCII signal globe",
        screen_factory=AsciiOrbitScreen,
    ),
    ModuleDefinition(
        id="typing",
        name="Typing Test",
        command="typing",
        description="Practice speed and accuracy",
        screen_factory=TypingScreen,
    ),
    ModuleDefinition(
        id="typing-stats",
        name="Typing Stats",
        command="typing-stats",
        description="View saved typing performance",
        screen_factory=TypingStatsScreen,
    ),
    ModuleDefinition(
        id="stacker",
        name="Stacker",
        command="stacker",
        description="Planned block stacker scaffold",
        screen_factory=StackerScreen,
    ),
)

_MODULES_BY_ID = {module.id: module for module in MODULES}
_MODULES_BY_COMMAND = {
    module.command: module for module in MODULES if module.id != "home"
}


def list_modules() -> tuple[ModuleDefinition, ...]:
    return MODULES


def get_module(module_id: str) -> ModuleDefinition | None:
    return _MODULES_BY_ID.get(module_id)


def get_module_by_command(command: str) -> ModuleDefinition | None:
    return _MODULES_BY_COMMAND.get(command)
