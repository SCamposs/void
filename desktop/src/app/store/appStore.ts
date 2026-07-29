import { create } from "zustand";
import { readStoredJson, storageKeys, writeStoredJson } from "../lib/persistence";

export type ModuleId = "home" | "typing" | "orbit" | "stacker" | "settings";

type ThemeSettings = {
  scanlines: boolean;
  scanlineIntensity: number;
  noise: number;
  glow: number;
  flicker: number;
  backgroundTexture: "flat" | "vignette" | "radial";
  animatedBackground: boolean;
  dense: boolean;
  accentIntensity: number;
  fontScale: number;
};

type AppState = {
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: ThemeSettings;
  updateTheme: (patch: Partial<ThemeSettings>) => void;
};

const defaults: ThemeSettings = {
  scanlines: true,
  scanlineIntensity: 0.12,
  noise: 0.08,
  glow: 0.12,
  flicker: 0,
  backgroundTexture: "vignette",
  animatedBackground: false,
  dense: false,
  accentIntensity: 1,
  fontScale: 1,
};
const loaded = { ...defaults, ...readStoredJson<Partial<ThemeSettings>>(storageKeys.theme, {}) };

export const useAppStore = create<AppState>((set) => ({
  module: "home",
  setModule: (module) => set({ module }),
  sidebarCollapsed: (() => {
    return readStoredJson(storageKeys.sidebar, false);
  })(),
  toggleSidebar: () => set((state) => {
    const sidebarCollapsed = !state.sidebarCollapsed;
    writeStoredJson(storageKeys.sidebar, sidebarCollapsed);
    return { sidebarCollapsed };
  }),
  theme: loaded,
  updateTheme: (patch) => set((state) => {
    const next = { ...state.theme, ...patch };
    writeStoredJson(storageKeys.theme, next);
    return { theme: next };
  }),
}));
