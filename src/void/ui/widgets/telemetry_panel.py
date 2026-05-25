from __future__ import annotations

from dataclasses import dataclass

from textual.app import ComposeResult
from textual.widget import Widget
from textual.widgets import Static


@dataclass(frozen=True, slots=True)
class TelemetrySnapshot:
    renderer: str
    used_vram_gb: float
    total_vram_gb: float
    storage: str
    sync_state: str
    active_threads: int


def get_fake_telemetry() -> TelemetrySnapshot:
    return TelemetrySnapshot(
        renderer="OpenGL v4.6 Core",
        used_vram_gb=1.2,
        total_vram_gb=8.0,
        storage="SQLite DB_01",
        sync_state="ACTIVE",
        active_threads=24,
    )


class TelemetryPanel(Widget):
    def __init__(self) -> None:
        super().__init__(id="telemetry")

    def compose(self) -> ComposeResult:
        data = get_fake_telemetry()
        ratio = max(0.0, min(1.0, data.used_vram_gb / data.total_vram_gb))
        used_blocks = int(ratio * 20)
        free_blocks = 20 - used_blocks
        bar = f"[#6bdc96]{'|' * used_blocks}[/][#3e4a40]{'|' * free_blocks}[/]"

        yield Static("SYSTEM TELEMETRY", id="telemetry-title")
        yield Static(
            "\n".join(
                [
                    "[#879488]RENDERER[/]",
                    f"[#5adace]{data.renderer}[/]",
                    "",
                    "[#879488]MEMORY VRAM[/]",
                    f"[#6bdc96]{data.used_vram_gb:.1f}GB[/] [#bdcabd]/ {data.total_vram_gb:.1f}GB[/]",
                    bar,
                    "",
                    "[#879488]LOCAL STORAGE[/]",
                    data.storage,
                    f"[#6bdc96]SYNC: {data.sync_state}[/]",
                    "",
                    "[#879488]ACTIVE THREADS[/]",
                    f"[bold]{data.active_threads}[/]",
                    "[#6bdc96]|#||#|#|[/]",
                    "[#6bdc96]||#||##|[/]",
                ]
            )
        )
