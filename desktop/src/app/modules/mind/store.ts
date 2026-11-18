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

export type MindStore = MindPersistedState & {
  runtimeState: MindRuntimeState;
  runtimeDetail: string;
  generation: { chatId: string; assistantId: string } | null;
  startNewChat: () => void;
  updateDraft: (content: string) => void;
  addUserMessage: (content: string) => { chatId: string; assistantId: string };
  renameChat: (chatId: string, title: string) => void;
  removeEmptyResponse: (chatId: string, messageId: string) => void;
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
    version: 3,
    newDraft: retain ? state.newDraft : "",
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

export function createMindStore(repo = mindRepo) {
  return create<MindStore>((set, get) => {
    const loaded = repo.load();
    const save = () => repo.save(persistedState(get()));
    const mutate = (updater: (state: MindStore) => Partial<MindStore>) => {
      set((state) => updater(state));
      save();
    };

    return {
      ...loaded,
      runtimeState: "idle",
      runtimeDetail: "Runtime not checked.",
      generation: null,
      startNewChat: () => mutate(() => ({ activeChatId: null })),
      updateDraft: (content) => mutate((state) => state.activeChatId
        ? { chats: state.chats.map((chat) => chat.id === state.activeChatId ? { ...chat, draft: content } : chat) }
        : { newDraft: content }),
      addUserMessage: (content) => {
        if (!content.trim()) throw new Error("Write a message before sending.");
        if (get().generation) throw new Error("Stop the current response before sending another message.");
        const state = get();
        const chat = state.chats.find((item) => item.id === state.activeChatId) ?? makeChat();
        const now = new Date().toISOString();
        const user: MindMessage = { id: createId("message"), role: "user", content, createdAt: now };
        const assistant: MindMessage = { id: createId("message"), role: "assistant", content: "", createdAt: now };
        const next = { ...chat, draft: "", updatedAt: now, messages: [...chat.messages, user, assistant],
          title: !chat.titleManuallyEdited && !chat.messages.some((message) => message.role === "user") ? titleFrom(content) : chat.title };
        mutate((current) => ({ activeChatId: chat.id, newDraft: current.activeChatId ? current.newDraft : "",
          chats: current.chats.some((item) => item.id === chat.id)
            ? current.chats.map((item) => item.id === chat.id ? next : item) : [next, ...current.chats] }));
        return { chatId: chat.id, assistantId: assistant.id };
      },
      renameChat: (chatId, title) => {
        const next = title.trim().replace(/\s+/g, " ");
        if (!next || next.length > 80) throw new Error("Use a title between 1 and 80 characters.");
        mutate((state) => ({ chats: state.chats.map((chat) => chat.id === chatId
          ? { ...chat, title: next, titleManuallyEdited: true } : chat) }));
      },
      removeEmptyResponse: (chatId, messageId) => mutate((state) => ({ chats: state.chats.map((chat) => chat.id === chatId
        ? { ...chat, messages: chat.messages.filter((message) => message.id !== messageId || Boolean(message.content)) } : chat) })),
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
              title: firstUserMessage && !chat.titleManuallyEdited ? titleFrom(content) : chat.title,
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
            return { ...chat, title: !chat.titleManuallyEdited && index === chat.messages.findIndex((item) => item.role === "user") ? titleFrom(content) : chat.title, updatedAt: new Date().toISOString(), messages };
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
        const fresh = repo.reset();
        set({ ...fresh, generation: null, runtimeState: "idle", runtimeDetail: "Runtime not checked." });
      },
    };
  });
}

export const useMindStore = createMindStore();
