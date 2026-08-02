import type { ModelManifest } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseModelManifest(value: unknown): ModelManifest {
  if (!isRecord(value)) throw new Error("Manifest must be a JSON object.");
  if (value.schema_version !== "1.0.0") throw new Error("Unsupported manifest schema version.");
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error("Manifest name is required.");
  if (typeof value.version !== "string" || !/^A(?:0|[1-9][0-9]*)$/.test(value.version)) {
    throw new Error("Manifest version must use A0, A1, A2, and so on.");
  }
  if (value.format !== "GGUF") throw new Error("VOID Mind currently supports GGUF manifests only.");
  if (value.created_by !== "SCamposs") throw new Error("Manifest creator must be SCamposs.");
  if (!isRecord(value.source) || typeof value.source.uri !== "string" || typeof value.source.license !== "string") {
    throw new Error("Manifest source and license are required.");
  }
  if (!isRecord(value.hashes) || typeof value.hashes.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(value.hashes.sha256)) {
    throw new Error("Manifest requires a valid SHA-256 hash.");
  }
  if (!Array.isArray(value.languages) || value.languages.some((language) => typeof language !== "string")) {
    throw new Error("Manifest languages must be a string array.");
  }
  if (typeof value.context !== "number" || value.context < 256) {
    throw new Error("Manifest context is invalid.");
  }
  const requiredArrays = [
    "training_lineage",
    "training_datasets",
    "training_stages",
    "adapters",
    "evaluations",
  ] as const;
  if (requiredArrays.some((key) => !Array.isArray(value[key]))) {
    throw new Error("Manifest lineage arrays are incomplete.");
  }
  if (typeof value.created_at !== "string" || Number.isNaN(Date.parse(value.created_at))) {
    throw new Error("Manifest creation date is invalid.");
  }
  return value as ModelManifest;
}

export function readManifestFile(file: File): Promise<ModelManifest> {
  return file.text().then((text) => parseModelManifest(JSON.parse(text) as unknown));
}
