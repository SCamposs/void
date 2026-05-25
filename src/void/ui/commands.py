from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShellCommandResult:
    action: str
    target: str | None
    message: str


def execute_shell_command(raw: str) -> ShellCommandResult:
    command = " ".join(raw.strip().lower().split())

    if command in {"", "help"}:
        return ShellCommandResult(
            action="help",
            target=None,
            message=(
                "Commands: open shell | open json | open ambient | open orbit | open typing | open typing-stats | modules | help | clear | quit"
            ),
        )

    if command in {"open shell", "shell", "open home", "home", "h"}:
        return ShellCommandResult(action="open", target="home", message="Opening SHELL")

    if command in {"open json", "json"}:
        return ShellCommandResult(
            action="open", target="json-tools", message="Opening JSON Tools"
        )

    if command in {"open ambient", "ambient"}:
        return ShellCommandResult(
            action="open", target="ambient", message="Opening Ambient Mode"
        )

    if command in {"open orbit", "orbit", "open ascii-orbit", "ascii-orbit", "o"}:
        return ShellCommandResult(
            action="open", target="ascii-orbit", message="Opening ASCII Orbit"
        )

    if command in {"open typing", "typing"}:
        return ShellCommandResult(
            action="open", target="typing", message="Opening Typing Test"
        )

    if command in {"open typing-stats", "typing-stats", "stats"}:
        return ShellCommandResult(
            action="open", target="typing-stats", message="Opening Typing Stats"
        )

    if command == "modules":
        return ShellCommandResult(
            action="modules",
            target=None,
            message="Modules: home (h), json-tools (j), ambient (a), ascii-orbit (o), typing (t), typing-stats (s)",
        )

    if command == "clear":
        return ShellCommandResult(
            action="clear", target=None, message="Command line cleared"
        )

    if command in {"quit", "exit"}:
        return ShellCommandResult(action="quit", target=None, message="Exiting VOID")

    return ShellCommandResult(
        action="error",
        target=None,
        message="Unknown command. Try: open shell, open json, open ambient, open orbit, open typing, open typing-stats, modules, help, clear, quit",
    )
