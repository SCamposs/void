import { useEffect, useMemo, useState } from "react";
import { useAppStore, type ModuleId } from "./store/appStore";
import { TypingModule } from "./modules/typing/TypingModule";
import { OrbitModule } from "./modules/orbit/OrbitModule";
import { StackerModule } from "./modules/stacker/StackerModule";
import { BootIntro } from "./components/intro/BootIntro";

function SettingsModule() {
  const { theme, updateTheme } = useAppStore();
  return <div className="panel p-4 space-y-2">
    <label className="block">Scanlines <input type="checkbox" checked={theme.scanlines} onChange={(e) => updateTheme({ scanlines: e.target.checked })} /></label>
    <label className="block">Noise <input type="range" min={0} max={0.35} step={0.01} value={theme.noise} onChange={(e) => updateTheme({ noise: Number(e.target.value) })} /></label>
    <label className="block">Glow <input type="range" min={0} max={0.4} step={0.01} value={theme.glow} onChange={(e) => updateTheme({ glow: Number(e.target.value) })} /></label>
    <label className="block">Flicker <input type="range" min={0} max={0.08} step={0.01} value={theme.flicker} onChange={(e) => updateTheme({ flicker: Number(e.target.value) })} /></label>
    <label className="block">Dense <input type="checkbox" checked={theme.dense} onChange={(e) => updateTheme({ dense: e.target.checked })} /></label>
    <label className="block">Accent intensity <input type="range" min={0.7} max={1.4} step={0.05} value={theme.accentIntensity} onChange={(e) => updateTheme({ accentIntensity: Number(e.target.value) })} /></label>
    <label className="block">Font scale <input type="range" min={0.85} max={1.2} step={0.05} value={theme.fontScale} onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })} /></label>
  </div>;
}

function Home() {
  return <div className="panel p-4">VOID desktop shell ready. Click a module or press Ctrl+K for command palette.</div>;
}

export function App() {
  const { module, setModule, theme } = useAppStore();
  const [showIntro, setShowIntro] = useState(true);
  const [showPalette, setShowPalette] = useState(false);

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
    return <Home />;
  }, [module]);

  const jump = (m: ModuleId) => { setModule(m); setShowPalette(false); };

  return <div
    className={`relative h-screen ${theme.scanlines ? "crt" : ""} boot`}
    style={{
      fontSize: `${theme.fontScale}rem`,
      ["--glowStrength" as string]: String(theme.glow),
      ["--noiseStrength" as string]: String(theme.noise),
      ["--flickerStrength" as string]: String(theme.flicker),
      ["--accentMix" as string]: String(theme.accentIntensity),
    }}
  >
    <header className="panel flex h-10 items-center justify-between px-3">VOID <span className="text-[var(--muted)]">Desktop</span></header>
    <div className={`grid h-[calc(100vh-4rem)] ${theme.dense ? "grid-cols-[160px_1fr_220px]" : "grid-cols-[200px_1fr_260px]"}`}>
      <aside className="panel p-2 space-y-2">
        {(["home", "typing", "orbit", "stacker", "settings"] as const).map((m) => <button key={m} className="block w-full border border-[var(--border)] px-2 py-1 text-left" onClick={() => setModule(m)}>{m}</button>)}
      </aside>
      <main className="p-3">{content}</main>
      <aside className="panel p-3 text-sm">Inspector panel<br/>Mode: {module}<br/>Theme: ice/charcoal</aside>
    </div>
    <footer className="panel flex h-6 items-center justify-between px-3 text-xs"><span>Ctrl+K command palette</span><span>status: operational</span></footer>

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
