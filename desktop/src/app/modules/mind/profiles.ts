import type { GenerationSettings, MindProfileId } from "./types";

export const DEFAULT_SYSTEM_PROMPT = [
  "You are VOID Mind, a general-purpose local conversational AI.",
  "Be clear, honest about uncertainty, and useful across conversation, writing, explanation, brainstorming, and reasoning.",
  "Respond in Brazilian Portuguese when the user writes in Portuguese, while retaining strong English support.",
  "You have no autonomous tools, shell access, repository access, telemetry, or cloud inference.",
].join(" ");

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  seed: -1,
  maxTokens: 1024,
  context: 4096,
  stopSequences: [],
  gpuLayers: 24,
};

export const PROFILE_SETTINGS: Record<
  Exclude<MindProfileId, "custom">,
  Pick<GenerationSettings, "temperature" | "topP" | "topK" | "repeatPenalty" | "maxTokens">
> = {
  general: { temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1, maxTokens: 1024 },
  creative: { temperature: 1, topP: 0.95, topK: 60, repeatPenalty: 1.05, maxTokens: 1536 },
  analytical: { temperature: 0.35, topP: 0.85, topK: 30, repeatPenalty: 1.12, maxTokens: 1400 },
  concise: { temperature: 0.25, topP: 0.8, topK: 24, repeatPenalty: 1.12, maxTokens: 512 },
};

export function applyProfile(
  settings: GenerationSettings,
  profile: Exclude<MindProfileId, "custom">,
): GenerationSettings {
  return { ...settings, ...PROFILE_SETTINGS[profile] };
}
