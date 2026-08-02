import type { MindRuntimeState } from "./types";
import { MIND_STATE_LABELS } from "./mindState";

export function MindOrbit({ state, compact = false }: { state: MindRuntimeState; compact?: boolean }) {
  return (
    <div className={`mind-orbit ${compact ? "mind-orbit--compact" : ""}`} data-state={state}>
      <div className="mind-orbit__halo" aria-hidden="true" />
      <div className="mind-orbit__ring mind-orbit__ring--outer" aria-hidden="true" />
      <div className="mind-orbit__ring mind-orbit__ring--inner" aria-hidden="true" />
      <div className="mind-orbit__core" aria-hidden="true" />
      <span className="sr-only">Mind state: {MIND_STATE_LABELS[state]}</span>
    </div>
  );
}
