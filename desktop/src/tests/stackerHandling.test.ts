import { describe, expect, it } from "vitest";
import { advanceRepeat } from "../app/modules/stacker/handling";

describe("Stacker repeat timing", () => {
  it("produces the same movement over one second at 30, 60 and 144 Hz", () => {
    const counts = [30, 60, 144].map((hz) => {
      let remaining = 125;
      let count = 0;
      for (let frame = 0; frame < hz; frame += 1) {
        const next = advanceRepeat(remaining, 1000 / hz, 8);
        remaining = next.remainingMs;
        count += next.count;
      }
      return count;
    });
    expect(counts).toEqual([110, 110, 110]);
  });

  it("preserves DAS overshoot and repeats several times in a slow frame", () => {
    expect(advanceRepeat(5, 30, 8)).toEqual({ count: 4, remainingMs: 7 });
    expect(advanceRepeat(100, 16, 8)).toEqual({ count: 0, remainingMs: 84 });
  });

  it("bounds instant movement to board width and ignores invalid frame time", () => {
    expect(advanceRepeat(0, 16, 0)).toEqual({ count: 10, remainingMs: 0 });
    expect(advanceRepeat(90, Number.NaN, 8)).toEqual({ count: 0, remainingMs: 90 });
  });
});
