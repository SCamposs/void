export type OrbitAudioStatus = "idle" | "listening" | "denied" | "unavailable" | "stopped";

export type OrbitAudioMetrics = {
  volume: number;
  bass: number;
  mid: number;
  high: number;
};

export const EMPTY_ORBIT_METRICS: OrbitAudioMetrics = {
  volume: 0,
  bass: 0,
  mid: 0,
  high: 0,
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function averageFrequencyRange(data: Uint8Array, start: number, end: number): number {
  if (data.length === 0) return 0;
  const safeStart = Math.floor(clamp(start, 0, data.length - 1));
  const safeEnd = Math.floor(clamp(end, safeStart + 1, data.length));
  let total = 0;
  for (let index = safeStart; index < safeEnd; index += 1) total += data[index];
  return clamp(total / (safeEnd - safeStart) / 255);
}

export function normalizeAmplitude(value: number, sensitivity: number): number {
  const gated = Math.max(0, value - 0.018);
  return clamp(gated * clamp(sensitivity, 0.1, 4) * 2.45);
}

export function smoothMetrics(
  current: OrbitAudioMetrics,
  target: OrbitAudioMetrics,
  smoothing: number,
): OrbitAudioMetrics {
  const ease = clamp(1 - smoothing, 0.02, 1);
  return {
    volume: current.volume + (target.volume - current.volume) * ease,
    bass: current.bass + (target.bass - current.bass) * ease,
    mid: current.mid + (target.mid - current.mid) * ease,
    high: current.high + (target.high - current.high) * ease,
  };
}

export function fallbackStatus(error: unknown, hasAudioApi: boolean): OrbitAudioStatus {
  if (!hasAudioApi) return "unavailable";
  return error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "unavailable";
}
