import { describe, expect, it } from "vitest";
import { parseModelManifest } from "../app/modules/mind/manifest";

const validManifest = {
  schema_version: "1.0.0",
  name: "VOID Mind",
  version: "A0",
  base: "example/instruct",
  source: { uri: "https://example.invalid/model", license: "Apache-2.0" },
  format: "GGUF",
  quantization: "Q4_K_M",
  languages: ["pt-BR", "en"],
  context: 8192,
  chat_template: "llama3",
  training_lineage: [],
  training_datasets: [],
  training_stages: [],
  adapters: [],
  evaluations: [],
  hashes: { sha256: "a".repeat(64) },
  created_by: "SCamposs",
  created_at: "2026-01-01T00:00:00Z",
};

describe("Mind manifest", () => {
  it("accepts the versioned A0 contract", () => {
    expect(parseModelManifest(validManifest).version).toBe("A0");
  });

  it("rejects manifests without a real hash", () => {
    expect(() => parseModelManifest({ ...validManifest, hashes: { sha256: "unknown" } })).toThrow();
  });
});
