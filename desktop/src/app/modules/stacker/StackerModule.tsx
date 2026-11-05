import { Button, SwitchControl, Disclosure, DisclosureBody, DisclosureTitle, Input, Select, Slider } from "../../components/ui/Controls";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StackerEngine, type LastClearEvent, type Snapshot } from "./engine";
import { advanceRepeat } from "./handling";
import { prepareStackerReferenceAudio, stackerOutput } from "./referenceAudio";
import { Volume2, VolumeX } from "lucide-react";
import "./stacker.css";
import {
  playStackerSound,
  type StackerSoundEvent,
  type StackerSoundPack,
  type StackerSoundSettings,
} from "./audio";
import {
  STACKER_COUNTDOWN_GO_MS,
  STACKER_COUNTDOWN_INTERVAL_MS,
  STACKER_COUNTDOWN_STEPS,
  type StackerCountdownStep,
} from "./countdown";

const CELL = 22;
const W = 10;
const GAP = 1;
const H = 20;
const BOARD_PIXEL_W = W * CELL + (W - 1) * GAP;
const BOARD_PIXEL_H = H * CELL + (H - 1) * GAP;
const PLAY_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "z", "Z", "a", "A", "c", "C", "p", "P", "r", "R", "F4"]);
const PIECE_SHADES: Record<number, string> = {
  1: "#e7ecf3",
  2: "#d8e0eb",
  3: "#c8d2e0",
  4: "#bcc8d7",
  5: "#b0bdcf",
  6: "#a1b1c6",
  7: "#93a5bd",
};
type PieceSkin = "classic-mono" | "ice-glass" | "wireframe" | "solid-block" | "soft-glow";
type PiecePalette = "mono" | "ice" | "contrast";
type BoardBackground = "old-black" | "charcoal" | "deep-grid";

const PIECE_PALETTES: Record<PiecePalette, Record<number, string>> = {
  mono: PIECE_SHADES,
  ice: {
    1: "#81e8ff", // I, glacial cyan
    2: "#f3df86", // O, pale yellow
    3: "#c5a3ff", // T, frosted violet
    4: "#89e0b5", // S, cool mint
    5: "#f29cbc", // Z, muted rose
    6: "#91b6ff", // J, ice blue
    7: "#f0ba85", // L, pale peach
  },
  contrast: {
    1: "#f5f8ff",
    2: "#b9c9dd",
    3: "#e6edf7",
    4: "#92a7c3",
    5: "#d3deed",
    6: "#a5b8d2",
    7: "#c2d1e5",
  },
};

const BOARD_BACKGROUNDS: Record<BoardBackground, string> = {
  "old-black": "#030405",
  charcoal: "#0a0c10",
  "deep-grid": "#050505",
};

function canPlaceAt(state: Snapshot, x: number, y: number): boolean {
  for (let py = 0; py < state.activePiece.matrix.length; py += 1) {
    for (let px = 0; px < state.activePiece.matrix[py].length; px += 1) {
      if (state.activePiece.matrix[py][px] === 0) continue;
      const bx = x + px;
      const by = y + py;
      if (bx < 0 || bx >= 10 || by >= 20) return false;
      if (by >= 0 && state.board[by][bx] !== 0) return false;
    }
  }
  return true;
}

function ghostY(state: Snapshot): number {
  let y = state.activePiece.y;
  while (canPlaceAt(state, state.activePiece.x, y + 1)) y += 1;
  return y;
}

function overlay(state: Snapshot): number[][] {
  const out = state.board.map((r) => [...r]);
  const gy = ghostY(state);
  for (let y = 0; y < state.activePiece.matrix.length; y += 1) for (let x = 0; x < state.activePiece.matrix[y].length; x += 1) {
    if (!state.activePiece.matrix[y][x]) continue;
    const gx = state.activePiece.x + x;
    const yy = gy + y;
    if (yy >= 0 && yy < 20 && gx >= 0 && gx < 10 && out[yy][gx] === 0) out[yy][gx] = 8;
  }
  for (let y = 0; y < state.activePiece.matrix.length; y += 1) for (let x = 0; x < state.activePiece.matrix[y].length; x += 1) {
    if (!state.activePiece.matrix[y][x]) continue;
    const gx = state.activePiece.x + x;
    const yy = state.activePiece.y + y;
    if (yy >= 0 && yy < 20 && gx >= 0 && gx < 10) out[yy][gx] = state.activePiece.id;
  }
  return out;
}

function clearLabel(lines: number): string {
  if (lines === 1) return "SINGLE";
  if (lines === 2) return "DOUBLE";
  if (lines === 3) return "TRIPLE";
  if (lines === 4) return "QUAD";
  return `${lines} LINES`;
}

function clearTone(clear: LastClearEvent): string {
  if (clear.isPerfectClear) return "#f2efe5";
  if (clear.tSpinKind === "mini") return "#d8e0eb";
  if (clear.isTSpin) return "#ebe7de";
  if (clear.lines === 4) return "#f2efe5";
  return "#c9c5bc";
}

function comboTierTone(combo: number): string {
  if (combo >= 8) return "#f2efe5";
  if (combo >= 5) return "#d8e0eb";
  if (combo >= 3) return "#c9c5bc";
  if (combo >= 2) return "#b9b5ab";
  return "#93a5bd";
}

function b2bTierTone(b2bStreak: number): string {
  if (b2bStreak >= 8) return "#f2efe5";
  if (b2bStreak >= 5) return "#d5d1c7";
  if (b2bStreak >= 3) return "#c3bfb6";
  if (b2bStreak >= 2) return "#b5b1a8";
  return "#98958f";
}

function clearSubtitle(clear: LastClearEvent): string {
  const detail: string[] = [];
  if (clear.combo > 1) detail.push(`C${clear.combo - 1}`);
  if (clear.b2bStreak >= 2) detail.push(`B${clear.b2bStreak - 1}`);
  if (clear.tSpinKind === "mini") detail.push("MINI");
  if (clear.isPerfectClear) detail.push("PC");
  return detail.join(" ");
}

function pieceLabel(id: number): string {
  if (id === 1) return "I";
  if (id === 2) return "O";
  if (id === 3) return "T";
  if (id === 4) return "S";
  if (id === 5) return "Z";
  if (id === 6) return "J";
  if (id === 7) return "L";
  return "?";
}

function formatMs(ms: number): string {
  const clamped = Math.max(0, Math.trunc(ms));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const centis = Math.floor((clamped % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || target.isContentEditable
    || target.closest('[role="combobox"], [role="slider"], [role="checkbox"], [role="switch"], [role="listbox"], [role="dialog"], [role="alertdialog"]') !== null;
}

type SprintHistoryEntry = { at: number; ms: number };
const SPRINT_HISTORY_KEY = "void_stacker_sprint_history_v1";
type StackerRunEntry = {
  at: number;
  mode: "sprint" | "endless";
  score: number;
  lines: number;
  ms: number;
  pieces: number;
  inputs: number;
  finessePlus: number;
};

type ClearParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  size: number;
  tone: string;
};
const STACKER_RUNS_KEY = "void_stacker_runs_v1";
const SEED_KEY = "void_stacker_seed";
const OPENER_KEY = "void_stacker_opener";

function SettingRow({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <label className="block border border-[var(--border)] bg-[#090b0e] px-2.5 py-2 text-xs">
      <span className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[var(--muted)]">{label}</span>
        {value && <span className="text-[var(--subtle)]">{value}</span>}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 border border-[var(--border)] bg-[#090b0e] px-2.5 py-2 text-xs">
      <span className="text-[var(--muted)]">{children}</span>
      <SwitchControl label={typeof children === "string" ? children : undefined} checked={checked} onCheckedChange={(nextValue) => onChange(nextValue)} />
    </label>
  );
}

function readNumberSetting(key: string, fallback: number, min?: number, max?: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  let value = parsed;
  if (typeof min === "number") value = Math.max(min, value);
  if (typeof max === "number") value = Math.min(max, value);
  return value;
}

function readStringSetting(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : raw;
}

function readBoolSetting(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

function loadSprintHistory(): SprintHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SPRINT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SprintHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && Number.isFinite(entry.at) && Number.isFinite(entry.ms) && entry.ms > 0)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function loadRunHistory(): StackerRunEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STACKER_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<StackerRunEntry>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && Number.isFinite(entry.at))
      .filter(
        (entry) =>
          entry.mode === "sprint" || entry.mode === "endless",
      )
      .filter(
        (entry) =>
          Number.isFinite(entry.score) &&
          Number.isFinite(entry.lines) &&
          Number.isFinite(entry.ms) &&
          Number.isFinite(entry.pieces),
      )
      .map((entry) => ({
        at: Number(entry.at),
        mode: entry.mode as "sprint" | "endless",
        score: Number(entry.score),
        lines: Number(entry.lines),
        ms: Number(entry.ms),
        pieces: Number(entry.pieces),
        // Backward-compatible migration for older saved runs without inputs.
        inputs: Number.isFinite(entry.inputs) ? Number(entry.inputs) : 0,
        finessePlus: Number.isFinite(entry.finessePlus) ? Number(entry.finessePlus) : 0,
      }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

function parseOpener(input: string): number[] {
  const map: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
  return input
    .toUpperCase()
    .replace(/[^IOTSZJL]/g, "")
    .split("")
    .map((token) => map[token])
    .filter((id) => Number.isFinite(id));
}

function pieceShade(id: number, palette: PiecePalette = "mono"): string {
  return PIECE_PALETTES[palette][id] ?? "#dce5f2";
}

function MiniPiece({ matrix, pieceId, active, palette = "mono" }: { matrix: number[][] | null; pieceId?: number; active?: boolean; palette?: PiecePalette }) {
  const occupied = matrix?.flatMap((row, y) => row.flatMap((cell, x) => cell ? [{ x, y }] : [])) ?? [];
  const minX = occupied.length ? Math.min(...occupied.map((cell) => cell.x)) : 0;
  const minY = occupied.length ? Math.min(...occupied.map((cell) => cell.y)) : 0;
  const rows = occupied.length ? Math.max(...occupied.map((cell) => cell.y)) - minY + 1 : 2;
  const cols = occupied.length ? Math.max(...occupied.map((cell) => cell.x)) - minX + 1 : 4;
  return <div className={`stacker-preview ${active ? "is-next" : ""}`} style={{ gridTemplateColumns: `repeat(${cols}, var(--stacker-mini))` }} aria-label={pieceId ? `${pieceLabel(pieceId)} piece` : "Empty hold"}>
    {Array.from({ length: rows }).flatMap((_, y) => Array.from({ length: cols }).map((__, x) => {
      const on = !!matrix?.[y + minY]?.[x + minX];
      return <span key={`${x}-${y}`} className={on ? "is-filled" : undefined} style={{ background: on ? pieceShade(pieceId ?? 1, palette) : "transparent", ["--piece-tone" as string]: pieceShade(pieceId ?? 1, palette) }} />;
    }))}
  </div>;
}

export function StackerModule() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const engineRef = useRef(new StackerEngine("endless"));
  const lastFrame = useRef(performance.now());
  const lastClearId = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const lastAudioResumeAttemptRef = useRef(0);
  const keyHeld = useRef({ left: false, right: false, down: false });
  const moveRepeat = useRef({ left: 0, right: 0, down: 0 });
  const horizontalPriority = useRef<"left" | "right">("left");
  const [dasMs, setDasMs] = useState<number>(() => readNumberSetting("void_stacker_das", 125, 50, 220));
  const [arrMs, setArrMs] = useState<number>(() => readNumberSetting("void_stacker_arr", 16, 0, 50));
  const [dcdMs, setDcdMs] = useState<number>(() => readNumberSetting("void_stacker_dcd", 0, 0, 80));
  const [sdfMs, setSdfMs] = useState<number>(() => readNumberSetting("void_stacker_sdf", 35, 0, 80));
  const [lockDelayMs, setLockDelayMs] = useState<number>(() => readNumberSetting("void_stacker_lock_delay", 500, 0, 900));
  const [lockResetLimit, setLockResetLimit] = useState<number>(() => readNumberSetting("void_stacker_lock_resets", 15, 0, 20));
  const [clearFxStrength, setClearFxStrength] = useState<number>(() => readNumberSetting("void_stacker_clear_fx", 0.65, 0, 1));
  const [shakeStrength, setShakeStrength] = useState<number>(() => readNumberSetting("void_stacker_shake", 1, 0, 1.5));
  const [showParticles, setShowParticles] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("void_stacker_particles") !== "0";
  });
  const [hearNextPieces, setHearNextPieces] = useState<boolean>(() => readBoolSetting("void_stacker_hear_next", false));
  const [showGhost, setShowGhost] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("void_stacker_show_ghost") !== "0";
  });
  const [ghostOpacity, setGhostOpacity] = useState<number>(() => readNumberSetting("void_stacker_ghost_opacity", 0.22, 0.05, 0.35));
  const [seedInput, setSeedInput] = useState<string>(() => readStringSetting(SEED_KEY, ""));
  const [openerInput, setOpenerInput] = useState<string>(() => readStringSetting(OPENER_KEY, ""));
  const [volume, setVolume] = useState<number>(() => readNumberSetting("void_stacker_volume", 0.7, 0, 1));
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => readBoolSetting("void_stacker_sfx", true));
  const [uiSoundEnabled, setUiSoundEnabled] = useState<boolean>(() => readBoolSetting("void_stacker_ui_sound", true));
  const [soundPack, setSoundPack] = useState<StackerSoundPack>(() => {
    const saved = readStringSetting("void_stacker_sound_pack", "void-soft");
    return saved === "glass" || saved === "mechanical" || saved === "muted" ? saved : "void-soft";
  });
  const [impactIntensity, setImpactIntensity] = useState<number>(() => readNumberSetting("void_stacker_impact", 1, 0.25, 1.75));
  const [pieceSkin, setPieceSkin] = useState<PieceSkin>(() => {
    const saved = readStringSetting("void_stacker_piece_skin", "ice-glass");
    return saved === "classic-mono" || saved === "wireframe" || saved === "solid-block" || saved === "soft-glow" ? saved : "ice-glass";
  });
  const [piecePalette, setPiecePalette] = useState<PiecePalette>(() => {
    const saved = readStringSetting("void_stacker_palette", "ice");
    return saved === "mono" || saved === "contrast" ? saved : "ice";
  });
  const [boardBackground, setBoardBackground] = useState<BoardBackground>(() => {
    const saved = readStringSetting("void_stacker_board_background", "old-black");
    return saved === "charcoal" || saved === "deep-grid" ? saved : "old-black";
  });
  const [gridIntensity, setGridIntensity] = useState<number>(() => readNumberSetting("void_stacker_grid_intensity", 0.35, 0, 1));
  const [particleIntensity, setParticleIntensity] = useState<number>(() => readNumberSetting("void_stacker_particle_intensity", 0.7, 0, 1));
  const [focusMode, setFocusMode] = useState<boolean>(() => readBoolSetting("void_stacker_focus_mode", false));
  const applyPreset = (preset: "balanced" | "competitive" | "instant") => {
    if (preset === "balanced") {
      setDasMs(125);
      setArrMs(16);
      setDcdMs(0);
      setSdfMs(35);
      setLockDelayMs(500);
      setLockResetLimit(15);
      setClearFxStrength(0.65);
      setShakeStrength(1);
      setShowParticles(true);
      setHearNextPieces(false);
      setShowGhost(true);
      setGhostOpacity(0.22);
      return;
    }
    if (preset === "competitive") {
      setDasMs(100);
      setArrMs(8);
      setDcdMs(0);
      setSdfMs(16);
      setLockDelayMs(500);
      setLockResetLimit(15);
      setClearFxStrength(0.75);
      setShakeStrength(1);
      setShowParticles(true);
      setHearNextPieces(false);
      setShowGhost(true);
      setGhostOpacity(0.2);
      return;
    }
    setDasMs(90);
    setArrMs(0);
    setDcdMs(0);
    setSdfMs(0);
    setLockDelayMs(420);
    setLockResetLimit(8);
    setClearFxStrength(0.85);
    setShakeStrength(1.2);
    setShowParticles(true);
    setHearNextPieces(true);
    setShowGhost(true);
    setGhostOpacity(0.18);
  };

  useEffect(() => { localStorage.setItem("void_stacker_das", String(dasMs)); }, [dasMs]);
  useEffect(() => { localStorage.setItem("void_stacker_arr", String(arrMs)); }, [arrMs]);
  useEffect(() => { localStorage.setItem("void_stacker_dcd", String(dcdMs)); }, [dcdMs]);
  useEffect(() => { localStorage.setItem("void_stacker_sdf", String(sdfMs)); }, [sdfMs]);
  useEffect(() => { localStorage.setItem("void_stacker_lock_delay", String(lockDelayMs)); }, [lockDelayMs]);
  useEffect(() => { localStorage.setItem("void_stacker_lock_resets", String(lockResetLimit)); }, [lockResetLimit]);
  useEffect(() => { localStorage.setItem("void_stacker_clear_fx", String(clearFxStrength)); }, [clearFxStrength]);
  useEffect(() => { localStorage.setItem("void_stacker_shake", String(shakeStrength)); }, [shakeStrength]);
  useEffect(() => { localStorage.setItem("void_stacker_particles", showParticles ? "1" : "0"); }, [showParticles]);
  useEffect(() => { localStorage.setItem("void_stacker_hear_next", hearNextPieces ? "1" : "0"); }, [hearNextPieces]);
  useEffect(() => { localStorage.setItem("void_stacker_show_ghost", showGhost ? "1" : "0"); }, [showGhost]);
  useEffect(() => { localStorage.setItem("void_stacker_ghost_opacity", String(ghostOpacity)); }, [ghostOpacity]);
  useEffect(() => { localStorage.setItem(SEED_KEY, seedInput); }, [seedInput]);
  useEffect(() => { localStorage.setItem(OPENER_KEY, openerInput); }, [openerInput]);
  useEffect(() => { localStorage.setItem("void_stacker_volume", String(volume)); }, [volume]);
  useEffect(() => { localStorage.setItem("void_stacker_sfx", sfxEnabled ? "1" : "0"); }, [sfxEnabled]);
  useEffect(() => { localStorage.setItem("void_stacker_ui_sound", uiSoundEnabled ? "1" : "0"); }, [uiSoundEnabled]);
  useEffect(() => { localStorage.setItem("void_stacker_sound_pack", soundPack); }, [soundPack]);
  useEffect(() => { localStorage.setItem("void_stacker_impact", String(impactIntensity)); }, [impactIntensity]);
  useEffect(() => { localStorage.setItem("void_stacker_piece_skin", pieceSkin); }, [pieceSkin]);
  useEffect(() => { localStorage.setItem("void_stacker_palette", piecePalette); }, [piecePalette]);
  useEffect(() => { localStorage.setItem("void_stacker_board_background", boardBackground); }, [boardBackground]);
  useEffect(() => { localStorage.setItem("void_stacker_grid_intensity", String(gridIntensity)); }, [gridIntensity]);
  useEffect(() => { localStorage.setItem("void_stacker_particle_intensity", String(particleIntensity)); }, [particleIntensity]);
  useEffect(() => { localStorage.setItem("void_stacker_focus_mode", focusMode ? "1" : "0"); }, [focusMode]);
  useEffect(() => {
    engineRef.current.setHandling({ lockDelayMs, lockResetLimit });
  }, [lockDelayMs, lockResetLimit]);

  const [state, setState] = useState<Snapshot>(() => engineRef.current.getSnapshot());
  const [mode, setMode] = useState<"sprint" | "endless">("endless");
  const [sprintElapsedMs, setSprintElapsedMs] = useState(0);
  const [runElapsedMs, setRunElapsedMs] = useState(0);
  const [sprintHistory, setSprintHistory] = useState<SprintHistoryEntry[]>(() => loadSprintHistory());
  const [runHistory, setRunHistory] = useState<StackerRunEntry[]>(() => loadRunHistory());
  const [runPieces, setRunPieces] = useState(0);
  const [runInputs, setRunInputs] = useState(0);
  const [runFinessePlus, setRunFinessePlus] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; detail: string; tone: string; untilMs: number } | null>(null);
  const [clearTrail, setClearTrail] = useState<Array<{ id: number; label: string; tone: string; untilMs: number }>>([]);
  const [lockTrail, setLockTrail] = useState<Array<{ id: number; label: string; detail: string; tone: string }>>([]);
  const lastLockId = useRef(0);
  const lastActivePieceId = useRef<number>(engineRef.current.getSnapshot().activePiece.id);
  const shakeUntilRef = useRef(0);
  const sprintRunningRef = useRef(false);
  const sprintStartMsRef = useRef(0);
  const sprintElapsedRef = useRef(0);
  const runRunningRef = useRef(false);
  const runStartMsRef = useRef(0);
  const runElapsedRef = useRef(0);
  const wasPausedRef = useRef(false);
  const pausedAtMsRef = useRef(0);
  const sprintSavedRunRef = useRef(false);
  const runPiecesRef = useRef(0);
  const runInputsRef = useRef(0);
  const pieceInputsRef = useRef(0);
  const runFinessePlusRef = useRef(0);
  const runSavedRef = useRef(false);
  const particlesRef = useRef<ClearParticle[]>([]);
  const particleIdRef = useRef(0);
  const wasGameOverRef = useRef(false);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const countdownActiveRef = useRef(false);
  const [countdownStep, setCountdownStep] = useState<StackerCountdownStep | null>(null);

  const buildRestartOptions = useCallback(() => {
    const parsedSeed = Number(seedInput);
    const useSeed =
      seedInput.trim().length > 0 &&
      Number.isFinite(parsedSeed) &&
      !Number.isNaN(parsedSeed);
    const opener = parseOpener(openerInput);
    return {
      seed: useSeed ? parsedSeed : null,
      openerPieceIds: opener.length > 0 ? opener : undefined,
    };
  }, [openerInput, seedInput]);

  const ensureAudioReady = useCallback((nowMs?: number) => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    if (!audio.current) audio.current = new window.AudioContext();
    void prepareStackerReferenceAudio(audio.current);
    if (audio.current.state === "running") return;
    const now = nowMs ?? performance.now();
    if (now - lastAudioResumeAttemptRef.current < 1500) return;
    lastAudioResumeAttemptRef.current = now;
    void audio.current.resume().catch(() => undefined);
  }, []);
  const soundSettings = useMemo<StackerSoundSettings>(() => ({
    enabled: sfxEnabled,
    uiEnabled: uiSoundEnabled,
    volume,
    impact: impactIntensity,
    pack: soundPack,
  }), [impactIntensity, sfxEnabled, soundPack, uiSoundEnabled, volume]);
  const emitSound = useCallback((event: StackerSoundEvent, detail = 0, packOverride?: StackerSoundPack) => {
    if (!soundSettings.enabled || typeof window === "undefined" || !window.AudioContext) return;
    if (!audio.current) audio.current = new window.AudioContext();
    const context = audio.current;
    const selected = packOverride ? { ...soundSettings, pack: packOverride } : soundSettings;
    void prepareStackerReferenceAudio(context);
    if (context.state === "suspended") {
      void context.resume().then(() => playStackerSound(context, event, selected, detail)).catch(() => undefined);
      return;
    }
    playStackerSound(context, event, selected, detail);
  }, [soundSettings]);

  useEffect(() => {
    if (audio.current) stackerOutput(audio.current, soundSettings);
  }, [soundSettings]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  const toggleSettings = useCallback(() => {
    if (settingsOpen) { closeSettings(); return; }
    const engine = engineRef.current;
    const snapshot = engine.getSnapshot();
    if (!snapshot.isPaused && !snapshot.isGameOver) {
      if (mode === "sprint") return;
      engine.togglePause();
      setState(engine.getSnapshot());
      emitSound("pause");
    }
    emitSound("menu");
    setSettingsOpen(true);
  }, [closeSettings, emitSound, mode, settingsOpen]);

  const cancelCountdown = useCallback(() => {
    for (const timeout of countdownTimeoutsRef.current) window.clearTimeout(timeout);
    countdownTimeoutsRef.current = [];
    countdownActiveRef.current = false;
    setCountdownStep(null);
  }, []);

  const beginCountdown = useCallback(() => {
    const snapshot = engineRef.current.getSnapshot();
    if (countdownActiveRef.current || !snapshot.isPaused || snapshot.isGameOver) return;
    boardRef.current?.focus({ preventScroll: true });
    ensureAudioReady();
    countdownActiveRef.current = true;
    setCountdownStep(STACKER_COUNTDOWN_STEPS[0]);
    emitSound("countdown-tick", STACKER_COUNTDOWN_STEPS[0]);

    STACKER_COUNTDOWN_STEPS.slice(1).forEach((step, index) => {
      const timeout = window.setTimeout(() => {
        setCountdownStep(step);
        emitSound("countdown-tick", step);
      }, STACKER_COUNTDOWN_INTERVAL_MS * (index + 1));
      countdownTimeoutsRef.current.push(timeout);
    });

    const goTimeout = window.setTimeout(() => {
      countdownActiveRef.current = false;
      engineRef.current.start();
      setState(engineRef.current.getSnapshot());
      setCountdownStep("GO");
      emitSound("countdown-go");
    }, STACKER_COUNTDOWN_INTERVAL_MS * STACKER_COUNTDOWN_STEPS.length);
    const finishTimeout = window.setTimeout(() => {
      countdownTimeoutsRef.current = [];
      countdownActiveRef.current = false;
      setCountdownStep(null);
    }, STACKER_COUNTDOWN_INTERVAL_MS * STACKER_COUNTDOWN_STEPS.length + STACKER_COUNTDOWN_GO_MS);
    countdownTimeoutsRef.current.push(goTimeout, finishTimeout);
  }, [emitSound, ensureAudioReady]);

  useEffect(() => () => {
    for (const timeout of countdownTimeoutsRef.current) window.clearTimeout(timeout);
    if (audio.current) void audio.current.close();
    audio.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SPRINT_HISTORY_KEY, JSON.stringify(sprintHistory.slice(0, 10)));
  }, [sprintHistory]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STACKER_RUNS_KEY, JSON.stringify(runHistory.slice(0, 20)));
  }, [runHistory]);
  const runSoftDropBurst = useCallback(() => {
    // Bounded burst prevents runaway loops while still approximating instant SDF.
    for (let i = 0; i < 40; i += 1) {
      const beforeY = engineRef.current.getSnapshot().activePiece.y;
      engineRef.current.softDrop();
      const afterY = engineRef.current.getSnapshot().activePiece.y;
      if (afterY === beforeY) break;
    }
  }, []);
  const applyDasCut = useCallback(() => {
    if (dcdMs <= 0) return;
    if (keyHeld.current.left) {
      moveRepeat.current.left = Math.max(moveRepeat.current.left, dcdMs);
    }
    if (keyHeld.current.right) {
      moveRepeat.current.right = Math.max(moveRepeat.current.right, dcdMs);
    }
  }, [dcdMs]);

  const performPieceAction = useCallback((action: (engine: StackerEngine) => void, sound: StackerSoundEvent) => {
    const engine = engineRef.current;
    const before = engine.getSnapshot();
    if (before.isPaused || before.isGameOver) return false;
    action(engine);
    const after = engine.getSnapshot();
    const changed = before.activePiece.x !== after.activePiece.x || before.activePiece.y !== after.activePiece.y
      || before.canHold !== after.canHold || before.lastLock?.id !== after.lastLock?.id
      || JSON.stringify(before.activePiece.matrix) !== JSON.stringify(after.activePiece.matrix)
      || (sound === "rotate" && before.activePiece.id === 2);
    if (changed) {
      emitSound(sound);
      if (sound !== "move" && sound !== "soft-drop") applyDasCut();
    }
    return changed;
  }, [applyDasCut, emitSound]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(42, now - lastFrame.current);
      lastFrame.current = now;

      const runLeft = keyHeld.current.left && (!keyHeld.current.right || horizontalPriority.current === "left");
      const runRight = keyHeld.current.right && (!keyHeld.current.left || horizontalPriority.current === "right");

      const engine = engineRef.current;
      const playing = !engine.getSnapshot().isPaused && !engine.getSnapshot().isGameOver;
      for (const direction of ["left", "right"] as const) {
        const held = playing && (direction === "left" ? runLeft : runRight);
        if (!held) continue;
        const beforeX = engine.getSnapshot().activePiece.x;
        const repeat = advanceRepeat(moveRepeat.current[direction], dt, arrMs);
        moveRepeat.current[direction] = repeat.remainingMs;
        for (let i = 0; i < repeat.count; i += 1) {
          if (direction === "left") engine.moveLeft();
          else engine.moveRight();
        }
        if (engine.getSnapshot().activePiece.x !== beforeX) emitSound("move");
      }
      if (playing && keyHeld.current.down) {
        const beforeY = engine.getSnapshot().activePiece.y;
        const repeat = advanceRepeat(moveRepeat.current.down, dt, sdfMs);
        moveRepeat.current.down = repeat.remainingMs;
        if (sdfMs <= 0) runSoftDropBurst();
        else for (let i = 0; i < repeat.count; i += 1) engine.softDrop();
        if (engine.getSnapshot().activePiece.y !== beforeY) emitSound("soft-drop");
      }

      engineRef.current.update(dt);
      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current
          .map((particle) => {
            const nextLife = particle.lifeMs - dt;
            const nextVx = particle.vx * 0.995;
            const nextVy = particle.vy + 0.0012 * dt;
            return {
              ...particle,
              x: particle.x + nextVx * dt,
              y: particle.y + nextVy * dt,
              vx: nextVx,
              vy: nextVy,
              lifeMs: nextLife,
            };
          })
          .filter((particle) => particle.lifeMs > 0);
      }
      const snap = engineRef.current.getSnapshot();
      if (snap.isGameOver && !wasGameOverRef.current) emitSound(mode === "sprint" && snap.lines >= 40 ? "sprint-clear" : "game-over");
      wasGameOverRef.current = snap.isGameOver;
      if (snap.isPaused && !wasPausedRef.current) {
        pausedAtMsRef.current = now;
        wasPausedRef.current = true;
      } else if (!snap.isPaused && wasPausedRef.current) {
        const pausedDuration = Math.max(0, now - pausedAtMsRef.current);
        runStartMsRef.current += pausedDuration;
        sprintStartMsRef.current += pausedDuration;
        wasPausedRef.current = false;
      }
      if (!runRunningRef.current && !snap.isPaused && !snap.isGameOver) {
        runRunningRef.current = true;
        runStartMsRef.current = now - runElapsedRef.current;
        runSavedRef.current = false;
      }
      if (runRunningRef.current && (!snap.isPaused || snap.isGameOver)) {
        const elapsed = now - runStartMsRef.current;
        runElapsedRef.current = elapsed;
        setRunElapsedMs(elapsed);
        if (snap.isGameOver || (mode === "sprint" && snap.lines >= 40)) {
          runRunningRef.current = false;
          setRunElapsedMs(elapsed);
        }
      }
      if (mode === "sprint") {
        if (!sprintRunningRef.current && !snap.isPaused && !snap.isGameOver && snap.lines < 40) {
          sprintRunningRef.current = true;
          sprintStartMsRef.current = now - sprintElapsedRef.current;
          sprintSavedRunRef.current = false;
          runSavedRef.current = false;
        }
        if (sprintRunningRef.current && (!snap.isPaused || snap.isGameOver)) {
          const elapsed = now - sprintStartMsRef.current;
          sprintElapsedRef.current = elapsed;
          setSprintElapsedMs(elapsed);
          if (snap.lines >= 40 || snap.isGameOver || snap.isPaused) {
            sprintRunningRef.current = false;
            setSprintElapsedMs(elapsed);
          }
        }
        if (!sprintSavedRunRef.current && snap.lines >= 40) {
          const finalMs = Math.max(1, Math.trunc(sprintElapsedRef.current));
          setSprintHistory((current) => [{ at: Date.now(), ms: finalMs }, ...current].slice(0, 10));
          sprintSavedRunRef.current = true;
        }
      }
      const isRunFinished = snap.isGameOver || (mode === "sprint" && snap.lines >= 40);
      if (!runSavedRef.current && isRunFinished) {
        runSavedRef.current = true;
        setRunHistory((current) => [
          {
            at: Date.now(),
            mode,
            score: snap.score,
            lines: snap.lines,
            ms: Math.max(1, Math.trunc(runElapsedRef.current)),
            pieces: snap.lastLock?.id ?? runPiecesRef.current,
            inputs: runInputsRef.current,
            finessePlus: runFinessePlusRef.current,
          },
          ...current,
        ].slice(0, 20));
      }
      if (snap.activePiece.id !== lastActivePieceId.current) {
        lastActivePieceId.current = snap.activePiece.id;
        if (hearNextPieces) emitSound("menu", snap.activePiece.id);
      }
      if (snap.lastClear && snap.lastClear.id !== lastClearId.current) {
        const clear = snap.lastClear;
        lastClearId.current = clear.id;
        const clearText = clear.tSpinKind === "mini"
          ? `T-SPIN MINI ${clearLabel(clear.lines)}`
          : clear.isTSpin
            ? `T-SPIN ${clearLabel(clear.lines)}`
            : (clear.isPerfectClear ? "ALL CLEAR" : clearLabel(clear.lines));
        const tone = clearTone(clear);
        const detail = clearSubtitle(clear);
        setFeedback({ text: clearText, detail, tone, untilMs: now + 900 });
        setClearTrail((current) => [
          {
            id: clear.id,
            label: detail ? `${clearText} ${detail}` : clearText,
            tone,
            untilMs: now + 3200,
          },
          ...current.filter((entry) => entry.untilMs > now),
        ].slice(0, 8));
        const shakeDuration =
          clear.isPerfectClear ? 360 : clear.lines >= 4 || clear.isTSpin ? 280 : 170;
        shakeUntilRef.current = Math.max(shakeUntilRef.current, now + shakeDuration);
        if (showParticles && !reducedMotion && clear.lines > 0) {
          const spawned: ClearParticle[] = [];
          const burstCount = Math.round(
            Math.min(42, 10 + clear.lines * 7 + (clear.isPerfectClear ? 8 : 0)) * particleIntensity,
          );
          for (let i = 0; i < burstCount; i += 1) {
            const rows = clear.clearedRows ?? [H - 1];
            const row = rows[i % rows.length] ?? H - 1;
            const lifeMs = 300 + Math.random() * 180;
            spawned.push({
              id: ++particleIdRef.current,
              x: Math.random() * (BOARD_PIXEL_W - 12) + 6,
              y: (row + .5) * (CELL + GAP),
              vx: (Math.random() - 0.5) * 0.1,
              vy: -(0.06 + Math.random() * 0.12),
              lifeMs,
              maxLifeMs: lifeMs,
              size: 1.2 + Math.random() * 2.1,
              tone,
            });
          }
          particlesRef.current = [...particlesRef.current, ...spawned].slice(-130);
        }
        const clearSound: StackerSoundEvent = clear.isPerfectClear ? "all-clear" : clear.isTSpin ? "t-spin" : clear.lines === 4 ? clear.wasBackToBack ? "back-to-back" : "quad" : "line-clear";
        emitSound(clearSound, clear.lines);
        if (clear.lines > 0 && clear.combo > 1) emitSound("combo", clear.combo - 1);
      }
      setFeedback((current) => (current && current.untilMs <= now ? null : current));
      setClearTrail((current) => current.filter((entry) => entry.untilMs > now));
      if (snap.lastLock) {
        const lock = snap.lastLock;
        if (lock.id !== lastLockId.current) {
          lastLockId.current = lock.id;
          runPiecesRef.current = lock.id;
          runFinessePlusRef.current += Math.max(0, pieceInputsRef.current - 3);
          pieceInputsRef.current = 0;
          setRunPieces(runPiecesRef.current);
          setRunFinessePlus(runFinessePlusRef.current);
          if (lock.lines === 0 && lock.lockCause !== "hard-drop") emitSound("lock");
          if (lock.lockCause !== "hard-drop") applyDasCut();
        }
        setLockTrail((current) => {
          if (current.length > 0 && current[0].id === lock.id) return current;
          const title = lock.lines > 0 ? clearLabel(lock.lines) : "LOCK";
          const detail = [
            pieceLabel(lock.pieceId),
            lock.tSpinKind === "full" ? "TS" : lock.tSpinKind === "mini" ? "TSM" : "",
            lock.isPerfectClear ? "PC" : "",
            lock.combo > 1 ? `C${lock.combo}` : "",
            lock.b2bStreak >= 2 ? `B${lock.b2bStreak - 1}` : "",
            lock.lockCause.toUpperCase(),
          ].filter(Boolean).join(" ");
          const tone =
            lock.lines > 0
              ? clearTone({
                  id: lock.id,
                  pieceId: lock.pieceId,
                  lines: lock.lines,
                  isTSpin: lock.isTSpin,
                  tSpinKind: lock.tSpinKind,
                  isPerfectClear: lock.isPerfectClear,
                  combo: lock.combo,
                  b2bStreak: lock.b2bStreak,
                  wasBackToBack: lock.b2bStreak >= 2,
                })
              : "#8f8c84";
          return [{ id: lock.id, label: title, detail, tone }, ...current].slice(0, 6);
        });
      }
      setState(snap);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyDasCut, arrMs, emitSound, hearNextPieces, mode, particleIntensity, reducedMotion, runSoftDropBurst, sdfMs, showParticles]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeSettings();
        }
        return;
      }
      const isPlayKey = PLAY_KEYS.has(e.key) || e.code === "Space" || e.key === "Control" || e.key === "Shift";
      if (isTextEntryTarget(e.target)) return;
      if (countdownActiveRef.current) {
        if (isPlayKey) e.preventDefault();
        return;
      }
      if (e.repeat) {
        if (isPlayKey) e.preventDefault();
        return;
      }
      ensureAudioReady();
      const eg = engineRef.current;
      if (e.code === "Space" && eg.getSnapshot().isPaused && !eg.getSnapshot().isGameOver) {
        e.preventDefault();
        beginCountdown();
        return;
      }
      let countedInput = false;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keyHeld.current.left = true;
        horizontalPriority.current = "left";
        moveRepeat.current.left = dasMs;
        countedInput = performPieceAction((engine) => engine.moveLeft(), "move");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keyHeld.current.right = true;
        horizontalPriority.current = "right";
        moveRepeat.current.right = dasMs;
        countedInput = performPieceAction((engine) => engine.moveRight(), "move");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keyHeld.current.down = true;
        countedInput = performPieceAction((engine) => { if (sdfMs <= 0) runSoftDropBurst(); else engine.softDrop(); }, "soft-drop");
        moveRepeat.current.down = Math.max(0, sdfMs);
      }
      if (e.key === "ArrowUp") { e.preventDefault(); countedInput = performPieceAction((engine) => engine.rotateClockwise(), "rotate"); }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); countedInput = performPieceAction((engine) => engine.rotateCounterClockwise(), "rotate"); }
      if (e.key === "Control" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { e.preventDefault(); countedInput = performPieceAction((engine) => engine.rotateCounterClockwise(), "rotate"); }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); countedInput = performPieceAction((engine) => engine.rotate180(), "rotate"); }
      if (e.code === "Space") { e.preventDefault(); countedInput = performPieceAction((engine) => engine.hardDrop(), "hard-drop"); }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); countedInput = performPieceAction((engine) => engine.hold(), "hold"); }
      if (e.key === "Shift" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { e.preventDefault(); countedInput = performPieceAction((engine) => engine.hold(), "hold"); }
      if ((e.key === "p" || e.key === "P") && mode !== "sprint") { e.preventDefault(); eg.togglePause(); emitSound(eg.getSnapshot().isPaused ? "pause" : "resume"); }
      if (e.key === "r" || e.key === "R" || e.key === "F4") {
        e.preventDefault();
        cancelCountdown();
        engineRef.current.restart(buildRestartOptions());
        lastClearId.current = 0;
        lastLockId.current = 0;
        sprintRunningRef.current = false;
        sprintElapsedRef.current = 0;
        runRunningRef.current = false;
        runElapsedRef.current = 0;
        sprintSavedRunRef.current = false;
        runSavedRef.current = false;
        runPiecesRef.current = 0;
        runInputsRef.current = 0;
        pieceInputsRef.current = 0;
        runFinessePlusRef.current = 0;
        wasPausedRef.current = false;
        pausedAtMsRef.current = 0;
        setRunPieces(0);
        setRunInputs(0);
        setRunFinessePlus(0);
        setSprintElapsedMs(0);
        setRunElapsedMs(0);
        setClearTrail([]);
        setLockTrail([]);
        setFeedback(null);
        particlesRef.current = [];
      }
      const snapshot = eg.getSnapshot();
      if (countedInput) {
        runInputsRef.current += 1;
        pieceInputsRef.current += 1;
        setRunInputs(runInputsRef.current);
      }
      setState(snapshot);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); keyHeld.current.left = false; }
      if (e.key === "ArrowRight") { e.preventDefault(); keyHeld.current.right = false; }
      if (e.key === "ArrowDown") { e.preventDefault(); keyHeld.current.down = false; }
    };
    const releaseHeldKeys = () => {
      keyHeld.current = { left: false, right: false, down: false };
      moveRepeat.current = { left: 0, right: 0, down: 0 };
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseHeldKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseHeldKeys);
      releaseHeldKeys();
    };
  }, [applyDasCut, beginCountdown, buildRestartOptions, cancelCountdown, closeSettings, dasMs, emitSound, ensureAudioReady, mode, performPieceAction, runSoftDropBurst, sdfMs, settingsOpen]);

  const grid = useMemo(() => (showGhost ? overlay(state) : (() => {
    const out = state.board.map((r) => [...r]);
    for (let y = 0; y < state.activePiece.matrix.length; y += 1) for (let x = 0; x < state.activePiece.matrix[y].length; x += 1) {
      if (!state.activePiece.matrix[y][x]) continue;
      const gx = state.activePiece.x + x;
      const yy = state.activePiece.y + y;
      if (yy >= 0 && yy < 20 && gx >= 0 && gx < 10) out[yy][gx] = state.activePiece.id;
    }
    return out;
  })()), [showGhost, state]);

  const restart = () => {
    boardRef.current?.focus({ preventScroll: true });
    cancelCountdown();
    emitSound("apply");
    engineRef.current.restart(buildRestartOptions());
    sprintRunningRef.current = false;
    sprintElapsedRef.current = 0;
    runRunningRef.current = false;
    runElapsedRef.current = 0;
    sprintSavedRunRef.current = false;
    runSavedRef.current = false;
    runPiecesRef.current = 0;
    runInputsRef.current = 0;
    pieceInputsRef.current = 0;
    runFinessePlusRef.current = 0;
    wasPausedRef.current = false;
    pausedAtMsRef.current = 0;
    setRunPieces(0);
    setRunInputs(0);
    setRunFinessePlus(0);
    setSprintElapsedMs(0);
    setRunElapsedMs(0);
    lastActivePieceId.current = engineRef.current.getSnapshot().activePiece.id;
    if (mode === "sprint") {
      // sprint goal remains UI-level: finish at 40 lines.
    }
    lastClearId.current = 0;
    lastLockId.current = 0;
    setClearTrail([]);
    setLockTrail([]);
    setFeedback(null);
    particlesRef.current = [];
    setState(engineRef.current.getSnapshot());
  };

  const togglePause = () => {
    if (mode === "sprint" || countdownActiveRef.current) return;
    engineRef.current.togglePause();
    const snapshot = engineRef.current.getSnapshot();
    emitSound(snapshot.isPaused ? "pause" : "resume");
    setState(snapshot);
  };

  const toggleMode = () => {
    cancelCountdown();
    emitSound("menu");
    const next = mode === "endless" ? "sprint" : "endless";
    setMode(next);
    engineRef.current.setMode(next);
    engineRef.current.restart(buildRestartOptions());
    sprintRunningRef.current = false;
    sprintElapsedRef.current = 0;
    runRunningRef.current = false;
    runElapsedRef.current = 0;
    sprintSavedRunRef.current = false;
    runSavedRef.current = false;
    runPiecesRef.current = 0;
    runInputsRef.current = 0;
    pieceInputsRef.current = 0;
    runFinessePlusRef.current = 0;
    wasPausedRef.current = false;
    pausedAtMsRef.current = 0;
    setRunPieces(0);
    setRunInputs(0);
    setRunFinessePlus(0);
    setSprintElapsedMs(0);
    setRunElapsedMs(0);
    lastActivePieceId.current = engineRef.current.getSnapshot().activePiece.id;
    lastClearId.current = 0;
    lastLockId.current = 0;
    setClearTrail([]);
    setLockTrail([]);
    particlesRef.current = [];
    setState(engineRef.current.getSnapshot());
  };

  const doneSprint = mode === "sprint" && state.lines >= 40;
  const sprintLinesLeft = mode === "sprint" ? Math.max(0, 40 - state.lines) : null;
  const sprintBestMs =
    sprintHistory.length > 0 ? Math.min(...sprintHistory.map((entry) => entry.ms)) : null;
  const bestScore = runHistory.length > 0 ? Math.max(...runHistory.map((entry) => entry.score)) : null;
  const runSeconds = Math.max(0.001, runElapsedMs / 1000);
  const pps = runPieces / runSeconds;
  const lpm = state.lines / (runSeconds / 60);
  const kpp = runPieces > 0 ? runInputs / runPieces : 0;
  const kps = runInputs / runSeconds;
  const filledCells = state.board.reduce(
    (count, row) => count + row.reduce((c, cell) => c + (cell !== 0 ? 1 : 0), 0),
    0,
  );
  const stackPercent = Math.round((filledCells / (W * H)) * 100);
  const sprintWastePieces = mode === "sprint" ? Math.max(0, runPieces - 100) : 0;
  const fxNow = performance.now();
  const shakeRemaining = Math.max(0, shakeUntilRef.current - fxNow);
  const shakeBase = !reducedMotion && shakeRemaining > 0 ? Math.min(2, (shakeRemaining / 360) * 2) * clearFxStrength * Math.max(0, shakeStrength) : 0;
  const shakeX = shakeBase > 0 ? Math.sin(fxNow * 0.13) * shakeBase : 0;
  const shakeY = shakeBase > 0 ? Math.cos(fxNow * 0.17) * shakeBase * 0.65 : 0;

  return <section
    className="stacker-shell panel relative flex h-full min-h-0 flex-col overflow-hidden"
    style={{ ["--stacker-fx" as string]: clearFxStrength, ["--stacker-cell" as string]: "clamp(12px, min(calc((100cqh - 220px) / 20), calc((100cqw - 240px) / 10)), 32px)" }}
  >
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
      <div className="min-w-[160px]">
        <h1 className="text-base font-semibold tracking-[-0.02em]">Stacker</h1>
        {!focusMode && <p className="text-[11px] text-[var(--muted)]">Find your rhythm. Make every piece count.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
        <Button
          className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={beginCountdown}
          disabled={countdownStep !== null || !state.isPaused || state.isGameOver}
        >
          {countdownStep ?? "Start"}
        </Button>
        <Button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={restart}>Restart</Button>
        <Button
          className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)] disabled:opacity-40"
          onClick={togglePause}
          disabled={mode === "sprint" || countdownStep !== null}
          title={mode === "sprint" ? "Sprint runs do not pause." : "Pause or resume"}
        >
          {state.isPaused ? "Resume" : "Pause"}
        </Button>
        <Button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={toggleMode}>{mode === "sprint" ? "40 line sprint" : "Endless"}</Button>
        <Button className="stacker-sound-toggle" aria-label={sfxEnabled ? "Mute sound effects" : "Enable sound effects"} title={sfxEnabled ? "Mute sound effects" : "Enable sound effects"} onClick={() => setSfxEnabled((value) => !value)}>
          {sfxEnabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
        </Button>
        <Button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={toggleSettings}
          disabled={countdownStep !== null || (mode === "sprint" && !state.isPaused && !state.isGameOver)}
          title={mode === "sprint" && !state.isPaused ? "Finish or restart the sprint before changing settings." : "Stacker settings"}>
          Settings
        </Button>
      </div>
    </div>

    <div className={`stacker-stage ${focusMode ? "is-focused" : ""}`}>
      <aside className="stacker-left" aria-label="Hold and run statistics">
        <div className={`stacker-hold ${state.canHold ? "" : "is-locked"}`}>
          <div className="stacker-rail-label">Hold <kbd>C</kbd></div>
          <MiniPiece matrix={state.holdPiece?.matrix ?? null} pieceId={state.holdPiece?.id} palette={piecePalette} />
          <span className="stacker-hold-status">{state.holdPiece ? state.canHold ? "Available" : "Next piece" : "Save a piece"}</span>
        </div>
        <dl className="stacker-stats">
          <div><dt>Score</dt><dd>{state.score.toLocaleString()}</dd></div>
          <div><dt>{mode === "sprint" ? "Lines left" : "Lines"}</dt><dd>{mode === "sprint" ? sprintLinesLeft : state.lines}<small>{mode === "sprint" ? "/ 40" : `Level ${state.level}`}</small></dd></div>
          {!focusMode && <div><dt>Pieces / sec</dt><dd>{pps.toFixed(2)}</dd></div>}
        </dl>
        <div className="stacker-chains" aria-label="Clear chains">
          <span style={{ color: comboTierTone(state.combo) }}>Combo <b>{state.combo > 1 ? `×${state.combo - 1}` : "—"}</b></span>
          <span style={{ color: b2bTierTone(state.b2bStreak) }}>Back to back <b>{state.b2bStreak >= 2 ? `×${state.b2bStreak - 1}` : "—"}</b></span>
        </div>
        <div className="stacker-feedback" role="status" aria-live="polite">{feedback && <div key={state.lastClear?.id} className="stacker-callout"><strong>{feedback.text}</strong>{feedback.detail && <span>{feedback.detail}</span>}</div>}</div>
      </aside>
      <div className="stacker-center">
        <div className="stacker-clock"><span>{mode === "sprint" ? "40 line sprint" : "Endless"}</span><strong>{formatMs(mode === "sprint" ? sprintElapsedMs : runElapsedMs)}</strong></div>
        <div className={`stacker-board-frame ${countdownStep !== null ? "stacker-countdown-board" : ""}`} style={{ background: BOARD_BACKGROUNDS[boardBackground] }}>
          <div ref={boardRef} tabIndex={0} className="stacker-board" role="img" aria-label="Stacker playfield" style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
            {grid.flatMap((row, y) => row.map((cell, x) => {
              const tone = pieceShade(cell === 8 ? state.activePiece.id : cell, piecePalette);
              const empty = cell === 0;
              const ghost = cell === 8;
              const active = !empty && !ghost && state.activePiece.matrix[y - state.activePiece.y]?.[x - state.activePiece.x] === 1;
              const background = empty ? "transparent" : ghost ? `color-mix(in srgb, ${tone} ${ghostOpacity * 30}%, transparent)`
                : pieceSkin === "ice-glass" ? `linear-gradient(145deg, ${tone}, color-mix(in srgb, ${tone} 84%, #141b27))`
                : pieceSkin === "wireframe" ? "transparent" : tone;
              return <div key={`${x}-${y}`} data-cell={empty ? "empty" : ghost ? "ghost" : active ? "active" : "settled"} className="stacker-cell"
                style={{ background, ["--piece-tone" as string]: tone, borderColor: empty ? `rgba(218,230,249,${gridIntensity * 0.09})` : ghost ? `color-mix(in srgb, ${tone} ${Math.min(75, ghostOpacity * 220)}%, transparent)` : pieceSkin === "wireframe" ? tone : "rgba(0,0,0,0.24)", boxShadow: !empty && !ghost && pieceSkin === "soft-glow" ? `0 0 6px ${tone}` : !empty && !ghost && pieceSkin === "ice-glass" ? "inset 0 1px rgba(248,252,255,0.65), inset 1px 0 rgba(230,243,255,0.28), inset 0 -1px rgba(9,17,30,0.18)" : "none" }} />;
            }))}
            {!reducedMotion && state.lastLock?.cells?.filter((cell) => cell.y >= 0).map((cell, index) => <div key={`lock-${state.lastLock?.id}-${index}`} className="stacker-lock-flash" style={{ left: `${cell.x * 10}%`, top: `${cell.y * 5}%` }} />)}
            {!reducedMotion && state.lastLock?.lockCause === "hard-drop" && (state.lastLock.dropDistance ?? 0) > 0 && state.lastLock.cells?.filter((cell, index, cells) => cells.findIndex((other) => other.x === cell.x) === index).map((cell) => {
              const distance = state.lastLock?.dropDistance ?? 0;
              const start = Math.max(0, cell.y - distance);
              return <div key={`drop-${state.lastLock?.id}-${cell.x}`} className="stacker-drop-trail" style={{ left: `${cell.x * 10}%`, top: `${start * 5}%`, height: `${Math.max(0, cell.y - start) * 5}%`, ["--piece-tone" as string]: pieceShade(state.lastLock?.pieceId ?? 1, piecePalette) }} />;
            })}
            {!reducedMotion && feedback && (state.lastClear?.clearedRows ?? []).map((y) => <div key={`${state.lastClear?.id}-${y}`} className="stacker-clear-flash" style={{ top: `${y * 5}%` }} />)}
            {!reducedMotion && particlesRef.current.map((particle) => <div key={particle.id} className="stacker-particle" style={{ left: `${particle.x / BOARD_PIXEL_W * 100}%`, top: `${particle.y / BOARD_PIXEL_H * 100}%`, width: particle.size, height: particle.size, background: particle.tone, opacity: Math.max(0, particle.lifeMs / particle.maxLifeMs) * 0.9 }} />)}
          </div>
          {(state.isPaused || state.isGameOver) && countdownStep === null && <div className="stacker-state-overlay"><span>{doneSprint ? "40 / 40" : state.isGameOver ? "Run complete" : runPieces > 0 || runElapsedMs > 0 ? "Take a breath" : "Your next run"}</span><strong>{doneSprint ? "Sprint clear" : state.isGameOver ? "Game over" : runPieces > 0 || runElapsedMs > 0 ? "Paused" : "Ready"}</strong><span>{state.isGameOver ? "Press R to restart" : "Press Space or Start"}</span></div>}
          {countdownStep !== null && <div key={countdownStep} className={`stacker-countdown-overlay absolute inset-0 z-[3] grid place-items-center ${countdownStep === "GO" ? "is-go" : ""}`}><div className="text-center"><div className="stacker-countdown-number font-black leading-none">{countdownStep}</div><div className="mt-2 text-xs text-[var(--muted)]">{countdownStep === "GO" ? "Stack" : "Get ready"}</div></div></div>}
        </div>
        <div className="stacker-board-footer"><span>{state.isGameOver ? "Finished" : state.isPaused ? "Stand by" : "In flow"}</span><span>{runPieces} pieces</span></div>
        {mode === "sprint" && <div className="stacker-sprint-progress" role="progressbar" aria-label="Sprint lines" aria-valuemin={0} aria-valuemax={40} aria-valuenow={Math.min(40, state.lines)}><span style={{ transform: `scaleX(${Math.min(1, state.lines / 40)})` }} /></div>}
      </div>
      <aside className="stacker-right" aria-label="Next pieces"><div className="stacker-rail-label">Next <span>5</span></div><div className="stacker-queue">{state.nextQueue.map((piece, index) => <div key={`q-${index}`} className={`stacker-queue-piece ${index === 0 ? "is-first" : ""}`}><MiniPiece matrix={piece.matrix} pieceId={piece.id} active={index === 0} palette={piecePalette} /></div>)}</div>{!focusMode && <div className="stacker-best"><span>{mode === "sprint" ? "Best time" : "Best score"}</span><strong>{mode === "sprint" ? sprintBestMs ? formatMs(sprintBestMs) : "—" : bestScore?.toLocaleString() ?? "—"}</strong></div>}</aside>
    </div>
    {!focusMode && <footer className="stacker-key-guide"><span><kbd>←</kbd><kbd>→</kbd> Move</span><span><kbd>↑</kbd><kbd>Z</kbd> Rotate <kbd>A</kbd> 180°</span><span><kbd>↓</kbd> Soft drop</span><span><kbd>Space</kbd> Hard drop</span><span><kbd>R</kbd> Restart</span></footer>}

    {settingsOpen && <div className="absolute inset-0 z-10 bg-black/45" onClick={closeSettings}>
      <aside className="stacker-settings absolute right-0 top-0 h-full w-[360px] max-w-[92vw] overflow-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 text-sm" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Stacker settings</h2>
            <p className="text-xs text-[var(--muted)]">Tuning, replay setup, effects, and run details.</p>
          </div>
          <Button className="border border-[var(--border)] px-2 py-1 text-xs" onClick={closeSettings}>Close</Button>
        </div>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Input tuning</DisclosureTitle><DisclosureBody>
          <div className="mt-3 space-y-2">
            <div className="flex gap-1 text-[10px]">
              <Button className="border px-1.5 py-0.5" onClick={() => applyPreset("balanced")}>Balanced</Button>
              <Button className="border px-1.5 py-0.5" onClick={() => applyPreset("competitive")}>Competitive</Button>
              <Button className="border px-1.5 py-0.5" onClick={() => applyPreset("instant")}>Instant</Button>
            </div>
            <SettingRow label="DAS" value={`${dasMs}ms`}><Slider label="DAS" className="w-full" min={50} max={220} step={5} value={dasMs} onValueChange={(nextValue) => setDasMs(Number(nextValue))} /></SettingRow>
            <SettingRow label="ARR" value={`${arrMs}ms`}><Slider label="ARR" className="w-full" min={0} max={50} step={1} value={arrMs} onValueChange={(nextValue) => setArrMs(Number(nextValue))} /></SettingRow>
            <SettingRow label="DCD" value={`${dcdMs}ms`}><Slider label="DCD" className="w-full" min={0} max={80} step={1} value={dcdMs} onValueChange={(nextValue) => setDcdMs(Number(nextValue))} /></SettingRow>
            <SettingRow label="Soft drop interval" value={`${sdfMs}ms`}><Slider label="Soft drop interval" className="w-full" min={0} max={80} step={1} value={sdfMs} onValueChange={(nextValue) => setSdfMs(Number(nextValue))} /></SettingRow>
            <SettingRow label="Lock delay" value={`${lockDelayMs}ms`}><Slider label="Lock delay" className="w-full" min={0} max={900} step={10} value={lockDelayMs} onValueChange={(nextValue) => setLockDelayMs(Number(nextValue))} /></SettingRow>
            <SettingRow label="Lock resets" value={String(lockResetLimit)}><Slider label="Lock resets" className="w-full" min={0} max={20} step={1} value={lockResetLimit} onValueChange={(nextValue) => setLockResetLimit(Number(nextValue))} /></SettingRow>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Seed and opener</DisclosureTitle><DisclosureBody>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-1 text-[10px]">
            <Input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="Seed" className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text)]" />
            <Input value={openerInput} onChange={(e) => setOpenerInput(e.target.value.toUpperCase())} placeholder="Opener" className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text)]" />
            <Button className="border px-1.5 py-0.5" onClick={restart}>Apply</Button>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3" defaultOpen>
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Appearance</DisclosureTitle><DisclosureBody>
          <div className="mt-3 space-y-2">
            <SettingRow label="Piece skin">
              <Select label="Piece skin" className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={pieceSkin} onValueChange={(nextValue) => setPieceSkin(nextValue as PieceSkin)}>
                <option value="classic-mono">Classic mono</option>
                <option value="ice-glass">Ice glass</option>
                <option value="wireframe">Wireframe</option>
                <option value="solid-block">Solid block</option>
                <option value="soft-glow">Soft glow</option>
              </Select>
            </SettingRow>
            <SettingRow label="Piece palette">
              <Select label="Piece palette" className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={piecePalette} onValueChange={(nextValue) => setPiecePalette(nextValue as PiecePalette)}>
                <option value="mono">Mono</option>
                <option value="ice">Ice</option>
                <option value="contrast">Contrast</option>
              </Select>
            </SettingRow>
            <SettingRow label="Board background">
              <Select label="Board background" className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={boardBackground} onValueChange={(nextValue) => setBoardBackground(nextValue as BoardBackground)}>
                <option value="old-black">Old black</option>
                <option value="charcoal">Charcoal</option>
                <option value="deep-grid">Deep grid</option>
              </Select>
            </SettingRow>
            <SettingRow label="Grid intensity" value={`${Math.round(gridIntensity * 100)}%`}><Slider label="Grid intensity" className="w-full" min={0} max={1} step={0.01} value={gridIntensity} onValueChange={(nextValue) => setGridIntensity(Number(nextValue))} /></SettingRow>
            <ToggleRow checked={showGhost} onChange={setShowGhost}>Ghost piece</ToggleRow>
            <SettingRow label="Ghost opacity" value={`${Math.round(ghostOpacity * 100)}%`}><Slider label="Ghost opacity" className="w-full" min={0.05} max={0.35} step={0.01} value={ghostOpacity} onValueChange={(nextValue) => setGhostOpacity(Number(nextValue))} /></SettingRow>
            <ToggleRow checked={focusMode} onChange={setFocusMode}>Compact focus mode</ToggleRow>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Audio</DisclosureTitle><DisclosureBody>
          <div className="mt-3 space-y-2">
            <ToggleRow checked={sfxEnabled} onChange={setSfxEnabled}>Sound effects</ToggleRow>
            <ToggleRow checked={uiSoundEnabled} onChange={setUiSoundEnabled}>UI sounds</ToggleRow>
            <SettingRow label="Sound pack">
              <Select label="Sound pack" className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={soundPack} onValueChange={(nextValue) => {
                setSoundPack(nextValue as StackerSoundPack);
                emitSound("apply", 0, nextValue as StackerSoundPack);
              }}>
                <option value="void-soft">VOID glacial</option>
                <option value="glass">Glass</option>
                <option value="mechanical">Mechanical</option>
                <option value="muted">Muted</option>
              </Select>
            </SettingRow>
            <SettingRow label="Master volume" value={`${Math.round(volume * 100)}%`}><Slider label="Master volume" className="w-full" min={0} max={1} step={0.01} value={volume} onValueChange={(nextValue) => setVolume(Number(nextValue))} /></SettingRow>
            <SettingRow label="Impact" value={`${Math.round(impactIntensity * 100)}%`}><Slider label="Impact" className="w-full" min={0.25} max={1.75} step={0.05} value={impactIntensity} onValueChange={(nextValue) => setImpactIntensity(Number(nextValue))} /></SettingRow>
            <ToggleRow checked={hearNextPieces} onChange={setHearNextPieces}>Next-piece tone</ToggleRow>
            <div className="stacker-audio-preview" aria-label="Preview sound pack">
              <Button onClick={() => emitSound("rotate")}>Rotation</Button>
              <Button onClick={() => emitSound("hard-drop")}>Drop</Button>
              <Button onClick={() => emitSound("quad", 4)}>Quad</Button>
              <Button onClick={() => emitSound("all-clear", 4)}>All clear</Button>
            </div>
            <p className="text-xs text-[var(--muted)]">Short feedback for each action. Clear accents build with the chain.</p>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Motion</DisclosureTitle><DisclosureBody>
          <div className="mt-3 space-y-2">
            <SettingRow label="Clear motion" value={`${Math.round(clearFxStrength * 100)}%`}><Slider label="Clear motion" className="w-full" min={0} max={1} step={0.01} value={clearFxStrength} onValueChange={(nextValue) => setClearFxStrength(Number(nextValue))} /></SettingRow>
            <SettingRow label="Board shake" value={`${Math.round(shakeStrength * 100)}%`}><Slider label="Board shake" className="w-full" min={0} max={1.5} step={0.01} value={shakeStrength} onValueChange={(nextValue) => setShakeStrength(Number(nextValue))} /></SettingRow>
            <ToggleRow checked={showParticles} onChange={setShowParticles}>Clear particles</ToggleRow>
            <SettingRow label="Particle intensity" value={`${Math.round(particleIntensity * 100)}%`}><Slider label="Particle intensity" className="w-full" min={0} max={1} step={0.01} value={particleIntensity} onValueChange={(nextValue) => setParticleIntensity(Number(nextValue))} /></SettingRow>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Run details</DisclosureTitle><DisclosureBody>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>Pieces {runPieces}</div>
            <div>Inputs {runInputs}</div>
            <div>F+ {runFinessePlus}</div>
            <div>PPS {Number.isFinite(pps) ? pps.toFixed(2) : "0.00"}</div>
            <div>KPS {Number.isFinite(kps) ? kps.toFixed(2) : "0.00"}</div>
            <div>LPM {Number.isFinite(lpm) ? lpm.toFixed(1) : "0.0"}</div>
            <div>KPP {Number.isFinite(kpp) ? kpp.toFixed(2) : "0.00"}</div>
            <div>Stack {stackPercent}%</div>
            {mode === "sprint" && <div>Waste {sprintWastePieces}p</div>}
            {mode === "sprint" && <div>PB {sprintBestMs !== null ? formatMs(sprintBestMs) : "--:--.--"}</div>}
            <div>Best score {bestScore ?? 0}</div>
          </div>
        </DisclosureBody></Disclosure>

        <Disclosure className="mb-3 border border-[var(--border)] p-3">
          <DisclosureTitle className="cursor-pointer text-[var(--muted)]">Recent locks and archive</DisclosureTitle><DisclosureBody>
          <div className="mt-3 space-y-3 text-[10px]">
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">Recent locks</div>
              {lockTrail.length === 0 ? <div className="text-[var(--subtle)]">-</div> : lockTrail.map((entry) => (
                <div key={entry.id} className="mb-1 border border-[var(--border)] px-1 py-0.5" style={{ color: entry.tone }}>
                  <div>{entry.label}</div>
                  <div className="text-[var(--subtle)]">{entry.detail}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">Clear chain</div>
              {clearTrail.length === 0 ? <div className="text-[var(--subtle)]">-</div> : clearTrail.map((entry) => (
                <div key={entry.id} className="mb-1 border border-[var(--border)] px-1 py-0.5" style={{ color: entry.tone }}>{entry.label}</div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">Run archive</div>
              {runHistory.length === 0 ? <div className="text-[var(--subtle)]">-</div> : runHistory.slice(0, 5).map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="mb-1 border border-[var(--border)] px-1 py-0.5">
                  <div>{entry.mode.toUpperCase()} S{entry.score} L{entry.lines}</div>
                  <div className="text-[var(--subtle)]">{formatMs(entry.ms)} | {entry.pieces}p | {entry.inputs > 0 && entry.pieces > 0 ? (entry.inputs / entry.pieces).toFixed(2) : "0.00"}kpp | F+ {entry.finessePlus}</div>
                </div>
              ))}
            </div>
          </div>
        </DisclosureBody></Disclosure>
      </aside>
    </div>}
  </section>;
}

