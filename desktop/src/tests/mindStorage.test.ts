import { describe, expect, it } from "vitest";
import { MIND_STATE_VERSION, migrateMindState } from "../app/modules/mind/storage";

describe("Mind storage migration", () => {
  it("returns safe defaults for invalid storage", () => {
    const state = migrateMindState("broken");
    expect(state.version).toBe(MIND_STATE_VERSION);
    expect(state.runtime.endpoint).toBe("http://127.0.0.1:8080");
    expect(state.policy.memoryEnabled).toBe(false);
  });

  it("migrates older partial state without losing valid chats", () => {
    const state = migrateMindState({
      version: 1,
      activeChatId: "chat-1",
      chats: [
        {
          id: "chat-1",
          title: "Local AI",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          messages: [],
        },
      ],
      settings: { context: 8192 },
    });
    expect(state.version).toBe(2);
    expect(state.activeChatId).toBe("chat-1");
    expect(state.settings.context).toBe(8192);
    expect(state.settings.temperature).toBeGreaterThan(0);
  });
});
