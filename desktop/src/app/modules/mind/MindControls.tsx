import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LlamaServerProvider } from "./provider";
import { readManifestFile } from "./manifest";
import {
  getManagedRuntimeStatus,
  isTauriRuntime,
  selectGgufModel,
  selectLlamaServer,
  startManagedRuntime,
  stopManagedRuntime,
} from "./runtime";
import { useMindStore } from "./store";
import type { GenerationSettings, MindModel } from "./types";
import { MindOrbit } from "./MindOrbit";
import { mindStateLabel } from "./mindState";

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mind-range">
      <span>{label}<output>{value}</output></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function provisionalModel(modelPath: string, context: number): MindModel {
  const fileName = modelPath.split(/[\\/]/).pop()?.replace(/\.gguf$/i, "") || "Local GGUF";
  return {
    id: `model-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    displayName: fileName,
    version: "A0",
    serverModelId: modelPath,
    modelPath,
    importedAt: new Date().toISOString(),
    context,
    languages: ["pt-BR", "en"],
  };
}

export function MindControls() {
  const store = useMindStore(useShallow((state) => ({
    models: state.models,
    selectedModelId: state.selectedModelId,
    profile: state.profile,
    settings: state.settings,
    policy: state.policy,
    runtime: state.runtime,
    runtimeState: state.runtimeState,
    runtimeDetail: state.runtimeDetail,
    updateRuntime: state.updateRuntime,
    setRuntimeStatus: state.setRuntimeStatus,
    updateModel: state.updateModel,
    addModel: state.addModel,
    selectModel: state.selectModel,
    removeModel: state.removeModel,
    setProfile: state.setProfile,
    updateSettings: state.updateSettings,
    updatePolicy: state.updatePolicy,
    resetMind: state.resetMind,
  })));
  const selectedModel = store.models.find((model) => model.id === store.selectedModelId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const updateNumber = (key: keyof GenerationSettings) => (value: number) => {
    store.updateSettings({ [key]: value });
  };

  const checkRuntime = async () => {
    store.setRuntimeStatus("checking", "Checking local runtime.");
    try {
      const health = await new LlamaServerProvider(store.runtime.endpoint).health();
      if (health.ok) {
        if (selectedModel && health.model) store.updateModel(selectedModel.id, { serverModelId: health.model });
        store.setRuntimeStatus("ready", health.model ? `Loaded: ${health.model}` : "llama-server is ready.");
      } else {
        store.setRuntimeStatus(health.status === "loading" ? "loading" : "error", health.detail);
      }
    } catch (error) {
      store.setRuntimeStatus("error", error instanceof Error ? error.message : "Runtime check failed.");
    }
  };

  const startRuntime = async () => {
    if (!store.runtime.executablePath || !selectedModel?.modelPath) {
      setNotice("Select llama-server and a GGUF model first.");
      return;
    }
    setBusy(true);
    store.setRuntimeStatus("loading", "Starting managed llama-server.");
    try {
      await startManagedRuntime({
        executablePath: store.runtime.executablePath,
        modelPath: selectedModel.modelPath,
        port: store.runtime.port,
        context: store.settings.context,
        gpuLayers: store.settings.gpuLayers,
      });
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        const health = await new LlamaServerProvider(store.runtime.endpoint).health();
        if (health.ok) {
          store.updateModel(selectedModel.id, { serverModelId: health.model || selectedModel.modelPath });
          store.setRuntimeStatus("ready", health.model ? `Loaded: ${health.model}` : "Model loaded.");
          return;
        }
        const process = await getManagedRuntimeStatus();
        if (!process.running) throw new Error(`llama-server stopped with exit code ${process.exitCode ?? "unknown"}.`);
      }
      throw new Error("llama-server did not become ready within 45 seconds.");
    } catch (error) {
      store.setRuntimeStatus("error", error instanceof Error ? error.message : "Managed runtime failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportMindData = () => {
    const snapshot = useMindStore.getState();
    const payload = {
      format: "void-mind-local-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      chats: snapshot.chats,
      models: snapshot.models,
      settings: snapshot.settings,
      policy: snapshot.policy,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `void-mind-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="mind-controls" aria-label="Mind controls">
      <div className="mind-controls__status">
        <MindOrbit state={store.runtimeState} compact />
        <div><strong>{mindStateLabel(store.runtimeState)}</strong><span>{store.runtimeDetail}</span></div>
      </div>

      <details open>
        <summary>Runtime</summary>
        <div className="mind-control-group">
          <label>Mode
            <select value={store.runtime.mode} onChange={(event) => store.updateRuntime({ mode: event.target.value as "external" | "managed" })}>
              <option value="external">External local server</option>
              <option value="managed" disabled={!isTauriRuntime()}>Managed by VOID</option>
            </select>
          </label>
          <label>Loopback endpoint
            <input value={store.runtime.endpoint} onChange={(event) => store.updateRuntime({ endpoint: event.target.value })} />
          </label>
          <button onClick={() => void checkRuntime()}>Check local runtime</button>
          {store.runtime.mode === "managed" && (
            <>
              <label>llama-server
                <div className="mind-path-field">
                  <input readOnly value={store.runtime.executablePath ?? ""} placeholder="Not selected" />
                  <button onClick={() => void selectLlamaServer().then((path) => path && store.updateRuntime({ executablePath: path }))}>Choose</button>
                </div>
              </label>
              <div className="mind-button-row">
                <button disabled={busy} onClick={() => void startRuntime()}>{busy ? "Loading…" : "Start runtime"}</button>
                <button onClick={() => void stopManagedRuntime().then(() => store.setRuntimeStatus("stopped", "Managed runtime stopped."))}>Stop runtime</button>
              </div>
            </>
          )}
        </div>
      </details>

      <details open>
        <summary>Model Manager</summary>
        <div className="mind-control-group">
          <label>Active model
            <select value={store.selectedModelId ?? ""} onChange={(event) => store.selectModel(event.target.value || null)}>
              <option value="">No model selected</option>
              {store.models.map((model) => <option key={model.id} value={model.id}>{model.version} · {model.displayName}</option>)}
            </select>
          </label>
          {selectedModel && (
            <div className="mind-model-facts">
              <span>{selectedModel.manifest ? "Manifest verified" : "Manifest not imported"}</span>
              <span>{selectedModel.quantization || "Quantization unknown"}</span>
              <span>{selectedModel.context.toLocaleString()} context</span>
            </div>
          )}
          {store.runtime.mode === "managed" && (
            <button onClick={() => void selectGgufModel().then((path) => path && store.addModel(provisionalModel(path, store.settings.context)))}>Import GGUF metadata</button>
          )}
          <label className="mind-file-button">
            Import manifest
            <input type="file" accept="application/json,.json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void readManifestFile(file).then((manifest) => {
                const current = useMindStore.getState().models.find((model) => model.id === useMindStore.getState().selectedModelId);
                if (current) {
                  store.updateModel(current.id, {
                    displayName: manifest.name,
                    version: manifest.version,
                    context: manifest.context,
                    quantization: manifest.quantization,
                    languages: manifest.languages,
                    manifest,
                    manifestPath: file.name,
                  });
                } else {
                  store.addModel({
                    id: `model-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
                    displayName: manifest.name,
                    version: manifest.version,
                    importedAt: new Date().toISOString(),
                    context: manifest.context,
                    quantization: manifest.quantization,
                    languages: manifest.languages,
                    manifest,
                    manifestPath: file.name,
                  });
                }
                setNotice(`Imported ${manifest.name} ${manifest.version}.`);
              }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Manifest import failed."));
              event.target.value = "";
            }} />
          </label>
          <button disabled={!selectedModel} onClick={() => selectedModel && store.removeModel(selectedModel.id)}>Remove model metadata</button>
        </div>
      </details>

      <details>
        <summary>Response</summary>
        <div className="mind-control-group">
          <label>Profile
            <select value={store.profile} onChange={(event) => store.setProfile(event.target.value as typeof store.profile)}>
              <option value="general">General</option><option value="creative">Creative</option><option value="analytical">Analytical</option><option value="concise">Concise</option><option value="custom">Custom</option>
            </select>
          </label>
          <label>System instructions
            <textarea rows={6} value={store.settings.systemPrompt} onChange={(event) => store.updateSettings({ systemPrompt: event.target.value })} />
          </label>
          <RangeControl label="Temperature" value={store.settings.temperature} min={0} max={2} step={0.05} onChange={updateNumber("temperature")} />
          <RangeControl label="Top P" value={store.settings.topP} min={0.05} max={1} step={0.05} onChange={updateNumber("topP")} />
          <RangeControl label="Top K" value={store.settings.topK} min={0} max={200} step={1} onChange={updateNumber("topK")} />
          <RangeControl label="Repeat penalty" value={store.settings.repeatPenalty} min={0.8} max={1.5} step={0.01} onChange={updateNumber("repeatPenalty")} />
          <RangeControl label="Max tokens" value={store.settings.maxTokens} min={64} max={8192} step={64} onChange={updateNumber("maxTokens")} />
          <RangeControl label="Context" value={store.settings.context} min={512} max={32768} step={512} onChange={updateNumber("context")} />
          <RangeControl label="GPU layers" value={store.settings.gpuLayers} min={-1} max={99} step={1} onChange={updateNumber("gpuLayers")} />
          <label>Seed
            <input type="number" value={store.settings.seed} onChange={(event) => store.updateSettings({ seed: Number(event.target.value) })} />
          </label>
          <label>Stop sequences, one per line
            <textarea rows={3} value={store.settings.stopSequences.join("\n")} onChange={(event) => store.updateSettings({ stopSequences: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
          </label>
        </div>
      </details>

      <details>
        <summary>Policy, memory, and data</summary>
        <div className="mind-control-group">
          <label className="mind-toggle">Local input policy <input type="checkbox" checked={store.policy.inputPolicyEnabled} onChange={(event) => store.updatePolicy({ inputPolicyEnabled: event.target.checked })} /></label>
          <label className="mind-toggle">Local output policy <input type="checkbox" checked={store.policy.outputPolicyEnabled} onChange={(event) => store.updatePolicy({ outputPolicyEnabled: event.target.checked })} /></label>
          <label className="mind-toggle">Personal memory <input type="checkbox" checked={store.policy.memoryEnabled} onChange={(event) => store.updatePolicy({ memoryEnabled: event.target.checked })} /></label>
          <p className="mind-help">Memory retrieval is not implemented in A0. Enabling this reserves the preference but stores no hidden memories.</p>
          <label className="mind-toggle">Retain conversations <input type="checkbox" checked={store.policy.retainConversations} onChange={(event) => store.updatePolicy({ retainConversations: event.target.checked })} /></label>
          <button onClick={exportMindData}>Export Mind data</button>
          <button onClick={() => {
            if (window.confirm("Delete all VOID Mind chats, models, settings, and local preferences?")) store.resetMind();
          }}>Reset Mind data</button>
        </div>
      </details>
      {notice && <p className="mind-controls__notice" role="status">{notice}</p>}
    </aside>
  );
}
