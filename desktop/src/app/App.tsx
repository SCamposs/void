import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore, type ModuleId } from "./store/appStore";
import { TypingModule } from "./modules/typing/TypingModule";
import { StackerModule } from "./modules/stacker/StackerModule";
import { BootIntro } from "./components/intro/BootIntro";
import { exportAppData, importAppData, resetAppData } from "./lib/persistence";
import { UpdateDot, UpdatePanel } from "./modules/updater/UpdatePanel";
import { scheduleUpdateChecks, useUpdateStore } from "./modules/updater/updateStore";

const MindModule = lazy(() =>
  import("./modules/mind/MindModule").then((module) => ({ default: module.MindModule })),
);
const OrbitModule = lazy(() =>
  import("./modules/orbit/OrbitModule").then((module) => ({ default: module.OrbitModule })),
);

function SettingsModule() {
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

  return <div className="panel h-full max-w-4xl overflow-auto p-5">
    <h1 className="mb-1 text-lg font-semibold tracking-[-0.02em]">Settings</h1>
    <p className="mb-5 max-w-[68ch] text-sm text-[var(--muted)]">Tune the app surface and manage local data. Orbit and Stacker keep module-specific controls inside their own settings panels.</p>

    <div className="space-y-3">
      <UpdatePanel />

      <details className="border border-[var(--border)] p-4" open>
        <summary className="cursor-pointer font-medium">App appearance</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 border border-[var(--border)] p-3">Scanlines <input type="checkbox" checked={theme.scanlines} onChange={(event) => updateTheme({ scanlines: event.target.checked })} /></label>
          <label className="flex items-center justify-between gap-3 border border-[var(--border)] p-3">Dense layout <input type="checkbox" checked={theme.dense} onChange={(event) => updateTheme({ dense: event.target.checked })} /></label>
          <label className="block border border-[var(--border)] p-3">Scanline intensity <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.scanlineIntensity * 100)}%</span><input className="mt-2 w-full" type="range" min={0} max={0.35} step={0.01} value={theme.scanlineIntensity} onChange={(event) => updateTheme({ scanlineIntensity: Number(event.target.value) })} /></label>
          <label className="block border border-[var(--border)] p-3">Noise <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.noise * 100)}%</span><input className="mt-2 w-full" type="range" min={0} max={0.25} step={0.01} value={theme.noise} onChange={(event) => updateTheme({ noise: Number(event.target.value) })} /></label>
          <label className="block border border-[var(--border)] p-3">Glow <span className="float-right text-xs text-[var(--muted)]">{Math.round(theme.glow * 100)}%</span><input className="mt-2 w-full" type="range" min={0} max={0.35} step={0.01} value={theme.glow} onChange={(event) => updateTheme({ glow: Number(event.target.value) })} /></label>
          <label className="block border border-[var(--border)] p-3">Background texture
            <select className="mt-2 w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={theme.backgroundTexture} onChange={(event) => updateTheme({ backgroundTexture: event.target.value as typeof theme.backgroundTexture })}>
              <option value="flat">Flat</option>
              <option value="vignette">Vignette</option>
              <option value="radial">Radial</option>
            </select>
          </label>
          <label className="block border border-[var(--border)] p-3">Accent intensity <input className="mt-2 w-full" type="range" min={0.7} max={1.2} step={0.05} value={theme.accentIntensity} onChange={(event) => updateTheme({ accentIntensity: Number(event.target.value) })} /></label>
          <label className="block border border-[var(--border)] p-3">Font scale <input className="mt-2 w-full" type="range" min={0.85} max={1.2} step={0.05} value={theme.fontScale} onChange={(event) => updateTheme({ fontScale: Number(event.target.value) })} /></label>
        </div>
      </details>

      <details className="border border-[var(--border)] p-4">
        <summary className="cursor-pointer font-medium">Local data</summary>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Export creates a portable JSON backup of VOID-owned settings and history. Import merges a valid backup and reloads the app.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button className="border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface2)]" onClick={downloadBackup}>Export app data</button>
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
          <button className="border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface2)]" onClick={() => {
            if (!window.confirm("Reset all VOID settings and local history? This cannot be undone without a backup.")) return;
            const count = resetAppData();
            setDataStatus(`Reset ${count} entries. Reloading...`);
            window.setTimeout(() => window.location.reload(), 450);
          }}>Reset local data</button>
        </div>
        {dataStatus && <p className="mt-3 text-xs text-[var(--accent)]" role="status">{dataStatus}</p>}
      </details>
    </div>
  </div>;
}

function Home({ jump }: { jump: (module: ModuleId) => void }) {
  const modules: Array<{ id: ModuleId; title: string; status: string; detail: string }> = [
    { id: "mind", title: "Mind", status: "local AI", detail: "Private conversations with a local GGUF model." },
    { id: "typing", title: "Typing", status: "practice", detail: "Portuguese word drills with local stats." },
    { id: "orbit", title: "Orbit", status: "ambient", detail: "A quiet full-window visual instrument." },
    { id: "stacker", title: "Stacker", status: "play", detail: "Sprint and endless stacking with local run archive." },
  ];

  return <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
    <section className="panel flex min-h-0 flex-col justify-between p-5">
      <div>
        <div className="mb-4 text-xs tracking-[0.22em] text-[var(--subtle)]">LOCAL DESKTOP SHELL</div>
        <h1 className="mb-3 text-2xl font-semibold tracking-[-0.02em]">VOID</h1>
        <p className="max-w-[62ch] text-sm leading-6 text-[var(--muted)]">
          A compact tool surface for focused modules, tuned around charcoal panels, ice-white signal, and stable monitor texture.
        </p>
      </div>
      <div className="mt-8 grid gap-2 text-xs sm:grid-cols-3">
        <div className="border border-[var(--border)] bg-[var(--surface2)] p-3">
          <div className="text-[var(--subtle)]">mode</div>
          <div>local-first</div>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface2)] p-3">
          <div className="text-[var(--subtle)]">texture</div>
          <div>steady CRT</div>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface2)] p-3">
          <div className="text-[var(--subtle)]">input</div>
          <div>keyboard ready</div>
        </div>
      </div>
    </section>

    <section className="panel min-h-0 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Modules</h2>
        <span className="text-xs text-[var(--muted)]">Ctrl+K opens palette</span>
      </div>
      <div className="space-y-2">
        {modules.map((item) => (
          <button
            key={item.id}
            className="w-full border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:border-[var(--accent)] hover:bg-[var(--surface2)]"
            onClick={() => jump(item.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{item.title}</span>
              <span className="text-[10px] text-[var(--subtle)]">{item.status}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">{item.detail}</div>
          </button>
        ))}
      </div>
    </section>
  </div>;
}

export function App() {
  const { module, setModule, theme, sidebarCollapsed, toggleSidebar } = useAppStore();
  const updateAvailable = useUpdateStore((state) => state.status === "available");
  const updateVersion = useUpdateStore((state) => state.candidate?.version);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const [showIntro, setShowIntro] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const jump = useCallback((m: ModuleId) => { setModule(m); setShowPalette(false); }, [setModule]);

  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => scheduleUpdateChecks(checkForUpdates), [checkForUpdates]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); setShowPalette((v) => !v); }
      if (e.key === "Escape") setShowPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const content = useMemo(() => {
    if (module === "typing") return <TypingModule />;
    if (module === "mind") return <Suspense fallback={<div className="panel flex h-full items-center justify-center text-sm text-[var(--muted)]">Loading Mind surface…</div>}><MindModule /></Suspense>;
    if (module === "orbit") return <Suspense fallback={<div className="h-full bg-black" />}><OrbitModule /></Suspense>;
    if (module === "stacker") return <StackerModule />;
    if (module === "settings") return <SettingsModule />;
    return <Home jump={jump} />;
  }, [jump, module]);

  const moduleItems: Array<{ id: ModuleId; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "H" },
    { id: "mind", label: "Mind", icon: "M" },
    { id: "typing", label: "Typing", icon: "T" },
    { id: "orbit", label: "Orbit", icon: "O" },
    { id: "stacker", label: "Stacker", icon: "S" },
    { id: "settings", label: "Settings", icon: "*" },
  ];
  const focusedModule = module === "mind" || module === "orbit" || module === "stacker";

  return <div
    className={`relative flex h-screen flex-col overflow-hidden ${theme.scanlines ? "crt" : ""} boot`}
    style={{
      fontSize: `${theme.fontScale}rem`,
      ["--glowStrength" as string]: String(theme.glow),
      ["--noiseStrength" as string]: String(theme.noise),
      ["--accentMix" as string]: String(theme.accentIntensity),
      ["--scanlineStrength" as string]: String(theme.scanlineIntensity),
    }}
    data-background={theme.backgroundTexture}
  >
    <header className="panel z-10 flex h-10 shrink-0 items-center justify-between px-3">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex h-7 w-7 items-center justify-center border border-[var(--border)] text-xs hover:bg-[var(--surface2)]"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? ">" : "<"}
        </button>
        <strong className="tracking-[0.12em]">VOID</strong>
      </div>
      <div className="flex items-center gap-3">
        {updateAvailable && <button
          className="inline-flex items-center gap-2 border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--accent)] hover:bg-[var(--surface2)]"
          onClick={() => setModule("settings")}
          aria-label={`Update ${updateVersion ?? "available"}`}
        >
          <UpdateDot />
          <span>Update v{updateVersion}</span>
        </button>}
        <span className="text-xs text-[var(--muted)]">Desktop / {module}</span>
      </div>
    </header>
    <div className={`app-shell-grid grid min-h-0 flex-1 ${sidebarCollapsed ? "grid-cols-[52px_1fr]" : theme.dense ? "grid-cols-[152px_1fr]" : "grid-cols-[184px_1fr]"}`}>
      <aside className="app-sidebar panel min-h-0 space-y-2 overflow-hidden p-2">
        {moduleItems.map((item) => (
          <button
            key={item.id}
            className={`flex w-full items-center gap-2 border border-[var(--border)] px-2 py-2 text-left text-sm hover:bg-[var(--surface2)] ${sidebarCollapsed ? "justify-center" : ""} ${module === item.id ? "bg-[var(--surface2)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
            onClick={() => setModule(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center border border-[var(--border)] text-[10px]" aria-hidden="true">
              {item.icon}
              {item.id === "settings" && updateAvailable && <span className="update-dot absolute -right-1 -top-1" />}
            </span>
            {!sidebarCollapsed && <span className="app-sidebar-label">{item.label}</span>}
          </button>
        ))}
      </aside>
      <main className={`min-h-0 overflow-hidden ${focusedModule ? "p-2" : "p-3"}`}>{content}</main>
    </div>
    <footer className="panel flex h-6 shrink-0 items-center justify-between px-3 text-xs"><span>Ctrl+K command palette</span><span>status: operational</span></footer>

    {showPalette && <div className="absolute inset-0 z-20 bg-black/50 p-8" onClick={() => setShowPalette(false)}>
      <div className="mx-auto max-w-xl border border-[var(--border)] bg-[var(--surface)] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-sm text-[var(--muted)]">Command Palette</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button className="border p-2 text-left" onClick={() => jump("home")}>Open Home</button>
          <button className="border p-2 text-left" onClick={() => jump("mind")}>Open Mind</button>
          <button className="border p-2 text-left" onClick={() => jump("typing")}>Open Typing</button>
          <button className="border p-2 text-left" onClick={() => jump("orbit")}>Open Orbit</button>
          <button className="border p-2 text-left" onClick={() => jump("stacker")}>Open Stacker</button>
          <button className="border p-2 text-left" onClick={() => jump("settings")}>Open Settings</button>
        </div>
      </div>
    </div>}
    <BootIntro visible={showIntro} onSkip={() => setShowIntro(false)} />
  </div>;
}
