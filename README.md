# VOID

VOID is a local-first desktop app built with Tauri, React, and TypeScript. It
combines focused tools with a quiet old-monitor identity: charcoal surfaces,
ice-white signal, and restrained CRT texture.

## Download

[Download the latest Windows installer](https://github.com/SCamposs/void/releases/latest/download/VOID-Windows-x64-setup.exe)

[View all releases](https://github.com/SCamposs/void/releases)

> **Alpha software:** Windows builds are currently unsigned. Windows may show
> a SmartScreen warning. Verify the adjacent SHA256 checksum before installing,
> and only download VOID from the `SCamposs/void` release page.

## Desktop app (current primary target)

Workspace: `desktop/`

- Install deps: `cd desktop && npm.cmd ci`
- Lint: `cd desktop && npm.cmd run lint`
- Typecheck: `cd desktop && npm.cmd run typecheck`
- Test: `cd desktop && npm.cmd run test`
- Build: `cd desktop && npm.cmd run build`
- Tauri info/dev:
  - `cd desktop && npm.cmd run tauri -- info`
  - `cd desktop && npm.cmd run tauri -- dev`

Note: Tauri native launch requires local Rust toolchain and Windows MSVC/SDK build tools.

## Releases

Pushing a version tag such as `v0.1.1-alpha` validates the desktop app, builds
the Windows NSIS installer, creates a GitHub Release, and uploads the installer
plus its SHA256 checksum using stable filenames. See [RELEASES.md](RELEASES.md)
for the release procedure and troubleshooting.

## Legacy Python/Textual reference

The prior Python/Textual prototype is preserved for reference under:

- `legacy/python-textual-reference/`

Active legacy checks for preserved code:

- `uv run ruff check src tests`
- `uv run pytest`
