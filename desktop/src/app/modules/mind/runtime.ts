import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type ManagedRuntimeConfig = {
  executablePath: string;
  modelPath: string;
  port: number;
  context: number;
  gpuLayers: number;
};

export type ManagedRuntimeStatus = {
  running: boolean;
  state: "loading" | "stopped";
  executablePath?: string;
  modelPath?: string;
  port?: number;
  startedAt?: number;
  exitCode?: number;
};

export type ValidatedRuntimePaths = Pick<
  ManagedRuntimeConfig,
  "executablePath" | "modelPath" | "port"
>;

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function selectLlamaServer(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    title: "Select llama-server",
    multiple: false,
    directory: false,
    filters: [{ name: "llama-server", extensions: ["exe"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function selectGgufModel(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    title: "Select a GGUF model",
    multiple: false,
    directory: false,
    filters: [{ name: "GGUF model", extensions: ["gguf"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export function validateManagedRuntime(
  config: ManagedRuntimeConfig,
): Promise<ValidatedRuntimePaths> {
  return invoke("mind_validate_runtime", { config });
}

export function startManagedRuntime(config: ManagedRuntimeConfig): Promise<ManagedRuntimeStatus> {
  return invoke("mind_start_runtime", { config });
}

export function getManagedRuntimeStatus(): Promise<ManagedRuntimeStatus> {
  return invoke("mind_runtime_status");
}

export function stopManagedRuntime(): Promise<ManagedRuntimeStatus> {
  return invoke("mind_stop_runtime");
}
