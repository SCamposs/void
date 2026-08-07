import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

export const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1_000;

export type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installing"
  | "unavailable";

export type UpdateCandidate = Pick<
  Update,
  "body" | "currentVersion" | "date" | "downloadAndInstall" | "version"
>;

export type UpdaterDependencies = {
  isDesktop: () => boolean;
  check: () => Promise<UpdateCandidate | null>;
  relaunch: () => Promise<void>;
};

export type UpdateState = {
  status: UpdateStatus;
  isChecking: boolean;
  candidate: UpdateCandidate | null;
  downloadedBytes: number;
  contentLength: number | null;
  error: string | null;
  lastCheckedAt: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
};

const defaultDependencies: UpdaterDependencies = {
  isDesktop: isTauri,
  check: () => check({ timeout: 15_000 }),
  relaunch,
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createUpdateStore(dependencies: UpdaterDependencies = defaultDependencies) {
  return create<UpdateState>((set, get) => ({
    status: "idle",
    isChecking: false,
    candidate: null,
    downloadedBytes: 0,
    contentLength: null,
    error: null,
    lastCheckedAt: null,

    checkForUpdates: async () => {
      const current = get();
      if (current.isChecking || ["downloading", "installing"].includes(current.status)) return;
      if (!dependencies.isDesktop()) {
        set({ status: "unavailable" });
        return;
      }

      set({
        status: current.candidate ? "available" : "checking",
        isChecking: true,
        error: null,
      });
      try {
        const candidate = await dependencies.check();
        set({
          status: candidate ? "available" : "upToDate",
          isChecking: false,
          candidate,
          downloadedBytes: 0,
          contentLength: null,
          error: null,
          lastCheckedAt: new Date().toISOString(),
        });
      } catch (error) {
        set({
          status: current.candidate ? "available" : "idle",
          isChecking: false,
          candidate: current.candidate,
          error: messageFrom(error),
          lastCheckedAt: new Date().toISOString(),
        });
      }
    },

    installUpdate: async () => {
      const candidate = get().candidate;
      if (!candidate || get().status !== "available") return;

      set({
        status: "downloading",
        downloadedBytes: 0,
        contentLength: null,
        error: null,
      });

      try {
        let downloadedBytes = 0;
        await candidate.downloadAndInstall((event: DownloadEvent) => {
          if (event.event === "Started") {
            set({ contentLength: event.data.contentLength ?? null });
            return;
          }
          if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            set({ downloadedBytes });
            return;
          }
          set({ status: "installing" });
        });
        set({ status: "installing" });
        await dependencies.relaunch();
      } catch (error) {
        set({ status: "available", error: messageFrom(error) });
      }
    },
  }));
}

export const useUpdateStore = createUpdateStore();

export function scheduleUpdateChecks(
  runCheck: () => Promise<void>,
  scheduler: Pick<typeof globalThis, "clearInterval" | "setInterval"> = globalThis,
): () => void {
  void runCheck();
  const interval = scheduler.setInterval(() => {
    void runCheck();
  }, UPDATE_CHECK_INTERVAL_MS);
  return () => scheduler.clearInterval(interval);
}
