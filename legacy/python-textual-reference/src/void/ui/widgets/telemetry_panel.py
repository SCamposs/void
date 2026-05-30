from __future__ import annotations

from dataclasses import dataclass

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Static


@dataclass(frozen=True, slots=True)
class TelemetrySnapshot:
    active_module: str
    mode: str
    sqlite_status: str
    command_count: int
    workspace_path: str


class TelemetryPanel(Vertical):
    def __init__(self) -> None:
        super().__init__(id="telemetry")
        self._snapshot = TelemetrySnapshot(
            active_module="home",
            mode="idle",
            sqlite_status="READY",
            command_count=0,
            workspace_path="/usr/void/local",
        )

    def compose(self) -> ComposeResult:
        yield Static("SYSTEM TELEMETRY", id="telemetry-title")
        yield Static("", id="telemetry-body")

    def on_mount(self) -> None:
        self._render_body()

    def update_snapshot(self, snapshot: TelemetrySnapshot) -> None:
        self._snapshot = snapshot
        self._render_body()

    def _render_body(self) -> None:
        self.query_one("#telemetry-body", Static).update(
            "\n".join(
                [
                    "[#879488]RENDERER[/]",
                    "[#5adace]OpenGL v4.6 Core[/]",
                    "",
                    "[#879488]ACTIVE MODULE[/]",
                    f"[#6bdc96]{self._snapshot.active_module}[/]",
                    "",
                    "[#879488]MODE[/]",
                    f"[#bdcabd]{self._snapshot.mode}[/]",
                    "",
                    "[#879488]SQLITE[/]",
                    f"[#6bdc96]{self._snapshot.sqlite_status}[/]",
                    "",
                    "[#879488]COMMAND COUNT[/]",
                    str(self._snapshot.command_count),
                    "",
                    "[#879488]WORKSPACE[/]",
                    self._snapshot.workspace_path,
                ]
            )
        )
