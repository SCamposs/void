import { describe, expect, it } from "vitest";
import { LlamaServerProvider, SseDecoder, normalizeLoopbackEndpoint, parseLlamaEvent } from "../app/modules/mind/provider";

describe("Mind provider", () => {
  it("accepts loopback endpoints and rejects remote hosts", () => {
    expect(normalizeLoopbackEndpoint("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
    expect(() => normalizeLoopbackEndpoint("https://example.com")).toThrow();
    expect(() => normalizeLoopbackEndpoint("http://192.168.1.20:8080")).toThrow();
  });

  it("decodes SSE events split across chunks", () => {
    const decoder = new SseDecoder();
    expect(decoder.push("data: {\"choices\":[{\"delta\":{\"content\":\"Hel" )).toEqual([]);
    const events = decoder.push("lo\"}}]}\n\ndata: [DONE]\n\n");
    expect(events).toHaveLength(2);
    expect(parseLlamaEvent(events[0])).toEqual({ type: "token", content: "Hello" });
    expect(parseLlamaEvent(events[1])).toEqual({ type: "done" });
  });

  it("reports health and the loaded model", async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) return new Response('{"status":"ok"}', { status: 200 });
      return new Response('{"data":[{"id":"VOID Mind A0"}]}', { status: 200 });
    };
    const provider = new LlamaServerProvider("http://localhost:8080", fetcher as typeof fetch);
    await expect(provider.health()).resolves.toEqual({
      ok: true,
      status: "ready",
      model: "VOID Mind A0",
    });
  });
});
