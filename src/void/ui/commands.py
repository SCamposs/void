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
                "Commands: open shell | open typing | open orbit | open stacker | modules | help | clear | quit"
            ),
        )

    if command in {"open shell", "shell", "open home", "home", "h"}:
        return ShellCommandResult(
            action="open", target="shell", message="Opening SHELL"
        )

    if command in {"open stacker", "stacker", "k"}:
        return ShellCommandResult(
            action="open", target="stacker", message="Opening STACKER"
        )

    if command in {"open json", "json", "j"}:
        return ShellCommandResult(
            action="disabled",
            target=None,
            message="JSON_TOOLS is disabled in this build",
        )

    if command in {"open ambient", "ambient", "a"}:
        return ShellCommandResult(
            action="disabled",
            target=None,
            message="AMBIENT is disabled in this build",
        )

    if command in {"open orbit", "orbit", "open ascii-orbit", "ascii-orbit", "o"}:
        return ShellCommandResult(
            action="open", target="ascii-orbit", message="Opening ASCII Orbit"
        )

    if command in {"open typing", "typing"}:
        return ShellCommandResult(
            action="open", target="typing", message="Opening Typing Test"
        )

    if command in {"open typing-stats", "typing-stats", "stats", "s"}:
        return ShellCommandResult(
            action="open", target="typing-stats", message="Opening Typing Stats"
        )

    if command == "modules":
        return ShellCommandResult(
            action="modules",
            target=None,
            message="Modules: shell (h), typing (t), orbit (o), stacker (k)",
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
        message="Unknown command. Try: open shell, open typing, open orbit, open stacker, modules, help, clear, quit",
    )
