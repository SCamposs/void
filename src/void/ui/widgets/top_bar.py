from __future__ import annotations

from textual.widgets import Static


class TopBar(Static):
    def __init__(self) -> None:
        super().__init__(
            "[bold #6bdc96]VOID // SESSION_ID: 0x8F2A[/]                                [#879488]- [ ] X[/]",
            id="top-bar",
        )
