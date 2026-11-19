import { libraryApi } from "../app/modules/library/api";
import { describe, expect, it, vi } from "vitest";
import { createMindStore } from "../app/modules/mind/store";
import { createMindGeneration } from "../app/modules/mind/generation";
import { DEFAULT_MIND_STATE, migrateMindState } from "../app/modules/mind/storage";
import type { MindPersistedState, ProviderChunk } from "../app/modules/mind/types";

function fixture() {
  let saved: MindPersistedState = structuredClone(DEFAULT_MIND_STATE);
  saved.models = [{ id: "test", displayName: "Test model", version: "A0", serverModelId: "test", importedAt: "2026-01-01", context: 2048, languages: ["en"] }];
  saved.selectedModelId = "test";
  const repo = { load: () => structuredClone(saved), save: (state: MindPersistedState) => { saved = structuredClone(state); }, reset: () => structuredClone(DEFAULT_MIND_STATE) };
  const store = createMindStore(repo);
  return { store, reload: () => createMindStore(repo) };
}
const health = async () => ({ ok: true, status: "ready" as const });

describe("Mind Mini conversation flow", () => {
  it("saves independent drafts without adding empty history entries", () => {
    const { store, reload } = fixture();
    store.getState().updateDraft("Unsent idea");
    store.getState().startNewChat();
    expect(store.getState().chats).toHaveLength(0);
    expect(reload().getState().newDraft).toBe("Unsent idea");
    const first = store.getState().addUserMessage("First question");
    store.getState().updateDraft("Follow-up draft");
    store.getState().startNewChat();
    store.getState().updateDraft("Another idea");
    const loaded = reload();
    expect(loaded.getState().activeChatId).toBeNull();
    expect(loaded.getState().newDraft).toBe("Another idea");
    loaded.getState().selectChat(first.chatId);
    expect(loaded.getState().chats[0].draft).toBe("Follow-up draft");
    expect(loaded.getState().chats[0].title).toBe("First question");
  });
  it("honors retention settings for both drafts and conversations", () => {
    const { store, reload } = fixture();
    store.getState().addUserMessage("Private question");
    store.getState().updatePolicy({ retainConversations: false });
    store.getState().startNewChat();
    store.getState().updateDraft("Private draft");
    expect(reload().getState().chats).toEqual([]);
    expect(reload().getState().newDraft).toBe("");
    expect(store.getState().chats).toHaveLength(1);
  });
  it("preserves manual titles after editing the original question", () => {
    const { store } = fixture();
    const { chatId } = store.getState().addUserMessage("First question");
    store.getState().renameChat(chatId, "My title");
    store.getState().editUserMessage(chatId, store.getState().chats[0].messages[0].id, "Changed question");
    expect(store.getState().chats[0].title).toBe("My title");
  });
  it("removes only legacy empty placeholders during migration", () => {
    const chats = ["New conversation", "My saved name"].map((title, i) => ({ id: String(i), title, messages: [] }));
    const state = migrateMindState({ chats, activeChatId: null });
    expect(state.chats.map((chat) => chat.title)).toEqual(["My saved name"]);
    expect(state.activeChatId).toBeNull();
  });
});

describe("Mind Mini request ownership", () => {
  it("streams and persists a completed response", async () => {
    const { store, reload } = fixture();
    const request = store.getState().addUserMessage("Hello");
    const generation = createMindGeneration(store, () => ({ health, async *generate() { yield { type: "token", content: "Hi" }; yield { type: "done" }; } }));
    await generation.start(request.chatId, request.assistantId);
    expect(store.getState().runtimeState).toBe("ready");
    expect(store.getState().generation).toBeNull();
    expect(reload().getState().chats[0].messages[1].content).toBe("Hi");
  });
  it("keeps partial output and reports incomplete streams", async () => {
    const { store } = fixture();
    const request = store.getState().addUserMessage("Hello");
    const generation = createMindGeneration(store, () => ({ health, async *generate() { yield { type: "token", content: "Partial" }; } }));
    await generation.start(request.chatId, request.assistantId);
    expect(store.getState().runtimeState).toBe("error");
    expect(store.getState().runtimeDetail).toContain("before the response finished");
    expect(store.getState().chats[0].messages[1].content).toBe("Partial");
  });
  it("removes empty failed responses and permits retry", async () => {
    const { store } = fixture();
    const request = store.getState().addUserMessage("Hello");
    const ready = vi.fn().mockResolvedValueOnce({ ok: false, status: "offline" }).mockResolvedValue({ ok: true, status: "ready" });
    const generation = createMindGeneration(store, () => ({ health: ready, async *generate() { yield { type: "token", content: "Recovered" }; yield { type: "done" }; } }));
    await generation.start(request.chatId, request.assistantId);
    expect(store.getState().chats[0].messages).toHaveLength(1);
    const id = store.getState().addMessage(request.chatId, "assistant", "");
    await generation.start(request.chatId, id);
    expect(store.getState().runtimeState).toBe("ready");
  });
  it("ignores late chunks after cancellation without clearing a newer request", async () => {
    const { store } = fixture();
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    let calls = 0;
    const generation = createMindGeneration(store, () => ({ health, async *generate(): AsyncGenerator<ProviderChunk> {
      calls += 1;
      if (calls === 1) { yield { type: "token", content: "Kept" }; await gate; yield { type: "token", content: "LATE" }; }
      else yield { type: "token", content: "New response" };
      yield { type: "done" };
    } }));
    const first = store.getState().addUserMessage("First");
    const running = generation.start(first.chatId, first.assistantId);
    await vi.waitFor(() => expect(store.getState().chats[0].messages[1].content).toBe("Kept"));
    expect(() => store.getState().addUserMessage("Concurrent")).toThrow();
    generation.stop();
    const next = store.getState().addUserMessage("Next");
    await generation.start(next.chatId, next.assistantId);
    resume(); await running;
    expect(store.getState().runtimeState).toBe("ready");
    expect(store.getState().chats[0].messages.map((message) => message.content)).toEqual(["First", "Kept", "Next", "New response"]);
  });
});


it("does not start inference when a selected Library source changed", async () => {
  const { store } = fixture();
  store.getState().attachSource({documentId:1,passageId:1,title:"Source",path:"source.txt",fingerprint:"a".repeat(64),page:null,lineStart:1,lineEnd:1,text:"Budget 42."});
  const request = store.getState().addUserMessage("What is the budget?");
  const validate = vi.spyOn(libraryApi,"validateSources").mockRejectedValueOnce(new Error("Original document changed. Refresh Library."));
  const generate = vi.fn(async function* (): AsyncGenerator<ProviderChunk> { yield {type:"done"}; });
  try {
    await createMindGeneration(store,() => ({health,generate})).start(request.chatId,request.assistantId);
    expect(generate).not.toHaveBeenCalled();
    expect(store.getState().runtimeDetail).toContain("changed");
    expect(store.getState().generation).toBeNull();
    expect(store.getState().chats[0].messages).toHaveLength(1);
  } finally { validate.mockRestore(); }
});
