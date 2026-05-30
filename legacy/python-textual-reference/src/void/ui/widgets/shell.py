from __future__ import annotations

from textual.widgets import Footer, Header, Static


class VoidHeader(Header):
    """Shared shell header."""


class VoidFooter(Footer):
    """Shared shell footer."""


class StatusPanel(Static):
    """Small status panel for shell state."""

    def update_status(self, status: str) -> None:
        self.update(f"STATUS\n------\n{status}")
