import { readStoredJson, storageKeys, writeStoredJson } from "../../lib/persistence";
import { DEFAULT_GENERATION_SETTINGS } from "./profiles";
import type { MindChat, MindPersistedState } from "./types";

export const MIND_STATE_VERSION = 2;

export const DEFAULT_MIND_STATE: MindPersistedState = {
  version: MIND_STATE_VERSION,
  onboardingComplete: false,
  activeChatId: null,
  chats: [],
  models: [],
  selectedModelId: null,
  profile: "general",
  settings: DEFAULT_GENERATION_SETTINGS,
  policy: {
    inputPolicyEnabled: true,
    outputPolicyEnabled: true,
    memoryEnabled: false,
    retainConversations: true,
  },
  runtime: {
    mode: "external",
    endpoint: "http://127.0.0.1:8080",
    port: 8080,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validChats(value: unknown): MindChat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((chat): chat is MindChat => {
    if (!isRecord(chat) || !Array.isArray(chat.messages)) return false;
    return typeof chat.id === "string" && typeof chat.title === "string";
  });
}

export function migrateMindState(value: unknown): MindPersistedState {
  if (!isRecord(value)) return structuredClone(DEFAULT_MIND_STATE);
  const settings = isRecord(value.settings) ? value.settings : {};
  const policy = isRecord(value.policy) ? value.policy : {};
  const runtime = isRecord(value.runtime) ? value.runtime : {};
  const models = Array.isArray(value.models) ? value.models : [];
  const migrated: MindPersistedState = {
    ...DEFAULT_MIND_STATE,
    onboardingComplete: value.onboardingComplete === true,
    activeChatId: typeof value.activeChatId === "string" ? value.activeChatId : null,
    chats: validChats(value.chats),
    models: models.filter((model): model is MindPersistedState["models"][number] => {
      if (!isRecord(model)) return false;
      return (
        typeof model.id === "string" &&
        typeof model.displayName === "string" &&
        typeof model.version === "string"
      );
    }),
    selectedModelId: typeof value.selectedModelId === "string" ? value.selectedModelId : null,
    profile:
      value.profile === "creative" ||
      value.profile === "analytical" ||
      value.profile === "concise" ||
      value.profile === "custom"
        ? value.profile
        : "general",
    settings: { ...DEFAULT_MIND_STATE.settings, ...settings },
    policy: { ...DEFAULT_MIND_STATE.policy, ...policy },
    runtime: { ...DEFAULT_MIND_STATE.runtime, ...runtime },
    version: MIND_STATE_VERSION,
  };
  if (!migrated.chats.some((chat) => chat.id === migrated.activeChatId)) {
    migrated.activeChatId = migrated.chats[0]?.id ?? null;
  }
  if (!migrated.models.some((model) => model.id === migrated.selectedModelId)) {
    migrated.selectedModelId = migrated.models[0]?.id ?? null;
  }
  return migrated;
}

export const mindRepo = {
  load(): MindPersistedState {
    return migrateMindState(readStoredJson<unknown>(storageKeys.mindState, null));
  },
  save(state: MindPersistedState): void {
    writeStoredJson(storageKeys.mindState, { ...state, version: MIND_STATE_VERSION });
  },
  reset(): MindPersistedState {
    const state = structuredClone(DEFAULT_MIND_STATE);
    this.save(state);
    return state;
  },
};
