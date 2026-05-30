# VOID

VOID is migrating to a desktop-first app using Tauri + React + TypeScript.

## Desktop app (current primary target)

Workspace: `desktop/`

- Install deps: `cd desktop && npm.cmd install`
- Lint: `cd desktop && npm.cmd run lint`
- Typecheck: `cd desktop && npm.cmd run typecheck`
- Test: `cd desktop && npm.cmd run test`
- Build: `cd desktop && npm.cmd run build`
- Tauri info/dev:
  - `cd desktop && npm.cmd run tauri -- info`
  - `cd desktop && npm.cmd run tauri -- dev`

Note: Tauri native launch requires local Rust toolchain and Windows MSVC/SDK build tools.

## Legacy Python/Textual reference

The prior Python/Textual prototype is preserved for reference under:

- `legacy/python-textual-reference/`

Active legacy checks for preserved code:

- `uv run ruff check src tests`
- `uv run pytest`
