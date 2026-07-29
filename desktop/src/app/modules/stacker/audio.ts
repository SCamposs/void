export type StackerSoundPack = "void-soft" | "glass" | "mechanical" | "muted";

export type StackerSoundEvent =
  | "move"
  | "rotate"
  | "soft-drop"
  | "hard-drop"
  | "lock"
  | "hold"
  | "line-clear"
  | "combo"
  | "pause"
  | "resume"
  | "game-over"
  | "menu"
  | "apply";

export type StackerSoundSettings = {
  enabled: boolean;
  uiEnabled: boolean;
  volume: number;
  impact: number;
  pack: StackerSoundPack;
};

type Tone = {
  frequency: number;
  durationMs: number;
  gain: number;
  wave: OscillatorType;
  offsetMs?: number;
  endFrequency?: number;
};

const PACK_CHARACTER: Record<StackerSoundPack, {
  wave: OscillatorType;
  filter: BiquadFilterType;
  cutoff: number;
  decay: number;
  echo: number;
  pitch: number;
}> = {
  "void-soft": { wave: "sine", filter: "lowpass", cutoff: 1500, decay: 1.1, echo: 0.12, pitch: 0.9 },
  glass: { wave: "triangle", filter: "highpass", cutoff: 520, decay: 1.35, echo: 0.2, pitch: 1.35 },
  mechanical: { wave: "square", filter: "bandpass", cutoff: 920, decay: 0.7, echo: 0.04, pitch: 0.72 },
  muted: { wave: "sine", filter: "lowpass", cutoff: 680, decay: 0.62, echo: 0.02, pitch: 0.62 },
};

function eventTones(event: StackerSoundEvent, detail = 0): Tone[] {
  switch (event) {
    case "move":
      return [{ frequency: 118, durationMs: 28, gain: 0.022, wave: "sine", endFrequency: 104 }];
    case "rotate":
      return [{ frequency: 176, durationMs: 42, gain: 0.032, wave: "triangle", endFrequency: 224 }];
    case "soft-drop":
      return [{ frequency: 92, durationMs: 24, gain: 0.018, wave: "sine", endFrequency: 74 }];
    case "hard-drop":
      return [
        { frequency: 94, durationMs: 62, gain: 0.07, wave: "triangle", endFrequency: 42 },
        { frequency: 188, durationMs: 28, gain: 0.025, wave: "sine", offsetMs: 8, endFrequency: 92 },
      ];
    case "lock":
      return [{ frequency: 76, durationMs: 48, gain: 0.04, wave: "sine", endFrequency: 58 }];
    case "hold":
      return [
        { frequency: 132, durationMs: 44, gain: 0.03, wave: "sine", endFrequency: 176 },
        { frequency: 176, durationMs: 46, gain: 0.025, wave: "triangle", offsetMs: 34, endFrequency: 132 },
      ];
    case "line-clear": {
      const lines = Math.max(1, Math.min(4, detail));
      return Array.from({ length: lines + 1 }, (_, index) => ({
        frequency: 128 * (1 + index * 0.38),
        durationMs: 70 + index * 14,
        gain: 0.045 + lines * 0.009,
        wave: index % 2 ? "triangle" : "sine",
        offsetMs: index * 34,
        endFrequency: 164 * (1 + index * 0.38),
      }));
    }
    case "combo":
      return [{ frequency: 250 + Math.min(8, detail) * 28, durationMs: 72, gain: 0.04, wave: "triangle", endFrequency: 330 + detail * 22 }];
    case "pause":
      return [{ frequency: 180, durationMs: 90, gain: 0.035, wave: "sine", endFrequency: 92 }];
    case "resume":
      return [{ frequency: 92, durationMs: 90, gain: 0.035, wave: "sine", endFrequency: 180 }];
    case "game-over":
      return [
        { frequency: 164, durationMs: 130, gain: 0.05, wave: "triangle", endFrequency: 122 },
        { frequency: 112, durationMs: 190, gain: 0.055, wave: "sine", offsetMs: 110, endFrequency: 48 },
      ];
    case "apply":
      return [
        { frequency: 164, durationMs: 45, gain: 0.03, wave: "sine", endFrequency: 206 },
        { frequency: 246, durationMs: 70, gain: 0.035, wave: "triangle", offsetMs: 36, endFrequency: 286 },
      ];
    default:
      return [{ frequency: 154, durationMs: 38, gain: 0.025, wave: "sine", endFrequency: 172 }];
  }
}

export function playStackerSound(
  audio: AudioContext | null,
  event: StackerSoundEvent,
  settings: StackerSoundSettings,
  detail = 0,
): void {
  const isUiEvent = event === "menu" || event === "apply";
  if (!audio || audio.state !== "running" || !settings.enabled || (isUiEvent && !settings.uiEnabled)) return;

  const volume = Math.max(0, Math.min(1, settings.volume));
  if (volume === 0) return;
  const impact = Math.max(0.25, Math.min(1.75, settings.impact));
  const character = PACK_CHARACTER[settings.pack];
  const now = audio.currentTime;
  const filter = audio.createBiquadFilter();
  const dry = audio.createGain();
  const delay = audio.createDelay(0.25);
  const echo = audio.createGain();

  filter.type = character.filter;
  filter.frequency.setValueAtTime(character.cutoff * (0.82 + impact * 0.18), now);
  filter.Q.setValueAtTime(settings.pack === "mechanical" ? 2.4 : 0.8, now);
  dry.gain.setValueAtTime(0.82, now);
  delay.delayTime.setValueAtTime(0.085, now);
  echo.gain.setValueAtTime(character.echo * volume, now);
  filter.connect(dry);
  filter.connect(delay);
  delay.connect(echo);
  echo.connect(audio.destination);
  dry.connect(audio.destination);

  let latestStop = now;
  for (const tone of eventTones(event, detail)) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const start = now + (tone.offsetMs ?? 0) / 1000;
    const duration = tone.durationMs * character.decay / 1000;
    const stop = start + duration;
    const frequency = tone.frequency * character.pitch;
    const endFrequency = (tone.endFrequency ?? tone.frequency) * character.pitch;
    oscillator.type = settings.pack === "void-soft" ? tone.wave : character.wave;
    oscillator.frequency.setValueAtTime(Math.max(24, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), stop);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain * volume * impact), start + Math.min(0.012, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(envelope);
    envelope.connect(filter);
    oscillator.start(start);
    oscillator.stop(stop + 0.01);
    latestStop = Math.max(latestStop, stop);
  }

  window.setTimeout(() => {
    filter.disconnect();
    dry.disconnect();
    delay.disconnect();
    echo.disconnect();
  }, Math.max(350, (latestStop - now) * 1000 + 280));
}
