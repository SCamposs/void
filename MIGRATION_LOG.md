# Migration Progress Log

## Checkpoint 1: Scope + Preservation
- Read `VOID_GOAL.md` fully and used it as migration source of truth.
- Preserved the Python/Textual prototype under `legacy/python-textual-reference/`.
- Kept the active Python project intact and testable.

## Checkpoint 2: Desktop Foundation
- Created `desktop/` with Tauri v2 + React + TypeScript + Vite + Tailwind + Zustand.
- Added Tauri host config (`src-tauri/`) and Vite/Tailwind/TypeScript toolchain.
- Built app shell with top bar, left nav, center workspace, right inspector, bottom strip.

## Checkpoint 3: Product Modules
- Typing module implemented with 60-second PT-BR word flow:
  - timer starts on first input, space submits word, no enter required, auto-stop at zero.
  - positional scoring and final 60s WPM formula.
  - local session persistence with summary and recent sessions.
- Orbit rebuilt as graphical canvas module with mode switching, pause/resume, reset, density.
- Stacker implemented as playable 10x20 block stacker:
  - movement, rotation, soft drop, hard drop, hold, next queue, line clear, score, timer, pause/restart, mode toggle.

## Checkpoint 4: Visual Identity + Settings
- Applied old-black + ice-white palette.
- Added CRT system: scanlines, light noise, subtle flicker, soft white glow.
- Added settings controls: scanlines, noise, glow, flicker, dense mode, accent intensity, font scale.
- Added graphical command palette (Ctrl+K + clickable actions).

## Checkpoint 5: Boot / Intro SVG
- Re-read updated `VOID_GOAL.md` and implemented SVG intro concept:
  - centered ice-white logo path on old-black background
  - line-draw reveal then fill animation
  - intro scanline/noise overlay
  - skip button and short auto-dismiss for usability
  - future-friendly component slot for replacing logo animation later
- Files:
  - `desktop/src/app/components/intro/BootIntro.tsx`
  - `desktop/src/app/styles/index.css`
  - `desktop/src/app/App.tsx`

## Checkpoint 6: Tauri Launch Unblock
- Found Rust installed but not resolved in initial shell PATH.
- Confirmed Rust binaries in `C:\Users\zuado\.cargo\bin`.
- Generated required Tauri icons from VOID SVG (`src-tauri/icons/icon.ico` and full icon set).
- Cleared stale locked process and re-ran Tauri dev successfully.

## Final Validation Evidence
- Desktop:
  - `npm.cmd run lint` ?
  - `npm.cmd run typecheck` ?
  - `npm.cmd run test` ?
  - `npm.cmd run build` ?
  - `npm.cmd run tauri -- dev` ? (build finished and ran `target\debug\void-desktop.exe`)
- Python legacy (preserved reference code):
  - `uv run ruff check src tests` ?
  - `uv run pytest` ? (65 passed)

## Notes
- Root README updated to reflect desktop-first status and legacy location.
- Legacy prototype remains preserved and testable as reference.
