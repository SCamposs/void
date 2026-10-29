import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, AudioLines, Home as HomeIcon, Keyboard, Layers3, PanelLeft, Search, Settings, X } from "lucide-react";
import { useAppStore, type ModuleId } from "./store/appStore";
import { TypingModule } from "./modules/typing/TypingModule";
import { StackerModule } from "./modules/stacker/StackerModule";
import { BootIntro } from "./components/intro/BootIntro";
import { UpdateDot } from "./modules/updater/UpdatePanel";
import { scheduleUpdateChecks, useUpdateStore } from "./modules/updater/updateStore";
import { Button, Input, ScrollSurface, Tooltip, TooltipProvider } from "./components/ui/Controls";
import { VoidMark } from "./components/ui/VoidMark";
import { WindowControls } from "./components/shell/WindowControls";
import { SettingsModule } from "./components/shell/SettingsModule";

const MindModule = lazy(() => import("./modules/mind/MindModule").then((module) => ({ default: module.MindModule })));
const OrbitModule = lazy(() => import("./modules/orbit/OrbitModule").then((module) => ({ default: module.OrbitModule })));
const destinations = [
  { id: "home", label: "Home", icon: HomeIcon, detail: "Your space to begin." },
  { id: "mind", label: "Mind", icon: VoidMark, detail: "Think and write with a local model." },
  { id: "typing", label: "Typing", icon: Keyboard, detail: "Find your rhythm, one word at a time." },
  { id: "orbit", label: "Orbit", icon: AudioLines, detail: "A visual instrument that responds to sound." },
  { id: "stacker", label: "Stacker", icon: Layers3, detail: "Make room for the next piece." },
  { id: "settings", label: "Settings", icon: Settings, detail: "Appearance, updates and your local data." },
] as const;

function Home({ jump }: { jump(module: ModuleId): void }) {
  return <ScrollSurface label="Home"><div className="void-home">
    <section className="home-intro"><VoidMark className="home-mark" /><h1>A little space to focus.</h1><p>Practice, explore, or take a moment to think.</p></section>
    <section className="home-destinations" aria-label="Modules">{destinations.filter((item) => item.id !== "home" && item.id !== "settings").map(({ id, label, icon: Icon, detail }) =>
      <Button key={id} className="home-destination" onClick={() => jump(id)}><Icon size={20} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden="true" /></Button>
    )}</section>
    <Button className="home-shortcut" onClick={() => window.dispatchEvent(new CustomEvent("void:open-navigation"))}><Search size={14} aria-hidden="true" />Find your way<kbd>Ctrl K</kbd></Button>
  </div></ScrollSurface>;
}

export function App() {
  const { module, setModule, theme, sidebarCollapsed, toggleSidebar } = useAppStore();
  const updateAvailable = useUpdateStore((state) => state.status === "available");
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const [showIntro, setShowIntro] = useState(true);
  const [showPalette, setShowPalette] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const values = { "--fontScale": theme.fontScale, "--glowStrength": theme.glow, "--accentMix": theme.accentIntensity, "--noiseStrength": theme.noise, "--scanlineStrength": theme.scanlineIntensity };
    const previous = Object.keys(values).map((key) => [key, root.style.getPropertyValue(key)]);
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, String(value)));
    return () => previous.forEach(([key, value]) => { if (value) root.style.setProperty(key, value); else root.style.removeProperty(key); });
  }, [theme.fontScale, theme.glow, theme.accentIntensity, theme.noise, theme.scanlineIntensity]);
  const jump = useCallback((next: ModuleId) => { setModule(next); setShowPalette(false); }, [setModule]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setShowIntro(false), reduced ? 0 : 3200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => scheduleUpdateChecks(checkForUpdates), [checkForUpdates]);
  useEffect(() => {
    const open = () => setShowPalette(true);
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setShowPalette((value) => !value); }
      if ((event.ctrlKey || event.metaKey) && event.key === ",") { event.preventDefault(); jump("settings"); }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("void:open-navigation", open);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("void:open-navigation", open); };
  }, [jump]);
  const content = useMemo(() => {
    if (module === "typing") return <TypingModule />;
    if (module === "mind") return <MindModule />;
    if (module === "orbit") return <OrbitModule />;
    if (module === "stacker") return <StackerModule />;
    if (module === "settings") return <ScrollSurface label="Settings"><SettingsModule /></ScrollSurface>;
    return <Home jump={jump} />;
  }, [module, jump]);
  return <TooltipProvider><div className={`void-app ${theme.scanlines ? "crt" : ""} boot`} data-collapsed={sidebarCollapsed} data-dense={theme.dense} data-background={theme.backgroundTexture}>
    <header className="void-titlebar" data-tauri-drag-region>
      <Button className="void-wordmark" onClick={() => jump("home")} aria-label="Open Home"><VoidMark /><span>VOID</span></Button>
      <div className="titlebar-drag-space" data-tauri-drag-region />
      {updateAvailable && <Tooltip label="An update is ready"><Button className="titlebar-update" onClick={() => jump("settings")} aria-label="View available update"><UpdateDot />Update ready</Button></Tooltip>}
      <WindowControls />
    </header>
    <div className="void-shell">
      <aside className="void-sidebar"><div className="sidebar-tools"><Tooltip label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}><Button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!sidebarCollapsed}><PanelLeft size={18} /></Button></Tooltip></div>
        <nav aria-label="Primary navigation">{destinations.map(({ id, label, icon: Icon }) => <Tooltip key={id} label={label}><Button className="void-nav-item" aria-current={module === id ? "page" : undefined} aria-label={label} onClick={() => jump(id)}><Icon size={18} aria-hidden="true" /><span className="void-nav-label">{label}</span>{id === "settings" && updateAvailable && <span className="update-dot" />}</Button></Tooltip>)}</nav>
        <Tooltip label="Find a module (Ctrl K)"><Button className="void-nav-item sidebar-search" onClick={() => setShowPalette(true)} aria-label="Find a module"><Search size={17} /><span className="void-nav-label">Find a module</span></Button></Tooltip>
      </aside>
      <main className={`void-main module-${module}`}><Suspense fallback={<div className="module-loading" role="status">Opening {destinations.find((item) => item.id === module)?.label}…</div>}>{content}</Suspense></main>
    </div>
    <Dialog.Root open={showPalette} onOpenChange={(open) => { setShowPalette(open); if (!open) setQuery(""); }}><Dialog.Portal><Dialog.Backdrop className="void-dialog-backdrop" /><Dialog.Popup className="void-command-palette" initialFocus={searchRef}>
      <div className="palette-heading"><Dialog.Title>Go somewhere</Dialog.Title><Dialog.Close render={<Button aria-label="Close navigation"><X size={17} /></Button>} /></div>
      <Dialog.Description className="sr-only">Find and open a VOID module.</Dialog.Description>
      <Input ref={searchRef} aria-label="Search modules" placeholder="Find a module…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="palette-results">{destinations.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase())).map(({ id, label, icon: Icon, detail }) => <Button key={id} onClick={() => jump(id)}><Icon size={18} aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={15} aria-hidden="true" /></Button>)}{!destinations.some((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase())) && <p role="status">No modules found.</p>}</div>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
    <BootIntro visible={showIntro} onSkip={() => setShowIntro(false)} />
  </div></TooltipProvider>;
}
