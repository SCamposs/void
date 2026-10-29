import { create } from "zustand";
import { readStoredJson, storageKeys, writeStoredJson } from "../lib/persistence";

export type ModuleId = "home" | "mind" | "typing" | "orbit" | "stacker" | "settings";

type AppState = {
  module: ModuleId;
  setModule: (m: ModuleId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

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
}));
