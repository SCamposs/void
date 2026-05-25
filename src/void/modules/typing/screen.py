from __future__ import annotations

from time import monotonic

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.events import Key
from textual.screen import Screen
from textual.widgets import Input, Static

from void.modules.typing.engine import (
    WordFlowStats,
    compute_elapsed_seconds,
    compute_should_start_timer,
    compute_word_flow_stats,
    generate_word_sequence,
)
from void.modules.typing.repository import save_typing_session
from void.modules.typing.words import PT_BR_WORDS
from void.ui.widgets.shell import VoidFooter, VoidHeader


class TypingScreen(Screen):
    BINDINGS = [
        Binding("ctrl+enter", "finish", "Finish"),
        Binding("r", "reset", "Reset"),
        Binding("s", "stats", "Stats"),
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    DURATION_SECONDS = 60.0
    WORD_COUNT = 240

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("Typing Test // PT-BR // 60 seconds", id="typing-title")
        yield Static(
            "space submit  [ctrl+enter] finish  [r] reset  [s] stats  [h] home  [q] quit",
            id="typing-hint",
        )
        with Vertical(id="typing-layout"):
            yield Static("", id="typing-timer", classes="void-panel")
            yield Static("", id="typing-word-line", classes="void-panel")
            yield Input(placeholder="digite a palavra atual", id="typing-input")
            yield Static("", id="typing-stats", classes="void-panel")
            yield Static("", id="typing-final", classes="void-panel")
        yield VoidFooter()

    def on_mount(self) -> None:
        self._started_at: float | None = None
        self._finished = False
        self._saved = False
        self._last_elapsed = 0.0
        self._target_words: list[str] = []
        self._submitted_words: list[str] = []
        self._refresh_timer = self.set_interval(0.1, self._tick)
        self.action_reset()

    def on_key(self, event: Key) -> None:
        if event.key != "space":
            return
        if self.focused is not self.query_one("#typing-input", Input):
            return
        event.prevent_default()
        self._submit_current_word()

    def on_input_changed(self, event: Input.Changed) -> None:
        if event.input.id != "typing-input":
            return
        if self._finished:
            return
        if compute_should_start_timer(
            started_at=self._started_at, current_input=event.value
        ):
            self._started_at = monotonic()
        self._refresh_panels()

    def action_finish(self) -> None:
        if self._finished:
            self.notify("typing test already finished")
            return
        self._finalize(save=True)

    def action_reset(self) -> None:
        self._started_at = None
        self._finished = False
        self._saved = False
        self._last_elapsed = 0.0
        self._target_words = generate_word_sequence(PT_BR_WORDS, count=self.WORD_COUNT)
        self._submitted_words = []
        input_box = self.query_one("#typing-input", Input)
        input_box.value = ""
        input_box.disabled = False
        input_box.focus()
        self.query_one("#typing-final", Static).update("")
        self._refresh_panels()

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def action_stats(self) -> None:
        self.app.switch_screen("typing-stats")

    def _tick(self) -> None:
        if self._finished:
            return
        if self._started_at is None:
            self._refresh_panels()
            return

        elapsed = compute_elapsed_seconds(self._started_at, monotonic())
        if elapsed >= self.DURATION_SECONDS:
            self._finalize(save=True)
            return
        self._refresh_panels()

    def _submit_current_word(self) -> None:
        if self._finished:
            return

        input_box = self.query_one("#typing-input", Input)
        typed_word = input_box.value.strip()
        if self._started_at is None and typed_word != "":
            self._started_at = monotonic()

        # Empty submission advances and counts as incorrect for the expected word.
        self._submitted_words.append(typed_word)
        input_box.value = ""
        self._refresh_panels()

    def _finalize(self, *, save: bool) -> None:
        if self._started_at is not None:
            self._last_elapsed = compute_elapsed_seconds(self._started_at, monotonic())
        else:
            self._last_elapsed = 0.0

        if self._last_elapsed > self.DURATION_SECONDS:
            self._last_elapsed = self.DURATION_SECONDS

        self._finished = True
        input_box = self.query_one("#typing-input", Input)
        input_box.disabled = True
        self._refresh_panels()
        stats = self._stats()

        if save and not self._saved:
            save_typing_session(
                target_text=" ".join(self._target_words),
                typed_text=" ".join(self._submitted_words),
                elapsed_seconds=stats.elapsed_seconds,
                correct_characters=stats.correct_characters,
                incorrect_characters=stats.incorrect_characters,
                accuracy=stats.accuracy_percent,
                wpm=stats.wpm,
                correct_words=stats.correct_words,
                incorrect_words=stats.incorrect_words,
                duration_seconds=self.DURATION_SECONDS,
                language="pt-BR",
                mode="word-flow-60s",
            )
            self._saved = True

        self.query_one("#typing-final", Static).update(
            "FINAL RESULT\n"
            "------------\n"
            f"wpm: {stats.wpm:.2f}\n"
            f"accuracy: {stats.accuracy_percent:.2f}%\n"
            f"correct words: {stats.correct_words}\n"
            f"incorrect words: {stats.incorrect_words}"
        )
        self.notify("typing test finished")

    def _elapsed(self) -> float:
        if self._finished:
            return self._last_elapsed
        if self._started_at is None:
            return 0.0
        return compute_elapsed_seconds(self._started_at, monotonic())

    def _stats(self) -> WordFlowStats:
        return compute_word_flow_stats(
            target_words=self._target_words,
            submitted_words=self._submitted_words,
            elapsed_seconds=self._elapsed(),
            duration_seconds=self.DURATION_SECONDS,
        )

    def _refresh_panels(self) -> None:
        stats = self._stats()
        self.query_one("#typing-timer", Static).update(
            "TIMER\n"
            "-----\n"
            f"remaining: {stats.remaining_seconds:.1f}s\n"
            f"elapsed: {stats.elapsed_seconds:.1f}s\n"
            f"wpm: {stats.wpm:.2f}\n"
            f"accuracy: {stats.accuracy_percent:.2f}%"
        )
        self.query_one("#typing-word-line", Static).update(self._render_word_line())
        self.query_one("#typing-stats", Static).update(self._render_stats(stats))

    def _render_word_line(self) -> str:
        current_index = len(self._submitted_words)
        previous_start = max(0, current_index - 8)
        previous = []
        for index in range(previous_start, current_index):
            expected = (
                self._target_words[index] if index < len(self._target_words) else ""
            )
            typed = self._submitted_words[index]
            marker = "ok" if typed == expected else "xx"
            view = typed if typed != "" else "_"
            previous.append(f"{view}({marker})")

        current_word = (
            self._target_words[current_index]
            if current_index < len(self._target_words)
            else "-"
        )
        upcoming = self._target_words[current_index + 1 : current_index + 10]

        current_input = self.query_one("#typing-input", Input).value
        typed_preview = self._render_current_input_preview(current_word, current_input)

        return (
            "WORDS\n"
            "-----\n"
            f"prev: {' '.join(previous) if previous else '-'}\n"
            f"now : [{current_word}]\n"
            f"type: {typed_preview}\n"
            f"next: {' '.join(upcoming) if upcoming else '-'}"
        )

    @staticmethod
    def _render_current_input_preview(expected: str, typed: str) -> str:
        if typed == "":
            return "-"
        return typed

    @staticmethod
    def _render_stats(stats: WordFlowStats) -> str:
        return (
            "STATS\n"
            "-----\n"
            f"correct words: {stats.correct_words}\n"
            f"incorrect words: {stats.incorrect_words}\n"
            f"correct chars: {stats.correct_characters}\n"
            f"incorrect chars: {stats.incorrect_characters}\n"
            f"accuracy: {stats.accuracy_percent:.2f}%\n"
            f"wpm: {stats.wpm:.2f}\n"
            f"finished: {'yes' if stats.is_finished else 'no'}"
        )
