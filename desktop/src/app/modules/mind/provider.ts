import type {
  ChatCompletionInput,
  ProviderChunk,
  ProviderHealth,
} from "./types";

export interface MindProvider {
  health(signal?: AbortSignal): Promise<ProviderHealth>;
  generate(input: ChatCompletionInput, signal?: AbortSignal): AsyncGenerator<ProviderChunk>;
}

export function normalizeLoopbackEndpoint(value: string): string {
  const candidate = value.trim().replace(/\/+$/, "");
  const url = new URL(candidate);
  if (url.protocol !== "http:") throw new Error("The runtime endpoint must use local HTTP.");
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost" && url.hostname !== "[::1]") {
    throw new Error("The runtime endpoint must bind to loopback only.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The runtime endpoint cannot contain credentials, query parameters, or fragments.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("Use the llama-server origin without an API path.");
  }
  return url.origin;
}

export class SseDecoder {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk.replace(/\r\n/g, "\n");
    const events: string[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) events.push(data);
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  flush(): string[] {
    if (!this.buffer.trim()) return [];
    return this.push("\n\n");
  }
}

export function parseLlamaEvent(data: string): ProviderChunk {
  if (data.trim() === "[DONE]") return { type: "done" };
  try {
    const payload = JSON.parse(data) as {
      error?: { message?: string };
      choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
    };
    if (payload.error) return { type: "error", message: payload.error.message || "llama-server error" };
    const choice = payload.choices?.[0];
    const token = choice?.delta?.content;
    if (token) return { type: "token", content: token };
    if (choice?.finish_reason) return { type: "done", finishReason: choice.finish_reason };
    return { type: "token", content: "" };
  } catch {
    return { type: "error", message: "llama-server returned an invalid stream event." };
  }
}

type FetchLike = typeof fetch;

export class LlamaServerProvider implements MindProvider {
  readonly endpoint: string;

  constructor(endpoint: string, private readonly fetcher: FetchLike = fetch) {
    this.endpoint = normalizeLoopbackEndpoint(endpoint);
  }

  async health(signal?: AbortSignal): Promise<ProviderHealth> {
    try {
      const response = await this.fetcher(`${this.endpoint}/health`, { signal });
      if (response.status === 503) return { ok: false, status: "loading", detail: "Model is loading." };
      if (!response.ok) return { ok: false, status: "offline", detail: `HTTP ${response.status}` };
      const models = await this.fetcher(`${this.endpoint}/v1/models`, { signal });
      const payload = models.ok
        ? ((await models.json()) as { data?: Array<{ id?: string }> })
        : undefined;
      return { ok: true, status: "ready", model: payload?.data?.[0]?.id };
    } catch (error) {
      return {
        ok: false,
        status: "offline",
        detail: error instanceof Error ? error.message : "Runtime is unavailable.",
      };
    }
  }

  async *generate(input: ChatCompletionInput, signal?: AbortSignal): AsyncGenerator<ProviderChunk> {
    const response = await this.fetcher(`${this.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        stream: true,
        temperature: input.settings.temperature,
        top_p: input.settings.topP,
        top_k: input.settings.topK,
        repeat_penalty: input.settings.repeatPenalty,
        seed: input.settings.seed,
        max_tokens: input.settings.maxTokens,
        stop: input.settings.stopSequences.length ? input.settings.stopSequences : undefined,
      }),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `llama-server returned HTTP ${response.status}`);
    }
    if (!response.body) throw new Error("llama-server returned no stream body.");

    const decoder = new TextDecoder();
    const sse = new SseDecoder();
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of sse.push(decoder.decode(value, { stream: true }))) {
          const parsed = parseLlamaEvent(event);
          yield parsed;
          if (parsed.type === "done" || parsed.type === "error") return;
        }
      }
    } finally {
      reader.releaseLock();
    }
    for (const event of sse.flush()) yield parseLlamaEvent(event);
  }
}
