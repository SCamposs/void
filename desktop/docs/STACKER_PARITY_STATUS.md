# VOID Stacker Parity Status (vs TETR.IO Custom Solo)

Last updated: 2026-05-31

## Scope

This document tracks parity of `desktop/src/app/modules/stacker` against:

- `C:\Users\zuado\code\pessoal\itl-game-hub\components\games\tetris`
- Public TETR.IO Custom Solo references (scoring/mechanics)

Goal: move from "close" to "verified parity" with test-backed evidence.

## Implemented and test-backed

- 7-bag randomizer behavior and deterministic seeded sequence
- Hold lock (single use until next lock)
- Hold returns spawn orientation (not rotated matrix)
- Ghost/queue/hold visuals and lock/clear trails (VOID aesthetic preserved)
- Combo/B2B tier signaling refined with normal-mode inspired feedback intensity
- Clear/lock audio feedback scaling refined for chain readability (VOID synth palette)
- Visual controls aligned closer to normal-mode ergonomics:
  - separate shake intensity control
  - particles-on-clear toggle
- Persisted settings hardening:
  - numeric localStorage settings are now validated/clamped at load
  - prevents invalid saved values from causing runtime control/FX instability
  - boolean/string persisted settings now use SSR-safe reads
- Soft drop / hard drop per-cell scoring:
  - soft: `+1` per cell
  - hard: `+2` per cell
  - independent from level
- Scoring table parity (Custom Solo style):
  - singles/doubles/triples/quads
  - spin and mini-spin scores (including spin zero)
  - B2B multiplier
  - combo bonus
  - all clear bonus
  - level multiplier application
- T-spin detection and spin-zero event/scoring behavior
- Lock cause attribution:
  - hard drop => `hard-drop`
  - grounded soft-drop => `soft-drop` if no successful transform intervenes
  - successful transform after grounded soft-drop reverts attribution to `gravity`
- Lock delay behavior:
  - default 500ms lock delay
  - lock reset cap handling with configured limits
  - grounded failed movement does not reset timer
  - grounded soft-drop input does not reset timer
  - successful grounded transform resets timer
- Kick-table coverage:
  - 90-degree keys complete for I and JLSTZ
  - 180-degree keys complete for I and JLSTZ
  - scenario tests for left/right wall fallback outcomes across CW/CCW/180
  - exhaustive first-valid candidate order checks per transition table
  - exhaustive full-rejection checks when all candidates are blocked
  - deterministic dense-blocker stress checks that guarantee legal final placements

## Remaining parity risks (not fully proven)

- Exact cross-check versus canonical TETR.IO 180 visual/table references for all transitions
- Runtime human-play smoke of "feel" parity under sustained high-speed inputs
  - test suite now validates transition ordering, rejection paths, and dense blocker behavior
  - subjective handling feel still needs manual play confirmation

## Evidence commands

From `desktop/`:

- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run build`

## Next recommended parity tasks

1. Cross-check every configured 180 transition against canonical TETR.IO references and capture source evidence.
2. Run manual speed-play sessions and record any divergence against expected TETR.IO behavior.
3. If handling deltas are observed, tune gravity/handling defaults while preserving VOID aesthetic.
