import { useCallback, useEffect, useRef, useState } from "react";

type AudioStatus = "idle" | "listening" | "denied" | "unavailable" | "stopped";

type AudioMetrics = {
  volume: number;
  bass: number;
  mid: number;
  high: number;
};

const idleMetrics: AudioMetrics = { volume: 0, bass: 0, mid: 0, high: 0 };

function averageRange(data: Uint8Array, start: number, end: number): number {
  const safeStart = Math.max(0, Math.min(data.length - 1, start));
  const safeEnd = Math.max(safeStart + 1, Math.min(data.length, end));
  let total = 0;
  for (let index = safeStart; index < safeEnd; index += 1) total += data[index];
  return total / (safeEnd - safeStart) / 255;
}

export function OrbitModule() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const metricsRef = useRef<AudioMetrics>(idleMetrics);
  const smoothedRef = useRef<AudioMetrics>(idleMetrics);
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [sensitivity, setSensitivity] = useState(1.15);
  const [smoothing, setSmoothing] = useState(0.78);
  const [intensity, setIntensity] = useState(1);
  const [frozen, setFrozen] = useState(false);

  const stopListening = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    metricsRef.current = idleMetrics;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setStatus((current) => (current === "denied" || current === "unavailable" ? current : "stopped"));
  }, []);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }
    try {
      stopListening();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = Math.max(0.45, Math.min(0.95, smoothing));
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setStatus("listening");
    } catch (error) {
      const reason = error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";
      setStatus(reason);
    }
  }, [smoothing, stopListening]);

  useEffect(() => {
    if (analyserRef.current) analyserRef.current.smoothingTimeConstant = Math.max(0.45, Math.min(0.95, smoothing));
  }, [smoothing]);

  useEffect(() => {
    let raf = 0;
    const frequencyData = new Uint8Array(512);
    const draw = (time: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(rect.width * scale));
      const height = Math.max(320, Math.floor(rect.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const analyser = analyserRef.current;
      if (analyser && status === "listening" && !frozen) {
        analyser.getByteFrequencyData(frequencyData);
        metricsRef.current = {
          volume: averageRange(frequencyData, 0, frequencyData.length),
          bass: averageRange(frequencyData, 2, 12),
          mid: averageRange(frequencyData, 12, 80),
          high: averageRange(frequencyData, 80, 220),
        };
      } else if (!frozen) {
        metricsRef.current = idleMetrics;
      }

      const target = metricsRef.current;
      const ease = Math.max(0.04, 1 - smoothing);
      smoothedRef.current = {
        volume: smoothedRef.current.volume + (target.volume - smoothedRef.current.volume) * ease,
        bass: smoothedRef.current.bass + (target.bass - smoothedRef.current.bass) * ease,
        mid: smoothedRef.current.mid + (target.mid - smoothedRef.current.mid) * ease,
        high: smoothedRef.current.high + (target.high - smoothedRef.current.high) * ease,
      };

      const metrics = smoothedRef.current;
      const reactive = status === "listening" && !frozen;
      const idleBreath = 0.5 + Math.sin(time * 0.0012) * 0.5;
      const amplitude = reactive ? Math.min(1, metrics.volume * sensitivity * 2.35) : idleBreath * 0.1;
      const bass = reactive ? metrics.bass * sensitivity : idleBreath * 0.08;
      const mid = reactive ? metrics.mid * sensitivity : 0.05 + idleBreath * 0.04;
      const high = reactive ? metrics.high * sensitivity : 0.04;
      const cx = width / 2;
      const cy = height / 2;
      const minSide = Math.min(width, height);
      const baseRadius = minSide * 0.275;
      const orbRadius = baseRadius * (1 + amplitude * 0.22 * intensity);
      const pointCount = 180;

      context.clearRect(0, 0, width, height);
      const background = context.createRadialGradient(cx, cy, 0, cx, cy, minSide * 0.72);
      background.addColorStop(0, "#10100e");
      background.addColorStop(0.46, "#080807");
      background.addColorStop(1, "#040403");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const halo = context.createRadialGradient(cx, cy, orbRadius * 0.25, cx, cy, orbRadius * (2.25 + amplitude));
      halo.addColorStop(0, `rgba(248, 246, 238, ${0.2 + amplitude * 0.28})`);
      halo.addColorStop(0.34, `rgba(232, 228, 218, ${0.08 + bass * 0.22})`);
      halo.addColorStop(1, "rgba(232, 228, 218, 0)");
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, orbRadius * (2.4 + amplitude), 0, Math.PI * 2);
      context.fill();

      context.save();
      context.globalCompositeOperation = "lighter";
      for (let filament = 0; filament < 18; filament += 1) {
        const orbit = time * (0.00008 + filament * 0.000004) + filament * 0.72;
        const stretch = 1.18 + Math.sin(filament * 2.1) * 0.18 + high * 0.28;
        const alpha = 0.025 + amplitude * 0.05 + (filament % 3) * 0.006;
        context.beginPath();
        context.ellipse(cx, cy, orbRadius * stretch, orbRadius * (0.34 + bass * 0.24), orbit, 0, Math.PI * 2);
        context.strokeStyle = `rgba(248, 246, 238, ${alpha})`;
        context.lineWidth = (0.7 + high * 1.2) * scale;
        context.shadowColor = "rgba(248, 246, 238, 0.42)";
        context.shadowBlur = (12 + amplitude * 24) * scale;
        context.stroke();
      }
      context.restore();

      for (let layer = 4; layer >= 0; layer -= 1) {
        const layerShift = layer * 0.56;
        const alpha = 0.08 + (4 - layer) * 0.045 + amplitude * 0.08;
        context.beginPath();
        for (let index = 0; index <= pointCount; index += 1) {
          const angle = (index / pointCount) * Math.PI * 2;
          const organic =
            Math.sin(angle * 3 + time * 0.0015 + layerShift) * (10 + mid * 38) +
            Math.sin(angle * 7 - time * 0.0019 + layerShift) * (6 + high * 30) +
            Math.sin(angle * 13 + time * 0.0009) * (3 + bass * 22);
          const radius = orbRadius + organic * intensity + layer * (5 + amplitude * 8);
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.strokeStyle = `rgba(247, 245, 238, ${alpha})`;
        context.lineWidth = (layer === 0 ? 2.2 : 1) * scale;
        context.shadowColor = "rgba(248, 246, 238, 0.48)";
        context.shadowBlur = (18 + amplitude * 34 + layer * 4) * scale;
        context.stroke();
      }

      context.shadowBlur = 0;
      const core = context.createRadialGradient(cx - orbRadius * 0.22, cy - orbRadius * 0.28, 0, cx, cy, orbRadius);
      core.addColorStop(0, `rgba(255, 254, 248, ${0.28 + amplitude * 0.18})`);
      core.addColorStop(0.42, `rgba(214, 211, 203, ${0.1 + mid * 0.12})`);
      core.addColorStop(1, "rgba(10, 10, 9, 0.02)");
      context.fillStyle = core;
      context.beginPath();
      context.arc(cx, cy, orbRadius * 0.96, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 0.16 + high * 0.35;
      context.strokeStyle = "#f7f5ee";
      context.lineWidth = scale;
      for (let ring = 0; ring < 5; ring += 1) {
        const radius = orbRadius * (0.42 + ring * 0.13 + Math.sin(time * 0.0008 + ring) * 0.018);
        context.beginPath();
        context.ellipse(cx, cy, radius * (1.05 + mid * 0.2), radius * (0.48 + bass * 0.28), time * 0.0004 + ring * 0.74, 0, Math.PI * 2);
        context.stroke();
      }
      context.globalAlpha = 1;

      for (let spark = 0; spark < 44; spark += 1) {
        const seed = spark * 91.7;
        const angle = seed + time * (0.00012 + high * 0.0002);
        const radius = orbRadius * (0.3 + ((Math.sin(seed) + 1) / 2) * (1.5 + amplitude * 0.6));
        const alpha = 0.08 + ((Math.sin(time * 0.002 + seed) + 1) / 2) * (0.14 + high * 0.26);
        context.fillStyle = `rgba(250, 248, 241, ${alpha})`;
        context.fillRect(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1.4 * scale, 1.4 * scale);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frozen, intensity, sensitivity, smoothing, status]);

  useEffect(() => stopListening, [stopListening]);

  const modeLabel = frozen ? "frozen" : status === "listening" ? "reactive" : "idle";
  const permissionLabel = status === "denied" ? "microphone denied" : status === "unavailable" ? "audio unavailable" : status;

  return (
    <section className="orbit-shell panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-2.5">
        <div>
          <h1 className="text-base font-semibold tracking-[-0.02em]">Orbit</h1>
          <p className="text-[11px] text-[var(--muted)]">Audio-reactive presence, ice-white signal on old black.</p>
        </div>
        <div className="shrink-0 border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          {modeLabel} / {permissionLabel}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[1fr_248px]">
        <div className="orbit-stage relative min-h-[420px] overflow-hidden bg-[#070706]">
          <canvas ref={canvasRef} className="h-full min-h-[420px] w-full" />
          <div className="pointer-events-none absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 text-[11px] text-[var(--muted)]">
            <span>source: {status === "listening" ? "microphone" : "procedural idle"}</span>
            <span>gain {intensity.toFixed(1)} / smooth {smoothing.toFixed(2)}</span>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
          <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-3 text-sm text-[var(--muted)]">Audio</div>
            <div className="grid gap-2">
              <button className="border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface2)] disabled:opacity-45" onClick={startListening} disabled={status === "listening"}>
                Start listening
              </button>
              <button className="border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface2)] disabled:opacity-45" onClick={stopListening} disabled={status !== "listening"}>
                Stop listening
              </button>
              <button className="border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface2)] disabled:opacity-45" onClick={() => setFrozen((value) => !value)}>
                {frozen ? "Resume reaction" : "Freeze reaction"}
              </button>
            </div>
          </div>

          <details className="border border-[var(--border)] bg-[var(--surface)] p-3">
            <summary className="cursor-pointer text-sm text-[var(--muted)]">Visual tuning</summary>
            <div className="mt-3 space-y-3 text-xs">
              <label className="block">
                Sensitivity {sensitivity.toFixed(2)}
                <input className="w-full" type="range" min={0.4} max={2.4} step={0.05} value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
              </label>
              <label className="block">
                Smoothing {smoothing.toFixed(2)}
                <input className="w-full" type="range" min={0.55} max={0.94} step={0.01} value={smoothing} onChange={(event) => setSmoothing(Number(event.target.value))} />
              </label>
              <label className="block">
                Intensity {intensity.toFixed(2)}
                <input className="w-full" type="range" min={0.35} max={1.8} step={0.05} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
              </label>
              <button className="w-full border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface2)] disabled:opacity-45" onClick={() => {
                setSensitivity(1.15);
                setSmoothing(0.78);
                setIntensity(1);
                setFrozen(false);
              }}>
                Reset visuals
              </button>
            </div>
          </details>

          {(status === "denied" || status === "unavailable") && (
            <div className="border border-[var(--border)] bg-[var(--surface2)] p-3 text-xs text-[var(--muted)]">
              Orbit is running in idle mode. Check microphone permissions, then start listening again when available.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
