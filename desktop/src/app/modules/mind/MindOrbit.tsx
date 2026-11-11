import type { MindRuntimeState } from "./types";
import { MIND_STATE_LABELS } from "./mindState";
import { VoidMark } from "../../components/ui/VoidMark";

export function MindOrbit({ state, compact = false }: { state: MindRuntimeState; compact?: boolean }) {
  return (
    <div className={`mind-orbit ${compact ? "mind-orbit--compact" : ""}`} data-state={state}>
      <VoidMark className="mind-orbit__mark" />
      <span className="sr-only">Mind state: {MIND_STATE_LABELS[state]}</span>
    </div>
  );
}
