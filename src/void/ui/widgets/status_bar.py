from __future__ import annotations

from textual.widgets import Static


class StatusBar(Static):
    def __init__(self) -> None:
        super().__init__(
            "SQLite: READY | SYS_PATH: /usr/void/local          ^C CANCEL   ^X EXIT   ^S SAVE",
            id="status-bar",
        )
