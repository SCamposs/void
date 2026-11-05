# Stacker refinement using TETR.IO as a reference

Date: 2026-11-05. Scope: improve VOID's local solo Stacker, with its own code and VOID presentation. This is not a claim of TETR.IO engine equivalence.

## Target and method

The supplied `../targets/TETR.IO Setup.exe` is a 92,041,512-byte NSIS installer for TETR.IO Desktop 10.0.0. Its SHA-256 is `aebd453c53ec3edaf1eb3942206199ae1e1c00284d458ba8a00010bdb67975c0`.

7-Zip extracted the NSIS payload and embedded `app-64.7z`, followed by an inert ASAR extraction. The installer was not executed. Extracted third-party files, downloaded reference resources, REA output and validation screenshots remain outside this repository under `../targets/tetrio-inspection/`.

REA 6.8.0 was run through its documented static JavaScript CLI:

```text
npx --yes rea-agents@6.8.0 analyze-javascript-application C:/Users/zuado/code/pessoal/void/targets/tetrio-inspection/asar --json
```

Evidence ID: `ev_199a76c6c811a4b9799a2528ff2976256bb196006390d00fc68c670f975f48cb`. Reported inventory: 654 relevant files, 425 parsed JavaScript files, zero parse failures. Raw evidence: `../targets/tetrio-inspection/rea-evidence.json`. The host Node 22.18.0 is below the package's declared supported versions; analysis completed, but this is a tooling limitation to retain when reproducing it. No agent configuration or system Node installation was changed.

## What the evidence establishes

- Extracted `package.json` identifies `tetrio-desktop` version `10.0.0` with `main.js` as its entry point.
- `config.json` targets `https://tetr.io/`. `main.js` creates an Electron BrowserWindow, loads a local loader and installs navigation handlers. The supplied package is the desktop wrapper, not a self-contained offline game engine.
- Public reference HTML and CSS were retrieved from `https://tetr.io/` on this date. The page version token was `68d5c11f9.f2133e6cf8b3.20261023T150006`.
- The public UI describes DAS as an initial repeat delay, ARR as a movement repeat interval, and SDF as a gravity multiplier. It offers SRS+ as a default rotation option and describes symmetric I rotation. These labels do not reveal exact kick tables, runtime timings or all rule interactions.
- The live entry screen requires joining with terms acceptance. No join/account creation was performed. No live gameplay timing measurements were obtained.

REA's static analysis has incomplete semantic coverage and does not establish runtime reachability. Inline HTML scripts and dynamically obtained game code are outside this result. The public bootstrap is obfuscated. Exact TETR.IO scoring, 180-degree kicks, lock policies, spawn rules, renderer timing, input buffering and network simulation remain unverified.

## VOID implementation

The following changes come from defects established in VOID source and regression fixtures, rather than copied TETR.IO code:

- Rotation uses fixed 3×3 frames for JLSTZ and 4×4 for I. Previously cropped rectangles moved the pivot during rotation. I's spawn frame starts at y = -1 so its occupied horizontal row still appears at visible row zero. Existing VOID kick tables remain unchanged; exact SRS+ equivalence is not asserted.
- Repeat timing carries overdue milliseconds and can execute multiple repeats in a frame. Unit tests compare one second of 8ms ARR at 30, 60 and 144Hz. Zero ARR remains bounded wall movement. UI simulation retains its existing 42ms frame cap, so this does not establish equivalence under arbitrarily slow frames.
- T-spin classification happens before row removal and retains rotation intent during downward travel. Successful horizontal movement cancels it. Existing VOID score tables remain a local scoring profile.
- Hard-drop and hold give the new piece a fresh gravity interval. Sprint ends immediately on the 40th line and rejects additional placement input.
- Input becomes available on GO, together with the running clock. Handling presets no longer overwrite the user's training seed or opener. The millisecond soft-drop control is labelled "Soft drop interval", since it is not TETR.IO's SDF multiplier.

Presentation is authored for VOID: larger continuous playfield, open side rails, persistent five-piece queue at compact sizes, centered silhouette previews, visible hold availability, stable feedback placement, sprint progress and explicit ready/paused/finished states. Clear flashes use actual completed row positions. Particles scale with board dimensions; reduced motion disables particles, clear flashes and camera shake.

The default Ice palette gives every shape a distinct luminous conventional tint: I cyan, O pale yellow, T violet, S mint, Z rose, J blue and L peach. After creator feedback, saturation and shape-colored glow were increased while keeping the black surroundings and stronger active-piece hierarchy. Settled blocks are slightly dimmer and the ghost uses an outlined version of the active piece's tint. Explicit mono and contrast palette selections remain available.

## Validation

- Unit coverage includes pivot coordinates, T-spin single recognition through a real rotate/drop action, vertical spin intent, gravity ownership after hold/drop, terminal sprint input rejection and repeat timing across frame rates.
- Existing kick fixtures were moved to the occupied cells of the padded frames. Their expected kick ordering was retained. Timer-lock I spawn assertions now use frame y = -1.
- Browser coverage exercises Start → hold → rotate → hard drop → pause/resume → restart; five previews and playfield/clock bounds at 760×600 and 1440×600; and a five-O all clear without moving the playfield or emitting reduced-motion effects.
- Screenshots are technical validation, not creator approval. Native packaged Tauri behavior, measured parity with TETR.IO and release/install acceptance are not established here.


## Follow-up: recovered sound bank and audiovisual adaptation

The user explicitly authorized extracting, modifying and using TETR.IO sounds. A fresh read-only browser resource inventory exposed the actual game bundle at `/js/tetrio.js` and the RSD sound atlas at `/sfx/tetrio.opus.rsd`, both with the same version token as above. No join or terms acceptance was needed. The game bundle is minified but exposes readable audio and effect call sites, unlike the obfuscated bootstrap.

The RSD parser in that bundle validates `tRSD`, version 1.0, reads float32 sample offsets with uint32-length names until an empty name, then reads the encoded audio payload length. Reconstructing this format recovered 273 named segments in a stereo 48kHz Opus atlas of approximately 456.927 seconds. Local original resources and the recovered full manifest remain in `../targets/tetrio-inspection/web/`.

Static call sites establish that successful lateral shifts trigger `move`; successful rotations select `rotate` or the initial-rotation variant; hard drop uses `harddrop`; floor contact uses `floor`; normal, quad, spin and back-to-back quad clears select distinct sounds. Combo selection uses the clear-chain count minus one, bounded to the available bank. This is evidence for event mapping, not a live timing measurement. The original high/ultra hard-drop edge effect uses short additive particle bursts with lifetimes in the 0.1–0.5 second range.

VOID now ships 23 adapted clips, about 271kB total, in `desktop/src/app/modules/stacker/sounds/`. `provenance.json` records source URL/hash, original keys/offsets, output hashes and processing parameters. `scripts/prepare_stacker_reference_audio.py` regenerates them from a caller-supplied RSD using FFmpeg. Adaptation lowers playback rate to 97%, removes low rumble below 85Hz, softens content above 7.8kHz, shortens tails, applies edge fades, attenuates levels and limits peaks. Original audio ownership remains with OSK; these files are not represented as newly authored or relicensed recordings.

The default saved key `void-soft` is retained and displayed as **VOID glacial**. Clips preload during the initial user gesture/countdown, play through a shared gain/compressor bus, and release their source nodes after playback. A bounded voice count and short transient coalescing prevent dense repeat input from stacking an excessive number of sounds. Existing procedural packs remain available and synthesis is the fallback if individual samples fail to decode or load. Mute updates the shared output immediately; master volume and UI-sound preferences remain functional. Pack changes preview the newly selected pack rather than the previous React state.

Placement metadata now exposes the locked cells and actual hard-drop distance. VOID uses it for 180ms drop trails and lock highlights; clear particles originate from the actual cleared rows, and row flashes honor Clear motion intensity. Reduced motion removes these transients. Board shake is capped at a smaller displacement. Successful action comparison prevents confirmation sounds for a blocked move or locked hold. DAS cut is applied once per lock instead of being refreshed every frame after the first placement.

The sound drawer adds separate Rotation, Drop, Quad and All clear previews, with a quick mute action in the game header. Browser validation covers decoded sample playback, invalid-hold silence, muting, previews, normal-motion placement cues and their removal when reduced motion changes live. Human listening and artistic acceptance remain distinct from these technical checks.


Follow-up validation completed: 137 unit tests, 10 browser tests, production build and ESLint passed. The browser audio test observed real decoded AudioBufferSource playback, verified a second locked hold did not start a sound, verified mute prevented subsequent playback, and exercised the All clear preview. Screenshots and traces are under `../targets/tetrio-inspection/validation-audio/`. The client bundle SHA-256 is `9e57c958c43520deb5dd91f5e1773bf779bfb91e7d273dc8494a93a3a0866d2f`. A nine-cue audition WAV and decoded amplitude metrics are in `../targets/tetrio-inspection/audio-validation/`; this audition uses the processed recordings before the in-game master gain/compressor.


## Publication validation

The packaged CSP was exercised using the Windows origin `http://tauri.localhost`, with requests proxied to the built preview files and the exact policy from `tauri.conf.json`. The old policy blocked local sound fetches: no decoded sample sources started. Adding only `'self'` to `connect-src` permits bundled audio while retaining the existing IPC/loopback restrictions. Ordinary localhost preview had masked this because the old loopback allowlist already permitted that origin. The browser regression now preserves this native-origin check.

Release polishing also pauses Endless runs when settings open, restores playfield focus on close, disables settings during an active sprint, and uses engine lock IDs for the piece count so several placements between animation frames are not lost. Run archives include the final lock ID. The version is `0.4.0-alpha`; package identity, updater endpoint and signing key are retained.
