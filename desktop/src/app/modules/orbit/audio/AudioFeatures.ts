export type OrbitAudioFeatures = {
  overall: number;
  bass: number;
  mid: number;
  high: number;
  transient: number;
};

export const EMPTY_AUDIO_FEATURES: OrbitAudioFeatures = {
  overall: 0,
  bass: 0,
  mid: 0,
  high: 0,
  transient: 0,
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function frequencyBinRange(
  minHz: number,
  maxHz: number,
  sampleRate: number,
  fftSize: number,
  binCount: number,
): [number, number] {
  const hzPerBin = sampleRate / fftSize;
  const start = Math.floor(clamp(minHz / hzPerBin, 0, Math.max(0, binCount - 1)));
  const end = Math.max(start + 1, Math.ceil(clamp(maxHz / hzPerBin, 0, binCount)));
  return [start, Math.min(binCount, end)];
}

export function averageNormalizedBins(data: Uint8Array, start: number, end: number): number {
  if (data.length === 0) return 0;
  const from = Math.floor(clamp(start, 0, data.length - 1));
  const to = Math.floor(clamp(end, from + 1, data.length));
  let energy = 0;
  for (let index = from; index < to; index += 1) {
    const normalized = data[index] / 255;
    energy += normalized * normalized;
  }
  return clamp(Math.sqrt(energy / Math.max(1, to - from)));
}

export function gateAndNormalize(value: number, floor: number, sensitivity: number): number {
  const safeFloor = clamp(floor, 0, 0.4);
  const gated = Math.max(0, value - safeFloor) / Math.max(0.001, 1 - safeFloor);
  return clamp(Math.pow(gated, 0.62) * clamp(sensitivity, 0.5, 2) * 2.2);
}
