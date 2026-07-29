import { describe, expect, it } from "vitest";
import {
  averageFrequencyRange,
  clamp,
  fallbackStatus,
  normalizeAmplitude,
  smoothMetrics,
} from "../app/modules/orbit/audioMath";

describe("Orbit audio helpers", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(Number.NaN)).toBe(0);
  });

  it("normalizes frequency ranges to zero through one", () => {
    expect(averageFrequencyRange(new Uint8Array([0, 255, 255, 0]), 1, 3)).toBe(1);
    expect(averageFrequencyRange(new Uint8Array(), 0, 4)).toBe(0);
  });

  it("applies a quiet noise gate before sensitivity", () => {
    expect(normalizeAmplitude(0.01, 2)).toBe(0);
    expect(normalizeAmplitude(0.5, 1)).toBeGreaterThan(0.9);
    expect(normalizeAmplitude(10, 4)).toBe(1);
  });

  it("smooths every metric without overshooting", () => {
    const next = smoothMetrics(
      { volume: 0, bass: 0.2, mid: 0.4, high: 0.8 },
      { volume: 1, bass: 1, mid: 0, high: 0 },
      0.8,
    );
    expect(next.volume).toBeCloseTo(0.2);
    expect(next.bass).toBeCloseTo(0.36);
    expect(next.mid).toBeCloseTo(0.32);
    expect(next.high).toBeCloseTo(0.64);
  });

  it("maps permission and capability failures to calm fallbacks", () => {
    expect(fallbackStatus(new Error("missing"), false)).toBe("unavailable");
    expect(fallbackStatus(new DOMException("blocked", "NotAllowedError"), true)).toBe("denied");
    expect(fallbackStatus(new DOMException("busy", "NotReadableError"), true)).toBe("unavailable");
  });
});
