import { useUpdateStore } from "./updateStore";

function formatProgress(downloadedBytes: number, contentLength: number | null): string {
  if (!contentLength) return "Downloading update...";
  const percentage = Math.min(100, Math.round((downloadedBytes / contentLength) * 100));
  return `Downloading update... ${percentage}%`;
}

export function UpdateDot() {
  return <span className="update-dot" aria-hidden="true" />;
}

export function UpdatePanel() {
  const status = useUpdateStore((state) => state.status);
  const isChecking = useUpdateStore((state) => state.isChecking);
  const candidate = useUpdateStore((state) => state.candidate);
  const downloadedBytes = useUpdateStore((state) => state.downloadedBytes);
  const contentLength = useUpdateStore((state) => state.contentLength);
  const error = useUpdateStore((state) => state.error);
  const lastCheckedAt = useUpdateStore((state) => state.lastCheckedAt);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const installUpdate = useUpdateStore((state) => state.installUpdate);

  const busy = isChecking || status === "downloading" || status === "installing";
  const statusText = status === "checking"
    ? "Checking for updates..."
    : status === "upToDate"
      ? "VOID is up to date."
      : status === "available" && candidate
        ? `Version ${candidate.version} is available. VOID will restart automatically after installation.`
        : status === "downloading"
          ? formatProgress(downloadedBytes, contentLength)
          : status === "installing"
            ? "Installing update and preparing to restart..."
            : status === "unavailable"
              ? "Update checks run in the installed desktop app."
              : "Automatic update checks are ready.";

  return <section className="border border-[var(--border)] p-4" aria-labelledby="app-updates-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 id="app-updates-title" className="font-medium">App updates</h2>
          {status === "available" && <UpdateDot />}
        </div>
        <p className="mt-2 max-w-[68ch] text-xs leading-5 text-[var(--muted)]">
          VOID checks GitHub when the app opens and every 2 hours. No usage data is sent.
        </p>
      </div>

      {status === "available" && candidate ? (
        <button
          className="border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
          onClick={() => void installUpdate()}
          disabled={busy}
        >
          Install and restart
        </button>
      ) : (
        <button
          className="border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface2)] disabled:cursor-wait disabled:opacity-50"
          onClick={() => void checkForUpdates()}
          disabled={busy || status === "unavailable"}
        >
          {isChecking ? "Checking..." : "Check now"}
        </button>
      )}
    </div>

    <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{statusText}</span>
        {lastCheckedAt && <span className="text-[var(--subtle)]">Last checked {new Date(lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      {status === "downloading" && contentLength && (
        <progress className="mt-3 h-1 w-full" max={contentLength} value={downloadedBytes} aria-label="Update download progress" />
      )}
      {candidate?.body && status === "available" && (
        <details className="mt-3 text-[var(--muted)]">
          <summary className="cursor-pointer">Release notes</summary>
          <p className="mt-2 max-w-[68ch] whitespace-pre-wrap leading-5">{candidate.body}</p>
        </details>
      )}
      {error && <p className="mt-3 text-[#d9aaa3]">Update check failed: {error}</p>}
    </div>
  </section>;
}
