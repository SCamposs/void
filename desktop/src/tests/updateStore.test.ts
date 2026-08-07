import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUpdateStore,
  scheduleUpdateChecks,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdateCandidate,
} from "../app/modules/updater/updateStore";

function candidate(overrides: Partial<UpdateCandidate> = {}): UpdateCandidate {
  return {
    body: "Changes",
    currentVersion: "0.1.3-alpha",
    date: "2026-08-07T12:00:00Z",
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    version: "0.1.4-alpha",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("automatic updates", () => {
  it("checks immediately and every two hours", async () => {
    vi.useFakeTimers();
    const runCheck = vi.fn().mockResolvedValue(undefined);
    const stop = scheduleUpdateChecks(runCheck);

    expect(runCheck).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(runCheck).toHaveBeenCalledTimes(3);

    stop();
  });

  it("refreshes an already available update on the two-hour check", async () => {
    const check = vi.fn()
      .mockResolvedValueOnce(candidate({ version: "0.1.4-alpha" }))
      .mockResolvedValueOnce(candidate({ version: "0.1.5-alpha" }));
    const store = createUpdateStore({
      isDesktop: () => true,
      check,
      relaunch: vi.fn(),
    });

    await store.getState().checkForUpdates();
    await store.getState().checkForUpdates();

    expect(check).toHaveBeenCalledTimes(2);
    expect(store.getState().candidate?.version).toBe("0.1.5-alpha");
  });

  it("exposes an available update without installing it automatically", async () => {
    const update = candidate();
    const store = createUpdateStore({
      isDesktop: () => true,
      check: vi.fn().mockResolvedValue(update),
      relaunch: vi.fn().mockResolvedValue(undefined),
    });

    await store.getState().checkForUpdates();

    expect(store.getState().status).toBe("available");
    expect(store.getState().candidate?.version).toBe("0.1.4-alpha");
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
  });

  it("downloads, installs and relaunches only after confirmation", async () => {
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 100 } });
      onEvent?.({ event: "Finished" });
    });
    const relaunch = vi.fn().mockResolvedValue(undefined);
    const store = createUpdateStore({
      isDesktop: () => true,
      check: vi.fn().mockResolvedValue(candidate({ downloadAndInstall })),
      relaunch,
    });

    await store.getState().checkForUpdates();
    await store.getState().installUpdate();

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(store.getState().downloadedBytes).toBe(100);
    expect(store.getState().status).toBe("installing");
  });

  it("does not call the native updater in a browser preview", async () => {
    const check = vi.fn();
    const store = createUpdateStore({
      isDesktop: () => false,
      check,
      relaunch: vi.fn(),
    });

    await store.getState().checkForUpdates();

    expect(check).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("unavailable");
  });
});
