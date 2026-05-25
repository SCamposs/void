from __future__ import annotations

import sys

import typer
from rich.console import Console
from rich.table import Table

from void.app import VoidApp
from void.core.modules import list_shell_modules
from void.core.registry import list_modules
from void.db.session import init_db
from void.modules.json_tools.formatter import JsonFormatError, format_json
from void.modules.typing.repository import get_typing_summary, list_typing_sessions

app = typer.Typer(
    help="VOID terminal-first playground",
    invoke_without_command=True,
    no_args_is_help=False,
)
console = Console()


@app.callback()
def main(ctx: typer.Context) -> None:
    """Launch TUI when no subcommand is provided."""
    if ctx.invoked_subcommand is None:
        VoidApp().run()


@app.command("ui")
def ui() -> None:
    """Launch VOID Textual interface."""
    VoidApp().run()


@app.command("modules")
def modules() -> None:
    """List available VOID modules."""
    table = Table(title="VOID Modules")
    table.add_column("Key", style="bold")
    table.add_column("Name")
    table.add_column("Description")

    legacy_by_id = {module.id: module for module in list_modules()}
    for module in list_shell_modules():
        legacy = legacy_by_id.get(module.screen_id)
        description = legacy.description if legacy is not None else "Core module"
        table.add_row(module.command, module.label.replace("_", " "), description)

    console.print(table)


@app.command("typing-history")
def typing_history(limit: int = 10) -> None:
    """Show recent typing sessions."""
    init_db()
    sessions = list_typing_sessions(limit=limit)
    table = Table(title="Typing Sessions")
    table.add_column("When")
    table.add_column("WPM", justify="right")
    table.add_column("Accuracy", justify="right")
    table.add_column("Words", justify="right")
    table.add_column("Chars", justify="right")
    table.add_column("Mode")
    table.add_column("Elapsed", justify="right")

    for item in sessions:
        table.add_row(
            item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            f"{item.wpm:.2f}",
            f"{item.accuracy:.2f}%",
            f"{item.correct_words}/{item.incorrect_words}",
            f"{item.correct_characters}/{item.incorrect_characters}",
            item.mode,
            f"{item.elapsed_seconds:.2f}s",
        )

    console.print(table)


@app.command("typing-summary")
def typing_summary() -> None:
    """Show aggregate typing statistics."""
    init_db()
    summary = get_typing_summary()
    table = Table(title="Typing Summary")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    table.add_row("Total sessions", str(summary.total_sessions))
    table.add_row("Best WPM", f"{summary.best_wpm:.2f}")
    table.add_row("Average WPM", f"{summary.average_wpm:.2f}")
    table.add_row("Average Accuracy", f"{summary.average_accuracy:.2f}%")
    console.print(table)


@app.command("json-format")
def json_format(text: str) -> None:
    """Format inline JSON text."""
    try:
        console.print(format_json(text))
    except JsonFormatError as exc:
        raise typer.BadParameter(str(exc)) from exc


def ui_main() -> None:
    """Script entry for uv run void-ui."""
    VoidApp().run()


def json_format_main() -> None:
    """Script entry for uv run json-format."""
    if len(sys.argv) != 2:
        raise typer.BadParameter("Usage: uv run json-format '<json>'")
    json_format(sys.argv[1])
