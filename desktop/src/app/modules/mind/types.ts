export type MindRole = "system" | "user" | "assistant";
export type MindRuntimeMode = "external" | "managed";
export type MindRuntimeState =
  | "idle"
  | "checking"
  | "loading"
  | "ready"
  | "thinking"
  | "generating"
  | "stopped"
  | "error";

export type MindMessage = {
  id: string;
  role: Exclude<MindRole, "system">;
  content: string;
  createdAt: string;
  editedAt?: string;
};

export type MindChat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: MindMessage[];
  modelId?: string;
};

export type MindProfileId = "general" | "creative" | "analytical" | "concise" | "custom";

export type GenerationSettings = {
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  seed: number;
  maxTokens: number;
  context: number;
  stopSequences: string[];
  gpuLayers: number;
};

export type MindPolicySettings = {
  inputPolicyEnabled: boolean;
  outputPolicyEnabled: boolean;
  memoryEnabled: boolean;
  retainConversations: boolean;
};

export type ModelLineageEntry = {
  name: string;
  version: string;
  relation: "base" | "fine_tuned_from" | "merged_from" | "quantized_from";
  manifest_sha256?: string;
  dataset_refs?: string[];
};

export type ModelManifest = {
  schema_version: "1.0.0";
  name: string;
  version: `A${number}`;
  base: string;
  source: { uri: string; license: string };
  format: "GGUF";
  quantization: string;
  languages: string[];
  context: number;
  chat_template: string;
  training_lineage: ModelLineageEntry[];
  training_datasets: Array<{ name: string; version: string; license: string; sha256?: string }>;
  training_stages: Array<{
    type: "continued_pretraining" | "sft" | "preference" | "merge" | "quantization";
    config_ref?: string;
    seed?: number;
  }>;
  adapters: Array<{ name: string; version: string; sha256: string }>;
  evaluations: Array<{
    suite: string;
    version: string;
    score: number;
    result_sha256: string;
  }>;
  hashes: { sha256: string };
  created_by: "SCamposs";
  created_at: string;
};

export type MindModel = {
  id: string;
  displayName: string;
  version: `A${number}`;
  serverModelId?: string;
  modelPath?: string;
  manifestPath?: string;
  importedAt: string;
  context: number;
  quantization?: string;
  languages: string[];
  manifest?: ModelManifest;
};

export type MindRuntimeConfig = {
  mode: MindRuntimeMode;
  endpoint: string;
  executablePath?: string;
  port: number;
};

export type MindPersistedState = {
  version: 2;
  onboardingComplete: boolean;
  activeChatId: string | null;
  chats: MindChat[];
  models: MindModel[];
  selectedModelId: string | null;
  profile: MindProfileId;
  settings: GenerationSettings;
  policy: MindPolicySettings;
  runtime: MindRuntimeConfig;
};

export type ChatCompletionInput = {
  messages: Array<{ role: MindRole; content: string }>;
  model: string;
  settings: GenerationSettings;
};

export type ProviderChunk =
  | { type: "token"; content: string }
  | { type: "done"; finishReason?: string }
  | { type: "error"; message: string };

export type ProviderHealth = {
  ok: boolean;
  status: "ready" | "loading" | "offline";
  model?: string;
  detail?: string;
};
