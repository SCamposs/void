import { describe, expect, it } from "vitest";
import {
  STACKER_COUNTDOWN_GO_MS,
  STACKER_COUNTDOWN_INTERVAL_MS,
  getStackerCountdownStep,
} from "../app/modules/stacker/countdown";

describe("stacker countdown", () => {
  it("progresses through 3, 2, 1, GO, then clears", () => {
    expect(getStackerCountdownStep(0)).toBe(3);
    expect(getStackerCountdownStep(STACKER_COUNTDOWN_INTERVAL_MS)).toBe(2);
    expect(getStackerCountdownStep(STACKER_COUNTDOWN_INTERVAL_MS * 2)).toBe(1);
    expect(getStackerCountdownStep(STACKER_COUNTDOWN_INTERVAL_MS * 3)).toBe("GO");
    expect(getStackerCountdownStep(
      STACKER_COUNTDOWN_INTERVAL_MS * 3 + STACKER_COUNTDOWN_GO_MS,
    )).toBeNull();
  });

  it("rejects invalid elapsed times", () => {
    expect(getStackerCountdownStep(-1)).toBeNull();
    expect(getStackerCountdownStep(Number.NaN)).toBeNull();
  });
});
