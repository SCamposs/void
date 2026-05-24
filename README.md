# VOID

VOID is a modular, terminal-first Python playground built with Typer + Textual.

## Run

- Start CLI: `uv run void`
- Launch TUI directly: `uv run void-ui`
- List modules: `uv run void modules`
- Format inline JSON: `uv run void json-format '{"b":2,"a":1}'`

## TUI keys

- `j` open JSON Tools
- `a` open Ambient Mode
- `h` return Home
- `q` quit

## Dev checks

- Tests: `uv run pytest`
- Lint: `uv run ruff check .`
