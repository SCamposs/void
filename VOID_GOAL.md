# VOID Goal — Desktop App Migration

You are working on VOID.

## Objective

Transform VOID from the current Python/Textual TUI prototype into a real desktop app with a graphical UI.

The final target is not a terminal app. It must feel like a real desktop application, closer in interaction model to modern desktop tools such as code assistants, chat apps, launchers, and dev tools, but with an original retro-terminal/CRT-inspired visual identity.

The app should be clickable, graphical, animated, and polished. It should NOT feel like it is running inside a terminal.

## Target stack

Migrate the product UI to:

- Tauri v2
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand or small React state where useful
- Local-first storage
- SQLite if practical through Tauri/plugin or a simple local persistence approach

If the current Python/Textual code remains useful, preserve it under a legacy or reference folder. Do not delete working logic unless it has been ported or is clearly obsolete.

The current Textual app should no longer be treated as the final product UI.

## Visual direction

VOID should use:

- old black / charcoal background
- ice-white text
- muted gray / warm white secondary text
- subtle off-white borders
- no green as primary color
- no cyberpunk neon palette
- no colorful dashboard aesthetic
- clean but dense desktop UI
- subtle CRT/old monitor effects:
  - scanlines
  - very light grain/noise
  - subtle flicker
  - optional phosphor-like glow, but white/ice, not green
- sharp panels
- no excessive rounded corners
- no shadows unless extremely subtle
- modern app usability with retro-terminal skin

Palette direction:

- background: #0b0b0a
- surface: #11110f
- surface2: #171713
- border: #2a2a25
- text: #e8e4da
- muted: #9c988f
- subtle: #5f5b54
- accent: #f2efe5

Create a theme system with light customization, but always inside this identity:

- scanlines on/off
- noise amount
- glow amount
- compact/dense mode
- accent intensity
- font scale

Do not introduce green as the default theme.

## Boot / intro SVG

Add an intro/boot screen using the following SVG concept as the basis for the temporary VOID logo animation.

The SVG can be adapted to fit the app style, but preserve the idea:

- ice-white stroke/fill
- line-draw reveal animation
- then fill-in
- centered on old-black background
- subtle CRT scanlines/noise overlay
- clean and minimal
- not green
- should feel like a modern desktop app intro with retro monitor texture

Base SVG concept:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .draw-reveal {
      fill: transparent;
      stroke: #FFFFFF;
      stroke-width: 1;
      stroke-linejoin: round;
      stroke-dasharray: 500;
      stroke-dashoffset: 500;
      animation:
        trace 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards,
        fillShape 0.8s 2.5s ease-out forwards;
    }

    @keyframes trace {
      to {
        stroke-dashoffset: 0;
      }
    }

    @keyframes fillShape {
      to {
        fill: #FFFFFF;
        stroke-width: 0;
      }
    }
  </style>
  <path class="draw-reveal" d="M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z" />
</svg>
```

Implementation guidance:

Prefer moving the animation into React/CSS instead of inline SVG style if cleaner.
The intro should be skippable or short enough not to annoy the user.
Keep a future-friendly slot for replacing this SVG with a more refined animated logo later.

## Product scope

The primary VOID app should contain only:

1. Shell / Home
2. Typing Test
3. Orbit
4. Stacker

Do not keep JSON Tools or Ambient as primary modules. They can remain as legacy/reference code if needed, but they should not appear in the final desktop navigation.

## App shell

Build a real desktop app shell:

- custom top bar/header
- left sidebar navigation
- central workspace
- right inspector/status panel or collapsible info panel
- bottom status strip
- command palette or command input, but graphical and app-like, not a raw terminal
- clickable navigation
- keyboard shortcuts as enhancement, not the only way to use the app
- smooth entrance animation
- placeholder boot/intro animation for now
- keep a slot for a future animated SVG logo intro

The user should be able to:

- click modules
- start a typing test
- open Orbit
- open Stacker
- change simple theme settings
- navigate without relying only on keyboard commands

## Typing Test requirements

Create a polished 60-second PT-BR word-flow typing test.

Behavior:

1. Duration is exactly 60 seconds.
2. Timer starts only on the first typed character.
3. Test ends automatically when timer reaches zero.
4. User should not need Enter to finish.
5. Space submits the current word and advances.
6. Backspace edits the current word normally.
7. The word list must be effectively impossible to complete in 60 seconds.
8. Use a large local PT-BR common word pool.
9. Generate a long random/repeated/shuffled sequence.
10. Do not use fixed phrases.
11. When time ends:
    - lock input
    - show final results
    - save result once
12. Reset creates a new run.

Scoring:

- A word is correct only if typed exactly equal to expected.
- Character scoring is positional.
- Correct position = correct char.
- Wrong char at position = incorrect char.
- Extra typed chars = incorrect.
- Missing expected chars = incorrect.

Examples:

expected: casa
typed: casas
correct chars: 4
incorrect chars: 1

expected: casa
typed: cas
correct chars: 3
incorrect chars: 1

expected: casa
typed: caza
correct chars: 3
incorrect chars: 1

WPM:

- live WPM = (correctChars / 5) / elapsedMinutes
- final 60s WPM = correctChars / 5

Accuracy:

- accuracy = correctChars / (correctChars + incorrectChars) \* 100
- avoid division by zero

UI:

- display previous/current/upcoming words
- current word visually distinct
- submitted words marked correct/incorrect
- optional per-character feedback if clean
- big timer
- live WPM
- live accuracy
- final result panel
- local history/stats:
  - best WPM
  - average WPM
  - average accuracy
  - recent sessions

Persist:

- date/time
- WPM
- accuracy
- correct words
- incorrect words
- correct chars
- incorrect chars
- duration seconds
- language: pt-BR
- mode: word-flow-60s

## Orbit requirements

Rebuild Orbit as a graphical module, not a terminal panel.

It can use:

- Canvas
- SVG
- CSS animation
- React animation
- lightweight procedural rendering

Orbit should feel like an original technical scanner/instrument:

- monochrome / ice-white on black
- rotating globe/sphere/orbital scanner
- scanlines overlay
- telemetry panel
- signal readout
- grid overlays
- mode switching:
  - globe
  - scanner
  - field
- pause/resume
- reset
- detail/density setting if practical

It should not look cramped or like ASCII trapped inside a terminal. ASCII can be used as an aesthetic element, but the module should feel graphical and native to the desktop app.

## Stacker requirements

Implement an original block-stacking game module inspired by modern competitive stacker responsiveness and polish, without copying external assets, sounds, names, UI, branding, or trade dress.

Use neutral naming:

- Stacker
- board
- piece
- queue
- hold
- sprint
- matrix
- finesse
- clear
- combo
- garbage only if needed later

Do not include external product/game names in code, UI, comments, docs, tests, or assets.

Minimum playable version:

- 10x20 board
- falling tetromino-like pieces
- left/right movement
- rotation
- soft drop
- hard drop
- hold
- next queue
- line clears
- score
- timer
- restart
- pause
- game over
- local sprint mode or endless mode
- responsive keyboard controls
- clickable start/restart/settings
- clean visual polish

Visual/audio polish:

- original sounds only, generated or simple synthesized if possible
- no copyrighted sounds
- no copied assets
- subtle hit/drop/clear feedback
- screen shake or flash on line clear, but restrained
- smooth piece movement if feasible
- block design consistent with VOID palette
- no bright rainbow colors by default
- optional muted monochrome piece differentiation

If audio is too much for one pass, create the audio system with original placeholder tones and keep it easy to expand.

## No external imitation rule

Do not copy or reproduce external brand names, assets, sound effects, UI layouts, logos, text, or trade dress.

Avoid writing external game/product names anywhere in:

- source code
- comments
- tests
- README
- UI labels
- variable names
- commit messages

The app should be original and VOID-branded.

## Architecture

Use a scalable structure, for example:

src/
app/
App.tsx
shell/
modules/
typing/
orbit/
stacker/
settings/
components/
styles/
lib/
store/
types/

src-tauri/
...

Prioritize:

- clean module boundaries
- reusable shell layout
- reusable panel/card/components
- pure logic for Typing and Stacker engines
- tests for scoring/game logic
- no huge single-file components
- no overcomplicated abstractions

## Data/persistence

Implement local persistence for:

- typing sessions
- settings/theme preferences
- optionally stacker local scores

Use a simple local-first storage approach. Prefer SQLite if practical in Tauri. If SQLite setup becomes too risky in this run, use local storage or a JSON-backed local store temporarily, but isolate it behind a persistence layer so SQLite can replace it cleanly.

## Migration from current code

Read the existing Python/Textual implementation before replacing it.

Port or preserve:

- Typing rules/scoring
- PT-BR word pool
- typing stats model
- Orbit concept/telemetry ideas
- module focus: Shell, Typing, Orbit, Stacker

Do not blindly delete the old implementation. If replacing it, move it under a legacy/reference directory or leave it untouched while creating the new app.

## Validation

Codex should work iteratively and validate after checkpoints.

Run appropriate commands, depending on the final stack:

- install dependencies
- typecheck
- lint
- test
- build
- run Tauri/dev smoke check if possible

Expected likely commands:

- npm install or pnpm install
- npm run lint
- npm run typecheck
- npm run test
- npm run build
- npm run tauri dev or equivalent, if possible

If package manager differs, choose one and document it.

Also keep existing Python tests passing if the legacy Python code remains active and testable:

- uv run pytest
- uv run ruff check src tests

## Definition of done

Stop when:

1. A Tauri + React + TypeScript desktop app exists and can be launched.
2. The UI is graphical, clickable, and app-like.
3. The default visual identity is old-black + ice-white, not green.
4. CRT/scanline/noise visual system exists.
5. The app has Shell, Typing, Orbit, and Stacker modules.
6. Typing Test is playable and follows the 60-second PT-BR word-flow rules.
7. Orbit is graphical and not cramped like terminal output.
8. Stacker is playable at a basic but polished level.
9. Theme/settings customization exists at least lightly.
10. External brand/product names are not used in code/UI/docs.
11. The app builds successfully or the remaining blockers are clearly documented.
12. Tests/lint/typecheck/build are run and results are reported.

## Working style

- Work in checkpoints.
- Keep a short progress log.
- Prefer finishing a working vertical slice over adding unfinished abstractions.
- If something is blocked, implement the closest clean fallback and document it.
- Do not ask for confirmation unless truly blocked by missing local tooling.
- Do not leave the repository in a broken state.

```

```
