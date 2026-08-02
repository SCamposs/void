import { useEffect, useMemo, useRef, useState } from "react";
import { LlamaServerProvider } from "./provider";
import { applyInputPolicy, applyOutputPolicy } from "./policy";
import { useMindStore } from "./store";
import { MarkdownMessage } from "./MarkdownMessage";
import { MindControls } from "./MindControls";
import { MindOrbit } from "./MindOrbit";
import { mindStateLabel } from "./mindState";
import { MindSetup } from "./MindSetup";
import type { MindMessage } from "./types";

const STARTERS = [
  "Help me plan a focused week.",
  "Explain a difficult idea simply.",
  "Brainstorm three directions for a short story.",
];

export function MindModule() {
  const store = useMindStore();
  const activeChat = store.chats.find((chat) => chat.id === store.activeChatId);
  const selectedModel = store.models.find((model) => model.id === store.selectedModelId);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const busy = store.runtimeState === "thinking" || store.runtimeState === "generating";
  const filteredChats = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? store.chats.filter((chat) => chat.title.toLocaleLowerCase().includes(query)) : store.chats;
  }, [search, store.chats]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: busy ? "auto" : "smooth" });
  }, [activeChat?.messages, busy]);

  if (!store.onboardingComplete) return <MindSetup />;

  const runGeneration = async (chatId: string, assistantId: string) => {
    const snapshot = useMindStore.getState();
    const chat = snapshot.chats.find((item) => item.id === chatId);
    const model = snapshot.models.find((item) => item.id === snapshot.selectedModelId);
    if (!chat || !model) {
      snapshot.setRuntimeStatus("error", "Select a model before generating.");
      return;
    }
    const modelId = model.serverModelId || model.modelPath || model.manifest?.name;
    if (!modelId) {
      snapshot.setRuntimeStatus("error", "The selected model is not connected to llama-server.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    snapshot.setRuntimeStatus("thinking", "Preparing local context.");
    try {
      const provider = new LlamaServerProvider(snapshot.runtime.endpoint);
      const health = await provider.health(controller.signal);
      if (!health.ok) throw new Error(health.detail || "llama-server is not ready.");
      const messages = [
        { role: "system" as const, content: snapshot.settings.systemPrompt },
        ...chat.messages
          .filter((message) => message.id !== assistantId)
          .map((message) => ({ role: message.role, content: message.content })),
      ];
      let receivedToken = false;
      for await (const chunk of provider.generate(
        { model: modelId, messages, settings: snapshot.settings },
        controller.signal,
      )) {
        if (chunk.type === "error") throw new Error(chunk.message);
        if (chunk.type === "done") break;
        const content = applyOutputPolicy(chunk.content, snapshot.policy.outputPolicyEnabled);
        if (!content) continue;
        if (!receivedToken) {
          receivedToken = true;
          snapshot.setRuntimeStatus("generating", "Receiving tokens from local llama-server.");
        }
        snapshot.appendMessage(chatId, assistantId, content);
      }
      snapshot.persistNow();
      snapshot.setRuntimeStatus("ready", `Ready · ${model.displayName}`);
    } catch (error) {
      snapshot.persistNow();
      if (controller.signal.aborted) snapshot.setRuntimeStatus("stopped", "Generation stopped by user.");
      else snapshot.setRuntimeStatus("error", error instanceof Error ? error.message : "Generation failed.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (busy) return;
    try {
      const content = applyInputPolicy(draft, store.policy.inputPolicyEnabled);
      const chatId = store.activeChatId ?? store.createChat();
      store.addMessage(chatId, "user", content);
      const assistantId = store.addMessage(chatId, "assistant", "");
      setDraft("");
      setShowChats(false);
      await runGeneration(chatId, assistantId);
    } catch (error) {
      store.setRuntimeStatus("error", error instanceof Error ? error.message : "Message could not be sent.");
    }
  };

  const regenerate = async (message: MindMessage) => {
    if (!activeChat || busy) return;
    store.clearAssistantMessage(activeChat.id, message.id);
    await runGeneration(activeChat.id, message.id);
  };

  const saveEdit = async (message: MindMessage) => {
    if (!activeChat || busy) return;
    try {
      const content = applyInputPolicy(editingContent, store.policy.inputPolicyEnabled);
      store.editUserMessage(activeChat.id, message.id, content);
      const assistantId = store.addMessage(activeChat.id, "assistant", "");
      setEditingId(null);
      await runGeneration(activeChat.id, assistantId);
    } catch (error) {
      store.setRuntimeStatus("error", error instanceof Error ? error.message : "Message could not be edited.");
    }
  };

  const copyMessage = async (message: MindMessage) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1400);
  };

  return (
    <section className="mind-shell panel h-full min-h-0 overflow-hidden">
      <header className="mind-header">
        <div className="mind-header__identity">
          <MindOrbit state={store.runtimeState} compact />
          <div><h1>Mind</h1><span>{mindStateLabel(store.runtimeState)} · {selectedModel?.version ?? "no model"}</span></div>
        </div>
        <div className="mind-privacy-strip" aria-label="Privacy status">
          <span>local inference</span><span>loopback only</span><span>telemetry off</span>
        </div>
        <div className="mind-header__mobile-actions">
          <button onClick={() => setShowChats((value) => !value)}>Chats</button>
          <button onClick={() => setShowControls((value) => !value)}>Controls</button>
        </div>
      </header>

      <div className="mind-layout">
        <aside className={`mind-chat-sidebar ${showChats ? "is-open" : ""}`}>
          <button className="mind-primary-button" onClick={() => { store.createChat(); setShowChats(false); }}>New conversation</button>
          <input className="mind-chat-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" />
          <div className="mind-chat-list">
            {filteredChats.map((chat) => (
              <div className={`mind-chat-row ${chat.id === store.activeChatId ? "is-active" : ""}`} key={chat.id}>
                <button onClick={() => { store.selectChat(chat.id); setShowChats(false); }}>
                  <strong>{chat.title}</strong><span>{new Date(chat.updatedAt).toLocaleDateString()}</span>
                </button>
                <button aria-label={`Delete ${chat.title}`} onClick={() => {
                  if (window.confirm(`Delete “${chat.title}”?`)) store.deleteChat(chat.id);
                }}>×</button>
              </div>
            ))}
            {filteredChats.length === 0 && <p className="mind-help">No matching conversations.</p>}
          </div>
        </aside>

        <main className="mind-conversation">
          {activeChat ? (
            <div className="mind-messages">
              <div className="mind-conversation-title"><h2>{activeChat.title}</h2><span>{selectedModel?.displayName ?? "No model selected"}</span></div>
              {activeChat.messages.map((message) => (
                <article className={`mind-message mind-message--${message.role}`} key={message.id}>
                  <div className="mind-message__role">{message.role === "user" ? "You" : "Mind"}</div>
                  <div className="mind-message__body">
                    {editingId === message.id ? (
                      <div className="mind-message__edit">
                        <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={5} />
                        <div><button onClick={() => void saveEdit(message)}>Save and regenerate</button><button onClick={() => setEditingId(null)}>Cancel</button></div>
                      </div>
                    ) : message.content ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      <div className="mind-generating-line"><span />{store.runtimeState === "thinking" ? "Thinking locally…" : "Generating…"}</div>
                    )}
                    {message.content && editingId !== message.id && (
                      <div className="mind-message__actions">
                        <button onClick={() => void copyMessage(message)}>{copiedId === message.id ? "Copied" : "Copy"}</button>
                        {message.role === "user" && <button onClick={() => { setEditingId(message.id); setEditingContent(message.content); }}>Edit</button>}
                        {message.role === "assistant" && <button disabled={busy} onClick={() => void regenerate(message)}>Regenerate</button>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              <div ref={conversationEndRef} />
            </div>
          ) : (
            <div className="mind-empty">
              <MindOrbit state={store.runtimeState} />
              <h2>What should we think through?</h2>
              <p>Start a local conversation. Nothing here is sent beyond the loopback runtime you selected.</p>
              <div>{STARTERS.map((starter) => <button key={starter} onClick={() => setDraft(starter)}>{starter}</button>)}</div>
            </div>
          )}

          <div className="mind-composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={selectedModel ? `Message ${selectedModel.displayName}` : "Select a model in Controls"}
              disabled={!selectedModel}
              rows={2}
            />
            <div>
              <span>Enter to send · Shift+Enter for newline</span>
              {busy ? <button onClick={() => abortRef.current?.abort()}>Stop</button> : <button className="mind-primary-button" disabled={!selectedModel || !draft.trim()} onClick={() => void sendMessage()}>Send message</button>}
            </div>
          </div>
        </main>

        <div className={`mind-controls-wrap ${showControls ? "is-open" : ""}`}>
          <button className="mind-controls-close" onClick={() => setShowControls(false)}>Close controls</button>
          <MindControls />
        </div>
      </div>
    </section>
  );
}
