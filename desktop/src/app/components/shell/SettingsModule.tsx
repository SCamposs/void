import { useConfirm } from "../ui/use-confirm";
import { Button, SwitchControl, Disclosure, DisclosureBody, DisclosureTitle, Select, Slider } from "../ui/Controls";
import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { exportAppData, importAppData, resetAppData } from "../../lib/persistence";
import { UpdatePanel } from "../../modules/updater/UpdatePanel";

export function SettingsModule() {
  const confirm = useConfirm();
  const { theme, updateTheme } = useAppStore();
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
    <p className="mb-5 max-w-[68ch] text-sm text-[var(--muted)]">Tune the app surface and manage local data. Orbit and Stacker keep module-specific controls inside their own settings panels.</p>

    <div className="space-y-3">
      <UpdatePanel />

      <Disclosure className="border border-[var(--border)] p-4" defaultOpen>
        <DisclosureTitle className="cursor-pointer font-medium">App appearance</DisclosureTitle><DisclosureBody>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3">Scanlines <SwitchControl label="Scanlines" checked={theme.scanlines} onCheckedChange={(nextValue) => updateTheme({ scanlines: nextValue })} /></label>
          <label className="flex items-center justify-between gap-3">Dense layout <SwitchControl label="Dense layout" checked={theme.dense} onCheckedChange={(nextValue) => updateTheme({ dense: nextValue })} /></label>
          <label className="block border border-[var(--border)] p-3">Scanline intensity <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.scanlineIntensity * 100)}%</span><Slider label="Scanline intensity" className="mt-2 w-full"  min={0} max={0.35} step={0.01} value={theme.scanlineIntensity} onValueChange={(nextValue) => updateTheme({ scanlineIntensity: Number(nextValue) })} /></label>
          <label className="block border border-[var(--border)] p-3">Noise <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.noise * 100)}%</span><Slider label="Noise" className="mt-2 w-full"  min={0} max={0.25} step={0.01} value={theme.noise} onValueChange={(nextValue) => updateTheme({ noise: Number(nextValue) })} /></label>
          <label className="block border border-[var(--border)] p-3">Glow <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.glow * 100)}%</span><Slider label="Glow" className="mt-2 w-full"  min={0} max={0.35} step={0.01} value={theme.glow} onValueChange={(nextValue) => updateTheme({ glow: Number(nextValue) })} /></label>
          <label className="block border border-[var(--border)] p-3">Background texture
            <Select label="Background texture" className="mt-2 w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={theme.backgroundTexture} onValueChange={(nextValue) => updateTheme({ backgroundTexture: nextValue as typeof theme.backgroundTexture })}>
              <option value="flat">Flat</option>
              <option value="vignette">Vignette</option>
              <option value="radial">Radial</option>
            </Select>
          </label>
          <label className="block border border-[var(--border)] p-3">Accent intensity <Slider label="Accent intensity" className="mt-2 w-full"  min={0.7} max={1.2} step={0.05} value={theme.accentIntensity} onValueChange={(nextValue) => updateTheme({ accentIntensity: Number(nextValue) })} /></label>
          <label className="block border border-[var(--border)] p-3">Font scale <Slider label="Font scale" className="mt-2 w-full"  min={0.85} max={1.2} step={0.05} value={theme.fontScale} onValueChange={(nextValue) => updateTheme({ fontScale: Number(nextValue) })} /></label>
        </div>
      </DisclosureBody></Disclosure>

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
