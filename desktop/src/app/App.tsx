import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore, type ModuleId } from "./store/appStore";
import { TypingModule } from "./modules/typing/TypingModule";
import { OrbitModule } from "./modules/orbit/OrbitModule";
import { StackerModule } from "./modules/stacker/StackerModule";
import { BootIntro } from "./components/intro/BootIntro";

function SettingsModule() {
  const { theme, updateTheme } = useAppStore();
  return <div className="panel max-w-3xl p-5">
    <h1 className="mb-1 text-lg font-semibold tracking-[-0.02em]">Interface settings</h1>
    <p className="mb-5 text-sm text-[var(--muted)]">Keep the monitor texture present without letting it crowd the modules.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex items-center justify-between gap-3 border border-[var(--border)] p-3">Scanlines <input type="checkbox" checked={theme.scanlines} onChange={(e) => updateTheme({ scanlines: e.target.checked })} /></label>
      <label className="flex items-center justify-between gap-3 border border-[var(--border)] p-3">Dense layout <input type="checkbox" checked={theme.dense} onChange={(e) => updateTheme({ dense: e.target.checked })} /></label>
      <label className="block border border-[var(--border)] p-3">Noise <input className="mt-2 w-full" type="range" min={0} max={0.35} step={0.01} value={theme.noise} onChange={(e) => updateTheme({ noise: Number(e.target.value) })} /></label>
      <label className="block border border-[var(--border)] p-3">Glow <input className="mt-2 w-full" type="range" min={0} max={0.4} step={0.01} value={theme.glow} onChange={(e) => updateTheme({ glow: Number(e.target.value) })} /></label>
      <label className="block border border-[var(--border)] p-3">Font scale <input className="mt-2 w-full" type="range" min={0.85} max={1.2} step={0.05} value={theme.fontScale} onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })} /></label>
    </div>
  </div>;
}

function Home({ jump }: { jump: (module: ModuleId) => void }) {
  const modules: Array<{ id: ModuleId; title: string; status: string; detail: string }> = [
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
  const [showIntro, setShowIntro] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const jump = useCallback((m: ModuleId) => { setModule(m); setShowPalette(false); }, [setModule]);

  useEffect(() => {
    const t = setTimeout(() => setShowIntro(false), 3600);
    return () => clearTimeout(t);
  }, []);
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
    if (module === "orbit") return <OrbitModule />;
    if (module === "stacker") return <StackerModule />;
    if (module === "settings") return <SettingsModule />;
    return <Home jump={jump} />;
  }, [jump, module]);

  const moduleItems: Array<{ id: ModuleId; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "H" },
    { id: "typing", label: "Typing", icon: "T" },
    { id: "orbit", label: "Orbit", icon: "O" },
    { id: "stacker", label: "Stacker", icon: "S" },
    { id: "settings", label: "Settings", icon: "*" },
  ];
  const focusedModule = module === "orbit" || module === "stacker";

  return <div
    className={`relative flex h-screen flex-col overflow-hidden ${theme.scanlines ? "crt" : ""} boot`}
    style={{
      fontSize: `${theme.fontScale}rem`,
      ["--glowStrength" as string]: String(theme.glow),
      ["--noiseStrength" as string]: String(theme.noise),
      ["--accentMix" as string]: String(theme.accentIntensity),
    }}
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
      <span className="text-xs text-[var(--muted)]">Desktop / {module}</span>
    </header>
    <div className={`grid min-h-0 flex-1 ${sidebarCollapsed ? "grid-cols-[52px_1fr]" : theme.dense ? "grid-cols-[152px_1fr]" : "grid-cols-[184px_1fr]"}`}>
      <aside className="panel min-h-0 space-y-2 overflow-hidden p-2">
        {moduleItems.map((item) => (
          <button
            key={item.id}
            className={`flex w-full items-center gap-2 border border-[var(--border)] px-2 py-2 text-left text-sm hover:bg-[var(--surface2)] ${sidebarCollapsed ? "justify-center" : ""} ${module === item.id ? "bg-[var(--surface2)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
            onClick={() => setModule(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-[var(--border)] text-[10px]" aria-hidden="true">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
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
