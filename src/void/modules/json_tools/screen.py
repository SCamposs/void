from __future__ import annotations

from collections.abc import Callable

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Static, TextArea

from void.modules.json_tools.formatter import (
    JsonFormatError,
    format_json,
    is_valid_json,
    minify_json,
)
from void.ui.widgets.shell import VoidFooter, VoidHeader


class JsonToolsScreen(Screen):
    BINDINGS = [
        Binding("f", "format", "Format"),
        Binding("m", "minify", "Minify"),
        Binding("v", "validate", "Validate"),
        Binding("c", "clear", "Clear"),
        Binding("h", "home", "Home"),
        Binding("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        yield VoidHeader(show_clock=True)
        yield Static("JSON Tools", id="json-title")
        yield Static(
            "[f] format  [m] minify  [v] validate  [c] clear  [h] home  [q] quit",
            id="json-hint",
        )
        with Horizontal(id="json-layout"):
            with Vertical(classes="json-column"):
                yield Static("Input", classes="json-label")
                yield TextArea.code_editor(language="json", id="json-input")
            with Vertical(classes="json-column"):
                yield Static("Output", classes="json-label")
                output = TextArea.code_editor(language="json", id="json-output")
                output.read_only = True
                yield output
        yield VoidFooter()

    def action_format(self) -> None:
        self._transform(format_json, "Formatted")

    def action_minify(self) -> None:
        self._transform(minify_json, "Minified")

    def action_validate(self) -> None:
        raw = self.query_one("#json-input", TextArea).text
        valid, message = is_valid_json(raw)
        output = self.query_one("#json-output", TextArea)
        output.text = "valid" if valid else (message or "invalid")
        self.notify(
            "JSON is valid" if valid else "JSON is invalid",
            severity="information" if valid else "error",
        )

    def action_clear(self) -> None:
        self.query_one("#json-input", TextArea).text = ""
        self.query_one("#json-output", TextArea).text = ""

    def action_home(self) -> None:
        self.app.switch_screen("home")

    def _transform(self, fn: Callable[[str], str], label: str) -> None:
        raw = self.query_one("#json-input", TextArea).text
        output = self.query_one("#json-output", TextArea)
        try:
            output.text = fn(raw)
            self.notify(f"{label} JSON")
        except JsonFormatError as exc:
            output.text = str(exc)
            self.notify(str(exc), severity="error")
