import type { StoreApi } from "zustand";
import { LlamaServerProvider } from "./provider";
import { applyOutputPolicy } from "./policy";
import { useMindStore, type MindStore } from "./store";

/** One request owns the stream. Aborted or superseded streams cannot mutate a later response. */
export function createMindGeneration(
  store: StoreApi<MindStore>,
  providerFor: (endpoint: string) => Pick<LlamaServerProvider, "health" | "generate"> = (endpoint: string) => new LlamaServerProvider(endpoint),
) {
  let active: { controller: AbortController; chatId: string; assistantId: string } | null = null;

  const stop = (detail = "Response stopped. Your text has been kept.") => {
    if (!active) return;
    const request = active;
    active = null;
    request.controller.abort();
    store.getState().removeEmptyResponse(request.chatId, request.assistantId);
    store.setState({ generation: null, runtimeState: "stopped", runtimeDetail: detail });
    store.getState().persistNow();
  };

  const start = async (chatId: string, assistantId: string) => {
    if (active) return;
    const request = { controller: new AbortController(), chatId, assistantId };
    active = request;
    const snapshot = store.getState();
    store.setState({ generation: { chatId, assistantId }, runtimeState: "thinking", runtimeDetail: "Preparing a response…" });
    const current = () => active === request && !request.controller.signal.aborted;
    try {
      const chat = snapshot.chats.find((item) => item.id === chatId);
      const model = snapshot.models.find((item) => item.id === snapshot.selectedModelId);
      const modelId = model?.serverModelId || model?.modelPath || model?.manifest?.name;
      if (!chat || !model || !modelId) throw new Error("Choose a connected model in Model settings before sending.");
      const provider = providerFor(snapshot.runtime.endpoint);
      const health = await provider.health(request.controller.signal);
      if (!current()) return;
      if (!health.ok) throw new Error(health.status === "loading" ? "Your model is still loading. Wait a moment and retry." : "The local server is unavailable. Check Model settings and retry.");
      let completed = false;
      for await (const chunk of provider.generate({ model: modelId, settings: snapshot.settings, messages: [
        { role: "system", content: snapshot.settings.systemPrompt },
        ...chat.messages.filter((message) => message.id !== assistantId && message.content).map(({ role, content }) => ({ role, content })),
      ] }, request.controller.signal)) {
        if (!current()) return;
        if (chunk.type === "error") throw new Error(chunk.message);
        if (chunk.type === "done") { completed = true; break; }
        const text = applyOutputPolicy(chunk.content, snapshot.policy.outputPolicyEnabled);
        if (text) {
          store.getState().appendMessage(chatId, assistantId, text);
          store.getState().setRuntimeStatus("generating", "Writing a response…");
        }
      }
      if (!current()) return;
      if (!completed) throw new Error("The connection ended before the response finished. Your text has been kept; you can retry.");
      const response = store.getState().chats.find((item) => item.id === chatId)?.messages.find((item) => item.id === assistantId);
      if (!response?.content.trim()) throw new Error("The model returned no text. Try generating the response again.");
      store.getState().setRuntimeStatus("ready", "Ready");
    } catch (error) {
      if (current()) store.getState().setRuntimeStatus("error", error instanceof Error ? error.message : "The response could not be completed.");
    } finally {
      if (active === request) {
        active = null;
        store.getState().removeEmptyResponse(chatId, assistantId);
        store.setState({ generation: null });
        store.getState().persistNow();
      }
    }
  };
  return { start, stop };
}

export const mindGeneration = createMindGeneration(useMindStore);
