import { useCallback, useEffect, useMemo, useState } from "react";

const W = 10; const H = 20;
type Cell = 0 | 1;
type Mode = "sprint" | "endless";
type Piece = { x: number; y: number; shape: number[][] };
const SHAPES = [
  [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]],
];

const empty = () => Array.from({ length: H }, () => Array<Cell>(W).fill(0));
const rnd = () => SHAPES[Math.floor(Math.random() * SHAPES.length)].map((r) => [...r]);
const rotate = (s: number[][]) => s[0].map((_, i) => s.map((r) => r[i]).reverse());

function collides(board: Cell[][], p: Piece) {
  for (let y = 0; y < p.shape.length; y += 1) for (let x = 0; x < p.shape[y].length; x += 1) {
    if (!p.shape[y][x]) continue;
    const bx = p.x + x; const by = p.y + y;
    if (bx < 0 || bx >= W || by >= H) return true;
    if (by >= 0 && board[by][bx]) return true;
  }
  return false;
}

export function StackerModule() {
  const [board, setBoard] = useState<Cell[][]>(empty);
  const [piece, setPiece] = useState<Piece>({ x: 3, y: 0, shape: rnd() });
  const [queue, setQueue] = useState<number[][][]>([rnd(), rnd(), rnd()]);
  const [hold, setHold] = useState<number[][] | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(true);
  const [over, setOver] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>("endless");

  const merge = useCallback((b: Cell[][], p: Piece) => {
    const n = b.map((r) => [...r]);
    p.shape.forEach((row, y) => row.forEach((c, x) => { if (c && p.y + y >= 0) n[p.y + y][p.x + x] = 1; }));
    return n;
  }, []);

  const spawn = useCallback((b: Cell[][], q: number[][][]) => {
    const [shape, ...rest] = q;
    const np: Piece = { x: 3, y: 0, shape };
    if (collides(b, np)) { setOver(true); return q; }
    setPiece(np);
    setCanHold(true);
    const nq = [...rest, rnd()];
    setQueue(nq);
    return nq;
  }, []);

  const lockPiece = useCallback(() => {
    const merged = merge(board, piece);
    const filtered = merged.filter((r) => r.some((c) => c === 0));
    const cleared = H - filtered.length;
    while (filtered.length < H) filtered.unshift(Array<Cell>(W).fill(0));
    setBoard(filtered);
    if (cleared > 0) {
      setLines((v) => v + cleared);
      setScore((v) => v + (cleared * cleared) * 100);
    }
    spawn(filtered, queue);
  }, [board, merge, piece, queue, spawn]);

  const step = useCallback(() => {
    if (paused || over) return;
    const down = { ...piece, y: piece.y + 1 };
    if (!collides(board, down)) setPiece(down);
    else lockPiece();
  }, [paused, over, piece, board, lockPiece]);

  useEffect(() => { const id = setInterval(step, 300); return () => clearInterval(id); }, [step]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!startedAt || paused || over) return;
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [startedAt, paused, over]);

  useEffect(() => {
    if (mode === "sprint" && lines >= 40) setOver(true);
  }, [mode, lines]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (paused || over) return;
      if (e.key === "ArrowLeft") { const p = { ...piece, x: piece.x - 1 }; if (!collides(board, p)) setPiece(p); }
      if (e.key === "ArrowRight") { const p = { ...piece, x: piece.x + 1 }; if (!collides(board, p)) setPiece(p); }
      if (e.key === "ArrowDown") step();
      if (e.key === "ArrowUp") { const p = { ...piece, shape: rotate(piece.shape) }; if (!collides(board, p)) setPiece(p); }
      if (e.code === "Space") { let p = { ...piece }; while (!collides(board, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 }; setPiece(p); lockPiece(); }
      if (e.key.toLowerCase() === "c" && canHold) {
        const swap = hold ?? queue[0];
        setHold(piece.shape);
        const np = { x: 3, y: 0, shape: swap };
        if (!collides(board, np)) setPiece(np);
        if (!hold) setQueue((q) => [...q.slice(1), rnd()]);
        setCanHold(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [paused, over, piece, board, hold, queue, canHold, step, lockPiece]);

  const view = useMemo(() => {
    const b = board.map((r) => [...r]);
    piece.shape.forEach((row, y) => row.forEach((c, x) => {
      const yy = piece.y + y; const xx = piece.x + x;
      if (c && yy >= 0 && yy < H && xx >= 0 && xx < W) b[yy][xx] = 1;
    }));
    return b;
  }, [board, piece]);

  const start = () => { if (!startedAt) setStartedAt(Date.now()); setPaused(false); };
  const reset = () => { setBoard(empty()); setPiece({ x: 3, y: 0, shape: rnd() }); setQueue([rnd(), rnd(), rnd()]); setHold(null); setCanHold(true); setScore(0); setLines(0); setPaused(true); setOver(false); setStartedAt(null); setElapsed(0); };

  return <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
    <div className="panel p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="border px-2" onClick={start}>Start</button>
        <button className="border px-2" onClick={reset}>Restart</button>
        <button className="border px-2" onClick={() => setPaused((v) => !v)}>{paused ? "Resume" : "Pause"}</button>
        <button className="border px-2" onClick={() => setMode((m) => (m === "endless" ? "sprint" : "endless"))}>Mode: {mode}</button>
        <span>Score {score}</span><span>Lines {lines}</span><span>Timer {elapsed}s</span>{over && <span>Game Over</span>}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${W}, 22px)`, gap: 1 }}>
        {view.flatMap((r, y) => r.map((c, x) => <div key={`${x}-${y}`} className="h-[22px] w-[22px] border border-[#2a2a25]" style={{ background: c ? "#dcd8cf" : "#171713" }} />))}
      </div>
    </div>
    <aside className="panel p-3 text-sm">
      <div className="text-[var(--muted)]">Hold</div>
      <div className="mb-3 font-mono text-xs">{hold ? hold.map((r) => r.map((v) => (v ? "[]" : " .")).join("")).join("\n") : "-"}</div>
      <div className="text-[var(--muted)]">Next Queue</div>
      <div className="font-mono text-xs">{queue.map((s, i) => <div key={i} className="mb-2">{s.map((r) => r.map((v) => (v ? "[]" : " .")).join("")).join("\n")}</div>)}</div>
      <div className="text-[var(--subtle)]">Keys: arrows move/rotate, space hard drop, c hold.</div>
    </aside>
  </div>;
}
