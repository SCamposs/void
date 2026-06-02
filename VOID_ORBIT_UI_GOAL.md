# VOID Goal — Audio Reactive Orbit + UI Focus Pass

You are working on VOID.

Current state:
- VOID has migrated to a desktop-first Tauri + React + TypeScript app.
- The old Python/Textual prototype is preserved as legacy/reference.
- The primary desktop app lives under `desktop/`.
- Current modules include:
  - Shell/Home
  - Typing Test
  - Orbit
  - Stacker
- The app already has old-black + ice-white visual direction, CRT scanlines/noise/glow, boot intro, and clickable desktop UI.
- Stacker is already playable enough for now.
- Typing Test is already functional enough for now.

## Objective

Perform a focused interface and visual identity pass.

Main goals:

1. Completely rethink Orbit as a living audio-reactive orb.
2. Simplify Stacker UI so the game board is the focus.
3. Improve global app UI density and layout so modules feel app-like, not overloaded.
4. Preserve VOID’s old-black + ice-white CRT desktop identity.

This is NOT a full product rewrite.
This is NOT a new stack migration.
Do not replace the current Tauri/React architecture.

## Visual direction

VOID should stay:

- old-black / charcoal
- ice-white / grayscale glow
- subtle CRT scanlines
- subtle noise
- subtle flicker
- modern desktop app usability
- not green
- not colorful cyberpunk
- not a terminal emulator
- not a raw command-line UI

Orbit reference direction:
- a glowing orb like a conversational AI presence
- abstract circular energy form
- white / ice-white / gray variations
- soft bloom/glow
- organic motion
- reactive to sound
- clean and modern
- not blue by default
- not colorful
- not a literal planet
- not a telemetry-heavy scanner

The user provided an image reference: a glowing blue circular orb on black background. Use it only as conceptual direction for shape/motion/energy. Adapt it to VOID’s grayscale/ice-white identity.

## Important no-copy rule

Do not copy any external product’s assets, sounds, UI, branding, or trade dress.

Do not use names of external games/apps/products in:
- source code
- UI labels
- comments
- tests
- docs
- variable names
- commit messages

For the block-stacking game, use neutral terms only:
- Stacker
- board
- queue
- hold
- sprint
- controls
- tuning
- settings
- replay
- stats

## Part 1 — Rebuild Orbit as audio-reactive orb

The current Orbit implementation can be removed or replaced if necessary.

New Orbit should be a graphical module, not terminal-like output.

### Core behavior

Build an audio-reactive orb module with:

- central orb/circle
- animated glowing edges
- organic waveform deformation
- subtle internal energy/noise
- white/ice-white/gray glow palette
- black/charcoal background
- responsive to audio amplitude/frequency
- smooth idle animation when no audio input is available
- microphone input as primary audio source
- optional system/audio source detection only if practical and safe
- graceful fallback if microphone permission is denied

### Audio behavior

Use browser/WebView audio APIs where practical:

- request microphone permission from user
- use AudioContext + AnalyserNode
- derive:
  - volume/amplitude
  - bass/mid/high energy if feasible
  - smoothed intensity
- orb should react smoothly, not jitter aggressively

Required audio states:

- idle: no audio connected; orb gently breathes
- listening: mic active; orb reacts to voice/sound
- denied/unavailable: show clean fallback and keep idle animation
- muted/frozen: if implemented, orb pauses audio reaction

### Controls

Add simple controls in the Orbit module:

- Enable microphone / Start listening
- Stop listening
- sensitivity slider
- smoothing slider
- intensity slider
- idle/reactive mode indicator
- optional reset visuals button

Keep controls visually minimal. They should not dominate the orb.

### Visual implementation

Use one of:
- Canvas 2D
- SVG
- React/CSS
- lightweight procedural rendering

Prefer Canvas if it helps organic motion.

The orb should be large, centered, and visually iconic.
It should feel like the visual core/presence of VOID.

Avoid:
- tiny render
- cramped telemetry layout
- excessive charts
- too many panels
- green/cyan scanner style
- terminal/ASCII-only look

### Orbit layout

The Orbit screen should feel like:

- one large central visual area
- minimal right/side controls
- small status readout
- optional collapsed advanced controls

Telemetry should be reduced. Keep only useful state:
- audio source status
- sensitivity/intensity
- mode
- permission status

Do not show large fake telemetry blocks by default.

## Part 2 — Stacker UI cleanup

The Stacker game itself is already good enough for now.
Do not spend this pass rewriting gameplay unless required to fix UI issues.

The current problem:
- too much telemetry/info is visible at once
- side panels are overloaded
- vertical layout can overflow/scroll
- holding down soft drop can cause the screen/page to scroll
- the board loses focus
- tuning/settings are always visible even though they are not needed during play

### Stacker UX goal

Make Stacker feel focused and playable.

The game board should be the visual center.

Default visible info should be only what the player needs while playing.

### Required default visible UI

Keep visible:
- game board
- hold box
- next queue
- score
- lines
- timer
- mode
- pause/restart/start controls
- minimal current status
- maybe level/speed if already relevant

Hide or move behind popovers/panels:
- Input tuning
- ARR/DAS/DCD/SDF/lock/reset settings
- seed/opener controls
- clear FX/shake/particles
- ghost opacity
- volume
- hear next
- recent locks
- detailed clear chain
- run archive
- advanced stats

### Settings UX

Create a settings button/icon for Stacker.

Settings should open as:
- popover
- drawer
- modal
- collapsible panel

It should include advanced tuning/settings.

Do not show advanced tuning permanently on the main gameplay screen.

### Layout requirements

- Center the board.
- Keep hold and queue close to the board.
- Prevent page/body scroll during gameplay.
- The app should not scroll vertically when the user holds soft drop/down.
- Use fixed-height module container or internal layout containment.
- Game controls should capture arrow keys/space without moving the page.
- Left sidebar should be collapsible globally or at least not interfere with Stacker focus.
- If sidebar collapse already exists, improve it.
- If not, add a simple collapse/expand control.

### Stacker polish

Do not rewrite core gameplay.
Only adjust UI/UX.

Allowed improvements:
- stronger board focus
- cleaner spacing
- less telemetry
- better settings organization
- better keyboard capture
- less visual clutter
- better pause/restart visibility

Avoid:
- adding more permanent info panels
- adding more visible telemetry
- copying external UI
- colorful default palette

## Part 3 — Global app UI improvements

Apply general interface cleanup across the app:

- reduce unnecessary always-visible telemetry
- keep only useful data visible
- prefer progressive disclosure:
  - popovers
  - drawers
  - collapsible sections
  - settings buttons
- avoid vertical overflow in modules
- make module screens fit the desktop window better
- improve spacing and hierarchy
- keep the app clean, clickable, and modern
- preserve the CRT/scanline aesthetic but do not make it noisy or hard to read

### Sidebar

Add or improve sidebar collapse.

Requirements:
- sidebar can collapse to icon/short label mode
- content area expands when collapsed
- state can be stored in local settings if easy
- should work especially well for Stacker and Orbit

### Settings

Global theme/settings can remain, but should not dominate.
If visible controls are cluttering the app, move them behind a settings panel.

## Part 4 — Validation

Run:

From `desktop/`:
- npm run lint
- npm run typecheck
- npm run test
- npm run build
- npm run tauri -- dev if local tooling is available

Legacy Python, if still active/testable:
- uv run ruff check src tests
- uv run pytest

If Tauri dev launches successfully, document it.

## Definition of done

Stop when:

1. Orbit has been rebuilt as a large audio-reactive orb module.
2. Orbit uses VOID’s grayscale/ice-white glow identity.
3. Orbit supports microphone input or a graceful fallback if unavailable.
4. Orbit has idle animation and reactive animation.
5. Orbit no longer feels like a cramped scanner/terminal panel.
6. Stacker main UI is simplified and board-focused.
7. Stacker advanced telemetry/settings are moved behind a settings popover/drawer/modal.
8. Holding soft drop/down no longer scrolls the app/page.
9. Sidebar can collapse or is improved to reduce distraction.
10. Global UI feels cleaner and more app-like.
11. Tests/lint/typecheck/build are run and results are documented.
12. No external product/game names are introduced into code/UI/docs/tests.

## Working style

- Work in checkpoints.
- Prefer clean, focused changes over broad rewrites.
- Keep current Tauri/React architecture.
- Do not ask for confirmation unless blocked by missing tooling or permissions.
- If microphone access cannot be fully validated in automated environment, implement it with graceful fallback and document manual validation steps.
- Do not leave repository broken.