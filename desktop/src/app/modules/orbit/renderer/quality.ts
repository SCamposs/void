export type OrbitQualityMode = "auto" | "performance" | "balanced" | "quality";
export type OrbitResolvedQuality = Exclude<OrbitQualityMode, "auto">;

export type OrbitQualityProfile = {
  textureWidth: number;
  textureHeight: number;
  particleCount: number;
  maxDpr: number;
  bloom: boolean;
  bloomStrength: number;
};

export const ORBIT_QUALITY_PROFILES: Record<OrbitResolvedQuality, OrbitQualityProfile> = {
  performance: {
    textureWidth: 128,
    textureHeight: 256,
    particleCount: 32_768,
    maxDpr: 1.15,
    bloom: false,
    bloomStrength: 0,
  },
  balanced: {
    textureWidth: 256,
    textureHeight: 256,
    particleCount: 65_536,
    maxDpr: 1.5,
    bloom: true,
    bloomStrength: 0.24,
  },
  quality: {
    textureWidth: 256,
    textureHeight: 512,
    particleCount: 131_072,
    maxDpr: 2,
    bloom: true,
    bloomStrength: 0.3,
  },
};

export function chooseInitialQuality(
  mode: OrbitQualityMode,
  hardwareConcurrency = navigator.hardwareConcurrency || 4,
  deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
): OrbitResolvedQuality {
  if (mode !== "auto") return mode;
  if (hardwareConcurrency <= 4 || (deviceMemory !== undefined && deviceMemory <= 4)) return "performance";
  return "balanced";
}

export function chooseAutoQuality(
  current: OrbitResolvedQuality,
  averageFrameMs: number,
  slowFrameCount: number,
  fastFrameCount: number,
): OrbitResolvedQuality {
  if (slowFrameCount >= 150 || averageFrameMs >= 27) {
    if (current === "quality") return "balanced";
    return "performance";
  }
  if (fastFrameCount >= 600 && averageFrameMs < 12.8 && current === "performance") return "balanced";
  return current;
}

export function cappedPixelRatio(profile: OrbitQualityProfile, devicePixelRatio: number): number {
  const safeDpr = Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  return Math.max(0.75, Math.min(profile.maxDpr, safeDpr));
}
