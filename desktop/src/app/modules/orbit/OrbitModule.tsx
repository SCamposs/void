import { useEffect, useRef, useState } from "react";

type Mode = "globe" | "scanner" | "field";

export function OrbitModule() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("globe");
  const [running, setRunning] = useState(true);
  const [density, setDensity] = useState(24);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let id = 0;
    const draw = () => {
      if (!running) return;
      frame += 1;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0b0b0a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e8e4da";
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < density; i += 1) {
        const y = (i / density) * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      const cx = w / 2; const cy = h / 2;
      ctx.globalAlpha = 1;
      if (mode === "globe") {
        ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i += 1) {
          const r = 20 + i * 12;
          ctx.beginPath(); ctx.arc(cx, cy, r, frame * 0.01, frame * 0.01 + Math.PI); ctx.stroke();
        }
      } else if (mode === "scanner") {
        const angle = frame * 0.03;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * 180, cy + Math.sin(angle) * 180); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 180, 0, Math.PI * 2); ctx.stroke();
      } else {
        for (let i = 0; i < density * 8; i += 1) ctx.fillRect((i * 37 + frame * 2) % w, (i * 53) % h, 2, 2);
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [mode, running, density]);

  return <div className="panel p-3">
    <div className="mb-2 flex flex-wrap gap-2">
      <button onClick={() => setMode("globe")} className="border px-2">Globe</button>
      <button onClick={() => setMode("scanner")} className="border px-2">Scanner</button>
      <button onClick={() => setMode("field")} className="border px-2">Field</button>
      <button onClick={() => setRunning((v) => !v)} className="border px-2">{running ? "Pause" : "Resume"}</button>
      <button onClick={() => { setDensity(24); setMode("globe"); setRunning(true); }} className="border px-2">Reset</button>
      <label className="text-sm">Density <input type="range" min={8} max={40} step={1} value={density} onChange={(e) => setDensity(Number(e.target.value))} /></label>
    </div>
    <div className="mb-2 text-sm text-[var(--muted)]">Telemetry: signal {running ? "LOCK" : "PAUSE"} | mode {mode.toUpperCase()} | density {density}</div>
    <canvas ref={canvasRef} width={760} height={420} className="w-full border border-[var(--border)]" />
  </div>;
}
