import { describe, expect, it } from "vitest";
import { averageNormalizedBins, frequencyBinRange, gateAndNormalize } from "../app/modules/orbit/audio/AudioFeatures";
import { SmoothedSignal } from "../app/modules/orbit/audio/SmoothedSignal";
import { pointerFalloff } from "../app/modules/orbit/interaction/PointerField";
import { DEFAULT_ORBIT_SETTINGS, parseOrbitSettings } from "../app/modules/orbit/settings";

describe("Orbit audio and interaction signals", () => {
  it("maps frequency bands to safe FFT bins", () => {
    expect(frequencyBinRange(40, 220, 48_000, 2_048, 1_024)).toEqual([1, 10]);
    expect(frequencyBinRange(-20, 99_000, 48_000, 2_048, 1_024)).toEqual([0, 1_024]);
  });

  it("uses RMS-like normalized band energy and a quiet floor", () => {
    expect(averageNormalizedBins(new Uint8Array([0, 255, 0, 255]), 0, 4)).toBeCloseTo(Math.SQRT1_2);
    expect(gateAndNormalize(0.02, 0.035, 2)).toBe(0);
    expect(gateAndNormalize(1, 0.035, 2)).toBe(1);
  });

  it("applies faster attack than release without frame-rate magic", () => {
    const signal = new SmoothedSignal();
    const attacked = signal.update(1, 1 / 60, 18, 2);
    const released = signal.update(0, 1 / 60, 18, 2);
    expect(attacked).toBeGreaterThan(0.2);
    expect(released).toBeGreaterThan(attacked * 0.9);
  });

  it("returns a smooth local pointer falloff", () => {
    expect(pointerFalloff(0, 1)).toBe(1);
    expect(pointerFalloff(0.5, 1)).toBe(0.5);
    expect(pointerFalloff(1, 1)).toBe(0);
    expect(pointerFalloff(Number.NaN, 1)).toBe(0);
  });

  it("migrates malformed settings to safe human-facing defaults", () => {
    expect(parseOrbitSettings(null)).toEqual(DEFAULT_ORBIT_SETTINGS);
    expect(parseOrbitSettings("not-json")).toEqual(DEFAULT_ORBIT_SETTINGS);
    expect(parseOrbitSettings(JSON.stringify({ quality: "impossible", motion: "wild", sensitivity: 99 }))).toEqual({
      quality: "auto",
      motion: "balanced",
      sensitivity: 2,
    });
  });
});
