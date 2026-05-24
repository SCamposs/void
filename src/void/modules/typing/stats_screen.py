from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import DataTable, Static

from void.modules.typing.repository import get_typing_summary, list_typing_sessions
from void.modules.typing.stats_view import build_wpm_sparkline, format_summary_block
from void.ui.widgets.shell import VoidFooter, VoidHeader


class TypingStatsScreen(Screen):
    BINDINGS = [
        Binding("h", "home", "Home"),
        Binding("t", "typing", "Typing"),
        Binding("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("Typing Stats", id="typing-stats-title")
        yield Static("[h] home  [t] typing test  [q] quit", id="typing-stats-hint")
        with Horizontal(id="typing-stats-layout"):
            with Vertical(classes="typing-stats-col"):
                yield Static("", id="typing-stats-summary", classes="void-panel")
                yield Static("", id="typing-stats-sparkline", classes="void-panel")
            with Vertical(classes="typing-stats-col"):
                yield DataTable(id="typing-stats-table")
        yield VoidFooter()

    def on_mount(self) -> None:
        self._load_dashboard()

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def action_typing(self) -> None:
        self.app.switch_screen("typing")

    def _load_dashboard(self) -> None:
        summary = get_typing_summary()
        sessions = list_typing_sessions(limit=12)

        self.query_one("#typing-stats-summary", Static).update(
            format_summary_block(summary)
        )

        if sessions:
            sparkline = build_wpm_sparkline([item.wpm for item in reversed(sessions)])
            self.query_one("#typing-stats-sparkline", Static).update(
                "WPM TREND\n---------\n" + sparkline
            )
        else:
            self.query_one("#typing-stats-sparkline", Static).update(
                "WPM TREND\n---------\nno sessions yet"
            )

        table = self.query_one("#typing-stats-table", DataTable)
        table.clear(columns=True)
        table.cursor_type = "row"
        table.add_columns("When", "WPM", "Accuracy", "Correct", "Incorrect", "Elapsed")

        if not sessions:
            table.add_row("No sessions yet", "-", "-", "-", "-", "-")
            return

        for item in sessions:
            table.add_row(
                item.created_at.strftime("%Y-%m-%d %H:%M"),
                f"{item.wpm:.2f}",
                f"{item.accuracy:.2f}%",
                str(item.correct_characters),
                str(item.incorrect_characters),
                f"{item.elapsed_seconds:.2f}s",
            )
