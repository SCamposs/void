import type { MindRuntimeState } from "./types";

export const MIND_STATE_LABELS: Record<MindRuntimeState, string> = {
  idle: "idle",
  checking: "checking runtime",
  loading: "loading model",
  ready: "ready",
  thinking: "thinking",
  generating: "generating",
  stopped: "stopped",
  error: "error",
};

export function mindStateLabel(state: MindRuntimeState): string {
  return MIND_STATE_LABELS[state];
}
