import { create } from "zustand";
import { readStoredJson, storageKeys, writeStoredJson } from "../lib/persistence";

export type ModuleId = "home" | "mind" | "typing" | "orbit" | "stacker" | "settings";

type ThemeSettings = {
  scanlines: boolean;
  scanlineIntensity: number;
  noise: number;
  glow: number;
  backgroundTexture: "flat" | "vignette" | "radial";
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
  backgroundTexture: "vignette",
  dense: false,
  accentIntensity: 1,
  fontScale: 1,
};
const storedTheme = readStoredJson<Partial<ThemeSettings> & { animatedBackground?: unknown; flicker?: unknown }>(storageKeys.theme, {});
delete storedTheme.animatedBackground;
delete storedTheme.flicker;
const loaded = { ...defaults, ...storedTheme };
writeStoredJson(storageKeys.theme, loaded);

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
