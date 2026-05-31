import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StackerEngine, type LastClearEvent, type Snapshot } from "./engine";

const CELL = 22;
const W = 10;
const MINI = 10;
const GAP = 1;
const H = 20;
const BOARD_PIXEL_W = W * CELL + (W - 1) * GAP;
const BOARD_PIXEL_H = H * CELL + (H - 1) * GAP;
const PIECE_SHADES: Record<number, string> = {
  1: "#e6e1d7",
  2: "#d9d4ca",
  3: "#ccc8bf",
  4: "#c0bcb4",
  5: "#b5b1aa",
  6: "#aaa79f",
  7: "#9f9c95",
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

function sfx(clear: LastClearEvent): Array<[number, number, number, OscillatorType]> {
  if (clear.isPerfectClear) return [[392,70,0.06,"triangle"],[523,90,0.07,"triangle"],[784,130,0.09,"triangle"]];
  if (clear.isTSpin) return [[294,55,0.05,"square"],[392,80,0.07,"triangle"],[587,110,0.075,"triangle"]];
  if (clear.lines === 4) return [[196,45,0.05,"sawtooth"],[294,70,0.06,"square"],[440,120,0.08,"triangle"]];
  if (clear.lines === 3) return [[220,35,0.05,"triangle"],[330,80,0.06,"triangle"]];
  if (clear.lines === 2) return [[196,35,0.045,"triangle"],[277,65,0.055,"triangle"]];
  return [[240,55,0.04,"triangle"]];
}

function pieceCue(pieceId: number): Array<[number, number, number, OscillatorType]> {
  const freq: Record<number, number> = {
    1: 196,
    2: 220,
    3: 247,
    4: 262,
    5: 294,
    6: 330,
    7: 349,
  };
  return [[freq[pieceId] ?? 262, 36, 0.028, "triangle"]];
}

function lockCue(lockCause: "gravity" | "soft-drop" | "hard-drop"): Array<[number, number, number, OscillatorType]> {
  if (lockCause === "hard-drop") return [[164, 24, 0.024, "square"]];
  if (lockCause === "soft-drop") return [[176, 22, 0.022, "triangle"]];
  return [[152, 20, 0.018, "triangle"]];
}

function playSeq(audio: AudioContext, seq: Array<[number, number, number, OscillatorType]>, volume = 0.7): void {
  if (audio.state !== "running") return;
  let t = audio.currentTime;
  for (const [freq, durMs, gain, wave] of seq) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * volume), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + durMs / 1000 + 0.01);
    t += durMs / 1000;
  }
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

function pieceShade(id: number): string {
  return PIECE_SHADES[id] ?? "#dcd8cf";
}

function MiniPiece({ matrix, pieceId, active }: { matrix: number[][] | null; pieceId?: number; active?: boolean }) {
  const rows = Math.max(2, matrix?.length ?? 0);
  const cols = Math.max(4, matrix?.[0]?.length ?? 0);
  const onColor = pieceShade(pieceId ?? 1);
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
  const [feedback, setFeedback] = useState<{ text: string; detail: string; tone: string; untilMs: number } | null>(null);
  const [clearTrail, setClearTrail] = useState<Array<{ id: number; label: string; tone: string; untilMs: number }>>([]);
  const [lockTrail, setLockTrail] = useState<Array<{ id: number; label: string; detail: string; tone: string }>>([]);
  const lastLockId = useRef(0);
  const lastActivePieceId = useRef<number>(engineRef.current.getSnapshot().activePiece.id);
  const shakeUntilRef = useRef(0);
  const flashUntilRef = useRef(0);
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
      ensureAudioReady(now);
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
        if (hearNextPieces && audio.current) {
          playSeq(audio.current, pieceCue(snap.activePiece.id), volume);
        }
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
        const flashDuration =
          clear.isPerfectClear ? 280 : clear.lines >= 4 ? 210 : 140;
        shakeUntilRef.current = Math.max(shakeUntilRef.current, now + shakeDuration);
        flashUntilRef.current = Math.max(flashUntilRef.current, now + flashDuration);
        if (showParticles) {
          const spawned: ClearParticle[] = [];
          const burstCount = Math.min(42, 10 + clear.lines * 7 + (clear.isPerfectClear ? 8 : 0));
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
        const chainBoost = Math.min(1.15, 0.92 + Math.max(0, clear.combo - 1) * 0.03);
        if (audio.current) playSeq(audio.current, sfx(clear), Math.min(1, volume * chainBoost));
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
          if (audio.current && lock.lines === 0) {
            playSeq(audio.current, lockCue(lock.lockCause), volume * 0.75);
          }
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
  }, [applyDasCut, arrMs, ensureAudioReady, hearNextPieces, mode, runSoftDropBurst, sdfMs, showParticles, volume]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      ensureAudioReady();
      const eg = engineRef.current;
      let countedInput = false;
      if (e.key === "ArrowLeft") {
        keyHeld.current.left = true;
        horizontalPriority.current = "left";
        moveRepeat.current.left = dasMs;
        eg.moveLeft();
        countedInput = true;
      }
      if (e.key === "ArrowRight") {
        keyHeld.current.right = true;
        horizontalPriority.current = "right";
        moveRepeat.current.right = dasMs;
        eg.moveRight();
        countedInput = true;
      }
      if (e.key === "ArrowDown") keyHeld.current.down = true;
      if (e.key === "ArrowDown") {
        if (sdfMs <= 0) runSoftDropBurst();
        else eg.softDrop();
        moveRepeat.current.down = Math.max(0, sdfMs);
        countedInput = true;
      }
      if (e.key === "ArrowUp") { eg.rotateClockwise(); applyDasCut(); countedInput = true; }
      if (e.key === "z" || e.key === "Z") { eg.rotateCounterClockwise(); applyDasCut(); countedInput = true; }
      if (e.key === "Control" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { eg.rotateCounterClockwise(); applyDasCut(); countedInput = true; }
      if (e.key === "a" || e.key === "A") { eg.rotate180(); applyDasCut(); countedInput = true; }
      if (e.code === "Space") { e.preventDefault(); eg.hardDrop(); applyDasCut(); countedInput = true; }
      if (e.key === "c" || e.key === "C") { eg.hold(); applyDasCut(); countedInput = true; }
      if (e.key === "Shift" && e.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) { eg.hold(); applyDasCut(); countedInput = true; }
      if ((e.key === "p" || e.key === "P") && mode !== "sprint") eg.togglePause();
      if (e.key === "r" || e.key === "R" || e.key === "F4") {
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
      if (e.key === "ArrowLeft") keyHeld.current.left = false;
      if (e.key === "ArrowRight") keyHeld.current.right = false;
      if (e.key === "ArrowDown") keyHeld.current.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [applyDasCut, buildRestartOptions, dasMs, ensureAudioReady, mode, runSoftDropBurst, sdfMs]);

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
    engineRef.current.start();
    setState(engineRef.current.getSnapshot());
  };

  const restart = () => {
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
    setState(engineRef.current.getSnapshot());
  };

  const toggleMode = () => {
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
  const flashRemaining = Math.max(0, flashUntilRef.current - fxNow);
  const shakeBase = shakeRemaining > 0 ? Math.min(4.5, (shakeRemaining / 360) * 4.5) * clearFxStrength * Math.max(0, shakeStrength) : 0;
  const shakeX = shakeBase > 0 ? Math.sin(fxNow * 0.13) * shakeBase : 0;
  const shakeY = shakeBase > 0 ? Math.cos(fxNow * 0.17) * shakeBase * 0.65 : 0;
  const flashOpacity = flashRemaining > 0 ? Math.min(0.22, (flashRemaining / 280) * 0.22) * clearFxStrength : 0;

  return <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
    <div className="panel p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <button className="border px-2" onClick={start}>Start</button>
        <button className="border px-2" onClick={restart}>Restart</button>
        <button
          className="border px-2 disabled:opacity-40"
          onClick={togglePause}
          disabled={mode === "sprint"}
          title={mode === "sprint" ? "Sprint runs do not pause." : "Pause or resume"}
        >
          {state.isPaused ? "Resume" : "Pause"}
        </button>
        <button className="border px-2" onClick={toggleMode}>Mode: {mode}</button>
        <span>Score {state.score}</span><span>Lines {state.lines}</span><span>Lv {state.level}</span>
        {mode === "sprint" && <span>Time {formatMs(sprintElapsedMs)}</span>}
        {mode === "sprint" && <span>Left {sprintLinesLeft}</span>}
        <span>Pieces {runPieces}</span>
        <span>Inputs {runInputs}</span>
        <span>F+ {runFinessePlus}</span>
        <span>PPS {Number.isFinite(pps) ? pps.toFixed(2) : "0.00"}</span>
        <span>KPS {Number.isFinite(kps) ? kps.toFixed(2) : "0.00"}</span>
        <span>LPM {Number.isFinite(lpm) ? lpm.toFixed(1) : "0.0"}</span>
        <span>KPP {Number.isFinite(kpp) ? kpp.toFixed(2) : "0.00"}</span>
        <span>Stack {stackPercent}%</span>
      </div>
      {feedback && <div className="mb-2 border px-2 py-1 text-xs" style={{ borderColor: feedback.tone, color: feedback.tone }}>
        <div>{feedback.text}</div>
        {feedback.detail && <div className="text-[10px] text-[var(--subtle)]">{feedback.detail}</div>}
      </div>}
      <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
        <span>Piece {pieceLabel(state.activePiece.id)}</span>
        <span>Combo {state.combo > 1 ? `x${state.combo}` : "-"}</span>
        <span>B2B {state.b2bStreak >= 2 ? `x${state.b2bStreak - 1}` : "-"}</span>
      </div>
      {(state.isGameOver || doneSprint) && <div className="mb-2 border border-[var(--border)] px-2 py-1 text-xs">{doneSprint ? "SPRINT CLEAR" : "GAME OVER"}</div>}
      <div className="relative">
        <div className="relative grid transition-transform" style={{ gridTemplateColumns: `repeat(${W}, ${CELL}px)`, gap: GAP, width: BOARD_PIXEL_W, transform: `translate(${shakeX}px, ${shakeY}px)` }}>
          {grid.flatMap((r, y) => r.map((c, x) => {
            const bg = c === 0 ? "#171713" : c === 8 ? `rgba(232,228,218,${ghostOpacity})` : pieceShade(c);
            return <div key={`${x}-${y}`} className="h-[22px] w-[22px] border border-[#2a2a25]" style={{ background: bg }} />;
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
        {flashOpacity > 0 && <div className="pointer-events-none absolute inset-0 border border-[#dcd8cf]" style={{ background: `rgba(232,228,218,${flashOpacity})` }} />}
      </div>
    </div>
    <aside className="panel p-3 text-sm">
      <div className="text-[var(--muted)]">Hold {state.canHold ? "" : "(LOCKED)"}</div>
      <div className="mb-2 text-xs">{state.holdPiece ? pieceLabel(state.holdPiece.id) : "-"}</div>
      <div style={{ opacity: state.canHold ? 1 : 0.45 }}>
        <MiniPiece matrix={state.holdPiece?.matrix ?? null} pieceId={state.holdPiece?.id} />
      </div>
      <div className="text-[var(--muted)]">Next Queue</div>
      <div className="mb-3 mt-1 space-y-1">
        {state.nextQueue.slice(0, 5).map((p, i) => (
          <div key={`q-${i}`}>
            <div className="mb-0.5 text-[10px] text-[var(--subtle)]">{pieceLabel(p.id)}</div>
            <MiniPiece matrix={p.matrix} pieceId={p.id} active={i === 0} />
          </div>
        ))}
      </div>
      <div style={{ color: comboTierTone(state.combo) }}>Combo {state.combo > 1 ? `x${state.combo}` : "-"}</div>
      <div style={{ color: b2bTierTone(state.b2bStreak) }}>B2B {state.b2bStreak >= 2 ? `x${state.b2bStreak - 1}` : "-"}</div>
      <div className="mt-1 h-2 overflow-hidden border border-[var(--border)] bg-[var(--surface2)]">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, (state.combo / 8) * 100)}%`,
            background: comboTierTone(state.combo),
          }}
        />
      </div>
      <div className="mt-1 h-2 overflow-hidden border border-[var(--border)] bg-[var(--surface2)]">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, ((state.b2bStreak >= 2 ? state.b2bStreak - 1 : 0) / 8) * 100)}%`,
            background: b2bTierTone(state.b2bStreak),
          }}
        />
      </div>
      <div className="mt-3 text-[var(--muted)]">Input Tuning</div>
      <div className="mb-1 flex gap-1 text-[10px]">
        <button className="border px-1.5 py-0.5" onClick={() => applyPreset("balanced")}>Balanced</button>
        <button className="border px-1.5 py-0.5" onClick={() => applyPreset("competitive")}>Competitive</button>
        <button className="border px-1.5 py-0.5" onClick={() => applyPreset("instant")}>ARR0</button>
      </div>
      <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-1 text-[10px]">
        <input
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="Seed"
          className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--foreground)]"
        />
        <input
          value={openerInput}
          onChange={(e) => setOpenerInput(e.target.value.toUpperCase())}
          placeholder="Opener (IOT...)"
          className="border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--foreground)]"
        />
        <button className="border px-1.5 py-0.5" onClick={restart}>Apply</button>
      </div>
      <label className="block text-xs">DAS {dasMs}ms <input type="range" min={50} max={220} step={5} value={dasMs} onChange={(e) => setDasMs(Number(e.target.value))} /></label>
      <label className="block text-xs">ARR {arrMs}ms <input type="range" min={0} max={50} step={1} value={arrMs} onChange={(e) => setArrMs(Number(e.target.value))} /></label>
      <label className="block text-xs">DCD {dcdMs}ms <input type="range" min={0} max={80} step={1} value={dcdMs} onChange={(e) => setDcdMs(Number(e.target.value))} /></label>
      <label className="block text-xs">SDF {sdfMs}ms <input type="range" min={0} max={80} step={1} value={sdfMs} onChange={(e) => setSdfMs(Number(e.target.value))} /></label>
      <label className="block text-xs">Lock {lockDelayMs}ms <input type="range" min={0} max={900} step={10} value={lockDelayMs} onChange={(e) => setLockDelayMs(Number(e.target.value))} /></label>
      <label className="block text-xs">Resets {lockResetLimit} <input type="range" min={0} max={20} step={1} value={lockResetLimit} onChange={(e) => setLockResetLimit(Number(e.target.value))} /></label>
      <label className="block text-xs">Clear FX {Math.round(clearFxStrength * 100)} <input type="range" min={0} max={1} step={0.01} value={clearFxStrength} onChange={(e) => setClearFxStrength(Number(e.target.value))} /></label>
      <label className="block text-xs">Shake {Math.round(shakeStrength * 100)} <input type="range" min={0} max={1.5} step={0.01} value={shakeStrength} onChange={(e) => setShakeStrength(Number(e.target.value))} /></label>
      <label className="block text-xs"><input type="checkbox" checked={showParticles} onChange={(e) => setShowParticles(e.target.checked)} /> Particles on clear</label>
      <label className="block text-xs"><input type="checkbox" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} /> Ghost</label>
      <label className="block text-xs">Ghost Opacity {Math.round(ghostOpacity * 100)} <input type="range" min={0.05} max={0.35} step={0.01} value={ghostOpacity} onChange={(e) => setGhostOpacity(Number(e.target.value))} /></label>
      <label className="block text-xs"><input type="checkbox" checked={hearNextPieces} onChange={(e) => setHearNextPieces(e.target.checked)} /> Hear Next</label>
      <label className="block text-xs">Volume {Math.round(volume * 100)} <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></label>
      <div className="mt-3 text-[var(--muted)]">Recent Locks</div>
      <div className="mt-1 space-y-1 text-[10px]">
        {lockTrail.length === 0 ? <div className="text-[var(--subtle)]">-</div> : lockTrail.map((entry) => (
          <div key={entry.id} className="border border-[var(--border)] px-1 py-0.5" style={{ color: entry.tone }}>
            <div>{entry.label}</div>
            <div className="text-[var(--subtle)]">{entry.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[var(--muted)]">Clear Chain</div>
      <div className="mt-1 space-y-1 text-[10px]">
        {clearTrail.length === 0 ? <div className="text-[var(--subtle)]">-</div> : clearTrail.map((entry) => (
          <div key={entry.id} className="border border-[var(--border)] px-1 py-0.5" style={{ color: entry.tone }}>
            {entry.label}
          </div>
        ))}
      </div>
      {mode === "sprint" && <>
        <div className="mt-3 text-[var(--muted)]">Sprint 40L</div>
        <div className="text-xs">PB {sprintBestMs !== null ? formatMs(sprintBestMs) : "--:--.--"}</div>
        <div className="text-xs">Waste {sprintWastePieces}p</div>
        <div className="mt-1 space-y-1 text-[10px]">
          {sprintHistory.length === 0 ? <div className="text-[var(--subtle)]">-</div> : sprintHistory.slice(0, 5).map((entry, idx) => (
            <div key={`${entry.at}-${idx}`} className="border border-[var(--border)] px-1 py-0.5">
              <div>{formatMs(entry.ms)}</div>
              <div className="text-[var(--subtle)]">{new Date(entry.at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </>}
      <div className="mt-3 text-[var(--muted)]">Run Archive</div>
      <div className="text-xs">Best Score {bestScore ?? 0}</div>
      <div className="mt-1 space-y-1 text-[10px]">
        {runHistory.length === 0 ? <div className="text-[var(--subtle)]">-</div> : runHistory.slice(0, 5).map((entry, idx) => (
          <div key={`${entry.at}-${idx}`} className="border border-[var(--border)] px-1 py-0.5">
            <div>{entry.mode.toUpperCase()} S{entry.score} L{entry.lines}</div>
            <div className="text-[var(--subtle)]">{formatMs(entry.ms)} | {entry.pieces}p | {entry.inputs > 0 && entry.pieces > 0 ? (entry.inputs / entry.pieces).toFixed(2) : "0.00"}kpp | F+ {entry.finessePlus}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[var(--subtle)]">Keys: Left/Right move, Down soft drop, Up/Z/A rotate, Space hard drop, C hold, P pause (endless only).</div>
    </aside>
  </div>;
}

