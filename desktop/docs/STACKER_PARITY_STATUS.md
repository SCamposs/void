# VOID Stacker Parity Status

Last updated: 2026-05-31

## Scope

This document tracks the current behavior evidence for `desktop/src/app/modules/stacker`.
The goal is to keep the Stacker engine test-backed while the UI stays focused on the board.

## Implemented and test-backed

- 7-bag randomizer behavior and deterministic seeded sequence
- Hold lock, including single use until the next lock
- Hold returns spawn orientation, not the rotated matrix
- Ghost, queue, hold visuals, and lock/clear trails
- Combo and back-to-back tier signaling
- Clear and lock audio feedback scaling
- Separate controls for shake strength and clear particles
- AudioContext resume attempts on start, input, and tick paths
- Persisted numeric settings are validated and clamped at load
- Boolean and string persisted settings use guarded reads
- Soft drop and hard drop per-cell scoring
- Singles, doubles, triples, quads, spin clears, mini spin clears, all clear, combo, back-to-back, and level multiplier coverage
- Spin-zero event and scoring behavior
- Lock cause attribution for gravity, soft drop, and hard drop
- Lock delay timing, reset limits, failed movement handling, and invalid frame delta handling
- Kick-table coverage for 90-degree and 180-degree transitions
- Dense blocker stress checks for legal final placements

## Remaining risks

- Manual high-speed play smoke is still useful for subjective handling feel.
- Full visual cross-check of every configured 180-degree transition remains outside this UI-focused pass.

## Evidence commands

From `desktop/`:

- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run typecheck`
- `npm.cmd run build`
