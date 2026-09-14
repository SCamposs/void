import type { OrbitQualityMode } from "./renderer/quality";

export type OrbitMotion = "calm" | "balanced" | "alive";

export type OrbitSettings = {
  quality: OrbitQualityMode;
  motion: OrbitMotion;
  sensitivity: number;
};

export const DEFAULT_ORBIT_SETTINGS: OrbitSettings = {
  quality: "auto",
  motion: "balanced",
  sensitivity: 1,
};

const STORAGE_KEY = "void.orbit.settings.v2";

export function parseOrbitSettings(value: string | null): OrbitSettings {
  if (!value) return { ...DEFAULT_ORBIT_SETTINGS };
  try {
    const parsed = JSON.parse(value) as Partial<OrbitSettings>;
    const quality = ["auto", "performance", "balanced", "quality"].includes(parsed.quality ?? "")
      ? parsed.quality as OrbitQualityMode
      : DEFAULT_ORBIT_SETTINGS.quality;
    const motion = ["calm", "balanced", "alive"].includes(parsed.motion ?? "")
      ? parsed.motion as OrbitMotion
      : DEFAULT_ORBIT_SETTINGS.motion;
    const sensitivity = Number.isFinite(parsed.sensitivity)
      ? Math.max(0.5, Math.min(2, parsed.sensitivity as number))
      : DEFAULT_ORBIT_SETTINGS.sensitivity;
    return { quality, motion, sensitivity };
  } catch {
    return { ...DEFAULT_ORBIT_SETTINGS };
  }
}

export function loadOrbitSettings(): OrbitSettings {
  return parseOrbitSettings(localStorage.getItem(STORAGE_KEY));
}

export function saveOrbitSettings(settings: OrbitSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
