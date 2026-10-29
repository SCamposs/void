import { Button, Select, Slider, Tooltip } from "../../../components/ui/Controls";
import { Popover } from "@base-ui/react/popover";
import { Mic, MicOff, SlidersHorizontal, X } from "lucide-react";
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
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: OrbitSettings) => void;
};

const QUALITY_LABELS: Record<OrbitResolvedQuality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  quality: "Quality",
};

export function OrbitControlsMinimal({
  visible,
  settingsOpen,
  audioStatus,
  runtimeState,
  settings,
  onToggleAudio,
  onSettingsOpenChange,
  onSettingsChange,
}: OrbitControlsMinimalProps) {
  const listening = audioStatus === "listening";
  const audioLabel = listening ? "Turn microphone off" : audioStatus === "requesting" ? "Requesting microphone access" : "Turn microphone on";
  return <Popover.Root open={settingsOpen} onOpenChange={onSettingsOpenChange}><div className={`orbit-controls ${visible || settingsOpen ? "is-visible" : ""}`}>
    <Popover.Portal><Popover.Positioner className="orbit-settings-positioner" side="top" align="end" sideOffset={12} collisionPadding={16}>
    <Popover.Popup className="orbit-settings">
      <div className="orbit-settings__header">
        <Popover.Title>Orbit settings</Popover.Title>
        <Popover.Close render={<Button type="button" aria-label="Close Orbit settings"><X size={16} aria-hidden="true" /></Button>} />
      </div>
      <Popover.Description className="sr-only">Adjust motion, visual quality and microphone sensitivity.</Popover.Description>

      <label className="orbit-setting-row">
        <span>Motion</span>
        <Select label="Motion" value={settings.motion} onValueChange={(nextValue) => onSettingsChange({ ...settings, motion: nextValue as OrbitMotion })}>
          <option value="calm">Calm</option>
          <option value="balanced">Balanced</option>
          <option value="alive">Alive</option>
        </Select>
      </label>

      <label className="orbit-setting-row">
        <span>Quality</span>
        <Select label="Quality" value={settings.quality} onValueChange={(nextValue) => onSettingsChange({ ...settings, quality: nextValue as OrbitQualityMode })}>
          <option value="auto">Automatic</option>
          <option value="performance">Performance</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </Select>
      </label>

      <label className="orbit-setting-range">
        <span>Microphone sensitivity</span>
        <Slider label="Microphone sensitivity"

          min="0.5"
          max="2"
          step="0.05"
          value={settings.sensitivity}
          onValueChange={(nextValue) => onSettingsChange({ ...settings, sensitivity: Number(nextValue) })}
        />
      </label>

      {runtimeState && <p className="orbit-settings__note">
        {runtimeState.backend === "procedural"
          ? "Reduced visual mode is active on this graphics device."
          : `${settings.quality === "auto" ? "Automatic" : "Current"} quality: ${QUALITY_LABELS[runtimeState.resolvedQuality]}.`}
      </p>}
    </Popover.Popup></Popover.Positioner></Popover.Portal>

    {(audioStatus === "denied" || audioStatus === "unavailable") && <p className="orbit-audio-notice" role="status">
      Microphone unavailable. Orbit remains alive in quiet mode.
    </p>}

    <div className="orbit-controls__buttons">
      <Tooltip label={audioLabel}><Button
        type="button"
        className={listening ? "is-active" : ""}
        onClick={onToggleAudio}
        disabled={audioStatus === "requesting"}
        aria-label={audioLabel}
      >
        {listening ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
        <span className="orbit-control-state" aria-hidden="true" />
      </Button></Tooltip>
      <Tooltip label="Orbit settings"><Popover.Trigger render={<Button
        type="button"
        className={settingsOpen ? "is-active" : ""}
        aria-label="Open Orbit settings"
      >
        <SlidersHorizontal aria-hidden="true" />
      </Button>} /></Tooltip>
    </div>
  </div></Popover.Root>;
}
