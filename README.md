# VOID

VOID is a local-first desktop app built with Tauri, React, and TypeScript. It
combines focused tools with a quiet old-monitor identity: charcoal surfaces,
ice-white signal, and restrained CRT texture.

## Download and install

- [Download VOID for Windows](https://github.com/SCamposs/void/releases) (`.exe`)
- [Download VOID for Linux](https://github.com/SCamposs/void/releases) (`.deb` or `.AppImage`)

> **Alpha software:** Windows builds are currently unsigned. Windows may show
> a SmartScreen warning. Verify the adjacent SHA256 checksum before installing,
> and only download VOID from the `SCamposs/void` release page.

On Debian, Ubuntu, and derivatives, install the downloaded `.deb` package. On
other x86_64 distributions, make the AppImage executable and run it:

```sh
chmod +x VOID-Linux-x64.AppImage
./VOID-Linux-x64.AppImage
```

## Desktop app

Workspace: `desktop/`

- Install deps: `cd desktop && npm ci`
- Lint: `cd desktop && npm run lint`
- Typecheck: `cd desktop && npm run typecheck`
- Test: `cd desktop && npm run test`
- Build: `cd desktop && npm run build`
- Tauri info/dev:
  - `cd desktop && npm run tauri -- info`
  - `cd desktop && npm run tauri -- dev`

On Windows, `npm.cmd` can be used in place of `npm`. Tauri native launch also
requires the stable Rust toolchain and the platform dependencies documented by
Tauri (Windows MSVC/SDK build tools or Linux WebKitGTK development libraries).

## Releases

Pushing a version tag such as `v0.1.3-alpha` validates the desktop app, builds
the Windows NSIS installer and Linux DEB/AppImage packages, creates a GitHub
Release, and uploads every package plus its SHA256 checksum using stable
filenames. See [RELEASES.md](RELEASES.md) for the release procedure and
troubleshooting.

## Legacy Python/Textual reference

The prior Python/Textual prototype is preserved for reference under:

- `legacy/python-textual-reference/`

Active legacy checks for preserved code:

- `uv run ruff check src tests`
- `uv run pytest`
