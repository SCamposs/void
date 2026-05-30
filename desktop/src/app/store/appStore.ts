import { create } from "zustand";

export type ModuleId = "home" | "typing" | "orbit" | "stacker" | "settings";

type ThemeSettings = {
  scanlines: boolean;
  noise: number;
  glow: number;
  flicker: number;
  dense: boolean;
  accentIntensity: number;
  fontScale: number;
};

type AppState = {
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  theme: ThemeSettings;
  updateTheme: (patch: Partial<ThemeSettings>) => void;
};

const storageKey = "void-desktop-theme";
const defaults: ThemeSettings = { scanlines: true, noise: 0.08, glow: 0.12, flicker: 0.03, dense: false, accentIntensity: 1, fontScale: 1 };
const loaded = (() => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
})();

export const useAppStore = create<AppState>((set) => ({
  module: "home",
  setModule: (module) => set({ module }),
  theme: loaded,
  updateTheme: (patch) => set((state) => {
    const next = { ...state.theme, ...patch };
    localStorage.setItem(storageKey, JSON.stringify(next));
    return { theme: next };
  }),
}));
