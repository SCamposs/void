import clip0 from "./sounds/move.ogg";
import clip1 from "./sounds/rotate.ogg";
import clip2 from "./sounds/soft-drop.ogg";
import clip3 from "./sounds/hard-drop.ogg";
import clip4 from "./sounds/lock.ogg";
import clip5 from "./sounds/hold.ogg";
import clip6 from "./sounds/line-clear.ogg";
import clip7 from "./sounds/quad.ogg";
import clip8 from "./sounds/t-spin.ogg";
import clip9 from "./sounds/all-clear.ogg";
import clip10 from "./sounds/back-to-back.ogg";
import clip11 from "./sounds/combo-1.ogg";
import clip12 from "./sounds/combo-2.ogg";
import clip13 from "./sounds/combo-3.ogg";
import clip14 from "./sounds/combo-4.ogg";
import clip15 from "./sounds/countdown-tick.ogg";
import clip16 from "./sounds/countdown-go.ogg";
import clip17 from "./sounds/pause.ogg";
import clip18 from "./sounds/resume.ogg";
import clip19 from "./sounds/game-over.ogg";
import clip20 from "./sounds/sprint-clear.ogg";
import clip21 from "./sounds/menu.ogg";
import clip22 from "./sounds/apply.ogg";
import type { StackerSoundEvent, StackerSoundSettings } from "./audio";

// Asset provenance and reproducible processing live beside the recordings.
const CLIPS: Record<string, string> = {
  "move": clip0,
  "rotate": clip1,
  "soft-drop": clip2,
  "hard-drop": clip3,
  "lock": clip4,
  "hold": clip5,
  "line-clear": clip6,
  "quad": clip7,
  "t-spin": clip8,
  "all-clear": clip9,
  "back-to-back": clip10,
  "combo-1": clip11,
  "combo-2": clip12,
  "combo-3": clip13,
  "combo-4": clip14,
  "countdown-tick": clip15,
  "countdown-go": clip16,
  "pause": clip17,
  "resume": clip18,
  "game-over": clip19,
  "sprint-clear": clip20,
  "menu": clip21,
  "apply": clip22,
};
type Mix = {
  output: GainNode;
  voices: Set<AudioBufferSourceNode>;
  lastPlayed: Map<string, number>;
};
const mixes = new WeakMap<BaseAudioContext, Mix>();
const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const loading = new WeakMap<BaseAudioContext, Promise<void>>();

export function stackerOutput(audio: BaseAudioContext, settings: StackerSoundSettings): GainNode {
  let mix = mixes.get(audio);
  if (!mix) {
    const output = audio.createGain();
    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = .003;
    compressor.release.value = .12;
    output.connect(compressor);
    compressor.connect(audio.destination);
    mix = { output, voices: new Set(), lastPlayed: new Map() };
    mixes.set(audio, mix);
  }
  const volume = Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : 0;
  mix.output.gain.setTargetAtTime(settings.enabled ? volume * .82 : 0, audio.currentTime, .008);
  return mix.output;
}

/** Preload during the user gesture/countdown; missing files retain synthesis. */
export function prepareStackerReferenceAudio(audio: BaseAudioContext): Promise<void> {
  const current = loading.get(audio);
  if (current) return current;
  const decoded = new Map<string, AudioBuffer>();
  buffers.set(audio, decoded);
  const ready = Promise.all(Object.entries(CLIPS).map(async ([name, url]) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      decoded.set(name, await audio.decodeAudioData(await response.arrayBuffer()));
    } catch { /* Offline/missing assets use the procedural fallback. */ }
  })).then(() => undefined);
  loading.set(audio, ready);
  return ready;
}

export function playStackerReferenceSound(audio: BaseAudioContext, event: StackerSoundEvent, settings: StackerSoundSettings, detail: number): boolean {
  if (settings.pack !== "void-soft") return false;
  const name = event === "combo" ? `combo-${Math.max(1, Math.min(4, Math.trunc(detail)))}` : event;
  const buffer = buffers.get(audio)?.get(name);
  if (!buffer) { void prepareStackerReferenceAudio(audio); return false; }
  const output = stackerOutput(audio, settings);
  const mix = mixes.get(audio)!;
  const now = audio.currentTime;
  // Repeated movement stays audible without stacking dozens of transients.
  const gap = event === "move" ? .035 : event === "soft-drop" ? .05 : .012;
  if (now - (mix.lastPlayed.get(name) ?? -Infinity) < gap) return true;
  mix.lastPlayed.set(name, now);
  if (mix.voices.size >= 20) {
    const oldest = mix.voices.values().next().value;
    oldest?.stop();
    if (oldest) mix.voices.delete(oldest);
  }
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const impact = Number.isFinite(settings.impact) ? Math.max(.25, Math.min(1.75, settings.impact)) : 1;
  gain.gain.value = event === "hard-drop" || event === "lock" ? impact : Math.sqrt(impact);
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(output);
  mix.voices.add(source);
  source.onended = () => { source.disconnect(); gain.disconnect(); mix.voices.delete(source); };
  source.start(now);
  return true;
}
