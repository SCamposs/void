from __future__ import annotations

import sys

import typer
from rich.console import Console
from rich.table import Table

from void.app import VoidApp
from void.core.registry import list_modules
from void.modules.json_tools.formatter import JsonFormatError, format_json

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

    for module in list_modules():
        if module.id == "home":
            continue
        table.add_row(module.command, module.name, module.description)

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
