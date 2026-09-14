import type { OrbitAudioStatus } from "../audio/OrbitAudioAnalyzer";
import type { OrbitRuntimeState } from "../renderer/OrbitRenderer";
import type { OrbitResolvedQuality, OrbitQualityMode } from "../renderer/quality";
import type { OrbitMotion, OrbitSettings } from "../settings";

type OrbitControlsMinimalProps = {
  visible: boolean;
  settingsOpen: boolean;
  audioStatus: OrbitAudioStatus;
  runtimeState: OrbitRuntimeState | null;
  settings: OrbitSettings;
  onToggleAudio: () => void;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onSettingsChange: (settings: OrbitSettings) => void;
};

const QUALITY_LABELS: Record<OrbitResolvedQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  quality: "Quality",
};

function MicrophoneIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V5Z" />
    <path d="M5.5 10.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 17.5V21M9 21h6" />
    {muted && <path d="m4 4 16 16" />}
  </svg>;
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6" />
  </svg>;
}

export function OrbitControlsMinimal({
  visible,
  settingsOpen,
  audioStatus,
  runtimeState,
  settings,
  onToggleAudio,
  onToggleSettings,
  onCloseSettings,
  onSettingsChange,
}: OrbitControlsMinimalProps) {
  const listening = audioStatus === "listening";
  const audioLabel = listening ? "Turn microphone off" : audioStatus === "requesting" ? "Requesting microphone access" : "Turn microphone on";
  return <div className={`orbit-controls ${visible || settingsOpen ? "is-visible" : ""}`}>
    {settingsOpen && <section className="orbit-settings" role="dialog" aria-label="Orbit settings">
      <div className="orbit-settings__header">
        <h2>Orbit settings</h2>
        <button type="button" onClick={onCloseSettings} aria-label="Close Orbit settings">×</button>
      </div>

      <label className="orbit-setting-row">
        <span>Motion</span>
        <select value={settings.motion} onChange={(event) => onSettingsChange({ ...settings, motion: event.target.value as OrbitMotion })}>
          <option value="calm">Calm</option>
          <option value="balanced">Balanced</option>
          <option value="alive">Alive</option>
        </select>
      </label>

      <label className="orbit-setting-row">
        <span>Quality</span>
        <select value={settings.quality} onChange={(event) => onSettingsChange({ ...settings, quality: event.target.value as OrbitQualityMode })}>
          <option value="auto">Automatic</option>
          <option value="performance">Performance</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </select>
      </label>

      <label className="orbit-setting-range">
        <span>Microphone sensitivity</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={settings.sensitivity}
          onChange={(event) => onSettingsChange({ ...settings, sensitivity: Number(event.target.value) })}
        />
      </label>

      {runtimeState && <p className="orbit-settings__note">
        {runtimeState.backend === "procedural"
          ? "Reduced visual mode is active on this graphics device."
          : `${settings.quality === "auto" ? "Automatic" : "Current"} quality: ${QUALITY_LABELS[runtimeState.resolvedQuality]}.`}
      </p>}
    </section>}

    {(audioStatus === "denied" || audioStatus === "unavailable") && <p className="orbit-audio-notice" role="status">
      Microphone unavailable. Orbit remains alive in quiet mode.
    </p>}

    <div className="orbit-controls__buttons">
      <button
        type="button"
        className={listening ? "is-active" : ""}
        onClick={onToggleAudio}
        disabled={audioStatus === "requesting"}
        aria-label={audioLabel}
        title={audioLabel}
      >
        <MicrophoneIcon muted={!listening} />
        <span className="orbit-control-state" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={settingsOpen ? "is-active" : ""}
        onClick={onToggleSettings}
        aria-expanded={settingsOpen}
        aria-label="Open Orbit settings"
        title="Orbit settings"
      >
        <SettingsIcon />
      </button>
    </div>
  </div>;
}
