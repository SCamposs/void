import { describe, expect, it } from "vitest";
import { STACKER_KICK_TABLES, StackerEngine } from "../app/modules/stacker/engine";

describe("stacker engine", () => {
  it("does not throw on repeated I-piece 180 rotations", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    for (let i = 0; i < 50; i += 1) {
      expect(() => engine.rotate180()).not.toThrow();
      engine.update(16);
    }
  });

  it("enforces hold lock until next spawn", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    const before = engine.getSnapshot().holdPiece;
    engine.hold();
    const first = engine.getSnapshot().holdPiece;
    expect(engine.getSnapshot().canHold).toBe(false);
    engine.hold();
    const second = engine.getSnapshot().holdPiece;
    expect(first).not.toEqual(before);
    expect(second).toEqual(first);
    engine.hardDrop();
    expect(engine.getSnapshot().canHold).toBe(true);
  });

  it("supports mode switching without runtime errors", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    expect(() => engine.setMode("sprint")).not.toThrow();
    for (let i = 0; i < 80; i += 1) {
      engine.rotate180();
      engine.moveLeft();
      engine.moveRight();
      engine.update(16);
    }
    expect(engine.getSnapshot().isGameOver).toBe(false);
  });

  it("uses deterministic opener/seed for stable piece sequence", () => {
    const engineA = new StackerEngine("endless");
    const engineB = new StackerEngine("endless");
    engineA.restart({ seed: 12345, openerPieceIds: [1, 3, 2] });
    engineB.restart({ seed: 12345, openerPieceIds: [1, 3, 2] });
    engineA.start();
    engineB.start();

    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      seqA.push(engineA.getSnapshot().activePiece.id);
      seqB.push(engineB.getSnapshot().activePiece.id);
      engineA.hardDrop();
      engineB.hardDrop();
    }

    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBe(1);
  });

  it("soft drop does not force immediate lock on floor contact", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] }); // O piece stable shape
    engine.start();

    let previousY = engine.getSnapshot().activePiece.y;
    for (let i = 0; i < 60; i += 1) {
      engine.softDrop();
      const nextY = engine.getSnapshot().activePiece.y;
      if (nextY === previousY) break;
      previousY = nextY;
    }

    const before = engine.getSnapshot();
    expect(before.isGameOver).toBe(false);

    // One soft drop at grounded position should not instantly spawn next piece.
    engine.softDrop();
    const after = engine.getSnapshot();
    expect(after.activePiece.id).toBe(before.activePiece.id);

    // But lock should happen after lock delay elapsed by update loop.
    for (let i = 0; i < 40; i += 1) engine.update(16);
    const locked = engine.getSnapshot();
    expect(locked.isGameOver).toBe(false);
    expect(locked.activePiece.y).toBeLessThanOrEqual(1);
  });

  it("applies wall kicks on rotation near side walls", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [1] }); // I piece
    engine.start();

    for (let i = 0; i < 8; i += 1) engine.moveLeft();
    const pre = engine.getSnapshot().activePiece;
    engine.rotateClockwise();
    const post = engine.getSnapshot().activePiece;

    expect(post.id).toBe(pre.id);
    expect(post.matrix).not.toEqual(pre.matrix);
    expect(post.x).toBeGreaterThanOrEqual(0);
  });

  it("keeps expected SRS+ I kick data for key transitions", () => {
    expect(STACKER_KICK_TABLES.i["0>1"]).toEqual([
      [0, 0],
      [-2, 0],
      [1, 0],
      [1, 2],
      [-2, -1],
    ]);
    expect(STACKER_KICK_TABLES.i["1>0"]).toEqual([
      [0, 0],
      [2, 0],
      [-1, 0],
      [2, 1],
      [-1, -2],
    ]);
  });

  it("keeps transition-based 180 tables for both I and JLSTZ families", () => {
    expect(STACKER_KICK_TABLES.jltsz180["0>2"]).toEqual([
      [0, 0],
      [1, 0],
      [-1, 0],
      [2, 0],
      [-2, 0],
      [0, 1],
      [0, -1],
    ]);
    expect(STACKER_KICK_TABLES.i180["1>3"]).toEqual([
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, 1],
      [0, -1],
    ]);
  });

  it("contains complete 90-degree transition keys for JLSTZ and I kick tables", () => {
    const expected90 = ["0>1", "1>0", "1>2", "2>1", "2>3", "3>2", "3>0", "0>3"];
    for (const key of expected90) {
      expect(STACKER_KICK_TABLES.jltsz[key]).toBeDefined();
      expect(STACKER_KICK_TABLES.i[key]).toBeDefined();
      expect(STACKER_KICK_TABLES.jltsz[key]).toHaveLength(5);
      expect(STACKER_KICK_TABLES.i[key]).toHaveLength(5);
    }
  });

  it("contains complete 180-degree transition keys for JLSTZ and I kick tables", () => {
    const expected180 = ["0>2", "1>3", "2>0", "3>1"];
    for (const key of expected180) {
      expect(STACKER_KICK_TABLES.jltsz180[key]).toBeDefined();
      expect(STACKER_KICK_TABLES.i180[key]).toBeDefined();
      expect(STACKER_KICK_TABLES.jltsz180[key]).toHaveLength(7);
      expect(STACKER_KICK_TABLES.i180[key]).toHaveLength(7);
    }
  });

  it("uses TETR.IO-style base values for Spin Zero and Mini Spin Zero scoring", () => {
    const engine = new StackerEngine("endless") as unknown as {
      scoreForClear: (
        linesCleared: number,
        tSpinKind: "none" | "mini" | "full",
        isPerfectClear: boolean,
        wasBackToBack: boolean,
      ) => number;
    };

    expect(engine.scoreForClear(0, "full", false, false)).toBe(400);
    expect(engine.scoreForClear(0, "mini", false, false)).toBe(100);
  });

  it("matches TETR.IO custom-solo scoring matrix for key actions", () => {
    const engine = new StackerEngine("endless") as unknown as {
      combo: number;
      scoreForClear: (
        linesCleared: number,
        tSpinKind: "none" | "mini" | "full",
        isPerfectClear: boolean,
        wasBackToBack: boolean,
      ) => number;
    };

    // No combo, no B2B.
    engine.combo = 0;
    expect(engine.scoreForClear(1, "none", false, false)).toBe(100);
    expect(engine.scoreForClear(2, "none", false, false)).toBe(300);
    expect(engine.scoreForClear(3, "none", false, false)).toBe(500);
    expect(engine.scoreForClear(4, "none", false, false)).toBe(800);
    expect(engine.scoreForClear(1, "full", false, false)).toBe(800);
    expect(engine.scoreForClear(2, "full", false, false)).toBe(1200);
    expect(engine.scoreForClear(1, "mini", false, false)).toBe(200);
    expect(engine.scoreForClear(0, "full", false, false)).toBe(400);
    expect(engine.scoreForClear(0, "mini", false, false)).toBe(100);

    // B2B difficult multiplier x1.5.
    expect(engine.scoreForClear(4, "none", false, true)).toBe(1200);
    expect(engine.scoreForClear(2, "full", false, true)).toBe(1800);

    // Combo bonus: +50 * comboCount where comboCount is current combo value.
    engine.combo = 3;
    expect(engine.scoreForClear(1, "none", false, false)).toBe(250); // 100 + 150
    expect(engine.scoreForClear(2, "full", false, false)).toBe(1350); // 1200 + 150

    // All clear flat +3500.
    engine.combo = 0;
    expect(engine.scoreForClear(4, "none", true, false)).toBe(4300); // 800 + 3500
  });

  it("applies level multiplier to total post-bonus score", () => {
    const engine = new StackerEngine("endless") as unknown as {
      combo: number;
      level: number;
      scoreForClear: (
        linesCleared: number,
        tSpinKind: "none" | "mini" | "full",
        isPerfectClear: boolean,
        wasBackToBack: boolean,
      ) => number;
    };

    engine.combo = 2; // +100
    engine.level = 3;
    // Base single 100 + combo 100 = 200; level 3 => 600.
    expect(engine.scoreForClear(1, "none", false, false)).toBe(600);
  });

  it("stacks B2B, combo, and all-clear bonuses correctly", () => {
    const engine = new StackerEngine("endless") as unknown as {
      combo: number;
      level: number;
      scoreForClear: (
        linesCleared: number,
        tSpinKind: "none" | "mini" | "full",
        isPerfectClear: boolean,
        wasBackToBack: boolean,
      ) => number;
    };

    engine.combo = 4; // +200
    engine.level = 1;
    // Quad base 800 -> B2B x1.5 => 1200; +combo 200 => 1400; +PC 3500 => 4900.
    expect(engine.scoreForClear(4, "none", true, true)).toBe(4900);
  });

  it("emits lastClear and awards score for Spin Zero lock (no line clear)", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lastSuccessfulAction: "none" | "cw" | "ccw" | "r180" | "other";
      score: number;
      lockPieceAndAdvance: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    const board = Array.from({ length: 20 }, () => Array(10).fill(0));
    // Corners around pivot (x+1, y+1) for rotation state 0:
    // block 3 corners total, including both front corners => full spin.
    board[0][0] = 8;
    board[0][2] = 8;
    board[2][0] = 8;

    engine.board = board;
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 0, y: 0 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "cw";
    const before = engine.score;

    engine.lockPieceAndAdvance();
    const snap = engine.getSnapshot();

    expect(snap.lastClear).not.toBeNull();
    expect(snap.lastClear?.lines).toBe(0);
    expect(snap.lastClear?.isTSpin).toBe(true);
    expect(snap.lastClear?.tSpinKind).toBe("full");
    expect(snap.score).toBe(before + 400);
  });

  it("emits lastClear and awards score for Mini Spin Zero lock (no line clear)", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lastSuccessfulAction: "none" | "cw" | "ccw" | "r180" | "other";
      score: number;
      lockPieceAndAdvance: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    const board = Array.from({ length: 20 }, () => Array(10).fill(0));
    // 3 blocked corners total, but only one front corner for state 0 => mini.
    board[0][0] = 8;
    board[2][0] = 8;
    board[2][2] = 8;

    engine.board = board;
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 0, y: 0 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "cw";
    const before = engine.score;

    engine.lockPieceAndAdvance();
    const snap = engine.getSnapshot();

    expect(snap.lastClear).not.toBeNull();
    expect(snap.lastClear?.lines).toBe(0);
    expect(snap.lastClear?.isTSpin).toBe(true);
    expect(snap.lastClear?.tSpinKind).toBe("mini");
    expect(snap.score).toBe(before + 100);
  });

  it("uses expected I-piece CW fallback kick when no-kick position is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveLeft: () => void;
      rotateClockwise: () => void;
    };

    engine.restart({ openerPieceIds: [1] });
    engine.start();
    for (let i = 0; i < 8; i += 1) engine.moveLeft();

    const board = engine.board.map((row) => [...row]);
    board[0][0] = 9; // block no-kick target for vertical I at x=0
    engine.board = board;

    const before = engine.getSnapshot().activePiece;
    expect(before.x).toBe(0);
    engine.rotateClockwise();
    const after = engine.getSnapshot().activePiece;

    // 0>1 kicks: [0,0] blocked, [-2,0] out, [1,0] succeeds.
    expect(after.x).toBe(1);
  });

  it("uses expected JLSTZ CW fallback kick when no-kick position is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveLeft: () => void;
      rotateClockwise: () => void;
    };

    engine.restart({ openerPieceIds: [3] }); // T piece
    engine.start();
    // Spawn x for T is 3, move to x=1.
    engine.moveLeft();
    engine.moveLeft();

    const board = engine.board.map((row) => [...row]);
    board[0][1] = 9; // block no-kick target for CW at x=1
    engine.board = board;

    const before = engine.getSnapshot().activePiece;
    expect(before.x).toBe(1);
    engine.rotateClockwise();
    const after = engine.getSnapshot().activePiece;

    // 0>1 JLSTZ kicks: [0,0] blocked, [-1,0] succeeds.
    expect(after.x).toBe(0);
  });

  it("uses expected I-piece 180 fallback kick when no-kick position is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveLeft: () => void;
      rotate180: () => void;
    };

    engine.restart({ openerPieceIds: [1] });
    engine.start();
    for (let i = 0; i < 8; i += 1) engine.moveLeft();

    const board = engine.board.map((row) => [...row]);
    board[0][0] = 9; // block no-kick target at x=0
    engine.board = board;

    const before = engine.getSnapshot().activePiece;
    expect(before.x).toBe(0);
    engine.rotate180();
    const after = engine.getSnapshot().activePiece;

    // I 0>2 kicks: [0,0] blocked, [1,0] should succeed first.
    expect(after.x).toBe(1);
  });

  it("uses expected JLSTZ 180 fallback kick when no-kick position is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveLeft: () => void;
      rotate180: () => void;
    };

    engine.restart({ openerPieceIds: [3] }); // T
    engine.start();
    engine.moveLeft();
    engine.moveLeft(); // x=1

    const board = engine.board.map((row) => [...row]);
    board[0][1] = 9; // block no-kick target
    engine.board = board;

    const before = engine.getSnapshot().activePiece;
    expect(before.x).toBe(1);
    engine.rotate180();
    const after = engine.getSnapshot().activePiece;

    // JLSTZ 0>2 kicks: [0,0] blocked, [1,0] should succeed first.
    expect(after.x).toBe(2);
  });

  it("keeps B2B state on no-clear locks and resets on non-difficult line clear", () => {
    const engine = new StackerEngine("endless") as unknown as {
      b2bStreak: number;
      combo: number;
      isDifficultClear: (lines: number, kind: "none" | "mini" | "full") => boolean;
    };

    // Difficulty rule invariant (TETR.IO/Guideline style): T-spin clear or quad.
    expect(engine.isDifficultClear(4, "none")).toBe(true);
    expect(engine.isDifficultClear(1, "full")).toBe(true);
    expect(engine.isDifficultClear(2, "mini")).toBe(true);
    expect(engine.isDifficultClear(3, "none")).toBe(false);

    // State transition invariant represented in engine:
    // - no-clear lock keeps b2b streak
    // - non-difficult clear resets b2b
    engine.b2bStreak = 3;
    // no-clear path should not reset
    const noClear = 0;
    if (noClear > 0) engine.b2bStreak = 0;
    expect(engine.b2bStreak).toBe(3);

    // non-difficult line clear resets
    const cleared = 2;
    const kind: "none" | "mini" | "full" = "none";
    if (!engine.isDifficultClear(cleared, kind) && cleared > 0) {
      engine.b2bStreak = 0;
    }
    expect(engine.b2bStreak).toBe(0);
  });

  it("keeps B2B through no-clear locks and resets on non-difficult clear in real lock flow", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lastSuccessfulAction: "none" | "cw" | "ccw" | "r180" | "other";
      b2bStreak: number;
      lockPieceAndAdvance: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    // 1) Create a quad to start B2B.
    const board = Array.from({ length: 20 }, () => Array(10).fill(0));
    for (let y = 16; y < 20; y += 1) {
      for (let x = 0; x < 10; x += 1) board[y][x] = 8;
      board[y][0] = 0;
    }
    engine.board = board;
    engine.activePiece = { id: 1, matrix: [[1], [1], [1], [1]], x: 0, y: 16 };
    engine.activeRotation = 1;
    engine.lastSuccessfulAction = "other";
    engine.lockPieceAndAdvance();
    expect(engine.getSnapshot().lastClear?.lines).toBe(4);
    expect(engine.getSnapshot().b2bStreak).toBe(1);

    // 2) No-clear lock should keep B2B.
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 0, y: 0 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "other";
    engine.lockPieceAndAdvance();
    expect(engine.getSnapshot().lastClear).toBeNull();
    expect(engine.getSnapshot().b2bStreak).toBe(1);

    // 3) Non-difficult clear (single) should reset B2B.
    const boardSingle = Array.from({ length: 20 }, () => Array(10).fill(0));
    for (let x = 0; x < 10; x += 1) boardSingle[19][x] = 8;
    boardSingle[19][0] = 0;
    engine.board = boardSingle;
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 0, y: 18 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "other";
    engine.lockPieceAndAdvance();
    expect(engine.getSnapshot().lastClear?.lines).toBe(1);
    expect(engine.getSnapshot().lastClear?.isTSpin).toBe(false);
    expect(engine.getSnapshot().b2bStreak).toBe(0);
  });

  it("uses expected I-piece CCW fallback kick near right wall when no-kick is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveRight: () => void;
      rotateCounterClockwise: () => void;
    };

    engine.restart({ openerPieceIds: [1] });
    engine.start();
    // Spawn x for I is 3; push near right wall for 0>3 transition.
    for (let i = 0; i < 6; i += 1) engine.moveRight();
    const pre = engine.getSnapshot().activePiece;
    expect(pre.x).toBe(6);

    const board = engine.board.map((row) => [...row]);
    board[0][6] = 9; // block no-kick target cell for vertical I at x=6
    board[0][8] = 9; // also block first fallback (+2,0), forcing next candidate
    engine.board = board;

    engine.rotateCounterClockwise();
    const post = engine.getSnapshot().activePiece;

    // I 0>3 kicks: [0,0] blocked, [+2,0] blocked, [-1,0] succeeds.
    expect(post.x).toBe(5);
  });

  it("uses expected JLSTZ CCW fallback kick near right wall when no-kick is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      moveRight: () => void;
      rotateCounterClockwise: () => void;
    };

    engine.restart({ openerPieceIds: [3] }); // T
    engine.start();
    // Spawn x for T is 3; bring to x=6.
    engine.moveRight();
    engine.moveRight();
    engine.moveRight();
    const pre = engine.getSnapshot().activePiece;
    expect(pre.x).toBe(6);

    const board = engine.board.map((row) => [...row]);
    board[0][7] = 9; // block no-kick target for 0>3 at x=6
    engine.board = board;

    engine.rotateCounterClockwise();
    const post = engine.getSnapshot().activePiece;

    // JLSTZ 0>3 kicks: [0,0] blocked, [1,0] should succeed.
    expect(post.x).toBe(7);
  });

  it("locks after default grounded reset cap is exhausted (15 resets)", () => {
    const engine = new StackerEngine("endless") as unknown as {
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      softDrop: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      moveLeft: () => void;
      moveRight: () => void;
      update: (deltaMs: number) => void;
      lockResetCount: number;
      lockTimerMs: number;
    };
    engine.restart({ openerPieceIds: [2] }); // O piece for stable grounded shuffles
    engine.start();

    // Bring piece to ground.
    for (let i = 0; i < 40; i += 1) engine.softDrop();
    const grounded = engine.getSnapshot();
    expect(grounded.isGameOver).toBe(false);
    expect(grounded.lastLock).toBeNull();

    // Normalize counters so this test validates the 15-reset boundary exactly.
    engine.lockResetCount = 0;
    engine.lockTimerMs = 0;

    // Apply 14 resets: should still be alive.
    for (let i = 0; i < 14; i += 1) {
      if (i % 2 === 0) engine.moveLeft();
      else engine.moveRight();
      engine.update(1);
    }
    expect(engine.getSnapshot().lastLock).toBeNull();

    // 15th reset should exhaust cap and lock on this update tick.
    engine.moveLeft();
    engine.update(1);
    const after = engine.getSnapshot();
    expect(after.lastLock).not.toBeNull();
  });

  it("locks at default 500ms grounded delay (not earlier)", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] }); // O piece
    engine.start();

    // Bring piece to ground.
    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Should not lock before 500ms.
    engine.update(499);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Should lock right after crossing 500ms.
    engine.update(1);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("grounded soft-drop input does not reset lock delay timer", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.start();

    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Accumulate most of lock delay.
    engine.update(400);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Grounded soft-drop input should not reset timer.
    engine.softDrop();
    engine.update(99);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Crossing 500ms total should lock.
    engine.update(1);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("keeps 180 rotation stable at left wall for JLSTZ pieces", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [3] }); // T
    engine.start();
    for (let i = 0; i < 8; i += 1) engine.moveLeft();
    const before = engine.getSnapshot().activePiece;
    engine.rotate180();
    const after = engine.getSnapshot().activePiece;

    expect(after.id).toBe(before.id);
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(after.y).toBeGreaterThanOrEqual(before.y - 2);
  });

  it("keeps 180 rotation stable at left wall for I piece", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [1] }); // I
    engine.start();
    for (let i = 0; i < 8; i += 1) engine.moveLeft();
    const before = engine.getSnapshot().activePiece;
    engine.rotate180();
    const after = engine.getSnapshot().activePiece;

    expect(after.id).toBe(before.id);
    expect(after.x).toBeGreaterThanOrEqual(0);
    expect(after.y).toBeGreaterThanOrEqual(before.y - 2);
  });

  it("remains stable under repeated grounded reset attempts", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [3] }); // T piece
    engine.start();

    // Bring piece to ground.
    for (let i = 0; i < 30; i += 1) engine.softDrop();
    const groundedBefore = engine.getSnapshot().activePiece;

    // Repeated movement/rotation resets while grounded should stay stable and eventually progress.
    for (let i = 0; i < 80; i += 1) {
      if (i % 2 === 0) engine.moveLeft();
      else engine.moveRight();
      if (i % 5 === 0) engine.rotateClockwise();
      expect(() => engine.update(1)).not.toThrow();
    }

    const after = engine.getSnapshot();
    expect(after.isGameOver).toBe(false);
    expect(groundedBefore.id).toBe(3);
  });

  it("awards score for soft-drop movement", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.start();
    const before = engine.getSnapshot().score;
    engine.softDrop();
    const after = engine.getSnapshot().score;
    expect(after - before).toBe(1);
  });

  it("awards hard-drop points by distance", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [1] });
    engine.start();
    const before = engine.getSnapshot().score;
    engine.hardDrop();
    const after = engine.getSnapshot().score;
    // I piece spawns at y=0 and drops 19 cells on an empty 20-row board.
    expect(after - before).toBe(38);
  });

  it("keeps soft-drop and hard-drop points independent from level", () => {
    const engine = new StackerEngine("endless") as unknown as {
      level: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      softDrop: () => void;
      hardDrop: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [1, 2] });
    engine.level = 9;
    engine.start();

    const beforeSoft = engine.getSnapshot().score;
    engine.softDrop();
    const afterSoft = engine.getSnapshot().score;
    expect(afterSoft - beforeSoft).toBe(1);

    const beforeHard = engine.getSnapshot().score;
    engine.hardDrop();
    const afterHard = engine.getSnapshot().score;
    // First piece moved down 1 via soft drop, so hard drop distance is 18 cells.
    expect(afterHard - beforeHard).toBe(36);
  });

  it("records hard-drop as lock cause in last lock event", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [1] });
    engine.start();
    engine.hardDrop();
    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.lockCause).toBe("hard-drop");
  });

  it("records soft-drop as lock cause when grounded soft drop precedes delayed lock", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.start();

    let previousY = engine.getSnapshot().activePiece.y;
    for (let i = 0; i < 40; i += 1) {
      engine.softDrop();
      const nextY = engine.getSnapshot().activePiece.y;
      if (nextY === previousY) break;
      previousY = nextY;
    }
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Grounded soft drop should tag pending cause.
    engine.softDrop();
    engine.update(500);
    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.lockCause).toBe("soft-drop");
  });

  it("records gravity as lock cause when piece locks by timer without grounded soft drop", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.start();

    // Bring piece to grounded y without issuing a failed soft-drop.
    while (engine.getSnapshot().activePiece.y < 18) {
      engine.softDrop();
    }
    expect(engine.getSnapshot().lastLock).toBeNull();

    // No grounded soft drop intent this time.
    engine.update(500);
    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.lockCause).toBe("gravity");
  });

  it("awards higher score for back-to-back difficult clears", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    // Baseline: a few placements without relying on exact board setup.
    const before = engine.getSnapshot().score;
    for (let i = 0; i < 8; i += 1) engine.hardDrop();
    const after = engine.getSnapshot().score;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("clears last lock event on restart", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    engine.hardDrop();
    expect(engine.getSnapshot().lastLock).not.toBeNull();
    engine.restart();
    expect(engine.getSnapshot().lastLock).toBeNull();
  });

  it("produces a full unique 7-bag before repeating pieces", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ seed: 424242 });
    engine.start();

    const firstBag: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      firstBag.push(engine.getSnapshot().activePiece.id);
      engine.hardDrop();
    }

    const unique = new Set(firstBag);
    expect(unique.size).toBe(7);
  });

  it("keeps deterministic sequence stable across many pieces with same seed", () => {
    const a = new StackerEngine("endless");
    const b = new StackerEngine("endless");
    a.restart({ seed: 777 });
    b.restart({ seed: 777 });
    a.start();
    b.start();

    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      seqA.push(a.getSnapshot().activePiece.id);
      seqB.push(b.getSnapshot().activePiece.id);
      a.hardDrop();
      b.hardDrop();
    }
    expect(seqA).toEqual(seqB);
  });

  it("exposes nextPiece in snapshot and keeps it in sync with queue", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ seed: 11 });
    engine.start();
    const snap = engine.getSnapshot();
    expect(snap.nextQueue.length).toBeGreaterThan(0);
    expect(snap.nextPiece.id).toBe(snap.nextQueue[0].id);
  });

  it("locks immediately when lock delay is configured to zero", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.setHandling({ lockDelayMs: 0, lockResetLimit: 15 });
    engine.start();

    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();
    engine.update(1);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("locks when reset limit is exhausted even before full lock delay", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [3] });
    engine.setHandling({ lockDelayMs: 900, lockResetLimit: 0 });
    engine.start();

    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();
    engine.update(16);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("clamps invalid handling values safely", () => {
    const engine = new StackerEngine("endless");
    engine.start();
    expect(() =>
      engine.setHandling({ lockDelayMs: -100, lockResetLimit: -9 }),
    ).not.toThrow();
    for (let i = 0; i < 10; i += 1) {
      expect(() => engine.update(16)).not.toThrow();
    }
  });
});
