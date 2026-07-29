import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StackerEngine, type LastClearEvent, type Snapshot } from "./engine";
import {
  playStackerSound,
  type StackerSoundEvent,
  type StackerSoundPack,
  type StackerSoundSettings,
} from "./audio";

const CELL = 22;
const W = 10;
const MINI = 10;
const GAP = 1;
const H = 20;
const BOARD_PIXEL_W = W * CELL + (W - 1) * GAP;
const BOARD_PIXEL_H = H * CELL + (H - 1) * GAP;
const PLAY_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "z", "Z", "a", "A", "c", "C", "p", "P", "r", "R", "F4"]);
const PIECE_SHADES: Record<number, string> = {
  1: "#e6e1d7",
  2: "#d9d4ca",
  3: "#ccc8bf",
  4: "#c0bcb4",
  5: "#b5b1aa",
  6: "#aaa79f",
  7: "#9f9c95",
};
type PieceSkin = "classic-mono" | "ice-glass" | "wireframe" | "solid-block" | "soft-glow";
type PiecePalette = "mono" | "ice" | "contrast";
type BoardBackground = "old-black" | "charcoal" | "deep-grid";

const PIECE_PALETTES: Record<PiecePalette, Record<number, string>> = {
  mono: PIECE_SHADES,
  ice: {
    1: "#f6f4ed",
    2: "#e7e5df",
    3: "#d8d9d6",
    4: "#cacdc9",
    5: "#bdc2bd",
    6: "#b1b7b2",
    7: "#a5aca7",
  },
  contrast: {
    1: "#f7f4eb",
    2: "#d8d2c5",
    3: "#eee9de",
    4: "#bfc3be",
    5: "#d4ccc0",
    6: "#aeb6b4",
    7: "#c7c2b8",
  },
};

const BOARD_BACKGROUNDS: Record<BoardBackground, string> = {
  "old-black": "#080807",
  charcoal: "#10100e",
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
  if (clear.tSpinKind === "mini") return "#d9d4ca";
  if (clear.isTSpin) return "#ebe7de";
  if (clear.lines === 4) return "#f2efe5";
  return "#c9c5bc";
}

function comboTierTone(combo: number): string {
  if (combo >= 8) return "#f2efe5";
  if (combo >= 5) return "#d9d4ca";
  if (combo >= 3) return "#c9c5bc";
  if (combo >= 2) return "#b9b5ab";
  return "#9f9c95";
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
  if (clear.combo > 1) detail.push(`C${clear.combo}`);
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
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
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
    <label className="block border border-[var(--border)] bg-[#0d0d0b] px-2.5 py-2 text-xs">
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
    <label className="flex items-center justify-between gap-3 border border-[var(--border)] bg-[#0d0d0b] px-2.5 py-2 text-xs">
      <span className="text-[var(--muted)]">{children}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
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
  return PIECE_PALETTES[palette][id] ?? "#dcd8cf";
}

function MiniPiece({ matrix, pieceId, active, palette = "mono" }: { matrix: number[][] | null; pieceId?: number; active?: boolean; palette?: PiecePalette }) {
  const rows = Math.max(2, matrix?.length ?? 0);
  const cols = Math.max(4, matrix?.[0]?.length ?? 0);
  const onColor = pieceShade(pieceId ?? 1, palette);
  return (
    <div
      className={`grid border border-[var(--border)] p-1 ${active ? "bg-[var(--surface2)]" : "bg-[var(--surface)]"}`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${MINI}px)`, gap: 1 }}
    >
      {Array.from({ length: rows }).flatMap((_, y) =>
        Array.from({ length: cols }).map((__, x) => {
          const on = (matrix?.[y]?.[x] ?? 0) !== 0;
          return (
            <span
              key={`${x}-${y}`}
              className="h-[10px] w-[10px] border border-[#2a2a25]"
              style={{ background: on ? onColor : "#11110f" }}
            />
          );
        }),
      )}
    </div>
  );
}

export function StackerModule() {
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
      setSeedInput("");
      setOpenerInput("");
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
      setSeedInput("");
      setOpenerInput("");
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
    setSeedInput("777");
    setOpenerInput("IOT");
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
    if (audio.current.state === "running") return;
    const now = nowMs ?? performance.now();
    if (now - lastAudioResumeAttemptRef.current < 1500) return;
    lastAudioResumeAttemptRef.current = now;
    void audio.current.resume();
  }, []);
  const soundSettings = useMemo<StackerSoundSettings>(() => ({
    enabled: sfxEnabled,
    uiEnabled: uiSoundEnabled,
    volume,
    impact: impactIntensity,
    pack: soundPack,
  }), [impactIntensity, sfxEnabled, soundPack, uiSoundEnabled, volume]);
  const emitSound = useCallback((event: StackerSoundEvent, detail = 0) => {
    if (!soundSettings.enabled || typeof window === "undefined" || !window.AudioContext) return;
    if (!audio.current) audio.current = new window.AudioContext();
    const context = audio.current;
    if (context.state === "suspended") {
      void context.resume().then(() => playStackerSound(context, event, soundSettings, detail));
      return;
    }
    playStackerSound(context, event, soundSettings, detail);
  }, [soundSettings]);

  useEffect(() => () => {
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

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(42, now - lastFrame.current);
      lastFrame.current = now;

      const runLeft = keyHeld.current.left && (!keyHeld.current.right || horizontalPriority.current === "left");
      const runRight = keyHeld.current.right && (!keyHeld.current.left || horizontalPriority.current === "right");

      if (runLeft) {
        if (moveRepeat.current.left <= 0) {
          if (arrMs <= 0) {
            while (true) {
              const beforeX = engineRef.current.getSnapshot().activePiece.x;
              engineRef.current.moveLeft();
              const afterX = engineRef.current.getSnapshot().activePiece.x;
              if (afterX === beforeX) break;
            }
          } else {
            engineRef.current.moveLeft();
          }
          moveRepeat.current.left = arrMs;
        } else {
          moveRepeat.current.left -= dt;
        }
      } else {
        moveRepeat.current.left = 0;
      }

      if (runRight) {
        if (moveRepeat.current.right <= 0) {
          if (arrMs <= 0) {
            while (true) {
              const beforeX = engineRef.current.getSnapshot().activePiece.x;
              engineRef.current.moveRight();
              const afterX = engineRef.current.getSnapshot().activePiece.x;
              if (afterX === beforeX) break;
            }
          } else {
            engineRef.current.moveRight();
          }
          moveRepeat.current.right = arrMs;
        } else {
          moveRepeat.current.right -= dt;
        }
      } else {
        moveRepeat.current.right = 0;
      }

      if (keyHeld.current.down) {
        if (moveRepeat.current.down <= 0) {
          if (sdfMs <= 0) {
            runSoftDropBurst();
          } else {
            engineRef.current.softDrop();
          }
          moveRepeat.current.down = sdfMs;
        } else {
          moveRepeat.current.down -= dt;
        }
      } else {
        moveRepeat.current.down = 0;
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
      if (snap.isGameOver && !wasGameOverRef.current) emitSound("game-over");
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
      if (runRunningRef.current && !snap.isPaused) {
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
        if (sprintRunningRef.current && !snap.isPaused) {
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
            pieces: runPiecesRef.current,
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
        if (showParticles) {
          const spawned: ClearParticle[] = [];
          const burstCount = Math.round(
            Math.min(42, 10 + clear.lines * 7 + (clear.isPerfectClear ? 8 : 0)) * particleIntensity,
          );
          for (let i = 0; i < burstCount; i += 1) {
            spawned.push({
              id: ++particleIdRef.current,
              x: Math.random() * (BOARD_PIXEL_W - 12) + 6,
              y: Math.max(12, BOARD_PIXEL_H - clear.lines * 28 + Math.random() * 24),
              vx: (Math.random() - 0.5) * 0.1,
              vy: -(0.06 + Math.random() * 0.12),
              lifeMs: 420 + Math.random() * 260,
              maxLifeMs: 420 + Math.random() * 260,
              size: 1.2 + Math.random() * 2.1,
              tone,
            });
          }
          particlesRef.current = [...particlesRef.current, ...spawned].slice(-130);
        }
        emitSound("line-clear", clear.lines);
        if (clear.combo > 1) emitSound("combo", clear.combo);
      }
      setFeedback((current) => (current && current.untilMs <= now ? null : current));
      setClearTrail((current) => current.filter((entry) => entry.untilMs > now));
      if (snap.lastLock) {
        const lock = snap.lastLock;
        if (lock.id !== lastLockId.current) {
          lastLockId.current = lock.id;
          runPiecesRef.current += 1;
          runFinessePlusRef.current += Math.max(0, pieceInputsRef.current - 3);
          pieceInputsRef.current = 0;
          setRunPieces(runPiecesRef.current);
          setRunFinessePlus(runFinessePlusRef.current);
          if (lock.lines === 0 && lock.lockCause !== "hard-drop") emitSound("lock");
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
        applyDasCut();
      }
      setState(snap);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyDasCut, arrMs, emitSound, hearNextPieces, mode, particleIntensity, runSoftDropBurst, sdfMs, showParticles]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSettingsOpen(false);
        }
        return;
      }
      const isPlayKey = PLAY_KEYS.has(e.key) || e.code === "Space" || e.key === "Control" || e.key === "Shift";
      if (isTextEntryTarget(e.target)) return;
      if (e.repeat) {
        if (isPlayKey) e.preventDefault();
        return;
      }
      ensureAudioReady();
      const eg = engineRef.current;
      let countedInput = false;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        keyHeld.current.left = true;
        horizontalPriority.current = "left";
        moveRepeat.current.left = dasMs;
        eg.moveLeft();
        emitSound("move");
        countedInput = true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keyHeld.current.right = true;
        horizontalPriority.current = "right";
        moveRepeat.current.right = dasMs;
        eg.moveRight();
        emitSound("move");
        countedInput = true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keyHeld.current.down = true;
        if (sdfMs <= 0) runSoftDropBurst();
        else eg.softDrop();
        emitSound("soft-drop");
        moveRepeat.current.down = Math.max(0, sdfMs);
        countedInput = true;
      }
      if (e.key === "ArrowUp") { e.preventDefault(); eg.rotateClockwise(); emitSound("rotate"); applyDasCut(); countedInput = true; }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); eg.rotateCounterClockwise(); emitSound("rotate"); applyDasCut(); countedInput = true; }
      if (e.key === "Control" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { e.preventDefault(); eg.rotateCounterClockwise(); emitSound("rotate"); applyDasCut(); countedInput = true; }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); eg.rotate180(); emitSound("rotate"); applyDasCut(); countedInput = true; }
      if (e.code === "Space") { e.preventDefault(); eg.hardDrop(); emitSound("hard-drop"); applyDasCut(); countedInput = true; }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); eg.hold(); emitSound("hold"); applyDasCut(); countedInput = true; }
      if (e.key === "Shift" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { e.preventDefault(); eg.hold(); emitSound("hold"); applyDasCut(); countedInput = true; }
      if ((e.key === "p" || e.key === "P") && mode !== "sprint") { e.preventDefault(); eg.togglePause(); emitSound(eg.getSnapshot().isPaused ? "pause" : "resume"); }
      if (e.key === "r" || e.key === "R" || e.key === "F4") {
        e.preventDefault();
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
      if (countedInput && !snapshot.isPaused && !snapshot.isGameOver) {
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
  }, [applyDasCut, buildRestartOptions, dasMs, emitSound, ensureAudioReady, mode, runSoftDropBurst, sdfMs, settingsOpen]);

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

  const start = () => {
    ensureAudioReady();
    emitSound("apply");
    engineRef.current.start();
    setState(engineRef.current.getSnapshot());
  };

  const restart = () => {
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
    if (mode === "sprint") return;
    engineRef.current.togglePause();
    const snapshot = engineRef.current.getSnapshot();
    emitSound(snapshot.isPaused ? "pause" : "resume");
    setState(snapshot);
  };

  const toggleMode = () => {
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
  const shakeBase = shakeRemaining > 0 ? Math.min(4.5, (shakeRemaining / 360) * 4.5) * clearFxStrength * Math.max(0, shakeStrength) : 0;
  const shakeX = shakeBase > 0 ? Math.sin(fxNow * 0.13) * shakeBase : 0;
  const shakeY = shakeBase > 0 ? Math.cos(fxNow * 0.17) * shakeBase * 0.65 : 0;

  return <section
    className="stacker-shell panel relative flex h-full min-h-0 flex-col overflow-hidden"
    style={{ ["--stacker-cell" as string]: "clamp(16px, min(2.15vw, calc((100vh - 250px) / 20)), 23px)" }}
  >
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
      <div className="min-w-[160px]">
        <h1 className="text-base font-semibold tracking-[-0.02em]">Stacker</h1>
        {!focusMode && <p className="text-[11px] text-[var(--muted)]">Board focus, minimal readout, advanced tuning tucked away.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
        <button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={start}>Start</button>
        <button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={restart}>Restart</button>
        <button
          className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)] disabled:opacity-40"
          onClick={togglePause}
          disabled={mode === "sprint"}
          title={mode === "sprint" ? "Sprint runs do not pause." : "Pause or resume"}
        >
          {state.isPaused ? "Resume" : "Pause"}
        </button>
        <button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={toggleMode}>{mode}</button>
        <button className="border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--surface2)]" onClick={() => {
          emitSound("menu");
          setSettingsOpen((value) => !value);
        }}>
          Settings
        </button>
      </div>
    </div>

    <div className="grid min-h-0 flex-1 place-items-center gap-3 overflow-hidden px-3 py-3 xl:grid-cols-[152px_auto_160px]">
      <aside className="hidden w-full self-center xl:block">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="text-sm text-[var(--muted)]">Hold {state.canHold ? "" : "(locked)"}</div>
          <div className="mb-2 text-xs">{state.holdPiece ? pieceLabel(state.holdPiece.id) : "-"}</div>
          <div style={{ opacity: state.canHold ? 1 : 0.45 }}>
            <MiniPiece matrix={state.holdPiece?.matrix ?? null} pieceId={state.holdPiece?.id} palette={piecePalette} />
          </div>
        </div>
        {!focusMode && <div className="mt-3 border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
          <div>Piece {pieceLabel(state.activePiece.id)}</div>
          <div style={{ color: comboTierTone(state.combo) }}>Combo {state.combo > 1 ? `x${state.combo}` : "-"}</div>
          <div style={{ color: b2bTierTone(state.b2bStreak) }}>B2B {state.b2bStreak >= 2 ? `x${state.b2bStreak - 1}` : "-"}</div>
        </div>}
      </aside>

      <main className="flex min-h-0 flex-col items-center justify-center">
        <div className="mb-2 grid w-full max-w-[500px] grid-cols-4 gap-1.5 text-center text-[11px]">
          <div className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"><div className="text-[var(--muted)]">Score</div><div className="truncate">{state.score}</div></div>
          <div className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"><div className="text-[var(--muted)]">Lines</div><div>{state.lines}</div></div>
          <div className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"><div className="text-[var(--muted)]">Timer</div><div>{formatMs(mode === "sprint" ? sprintElapsedMs : runElapsedMs)}</div></div>
          <div className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"><div className="text-[var(--muted)]">Level</div><div>{state.level}</div></div>
        </div>

        <div className="mb-3 flex gap-3 xl:hidden">
          <div className="border border-[var(--border)] bg-[var(--surface)] p-2 text-xs">
            <div className="mb-1 text-[var(--muted)]">Hold</div>
            <MiniPiece matrix={state.holdPiece?.matrix ?? null} pieceId={state.holdPiece?.id} palette={piecePalette} />
          </div>
          <div className="border border-[var(--border)] bg-[var(--surface)] p-2 text-xs">
            <div className="mb-1 text-[var(--muted)]">Next</div>
            <MiniPiece matrix={state.nextQueue[0]?.matrix ?? null} pieceId={state.nextQueue[0]?.id} active palette={piecePalette} />
          </div>
        </div>

        {feedback && <div className="mb-2 min-h-9 border px-3 py-1 text-center text-xs" style={{ borderColor: feedback.tone, color: feedback.tone }}>
          <div>{feedback.text}</div>
          {feedback.detail && <div className="text-[10px] text-[var(--subtle)]">{feedback.detail}</div>}
        </div>}
        {(state.isGameOver || doneSprint) && <div className="mb-2 border border-[var(--border)] px-3 py-1 text-xs">{doneSprint ? "SPRINT CLEAR" : "GAME OVER"}</div>}

        <div className="relative border border-[var(--border)] p-2 shadow-[0_0_8px_rgba(255,255,255,0.08)]" style={{ background: BOARD_BACKGROUNDS[boardBackground] }}>
          <div className="relative grid transition-transform" style={{ gridTemplateColumns: `repeat(${W}, var(--stacker-cell))`, gap: GAP, width: `calc(var(--stacker-cell) * ${W} + ${W - 1}px)`, transform: `translate(${shakeX}px, ${shakeY}px)` }}>
            {grid.flatMap((row, y) => row.map((cell, x) => {
              const tone = pieceShade(cell, piecePalette);
              const empty = cell === 0;
              const ghost = cell === 8;
              const background = empty
                ? `rgba(23,23,19,${0.38 + gridIntensity * 0.32})`
                : ghost
                  ? `rgba(232,228,218,${ghostOpacity})`
                  : pieceSkin === "ice-glass"
                    ? `linear-gradient(145deg, ${tone}, rgba(142,148,144,0.72))`
                    : pieceSkin === "wireframe"
                      ? "transparent"
                      : tone;
              return <div
                key={`${x}-${y}`}
                style={{
                  background,
                  width: "var(--stacker-cell)",
                  height: "var(--stacker-cell)",
                  border: `1px solid ${!empty && pieceSkin === "wireframe" ? tone : `rgba(226,222,213,${0.08 + gridIntensity * 0.28})`}`,
                  boxShadow: !empty && !ghost && pieceSkin === "soft-glow" ? `0 0 6px ${tone}` : pieceSkin === "ice-glass" && !empty && !ghost ? "inset 0 0 4px rgba(255,255,255,0.34)" : "none",
                }}
              />;
            }))}
            {particlesRef.current.map((particle) => {
              const alpha = Math.max(0, particle.lifeMs / particle.maxLifeMs) * 0.9;
              return (
                <div
                  key={particle.id}
                  className="pointer-events-none absolute rounded-[1px]"
                  style={{
                    left: Math.round(particle.x),
                    top: Math.round(particle.y),
                    width: particle.size,
                    height: particle.size,
                    background: particle.tone,
                    opacity: alpha,
                    boxShadow: `0 0 4px rgba(232,228,218,${Math.min(0.35, alpha)})`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {!focusMode && <div className="mt-2 text-center text-[11px] text-[var(--muted)]">
          Down soft drop, Space hard drop, C hold, P pause. {mode === "sprint" && `Left ${sprintLinesLeft}.`}
        </div>}
      </main>

      <aside className="hidden w-full self-center xl:block">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="text-sm text-[var(--muted)]">Next queue</div>
          <div className="mt-2 space-y-2">
            {state.nextQueue.slice(0, focusMode ? 3 : 5).map((piece, index) => (
              <div key={`q-${index}`}>
                <div className="mb-0.5 text-[10px] text-[var(--subtle)]">{pieceLabel(piece.id)}</div>
                <MiniPiece matrix={piece.matrix} pieceId={piece.id} active={index === 0} palette={piecePalette} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>

    {settingsOpen && <div className="absolute inset-0 z-10 bg-black/45" onClick={() => setSettingsOpen(false)}>
      <aside className="absolute right-0 top-0 h-full w-[360px] max-w-[92vw] overflow-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 text-sm" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Stacker settings</h2>
            <p className="text-xs text-[var(--muted)]">Tuning, replay setup, effects, and run details.</p>
          </div>
          <button className="border border-[var(--border)] px-2 py-1 text-xs" onClick={() => setSettingsOpen(false)}>Close</button>
        </div>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Input tuning</summary>
          <div className="mt-3 space-y-2">
            <div className="flex gap-1 text-[10px]">
              <button className="border px-1.5 py-0.5" onClick={() => applyPreset("balanced")}>Balanced</button>
              <button className="border px-1.5 py-0.5" onClick={() => applyPreset("competitive")}>Competitive</button>
              <button className="border px-1.5 py-0.5" onClick={() => applyPreset("instant")}>Instant</button>
            </div>
            <SettingRow label="DAS" value={`${dasMs}ms`}><input className="w-full" type="range" min={50} max={220} step={5} value={dasMs} onChange={(e) => setDasMs(Number(e.target.value))} /></SettingRow>
            <SettingRow label="ARR" value={`${arrMs}ms`}><input className="w-full" type="range" min={0} max={50} step={1} value={arrMs} onChange={(e) => setArrMs(Number(e.target.value))} /></SettingRow>
            <SettingRow label="DCD" value={`${dcdMs}ms`}><input className="w-full" type="range" min={0} max={80} step={1} value={dcdMs} onChange={(e) => setDcdMs(Number(e.target.value))} /></SettingRow>
            <SettingRow label="SDF" value={`${sdfMs}ms`}><input className="w-full" type="range" min={0} max={80} step={1} value={sdfMs} onChange={(e) => setSdfMs(Number(e.target.value))} /></SettingRow>
            <SettingRow label="Lock delay" value={`${lockDelayMs}ms`}><input className="w-full" type="range" min={0} max={900} step={10} value={lockDelayMs} onChange={(e) => setLockDelayMs(Number(e.target.value))} /></SettingRow>
            <SettingRow label="Lock resets" value={String(lockResetLimit)}><input className="w-full" type="range" min={0} max={20} step={1} value={lockResetLimit} onChange={(e) => setLockResetLimit(Number(e.target.value))} /></SettingRow>
          </div>
        </details>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Seed and opener</summary>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-1 text-[10px]">
            <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="Seed" className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text)]" />
            <input value={openerInput} onChange={(e) => setOpenerInput(e.target.value.toUpperCase())} placeholder="Opener" className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text)]" />
            <button className="border px-1.5 py-0.5" onClick={restart}>Apply</button>
          </div>
        </details>

        <details className="mb-3 border border-[var(--border)] p-3" open>
          <summary className="cursor-pointer text-[var(--muted)]">Appearance</summary>
          <div className="mt-3 space-y-2">
            <SettingRow label="Piece skin">
              <select className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={pieceSkin} onChange={(event) => setPieceSkin(event.target.value as PieceSkin)}>
                <option value="classic-mono">Classic mono</option>
                <option value="ice-glass">Ice glass</option>
                <option value="wireframe">Wireframe</option>
                <option value="solid-block">Solid block</option>
                <option value="soft-glow">Soft glow</option>
              </select>
            </SettingRow>
            <SettingRow label="Piece palette">
              <select className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={piecePalette} onChange={(event) => setPiecePalette(event.target.value as PiecePalette)}>
                <option value="mono">Mono</option>
                <option value="ice">Ice</option>
                <option value="contrast">Contrast</option>
              </select>
            </SettingRow>
            <SettingRow label="Board background">
              <select className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={boardBackground} onChange={(event) => setBoardBackground(event.target.value as BoardBackground)}>
                <option value="old-black">Old black</option>
                <option value="charcoal">Charcoal</option>
                <option value="deep-grid">Deep grid</option>
              </select>
            </SettingRow>
            <SettingRow label="Grid intensity" value={`${Math.round(gridIntensity * 100)}%`}><input className="w-full" type="range" min={0} max={1} step={0.01} value={gridIntensity} onChange={(event) => setGridIntensity(Number(event.target.value))} /></SettingRow>
            <ToggleRow checked={showGhost} onChange={setShowGhost}>Ghost piece</ToggleRow>
            <SettingRow label="Ghost opacity" value={`${Math.round(ghostOpacity * 100)}%`}><input className="w-full" type="range" min={0.05} max={0.35} step={0.01} value={ghostOpacity} onChange={(event) => setGhostOpacity(Number(event.target.value))} /></SettingRow>
            <ToggleRow checked={focusMode} onChange={setFocusMode}>Compact focus mode</ToggleRow>
          </div>
        </details>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Audio</summary>
          <div className="mt-3 space-y-2">
            <ToggleRow checked={sfxEnabled} onChange={setSfxEnabled}>Sound effects</ToggleRow>
            <ToggleRow checked={uiSoundEnabled} onChange={setUiSoundEnabled}>UI sounds</ToggleRow>
            <SettingRow label="Sound pack">
              <select className="w-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" value={soundPack} onChange={(event) => {
                setSoundPack(event.target.value as StackerSoundPack);
                emitSound("apply");
              }}>
                <option value="void-soft">VOID soft</option>
                <option value="glass">Glass</option>
                <option value="mechanical">Mechanical</option>
                <option value="muted">Muted</option>
              </select>
            </SettingRow>
            <SettingRow label="Master volume" value={`${Math.round(volume * 100)}%`}><input className="w-full" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></SettingRow>
            <SettingRow label="Impact" value={`${Math.round(impactIntensity * 100)}%`}><input className="w-full" type="range" min={0.25} max={1.75} step={0.05} value={impactIntensity} onChange={(event) => setImpactIntensity(Number(event.target.value))} /></SettingRow>
            <ToggleRow checked={hearNextPieces} onChange={setHearNextPieces}>Next-piece tone</ToggleRow>
            <button className="w-full border border-[var(--border)] px-2.5 py-2 text-left text-xs hover:bg-[var(--surface2)]" onClick={() => emitSound("apply")}>Preview sound pack</button>
          </div>
        </details>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Motion</summary>
          <div className="mt-3 space-y-2">
            <SettingRow label="Clear motion" value={`${Math.round(clearFxStrength * 100)}%`}><input className="w-full" type="range" min={0} max={1} step={0.01} value={clearFxStrength} onChange={(e) => setClearFxStrength(Number(e.target.value))} /></SettingRow>
            <SettingRow label="Board shake" value={`${Math.round(shakeStrength * 100)}%`}><input className="w-full" type="range" min={0} max={1.5} step={0.01} value={shakeStrength} onChange={(e) => setShakeStrength(Number(e.target.value))} /></SettingRow>
            <ToggleRow checked={showParticles} onChange={setShowParticles}>Clear particles</ToggleRow>
            <SettingRow label="Particle intensity" value={`${Math.round(particleIntensity * 100)}%`}><input className="w-full" type="range" min={0} max={1} step={0.01} value={particleIntensity} onChange={(event) => setParticleIntensity(Number(event.target.value))} /></SettingRow>
          </div>
        </details>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Run details</summary>
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
        </details>

        <details className="mb-3 border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-[var(--muted)]">Recent locks and archive</summary>
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
        </details>
      </aside>
    </div>}
  </section>;
}

