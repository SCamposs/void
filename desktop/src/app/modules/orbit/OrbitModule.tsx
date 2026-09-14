import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitAudioAnalyzer, type OrbitAudioStatus } from "./audio/OrbitAudioAnalyzer";
import { OrbitControlsMinimal } from "./components/OrbitControlsMinimal";
import { CanvasFallbackRenderer } from "./renderer/CanvasFallbackRenderer";
import { OrbitRenderer, type OrbitRuntimeState } from "./renderer/OrbitRenderer";
import { chooseInitialQuality } from "./renderer/quality";
import { hasWebGL2Support } from "./renderer/webglSupport";
import { loadOrbitSettings, saveOrbitSettings, type OrbitSettings } from "./settings";
import "./orbit.css";

type OrbitController = Pick<OrbitRenderer, "dispose" | "pointerLeave" | "pointerMove" | "setMotion" | "setQuality">;

export function OrbitModule() {
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<OrbitController | null>(null);
  const analyzerRef = useRef(new OrbitAudioAnalyzer());
  const sensitivityRef = useRef(1);
  const controlsTimerRef = useRef<number | null>(null);
  const [settings, setSettings] = useState<OrbitSettings>(loadOrbitSettings);
  const [audioStatus, setAudioStatus] = useState<OrbitAudioStatus>("idle");
  const [runtimeState, setRuntimeState] = useState<OrbitRuntimeState | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  sensitivityRef.current = settings.sensitivity;

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2_600);
  }, []);

  const createCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    stage.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.className = "orbit-canvas";
    canvas.setAttribute("aria-hidden", "true");
    stage.append(canvas);
    return canvas;
  }, []);

  const createRenderer = useCallback(() => {
    rendererRef.current?.dispose();
    rendererRef.current = null;
    const readAudio = (delta: number) => analyzerRef.current.sample(delta, sensitivityRef.current);
    const createCanvasFallback = () => {
      const canvas = createCanvas();
      if (!canvas) throw new Error("Orbit stage is unavailable.");
      rendererRef.current = new CanvasFallbackRenderer({ canvas, motion: settings.motion, readAudio });
      setRuntimeState({ backend: "procedural", resolvedQuality: chooseInitialQuality(settings.quality), fallbackReason: "WebGL is unavailable." });
    };
    try {
      if (!hasWebGL2Support()) createCanvasFallback();
      else {
        const canvas = createCanvas();
        if (!canvas) return;
        rendererRef.current = new OrbitRenderer({
          canvas,
          quality: settings.quality,
          motion: settings.motion,
          readAudio,
          onState: setRuntimeState,
          onFailure: () => setFailure("Orbit couldn't initialize the visual field."),
        });
      }
      setFailure(null);
    } catch {
      try { createCanvasFallback(); setFailure(null); }
      catch { rendererRef.current = null; setFailure("Orbit couldn't initialize the visual field."); }
    }
  }, [createCanvas, settings.motion, settings.quality]);

  useEffect(() => {
    const analyzer = analyzerRef.current;
    createRenderer();
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      analyzer.stop();
      if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    };
    // Settings are applied incrementally by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setQuality(settings.quality);
    rendererRef.current?.setMotion(settings.motion);
    saveOrbitSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleAudio = useCallback(async () => {
    if (analyzerRef.current.status === "listening") {
      analyzerRef.current.stop();
      setAudioStatus("idle");
      revealControls();
      return;
    }
    setAudioStatus("requesting");
    setAudioStatus(await analyzerRef.current.start());
    revealControls();
  }, [revealControls]);

  const updateSettings = useCallback((next: OrbitSettings) => { setSettings(next); revealControls(); }, [revealControls]);

  return <section
    className="orbit-shell"
    aria-label="Orbit, an interactive audio-reactive particle field"
    onPointerMove={(event) => { rendererRef.current?.pointerMove(event.clientX, event.clientY); revealControls(); }}
    onPointerLeave={() => rendererRef.current?.pointerLeave()}
    onFocusCapture={revealControls}
  >
    <div ref={stageRef} className="absolute inset-0" aria-hidden="true" />
    {failure && <div className="orbit-failure" role="alert"><p>{failure}</p><button type="button" onClick={createRenderer}>Retry</button></div>}
    <OrbitControlsMinimal
      visible={controlsVisible}
      settingsOpen={settingsOpen}
      audioStatus={audioStatus}
      runtimeState={runtimeState}
      settings={settings}
      onToggleAudio={() => void toggleAudio()}
      onToggleSettings={() => { setSettingsOpen((open) => !open); revealControls(); }}
      onCloseSettings={() => setSettingsOpen(false)}
      onSettingsChange={updateSettings}
    />
  </section>;
}
