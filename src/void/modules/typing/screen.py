from __future__ import annotations

from time import monotonic

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Static, TextArea

from void.modules.typing.engine import (
    TypingStats,
    compute_elapsed_seconds,
    compute_typing_stats,
)
from void.modules.typing.repository import save_typing_session
from void.ui.widgets.shell import VoidFooter, VoidHeader


class TypingScreen(Screen):
    BINDINGS = [
        Binding("ctrl+enter", "finish", "Finish"),
        Binding("r", "reset", "Reset"),
        Binding("s", "stats", "Stats"),
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    TARGET_TEXT = "void is a quiet place to practice terminal craft"

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("Typing Test v0.1", id="typing-title")
        yield Static(
            "Type the target text. [ctrl+enter] finish  [r] reset  [h] home  [q] quit",
            id="typing-hint",
        )
        with Vertical(id="typing-layout"):
            yield Static(self.TARGET_TEXT, id="typing-target", classes="void-panel")
            yield TextArea(id="typing-input")
            yield Static("", id="typing-stats", classes="void-panel")
        yield VoidFooter()

    def on_mount(self) -> None:
        self._started_at: float | None = None
        self._finished = False
        self._saved = False
        self._last_elapsed = 0.0
        self._refresh_timer = self.set_interval(0.2, self._refresh_stats)
        self.action_reset()

    def on_text_area_changed(self, event: TextArea.Changed) -> None:
        if event.text_area.id != "typing-input":
            return
        if self._started_at is None and event.text_area.text:
            self._started_at = monotonic()
        if not self._finished:
            self._refresh_stats()

    def action_finish(self) -> None:
        if self._finished:
            self.notify("Typing test already finished")
            return

        typed = self.query_one("#typing-input", TextArea).text
        if self._started_at is None or not typed.strip():
            self.notify("Type something before finishing", severity="warning")
            return

        if self._started_at is not None:
            self._last_elapsed = compute_elapsed_seconds(self._started_at, monotonic())

        self._finished = True
        self._refresh_stats()
        stats = compute_typing_stats(
            target=self.TARGET_TEXT,
            typed=typed,
            elapsed_seconds=self._last_elapsed,
        )
        if not self._saved:
            save_typing_session(
                target_text=self.TARGET_TEXT,
                typed_text=typed,
                elapsed_seconds=stats.elapsed_seconds,
                correct_characters=stats.correct_characters,
                incorrect_characters=stats.incorrect_characters,
                accuracy=stats.accuracy_percent,
                wpm=stats.wpm,
            )
            self._saved = True
            self.notify("Typing test finished and saved")
        else:
            self.notify("Typing test finished")

    def action_reset(self) -> None:
        self._started_at = None
        self._finished = False
        self._saved = False
        self._last_elapsed = 0.0
        input_box = self.query_one("#typing-input", TextArea)
        input_box.text = ""
        input_box.focus()
        self._refresh_stats()

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def _refresh_stats(self) -> None:
        typed = self.query_one("#typing-input", TextArea).text
        elapsed = self._current_elapsed()
        stats = compute_typing_stats(
            target=self.TARGET_TEXT,
            typed=typed,
            elapsed_seconds=elapsed,
        )
        self.query_one("#typing-stats", Static).update(self._render_stats(stats))

    def action_stats(self) -> None:
        self.app.switch_screen("typing-stats")

    def _current_elapsed(self) -> float:
        if self._finished:
            return self._last_elapsed
        if self._started_at is None:
            return 0.0
        return compute_elapsed_seconds(self._started_at, monotonic())

    @staticmethod
    def _render_stats(stats: TypingStats) -> str:
        return (
            "STATS\n"
            "-----\n"
            f"elapsed: {stats.elapsed_seconds:.2f}s\n"
            f"correct: {stats.correct_characters}\n"
            f"incorrect: {stats.incorrect_characters}\n"
            f"accuracy: {stats.accuracy_percent:.2f}%\n"
            f"wpm: {stats.wpm:.2f}"
        )
