export const STACKER_COUNTDOWN_INTERVAL_MS = 750;
export const STACKER_COUNTDOWN_GO_MS = 360;
export const STACKER_COUNTDOWN_STEPS = [3, 2, 1] as const;

export type StackerCountdownStep = (typeof STACKER_COUNTDOWN_STEPS)[number] | "GO";

export function getStackerCountdownStep(elapsedMs: number): StackerCountdownStep | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const stepIndex = Math.floor(elapsedMs / STACKER_COUNTDOWN_INTERVAL_MS);
  if (stepIndex < STACKER_COUNTDOWN_STEPS.length) return STACKER_COUNTDOWN_STEPS[stepIndex];
  if (elapsedMs < STACKER_COUNTDOWN_INTERVAL_MS * STACKER_COUNTDOWN_STEPS.length + STACKER_COUNTDOWN_GO_MS) {
    return "GO";
  }
  return null;
}
