import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { LlamaServerProvider } from "./provider";
import {
  selectGgufModel,
  selectLlamaServer,
  startManagedRuntime,
  validateManagedRuntime,
} from "./runtime";
import { useMindStore } from "./store";
import type { MindModel } from "./types";
import { MindOrbit } from "./MindOrbit";
import { mindStateLabel } from "./mindState";

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

function detectedModel(serverModelId: string, modelPath: string | undefined, context: number): MindModel {
  const fileName = modelPath?.split(/[\\/]/).pop()?.replace(/\.gguf$/i, "");
  return {
    id: `model-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    displayName: fileName || serverModelId.split(/[\\/]/).pop() || "VOID Mind A0",
    version: "A0",
    serverModelId,
    modelPath,
    importedAt: new Date().toISOString(),
    context,
    languages: ["pt-BR", "en"],
  };
}

export function MindSetup() {
  const {
    runtime,
    runtimeState,
    runtimeDetail,
    settings,
    selectedModelId,
    updateRuntime,
    updateSettings,
    setRuntimeStatus,
    addModel,
    completeOnboarding,
  } = useMindStore(useShallow((state) => ({
    runtime: state.runtime,
    runtimeState: state.runtimeState,
    runtimeDetail: state.runtimeDetail,
    settings: state.settings,
    selectedModelId: state.selectedModelId,
    updateRuntime: state.updateRuntime,
    updateSettings: state.updateSettings,
    setRuntimeStatus: state.setRuntimeStatus,
    addModel: state.addModel,
    completeOnboarding: state.completeOnboarding,
  })));
  const [mode, setMode] = useState(runtime.mode);
  const [executablePath, setExecutablePath] = useState(runtime.executablePath ?? "");
  const [modelPath, setModelPath] = useState("");
  const [busy, setBusy] = useState(false);

  const registerHealthyModel = (serverModelId: string, path?: string) => {
    addModel(detectedModel(serverModelId, path, settings.context));
  };

  const connectExternal = async () => {
    setBusy(true);
    setRuntimeStatus("checking", "Checking the loopback endpoint.");
    try {
      const provider = new LlamaServerProvider(runtime.endpoint);
      const health = await provider.health();
      if (!health.ok) {
        setRuntimeStatus(health.status === "loading" ? "loading" : "error", health.detail);
        return;
      }
      if (health.model) registerHealthyModel(health.model);
      setRuntimeStatus("ready", health.model ? `Loaded: ${health.model}` : "llama-server is ready.");
    } catch (error) {
      setRuntimeStatus("error", error instanceof Error ? error.message : "Could not reach llama-server.");
    } finally {
      setBusy(false);
    }
  };

  const startManaged = async () => {
    if (!executablePath || !modelPath) {
      setRuntimeStatus("error", "Select llama-server and a GGUF model first.");
      return;
    }
    setBusy(true);
    setRuntimeStatus("loading", "Validating paths and starting llama-server.");
    const config = {
      executablePath,
      modelPath,
      port: runtime.port,
      context: settings.context,
      gpuLayers: settings.gpuLayers,
    };
    try {
      const validated = await validateManagedRuntime(config);
      updateRuntime({
        mode: "managed",
        executablePath: validated.executablePath,
        endpoint: `http://127.0.0.1:${validated.port}`,
      });
      await startManagedRuntime(config);
      const provider = new LlamaServerProvider(`http://127.0.0.1:${runtime.port}`);
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const health = await provider.health();
        if (health.ok) {
          registerHealthyModel(health.model || modelPath, modelPath);
          setRuntimeStatus("ready", health.model ? `Loaded: ${health.model}` : "Model loaded.");
          return;
        }
        if (health.status === "offline" && attempt > 3) await wait(750);
        else await wait(500);
      }
      setRuntimeStatus("error", "llama-server did not become ready within 60 seconds.");
    } catch (error) {
      setRuntimeStatus("error", error instanceof Error ? error.message : "Managed runtime failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mind-setup panel h-full overflow-auto">
      <div className="mind-setup__intro">
        <MindOrbit state={runtimeState} />
        <div>
          <p className="mind-kicker">VOID MIND / LOCAL INFERENCE</p>
          <h1>Connect a model you control.</h1>
          <p>
            VOID Mind talks only to a llama-server bound to this computer. No account, cloud inference,
            telemetry, model download, or conversation upload is included.
          </p>
        </div>
      </div>

      <div className="mind-setup__modes" role="tablist" aria-label="Runtime setup mode">
        <button className={mode === "external" ? "is-active" : ""} onClick={() => setMode("external")}>Use running server</button>
        <button className={mode === "managed" ? "is-active" : ""} onClick={() => setMode("managed")}>Let VOID start it</button>
      </div>

      {mode === "external" ? (
        <div className="mind-setup__form">
          <label>
            Loopback endpoint
            <input
              value={runtime.endpoint}
              onChange={(event) => updateRuntime({ mode: "external", endpoint: event.target.value })}
              placeholder="http://127.0.0.1:8080"
            />
          </label>
          <p className="mind-help">Start llama-server yourself with a compatible instruct GGUF, then test the local endpoint.</p>
          <button className="mind-primary-button" disabled={busy} onClick={() => void connectExternal()}>
            {busy ? "Checking server…" : "Test local server"}
          </button>
        </div>
      ) : (
        <div className="mind-setup__form">
          <label>
            llama-server executable
            <div className="mind-path-field">
              <input readOnly value={executablePath} placeholder="Select llama-server.exe" />
              <button onClick={() => void selectLlamaServer().then((path) => path && setExecutablePath(path))}>Choose</button>
            </div>
          </label>
          <label>
            GGUF model
            <div className="mind-path-field">
              <input readOnly value={modelPath} placeholder="Select a local .gguf file" />
              <button onClick={() => void selectGgufModel().then((path) => path && setModelPath(path))}>Choose</button>
            </div>
          </label>
          <div className="mind-setup__summary">
            <span>127.0.0.1:{runtime.port}</span>
            <span>{settings.context.toLocaleString()} context</span>
            <span>{settings.gpuLayers} GPU layers</span>
          </div>
          <div className="mind-setup__tuning">
            <label>Context tokens
              <input type="number" min={512} max={32768} step={512} value={settings.context} onChange={(event) => updateSettings({ context: Number(event.target.value) })} />
            </label>
            <label>GPU layers
              <input type="number" min={-1} max={99} value={settings.gpuLayers} onChange={(event) => updateSettings({ gpuLayers: Number(event.target.value) })} />
            </label>
          </div>
          <button className="mind-primary-button" disabled={busy} onClick={() => void startManaged()}>
            {busy ? "Loading model…" : "Start local runtime"}
          </button>
        </div>
      )}

      <div className="mind-setup__status" data-state={runtimeState} role="status">
        <MindOrbit state={runtimeState} compact />
        <div>
          <strong>{mindStateLabel(runtimeState)}</strong>
          <span>{runtimeDetail}</span>
        </div>
      </div>

      <div className="mind-setup__finish">
        <button
          className="mind-primary-button"
          disabled={runtimeState !== "ready" || !selectedModelId}
          onClick={completeOnboarding}
        >
          Open VOID Mind
        </button>
        <span>A detected model without a manifest is labeled A0 and clearly marked unverified.</span>
      </div>
    </section>
  );
}
