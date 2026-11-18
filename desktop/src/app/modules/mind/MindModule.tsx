import "./mini.css";
import { useConfirm } from "../../components/ui/use-confirm";
import { Button, Input, Textarea } from "../../components/ui/Controls";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { History, Plus, SlidersHorizontal, X, Pencil } from "lucide-react";
import { mindGeneration } from "./generation";
import { applyInputPolicy } from "./policy";
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
  const confirm = useConfirm();
  const store = useMindStore();
  const activeChat = store.chats.find((chat) => chat.id === store.activeChatId);
  const selectedModel = store.models.find((model) => model.id === store.selectedModelId);
  const draft = activeChat?.draft ?? store.newDraft;
  const setDraft = store.updateDraft;
  const [showRename, setShowRename] = useState(false);
  const [title, setTitle] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const renameTrigger = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const followResponse = useRef(true);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const busy = Boolean(store.generation);
  const runtimePending = store.runtimeState === "checking" || store.runtimeState === "loading";
  const filteredChats = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? store.chats.filter((chat) => chat.title.toLocaleLowerCase().includes(query)) : store.chats;
  }, [search, store.chats]);

  useEffect(() => { followResponse.current = true; }, [store.activeChatId]);

  useEffect(() => {
    if (followResponse.current) conversationEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [activeChat?.messages, busy]);

  useEffect(() => {
    const leave = () => { mindGeneration.stop(); useMindStore.getState().persistNow(); };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
  }, []);

  if (!store.onboardingComplete) return <MindSetup />;

  const runGeneration = mindGeneration.start;

  const sendMessage = async () => {
    if (busy || runtimePending) return;
    try {
      const content = applyInputPolicy(draft, store.policy.inputPolicyEnabled);
      followResponse.current = true;
      const { chatId, assistantId } = store.addUserMessage(content);
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
    <section className="mind-shell h-full min-h-0 overflow-hidden">
      <header className="mind-header">
        <div className="mind-header__identity">
          <MindOrbit state={store.runtimeState} compact />
          <div><h1>Mind Mini</h1><span>{selectedModel?.displayName ?? "Choose a model"} · {mindStateLabel(store.runtimeState)}</span></div>
        </div>
        <div className="mind-mini-actions">
          <Button aria-label="New conversation" disabled={busy || !activeChat} onClick={() => { store.startNewChat(); setEditingId(null); }}><Plus size={16} /></Button>
          <Button ref={historyTrigger} aria-label="Conversations" disabled={busy} onClick={() => setShowChats(true)}><History size={16} /></Button>
          <Button ref={settingsTrigger} aria-label="Model settings" disabled={busy} onClick={() => setShowControls(true)}><SlidersHorizontal size={16} /></Button>
        </div>
      </header>

      <Dialog.Root open={showChats} onOpenChange={setShowChats}><Dialog.Portal><Dialog.Backdrop className="void-dialog-backdrop" />
        <Dialog.Popup className="mind-mini-panel" initialFocus={searchRef} finalFocus={historyTrigger}>
          <div className="mind-mini-panel__heading"><Dialog.Title>Conversations</Dialog.Title><Dialog.Close render={<Button aria-label="Close conversations"><X size={16} /></Button>} /></div>
          <Dialog.Description className="mind-help">Your conversations stay on this device.</Dialog.Description>
          <Button disabled={!activeChat} onClick={() => { store.startNewChat(); setShowChats(false); }}>New conversation</Button>
          <Input ref={searchRef} type="search" aria-label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
          <div className="mind-mini-history">
            {filteredChats.map((chat) => <div className={`mind-mini-history-row ${chat.id === store.activeChatId ? "is-active" : ""}`} key={chat.id}>
              <Button onClick={() => { store.selectChat(chat.id); setShowChats(false); setEditingId(null); }}><strong title={chat.title}>{chat.title}</strong><span>{new Date(chat.updatedAt).toLocaleDateString()}</span></Button>
              <Button aria-label={`Delete ${chat.title}`} onClick={async () => { if (await confirm(`Delete ${chat.title}?`)) store.deleteChat(chat.id); }}><X size={14} /></Button>
            </div>)}
            {!filteredChats.length && <p className="mind-help">{store.chats.length ? "No matching conversations." : "Conversations appear after your first message."}</p>}
          </div>
        </Dialog.Popup></Dialog.Portal></Dialog.Root>
        <main className="mind-conversation">
          {activeChat ? (
            <div className="mind-messages" onScroll={(event) => { const area = event.currentTarget; followResponse.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80; }}>
              <div className="mind-conversation-title"><h2>{activeChat.title}</h2><Button ref={renameTrigger} aria-label="Rename conversation" disabled={busy} onClick={() => { setTitle(activeChat.title); setShowRename(true); }}><Pencil size={14} /></Button><span>{selectedModel?.displayName ?? "No model selected"}</span></div>
              {activeChat.messages.map((message) => (
                <article className={`mind-message mind-message--${message.role}`} key={message.id}>
                  <div className="mind-message__role">{message.role === "user" ? "You" : "Mind"}</div>
                  <div className="mind-message__body">
                    {editingId === message.id ? (
                      <div className="mind-message__edit">
                        <Textarea aria-label="Edit message" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={5} />
                        <div><Button onClick={() => void saveEdit(message)}>Save and regenerate</Button><Button onClick={() => setEditingId(null)}>Cancel</Button></div>
                      </div>
                    ) : message.content ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      <div className="mind-generating-line">{store.generation?.assistantId === message.id ? <><span />{store.runtimeState === "thinking" ? "Thinking locally…" : "Generating…"}</> : <><span aria-hidden="true" />Response interrupted. <Button disabled={busy} onClick={() => void regenerate(message)}>Retry response</Button></>}</div>
                    )}
                    {message.content && editingId !== message.id && (
                      <div className="mind-message__actions">
                        <Button onClick={() => void copyMessage(message)}>{copiedId === message.id ? "Copied" : "Copy"}</Button>
                        {message.role === "user" && <Button disabled={busy} onClick={() => { setEditingId(message.id); setEditingContent(message.content); }}>Edit</Button>}
                        {message.role === "assistant" && message.id === activeChat.messages[activeChat.messages.length - 1].id && <Button disabled={busy} onClick={() => void regenerate(message)}>Regenerate</Button>}
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
              <p>Choose an idea below, or write your own message.</p>
              <div>{STARTERS.map((starter) => <Button key={starter} onClick={() => setDraft(starter)}>{starter}</Button>)}</div>
            </div>
          )}

          {(store.runtimeState === "error" || store.runtimeState === "stopped") && <div className="mind-mini-notice" role={store.runtimeState === "error" ? "alert" : "status"}>
            <span>{store.runtimeDetail}</span>
            {activeChat?.messages.some((message) => message.role === "user") && <Button disabled={busy} onClick={() => {
              const last = activeChat.messages[activeChat.messages.length - 1];
              const id = last?.role === "assistant" ? last.id : store.addMessage(activeChat.id, "assistant", "");
              if (last?.role === "assistant") store.clearAssistantMessage(activeChat.id, id);
              void runGeneration(activeChat.id, id);
            }}>Retry response</Button>}
            <Button disabled={busy} onClick={() => setShowControls(true)}>Model settings</Button>
          </div>}
          <div className="mind-composer">
            <Textarea
              aria-label="Message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={selectedModel ? `Message ${selectedModel.displayName}` : "Choose a model in Model settings"}
              disabled={!selectedModel}
              rows={2}
            />
            <div>
              <span>Enter to send · Shift+Enter for newline</span>
              {busy ? <Button onClick={() => mindGeneration.stop()}>Stop</Button> : <Button className="mind-primary-button" disabled={!selectedModel || !draft.trim() || runtimePending} onClick={() => void sendMessage()}>Send message</Button>}
            </div>
          </div>
        </main>

      <Dialog.Root open={showRename} onOpenChange={setShowRename}><Dialog.Portal><Dialog.Backdrop className="void-dialog-backdrop" />
        <Dialog.Popup className="mind-mini-panel" initialFocus={titleRef} finalFocus={renameTrigger}>
          <Dialog.Title>Rename conversation</Dialog.Title><Dialog.Description className="mind-help">Choose a title you can find later.</Dialog.Description>
          <form className="mind-mini-rename" onSubmit={(event) => { event.preventDefault(); if (activeChat && title.trim()) { store.renameChat(activeChat.id, title); setShowRename(false); } }}>
            <Input ref={titleRef} aria-label="Conversation title" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} />
            <div className="mind-mini-actions"><Button onClick={() => setShowRename(false)}>Cancel</Button><Button type="submit" disabled={!title.trim()}>Save title</Button></div>
          </form>
        </Dialog.Popup></Dialog.Portal></Dialog.Root>
      <Dialog.Root open={showControls} onOpenChange={setShowControls}><Dialog.Portal><Dialog.Backdrop className="void-dialog-backdrop" />
        <Dialog.Popup className="mind-mini-panel mind-mini-panel--settings" finalFocus={settingsTrigger}>
          <div className="mind-mini-panel__heading"><Dialog.Title>Model settings</Dialog.Title><Dialog.Close render={<Button aria-label="Close model settings"><X size={16} /></Button>} /></div>
          <Dialog.Description className="mind-help">Manage your local model and response preferences.</Dialog.Description>
          <MindControls />
        </Dialog.Popup></Dialog.Portal></Dialog.Root>
    </section>
  );
}
