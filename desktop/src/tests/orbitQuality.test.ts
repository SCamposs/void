import { describe, expect, it } from "vitest";
import { chooseRendererBackend } from "../app/modules/orbit/renderer/capabilities";
import {
  ORBIT_QUALITY_PROFILES,
  cappedPixelRatio,
  chooseAutoQuality,
  chooseInitialQuality,
} from "../app/modules/orbit/renderer/quality";

describe("Orbit quality selection", () => {
  it("defaults Auto to a stable middle tier on capable hardware", () => {
    expect(chooseInitialQuality("auto", 8, 8)).toBe("balanced");
    expect(chooseInitialQuality("auto", 4, 4)).toBe("performance");
    expect(chooseInitialQuality("quality", 2, 2)).toBe("quality");
  });

  it("uses sustained hysteresis before changing automatic quality", () => {
    expect(chooseAutoQuality("balanced", 23, 149, 0)).toBe("balanced");
    expect(chooseAutoQuality("balanced", 23, 150, 0)).toBe("performance");
    expect(chooseAutoQuality("performance", 12, 0, 599)).toBe("performance");
    expect(chooseAutoQuality("performance", 12, 0, 600)).toBe("balanced");
  });

  it("caps device pixel ratio by tier", () => {
    expect(cappedPixelRatio(ORBIT_QUALITY_PROFILES.performance, 3)).toBe(1.15);
    expect(cappedPixelRatio(ORBIT_QUALITY_PROFILES.quality, 3)).toBe(2);
    expect(cappedPixelRatio(ORBIT_QUALITY_PROFILES.balanced, Number.NaN)).toBe(1);
  });

  it("falls back gracefully when compute prerequisites are absent", () => {
    expect(chooseRendererBackend({ webgl2: true, floatColorBuffer: true }).backend).toBe("gpgpu");
    expect(chooseRendererBackend({ webgl2: false, floatColorBuffer: true }).backend).toBe("procedural");
    expect(chooseRendererBackend({ webgl2: true, floatColorBuffer: false }).backend).toBe("procedural");
  });
});
