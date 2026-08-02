import { create } from "zustand";
import { applyProfile } from "./profiles";
import { mindRepo } from "./storage";
import type {
  GenerationSettings,
  MindChat,
  MindMessage,
  MindModel,
  MindPersistedState,
  MindPolicySettings,
  MindProfileId,
  MindRuntimeConfig,
  MindRuntimeState,
} from "./types";

type MindStore = MindPersistedState & {
  runtimeState: MindRuntimeState;
  runtimeDetail: string;
  createChat: () => string;
  selectChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (chatId: string, role: MindMessage["role"], content: string) => string;
  appendMessage: (chatId: string, messageId: string, content: string) => void;
  persistNow: () => void;
  editUserMessage: (chatId: string, messageId: string, content: string) => void;
  clearAssistantMessage: (chatId: string, messageId: string) => void;
  setProfile: (profile: MindProfileId) => void;
  updateSettings: (patch: Partial<GenerationSettings>) => void;
  updatePolicy: (patch: Partial<MindPolicySettings>) => void;
  updateRuntime: (patch: Partial<MindRuntimeConfig>) => void;
  setRuntimeStatus: (state: MindRuntimeState, detail?: string) => void;
  addModel: (model: MindModel) => void;
  updateModel: (modelId: string, patch: Partial<MindModel>) => void;
  selectModel: (modelId: string | null) => void;
  removeModel: (modelId: string) => void;
  completeOnboarding: () => void;
  resetMind: () => void;
};

function createId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function makeChat(): MindChat {
  const now = new Date().toISOString();
  return { id: createId("chat"), title: "New conversation", createdAt: now, updatedAt: now, messages: [] };
}

function titleFrom(content: string): string {
  const title = content.trim().replace(/\s+/g, " ");
  return title.length > 46 ? `${title.slice(0, 45)}…` : title || "New conversation";
}

function persistedState(state: MindStore): MindPersistedState {
  const retain = state.policy.retainConversations;
  return {
    version: 2,
    onboardingComplete: state.onboardingComplete,
    activeChatId: retain ? state.activeChatId : null,
    chats: retain ? state.chats : [],
    models: state.models,
    selectedModelId: state.selectedModelId,
    profile: state.profile,
    settings: state.settings,
    policy: state.policy,
    runtime: state.runtime,
  };
}

export const useMindStore = create<MindStore>((set, get) => {
  const loaded = mindRepo.load();
  const save = () => mindRepo.save(persistedState(get()));
  const mutate = (updater: (state: MindStore) => Partial<MindStore>) => {
    set((state) => updater(state));
    save();
  };

  return {
    ...loaded,
    runtimeState: "idle",
    runtimeDetail: "Runtime not checked.",
    createChat: () => {
      const chat = makeChat();
      mutate((state) => ({ chats: [chat, ...state.chats], activeChatId: chat.id }));
      return chat.id;
    },
    selectChat: (activeChatId) => mutate(() => ({ activeChatId })),
    deleteChat: (chatId) =>
      mutate((state) => {
        const chats = state.chats.filter((chat) => chat.id !== chatId);
        return {
          chats,
          activeChatId: state.activeChatId === chatId ? (chats[0]?.id ?? null) : state.activeChatId,
        };
      }),
    addMessage: (chatId, role, content) => {
      const message: MindMessage = {
        id: createId("message"),
        role,
        content,
        createdAt: new Date().toISOString(),
      };
      mutate((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;
          const firstUserMessage = role === "user" && !chat.messages.some((item) => item.role === "user");
          return {
            ...chat,
            title: firstUserMessage ? titleFrom(content) : chat.title,
            updatedAt: message.createdAt,
            messages: [...chat.messages, message],
          };
        }),
      }));
      return message.id;
    },
    appendMessage: (chatId, messageId, content) =>
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                updatedAt: new Date().toISOString(),
                messages: chat.messages.map((message) =>
                  message.id === messageId ? { ...message, content: message.content + content } : message,
                ),
              }
            : chat,
        ),
      })),
    persistNow: save,
    editUserMessage: (chatId, messageId, content) =>
      mutate((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;
          const index = chat.messages.findIndex((message) => message.id === messageId);
          if (index < 0) return chat;
          const messages = chat.messages.slice(0, index + 1).map((message) =>
            message.id === messageId
              ? { ...message, content, editedAt: new Date().toISOString() }
              : message,
          );
          return { ...chat, title: titleFrom(content), updatedAt: new Date().toISOString(), messages };
        }),
      })),
    clearAssistantMessage: (chatId, messageId) =>
      mutate((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === messageId ? { ...message, content: "" } : message,
                ),
              }
            : chat,
        ),
      })),
    setProfile: (profile) =>
      mutate((state) => ({
        profile,
        settings: profile === "custom" ? state.settings : applyProfile(state.settings, profile),
      })),
    updateSettings: (patch) => mutate((state) => ({ settings: { ...state.settings, ...patch }, profile: "custom" })),
    updatePolicy: (patch) => mutate((state) => ({ policy: { ...state.policy, ...patch } })),
    updateRuntime: (patch) => mutate((state) => ({ runtime: { ...state.runtime, ...patch } })),
    setRuntimeStatus: (runtimeState, runtimeDetail = "") => set({ runtimeState, runtimeDetail }),
    addModel: (model) =>
      mutate((state) => ({
        models: [model, ...state.models.filter((item) => item.id !== model.id)],
        selectedModelId: model.id,
      })),
    updateModel: (modelId, patch) =>
      mutate((state) => ({
        models: state.models.map((model) => (model.id === modelId ? { ...model, ...patch } : model)),
      })),
    selectModel: (selectedModelId) => mutate(() => ({ selectedModelId })),
    removeModel: (modelId) =>
      mutate((state) => {
        const models = state.models.filter((model) => model.id !== modelId);
        return {
          models,
          selectedModelId: state.selectedModelId === modelId ? (models[0]?.id ?? null) : state.selectedModelId,
        };
      }),
    completeOnboarding: () => mutate(() => ({ onboardingComplete: true })),
    resetMind: () => {
      const fresh = mindRepo.reset();
      set({ ...fresh, runtimeState: "idle", runtimeDetail: "Runtime not checked." });
    },
  };
});
