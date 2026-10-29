import { useConfirm } from "../ui/use-confirm";
import { Button, Disclosure, DisclosureBody, DisclosureTitle } from "../ui/Controls";
import { useState } from "react";
import { exportAppData, importAppData, resetAppData } from "../../lib/persistence";
import { UpdatePanel } from "../../modules/updater/UpdatePanel";

export function SettingsModule() {
  const confirm = useConfirm();
  const [dataStatus, setDataStatus] = useState("");

  const downloadBackup = () => {
    const blob = new Blob([exportAppData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `void-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDataStatus("Backup exported.");
  };

  return <div className="settings-surface">
    <h1 className="mb-1 text-lg font-semibold tracking-[-0.02em]">Settings</h1>
    <p className="mb-5 max-w-[68ch] text-sm text-[var(--muted)]">Manage app updates and your local data.</p>

    <div className="space-y-3">
      <UpdatePanel />

      <Disclosure className="border border-[var(--border)] p-4">
        <DisclosureTitle className="cursor-pointer font-medium">Local data</DisclosureTitle><DisclosureBody>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Export creates a portable JSON backup of VOID-owned settings and history. Import merges a valid backup and reloads the app.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Button className="border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface2)]" onClick={downloadBackup}>Export app data</Button>
          <label className="cursor-pointer border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface2)]">
            Import app data
            <input className="sr-only" type="file" accept="application/json,.json" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const count = importAppData(await file.text());
                setDataStatus(`Imported ${count} entries. Reloading...`);
                window.setTimeout(() => window.location.reload(), 450);
              } catch (error) {
                setDataStatus(error instanceof Error ? error.message : "Import failed.");
              } finally {
                event.target.value = "";
              }
            }} />
          </label>
          <Button className="border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface2)]" onClick={async () => {
            if (!await confirm("Reset all VOID settings and local history? This cannot be undone without a backup.")) return;
            const count = resetAppData();
            setDataStatus(`Reset ${count} entries. Reloading...`);
            window.setTimeout(() => window.location.reload(), 450);
          }}>Reset local data</Button>
        </div>
        {dataStatus && <p className="mt-3 text-xs text-[var(--accent)]" role="status">{dataStatus}</p>}
      </DisclosureBody></Disclosure>
    </div>
  </div>;
}
