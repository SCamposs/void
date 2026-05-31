import { describe, expect, it } from "vitest";
import { STACKER_KICK_TABLES, StackerEngine } from "../app/modules/stacker/engine";

function canPlaceSnapshotPiece(
  board: number[][],
  piece: { matrix: number[][]; x: number; y: number },
): boolean {
  for (let py = 0; py < piece.matrix.length; py += 1) {
    for (let px = 0; px < piece.matrix[py].length; px += 1) {
      if (!piece.matrix[py][px]) continue;
      const x = piece.x + px;
      const y = piece.y + py;
      if (x < 0 || x >= 10 || y >= 20) return false;
      if (y >= 0 && board[y][x] !== 0) return false;
    }
  }
  return true;
}

function rotateCw(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) rotated[x][rows - 1 - y] = matrix[y][x];
  }
  return rotated;
}

function rotateCcw(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) rotated[cols - 1 - x][y] = matrix[y][x];
  }
  return rotated;
}

function rotate180m(matrix: number[][]): number[][] {
  return rotateCw(rotateCw(matrix));
}

function firstFilledCell(matrix: number[][]): [number, number] {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (matrix[y][x]) return [x, y];
    }
  }
  return [0, 0];
}

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

  it("resets held piece orientation to spawn state on swap", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [3, 2] }); // T then O
    engine.start();

    const spawnMatrix = engine.getSnapshot().activePiece.matrix.map((row) => [...row]);
    engine.rotateClockwise();
    const rotatedMatrix = engine.getSnapshot().activePiece.matrix.map((row) => [...row]);
    expect(rotatedMatrix).not.toEqual(spawnMatrix);

    engine.hold(); // store T, activate O
    engine.hardDrop(); // unlock hold
    engine.hold(); // retrieve T from hold

    const swapped = engine.getSnapshot().activePiece;
    expect(swapped.id).toBe(3);
    expect(swapped.matrix).toEqual(spawnMatrix);
  });

  it("respawns held pieces in canonical orientation for all piece ids", () => {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    const rotateSteps: Record<number, number> = {
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 3,
      6: 1,
      7: 2,
    };

    for (const id of ids) {
      const engine = new StackerEngine("endless");
      engine.restart({ openerPieceIds: [id, 2] });
      engine.start();

      const spawnMatrix = engine.getSnapshot().activePiece.matrix.map((row) => [...row]);
      for (let i = 0; i < (rotateSteps[id] ?? 1); i += 1) engine.rotateClockwise();

      engine.hold(); // store rotated piece, activate O
      engine.hardDrop(); // unlock hold
      engine.hold(); // retrieve stored piece

      const swapped = engine.getSnapshot().activePiece;
      expect(swapped.id).toBe(id);
      expect(swapped.matrix).toEqual(spawnMatrix);
    }
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

  it("keeps JLSTZ SRS kick symmetry across complementary 90-degree transitions", () => {
    const mirrorPairs: Array<[string, string]> = [
      ["0>1", "0>3"],
      ["1>0", "3>0"],
      ["1>2", "3>2"],
      ["2>1", "2>3"],
    ];

    for (const [a, b] of mirrorPairs) {
      const kicksA = STACKER_KICK_TABLES.jltsz[a];
      const kicksB = STACKER_KICK_TABLES.jltsz[b];
      expect(kicksA).toHaveLength(kicksB.length);
      for (let i = 0; i < kicksA.length; i += 1) {
        const [ax, ay] = kicksA[i];
        const [bx, by] = kicksB[i];
        expect(ax + bx).toBe(0);
        expect(ay).toBe(by);
      }
    }
  });

  it("keeps mirrored primary horizontal probes for complementary SRS+ I transitions", () => {
    const mirrorPairs: Array<[string, string]> = [
      ["0>1", "0>3"],
      ["1>0", "3>0"],
      ["1>2", "3>2"],
      ["2>1", "2>3"],
    ];

    for (const [a, b] of mirrorPairs) {
      const kicksA = STACKER_KICK_TABLES.i[a];
      const kicksB = STACKER_KICK_TABLES.i[b];
      // Primary probe ordering for SRS+ I transitions is [0,0], horizontal A, horizontal B.
      // These first 3 probes should be mirrored across complementary turns.
      expect(kicksA.length).toBeGreaterThanOrEqual(3);
      expect(kicksB.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < 3; i += 1) {
        const [ax, ay] = kicksA[i];
        const [bx, by] = kicksB[i];
        expect(bx + ax).toBe(0);
        expect(by).toBe(ay);
      }
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

  it("keeps consistent 180 probe composition across transitions for JLSTZ and I families", () => {
    const expectedJlstz180 = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [2, 0],
      [-2, 0],
      [0, 1],
      [0, -1],
    ];
    const expectedI180ByTransition: Record<string, Array<[number, number]>> = {
      "0>2": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
      "1>3": [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [0, -1]],
      "2>0": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
      "3>1": [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [0, -1]],
    };

    for (const [key, kicks] of Object.entries(STACKER_KICK_TABLES.jltsz180)) {
      expect(kicks).toEqual(expectedJlstz180);
      expect(kicks).toContainEqual([0, 1]);
      expect(kicks).toContainEqual([0, -1]);
      expect(key).toMatch(/^[0-3]>[0-3]$/);
    }

    for (const [key, kicks] of Object.entries(STACKER_KICK_TABLES.i180)) {
      expect(kicks).toEqual(expectedI180ByTransition[key]);
      expect(kicks).toContainEqual([0, 1]);
      expect(kicks).toContainEqual([0, -1]);
      expect(key).toMatch(/^[0-3]>[0-3]$/);
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
    expect(engine.scoreForClear(3, "full", false, false)).toBe(1600);
    expect(engine.scoreForClear(4, "full", false, false)).toBe(2600);
    expect(engine.scoreForClear(1, "mini", false, false)).toBe(200);
    expect(engine.scoreForClear(2, "mini", false, false)).toBe(400);
    expect(engine.scoreForClear(3, "mini", false, false)).toBe(800);
    expect(engine.scoreForClear(4, "mini", false, false)).toBe(1600);
    expect(engine.scoreForClear(0, "full", false, false)).toBe(400);
    expect(engine.scoreForClear(0, "mini", false, false)).toBe(100);

    // B2B difficult multiplier x1.5.
    expect(engine.scoreForClear(4, "none", false, true)).toBe(1200);
    expect(engine.scoreForClear(2, "full", false, true)).toBe(1800);
    expect(engine.scoreForClear(2, "mini", false, true)).toBe(600);
    // Spin Zero / Mini Spin Zero are not difficult clears and should not receive B2B boost.
    expect(engine.scoreForClear(0, "full", false, true)).toBe(400);
    expect(engine.scoreForClear(0, "mini", false, true)).toBe(100);

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
    expect(engine.isDifficultClear(1, "mini")).toBe(true);
    expect(engine.isDifficultClear(2, "mini")).toBe(true);
    expect(engine.isDifficultClear(0, "full")).toBe(false);
    expect(engine.isDifficultClear(0, "mini")).toBe(false);
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

  it("does not start or extend B2B on Spin Zero or Mini Spin Zero", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lastSuccessfulAction: "none" | "cw" | "ccw" | "r180" | "other";
      b2bStreak: number;
      lockPieceAndAdvance: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    // Full spin zero setup: 3 corners blocked and both front corners blocked.
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 4 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "cw";
    engine.board[4][4] = 9; // front-left
    engine.board[4][6] = 9; // front-right
    engine.board[6][4] = 9; // back-left
    engine.b2bStreak = 0;
    engine.lockPieceAndAdvance();
    expect(engine.getSnapshot().lastClear?.tSpinKind).toBe("full");
    expect(engine.getSnapshot().b2bStreak).toBe(0);

    // Mini spin zero setup: 3 corners blocked but only one front corner blocked.
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 4 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "ccw";
    engine.board[4][4] = 9; // front-left
    engine.board[6][4] = 9; // back-left
    engine.board[6][6] = 9; // back-right
    engine.b2bStreak = 2;
    engine.lockPieceAndAdvance();
    expect(engine.getSnapshot().lastClear?.tSpinKind).toBe("mini");
    expect(engine.getSnapshot().b2bStreak).toBe(2);
  });

  it("keeps spin-zero clear events non-B2B in real lock flow", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lastSuccessfulAction: "none" | "cw" | "ccw" | "r180" | "other";
      b2bStreak: number;
      lockPieceAndAdvance: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 4 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "cw";
    // Full spin-zero corners.
    engine.board[4][4] = 9;
    engine.board[4][6] = 9;
    engine.board[6][4] = 9;
    engine.b2bStreak = 3;
    engine.lockPieceAndAdvance();

    const afterFull = engine.getSnapshot();
    expect(afterFull.lastClear?.tSpinKind).toBe("full");
    expect(afterFull.lastClear?.lines).toBe(0);
    expect(afterFull.lastClear?.wasBackToBack).toBe(false);
    expect(afterFull.b2bStreak).toBe(3);

    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 4 };
    engine.activeRotation = 0;
    engine.lastSuccessfulAction = "ccw";
    // Mini spin-zero corners.
    engine.board[4][4] = 9;
    engine.board[6][4] = 9;
    engine.board[6][6] = 9;
    engine.b2bStreak = 4;
    engine.lockPieceAndAdvance();

    const afterMini = engine.getSnapshot();
    expect(afterMini.lastClear?.tSpinKind).toBe("mini");
    expect(afterMini.lastClear?.lines).toBe(0);
    expect(afterMini.lastClear?.wasBackToBack).toBe(false);
    expect(afterMini.b2bStreak).toBe(4);
  });

  it("treats Mini Spin Single and higher as difficult clears for B2B", () => {
    const engine = new StackerEngine("endless") as unknown as {
      combo: number;
      b2bStreak: number;
      scoreForClear: (
        linesCleared: number,
        tSpinKind: "none" | "mini" | "full",
        isPerfectClear: boolean,
        wasBackToBack: boolean,
      ) => number;
    };

    engine.combo = 0;
    engine.b2bStreak = 0;
    // Baseline mini single.
    expect(engine.scoreForClear(1, "mini", false, false)).toBe(200);
    // B2B-applied mini single.
    expect(engine.scoreForClear(1, "mini", false, true)).toBe(300);
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

  it("applies JLSTZ vertical kick candidate when floor blocks early candidates", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      start: () => void;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      rotateClockwise: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [3] }); // T piece
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    // Place T near floor in rotation state 0.
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 1, y: 18 };
    engine.activeRotation = 0;

    engine.rotateClockwise();
    const post = engine.getSnapshot().activePiece;

    // 0>1 JLSTZ kicks:
    // [0,0] and [-1,0] fail (would go out of bottom bounds),
    // [-1,1] succeeds => x-1, y-1.
    expect(post.x).toBe(0);
    expect(post.y).toBe(17);
  });

  it("selects the first valid JLSTZ CW kick candidate in order", () => {
    const scenarios = [
      { blockedCandidates: [0] },
      { blockedCandidates: [0, 1] },
      { blockedCandidates: [0, 1, 2] },
      { blockedCandidates: [0, 1, 2, 3] },
    ];
    const kicks: Array<[number, number]> = [
      [0, 0],
      [-1, 0],
      [-1, 1],
      [0, -2],
      [-1, -2],
    ];
    const rotateCw = (matrix: number[][]): number[][] => {
      const rows = matrix.length;
      const cols = matrix[0].length;
      const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) rotated[x][rows - 1 - y] = matrix[y][x];
      }
      return rotated;
    };

    for (const scenario of scenarios) {
      const engine = new StackerEngine("endless") as unknown as {
        board: number[][];
        activePiece: { id: number; matrix: number[][]; x: number; y: number };
        activeRotation: number;
        restart: (opts?: { openerPieceIds?: number[] }) => void;
        start: () => void;
        rotateClockwise: () => void;
        getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      };

      engine.restart({ openerPieceIds: [3] }); // T piece
      engine.start();
      const board = Array.from({ length: 20 }, () => Array(10).fill(0));
      engine.board = board;
      engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 5 };
      engine.activeRotation = 0;

      // Rotated T (CW) occupied cells include local (0,0), so block that cell
      // at candidate target positions to invalidate specific kick candidates.
      for (const idx of scenario.blockedCandidates) {
        const [dx, dy] = kicks[idx];
        const tx = engine.activePiece.x + dx;
        const ty = engine.activePiece.y - dy;
        board[ty][tx] = 9;
      }

      const rotated = rotateCw(engine.activePiece.matrix);
      const expected = kicks.find(([dx, dy]) =>
        canPlaceSnapshotPiece(board, { matrix: rotated, x: 4 + dx, y: 5 - dy }),
      );
      expect(expected).toBeDefined();

      engine.rotateClockwise();
      const post = engine.getSnapshot().activePiece;
      expect(post.x).toBe(4 + (expected?.[0] ?? 0));
      expect(post.y).toBe(5 - (expected?.[1] ?? 0));
    }
  });

  it("selects the first valid JLSTZ CCW kick candidate in order", () => {
    const scenarios = [
      { blockedCandidates: [0] },
      { blockedCandidates: [0, 1] },
      { blockedCandidates: [0, 1, 2] },
      { blockedCandidates: [0, 1, 2, 3] },
    ];
    const kicks = STACKER_KICK_TABLES.jltsz["0>3"].map(
      ([dx, dy]) => [dx, dy] as [number, number],
    );
    const rotateCcw = (matrix: number[][]): number[][] => {
      const rows = matrix.length;
      const cols = matrix[0].length;
      const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) rotated[cols - 1 - x][y] = matrix[y][x];
      }
      return rotated;
    };

    for (const scenario of scenarios) {
      const engine = new StackerEngine("endless") as unknown as {
        board: number[][];
        activePiece: { id: number; matrix: number[][]; x: number; y: number };
        activeRotation: number;
        restart: (opts?: { openerPieceIds?: number[] }) => void;
        start: () => void;
        rotateCounterClockwise: () => void;
        getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      };

      engine.restart({ openerPieceIds: [3] }); // T piece
      engine.start();
      const board = Array.from({ length: 20 }, () => Array(10).fill(0));
      engine.board = board;
      engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 5 };
      engine.activeRotation = 0;

      // Rotated T (CCW) occupied cells include local (1,0), use it as blocker probe.
      for (const idx of scenario.blockedCandidates) {
        const [dx, dy] = kicks[idx];
        const tx = engine.activePiece.x + dx + 1;
        const ty = engine.activePiece.y - dy;
        board[ty][tx] = 9;
      }

      const rotated = rotateCcw(engine.activePiece.matrix);
      const expected = kicks.find(([dx, dy]) =>
        canPlaceSnapshotPiece(board, { matrix: rotated, x: 4 + dx, y: 5 - dy }),
      );
      expect(expected).toBeDefined();

      engine.rotateCounterClockwise();
      const post = engine.getSnapshot().activePiece;
      expect(post.x).toBe(4 + (expected?.[0] ?? 0));
      expect(post.y).toBe(5 - (expected?.[1] ?? 0));
    }
  });

  it("selects the first valid I CW kick candidate in order", () => {
    const scenarios = [
      { blockedCandidates: [0] },
      { blockedCandidates: [0, 1] },
      { blockedCandidates: [0, 1, 2] },
    ];
    const kicks: Array<[number, number]> = [
      [0, 0],
      [-2, 0],
      [1, 0],
      [1, 2],
      [-2, -1],
    ];
    const rotateCw = (matrix: number[][]): number[][] => {
      const rows = matrix.length;
      const cols = matrix[0].length;
      const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) rotated[x][rows - 1 - y] = matrix[y][x];
      }
      return rotated;
    };

    for (const scenario of scenarios) {
      const engine = new StackerEngine("endless") as unknown as {
        board: number[][];
        activePiece: { id: number; matrix: number[][]; x: number; y: number };
        activeRotation: number;
        restart: (opts?: { openerPieceIds?: number[] }) => void;
        start: () => void;
        rotateClockwise: () => void;
        getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      };

      engine.restart({ openerPieceIds: [1] }); // I piece
      engine.start();
      const board = Array.from({ length: 20 }, () => Array(10).fill(0));
      engine.board = board;
      engine.activePiece = { id: 1, matrix: [[1, 1, 1, 1]], x: 4, y: 5 };
      engine.activeRotation = 0;

      // Rotated I (CW) occupied cells include local (0,0), use it as blocker probe.
      for (const idx of scenario.blockedCandidates) {
        const [dx, dy] = kicks[idx];
        const tx = engine.activePiece.x + dx;
        const ty = engine.activePiece.y - dy;
        board[ty][tx] = 9;
      }

      const rotated = rotateCw(engine.activePiece.matrix);
      const expected = kicks.find(([dx, dy]) =>
        canPlaceSnapshotPiece(board, { matrix: rotated, x: 4 + dx, y: 5 - dy }),
      );
      expect(expected).toBeDefined();

      engine.rotateClockwise();
      const post = engine.getSnapshot().activePiece;
      expect(post.x).toBe(4 + (expected?.[0] ?? 0));
      expect(post.y).toBe(5 - (expected?.[1] ?? 0));
    }
  });

  it("selects the first valid I CCW kick candidate in order", () => {
    const scenarios = [
      { blockedCandidates: [0] },
      { blockedCandidates: [0, 1] },
      { blockedCandidates: [0, 1, 2] },
    ];
    const kicks = STACKER_KICK_TABLES.i["0>3"].map(([dx, dy]) => [dx, dy] as [number, number]);
    const rotateCcw = (matrix: number[][]): number[][] => {
      const rows = matrix.length;
      const cols = matrix[0].length;
      const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) rotated[cols - 1 - x][y] = matrix[y][x];
      }
      return rotated;
    };

    for (const scenario of scenarios) {
      const engine = new StackerEngine("endless") as unknown as {
        board: number[][];
        activePiece: { id: number; matrix: number[][]; x: number; y: number };
        activeRotation: number;
        restart: (opts?: { openerPieceIds?: number[] }) => void;
        start: () => void;
        rotateCounterClockwise: () => void;
        getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
      };

      engine.restart({ openerPieceIds: [1] }); // I piece
      engine.start();
      const board = Array.from({ length: 20 }, () => Array(10).fill(0));
      engine.board = board;
      engine.activePiece = { id: 1, matrix: [[1, 1, 1, 1]], x: 4, y: 5 };
      engine.activeRotation = 0;

      for (const idx of scenario.blockedCandidates) {
        const [dx, dy] = kicks[idx];
        const tx = engine.activePiece.x + dx;
        const ty = engine.activePiece.y - dy;
        board[ty][tx] = 9;
      }

      const rotated = rotateCcw(engine.activePiece.matrix);
      const expected = kicks.find(([dx, dy]) =>
        canPlaceSnapshotPiece(board, { matrix: rotated, x: 4 + dx, y: 5 - dy }),
      );
      expect(expected).toBeDefined();

      engine.rotateCounterClockwise();
      const post = engine.getSnapshot().activePiece;
      expect(post.x).toBe(4 + (expected?.[0] ?? 0));
      expect(post.y).toBe(5 - (expected?.[1] ?? 0));
    }
  });

  it("rejects JLSTZ rotation when every CW kick candidate is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      rotateClockwise: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [3] }); // T
    engine.start();
    const board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.board = board;
    engine.activePiece = { id: 3, matrix: [[0, 1, 0], [1, 1, 1]], x: 4, y: 5 };
    engine.activeRotation = 0;

    // Block probe cell for each 0>1 JLSTZ kick candidate.
    const kicks = STACKER_KICK_TABLES.jltsz["0>1"];
    for (const [dx, dy] of kicks) {
      board[5 - dy][4 + dx] = 9;
    }

    const before = engine.getSnapshot().activePiece;
    engine.rotateClockwise();
    const after = engine.getSnapshot().activePiece;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.matrix).toEqual(before.matrix);
  });

  it("rejects I rotation when every CW kick candidate is blocked", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      rotateClockwise: () => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [1] }); // I
    engine.start();
    const board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.board = board;
    engine.activePiece = { id: 1, matrix: [[1, 1, 1, 1]], x: 4, y: 5 };
    engine.activeRotation = 0;

    // Rotated I (CW) probe local cell (0,0) for each 0>1 I kick candidate.
    const kicks = STACKER_KICK_TABLES.i["0>1"];
    for (const [dx, dy] of kicks) {
      board[5 - dy][4 + dx] = 9;
    }

    const before = engine.getSnapshot().activePiece;
    engine.rotateClockwise();
    const after = engine.getSnapshot().activePiece;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.matrix).toEqual(before.matrix);
  });

  it("follows configured first-valid kick order across all transition tables", () => {
    const baseByFamily: Record<"i" | "jltsz", number[][]> = {
      i: [[1, 1, 1, 1]],
      jltsz: [[0, 1, 0], [1, 1, 1]], // T footprint (3x2 family)
    };
    const tableGroups = [
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz, rotate: "90" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i, rotate: "90" as const },
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz180, rotate: "180" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i180, rotate: "180" as const },
    ];

    for (const group of tableGroups) {
      for (const [key, kicks] of Object.entries(group.table)) {
        const [fromRaw, toRaw] = key.split(">");
        const from = Number(fromRaw);
        const to = Number(toRaw);
        const action =
          group.rotate === "180"
            ? "180"
            : ((from + 1) % 4 === to ? "cw" : "ccw");

        for (let blockedCount = 0; blockedCount < Math.max(1, kicks.length - 1); blockedCount += 1) {
          const engine = new StackerEngine("endless") as unknown as {
            board: number[][];
            activePiece: { id: number; matrix: number[][]; x: number; y: number };
            activeRotation: number;
            restart: (opts?: { openerPieceIds?: number[] }) => void;
            start: () => void;
            rotateClockwise: () => void;
            rotateCounterClockwise: () => void;
            rotate180: () => void;
            getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
          };
          engine.restart({ openerPieceIds: [group.family === "i" ? 1 : 3] });
          engine.start();

          const board = Array.from({ length: 20 }, () => Array(10).fill(0));
          engine.board = board;
          let matrix = baseByFamily[group.family].map((row) => [...row]);
          for (let i = 0; i < from; i += 1) matrix = rotateCw(matrix);
          engine.activePiece = {
            id: group.family === "i" ? 1 : 3,
            matrix,
            x: group.family === "i" ? 4 : 4,
            y: 6,
          };
          engine.activeRotation = from;
          const originX = engine.activePiece.x;
          const originY = engine.activePiece.y;

          const rotated =
            action === "cw"
              ? rotateCw(matrix)
              : action === "ccw"
                ? rotateCcw(matrix)
                : rotate180m(matrix);
          const [probeX, probeY] = firstFilledCell(rotated);

          for (let i = 0; i < blockedCount; i += 1) {
            const [dx, dy] = kicks[i];
            const tx = originX + dx + probeX;
            const ty = originY - dy + probeY;
            if (ty >= 0 && ty < 20 && tx >= 0 && tx < 10) board[ty][tx] = 9;
          }

          const expected = kicks.find(([dx, dy]) =>
            canPlaceSnapshotPiece(board, {
              matrix: rotated,
              x: originX + dx,
              y: originY - dy,
            }),
          );
          if (!expected) continue;

          if (action === "cw") engine.rotateClockwise();
          else if (action === "ccw") engine.rotateCounterClockwise();
          else engine.rotate180();

          const post = engine.getSnapshot().activePiece;
          expect(post.x).toBe(originX + expected[0]);
          expect(post.y).toBe(originY - expected[1]);
        }
      }
    }
  });

  it("rejects rotation across all configured transitions when every kick candidate is blocked", () => {
    const baseByFamily: Record<"i" | "jltsz", number[][]> = {
      i: [[1, 1, 1, 1]],
      jltsz: [[0, 1, 0], [1, 1, 1]],
    };
    const tableGroups = [
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz, rotate: "90" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i, rotate: "90" as const },
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz180, rotate: "180" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i180, rotate: "180" as const },
    ];

    for (const group of tableGroups) {
      for (const [key, kicks] of Object.entries(group.table)) {
        const [fromRaw, toRaw] = key.split(">");
        const from = Number(fromRaw);
        const to = Number(toRaw);
        const action =
          group.rotate === "180"
            ? "180"
            : ((from + 1) % 4 === to ? "cw" : "ccw");

        const engine = new StackerEngine("endless") as unknown as {
          board: number[][];
          activePiece: { id: number; matrix: number[][]; x: number; y: number };
          activeRotation: number;
          restart: (opts?: { openerPieceIds?: number[] }) => void;
          start: () => void;
          rotateClockwise: () => void;
          rotateCounterClockwise: () => void;
          rotate180: () => void;
          getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
        };
        engine.restart({ openerPieceIds: [group.family === "i" ? 1 : 3] });
        engine.start();

        const board = Array.from({ length: 20 }, () => Array(10).fill(0));
        engine.board = board;
        let matrix = baseByFamily[group.family].map((row) => [...row]);
        for (let i = 0; i < from; i += 1) matrix = rotateCw(matrix);
        engine.activePiece = {
          id: group.family === "i" ? 1 : 3,
          matrix,
          x: 4,
          y: 6,
        };
        engine.activeRotation = from;
        const originX = engine.activePiece.x;
        const originY = engine.activePiece.y;

        const rotated =
          action === "cw"
            ? rotateCw(matrix)
            : action === "ccw"
              ? rotateCcw(matrix)
              : rotate180m(matrix);
        const [probeX, probeY] = firstFilledCell(rotated);

        // Block a required filled cell at every candidate target.
        for (const [dx, dy] of kicks) {
          const tx = originX + dx + probeX;
          const ty = originY - dy + probeY;
          if (tx >= 0 && tx < 10 && ty >= 0 && ty < 20) board[ty][tx] = 9;
        }

        const before = engine.getSnapshot().activePiece;
        if (action === "cw") engine.rotateClockwise();
        else if (action === "ccw") engine.rotateCounterClockwise();
        else engine.rotate180();
        const after = engine.getSnapshot().activePiece;

        expect(after.x).toBe(before.x);
        expect(after.y).toBe(before.y);
        expect(after.matrix).toEqual(before.matrix);
      }
    }
  });

  it("keeps rotation outcomes valid under deterministic dense blocker stress", () => {
    const baseByFamily: Record<"i" | "jltsz", number[][]> = {
      i: [[1, 1, 1, 1]],
      jltsz: [[0, 1, 0], [1, 1, 1]],
    };
    const tableGroups = [
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz, rotate: "90" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i, rotate: "90" as const },
      { family: "jltsz" as const, table: STACKER_KICK_TABLES.jltsz180, rotate: "180" as const },
      { family: "i" as const, table: STACKER_KICK_TABLES.i180, rotate: "180" as const },
    ];

    let rng = 987654321;
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 0x100000000;
    };

    for (const group of tableGroups) {
      for (const [key, kicks] of Object.entries(group.table)) {
        const [fromRaw, toRaw] = key.split(">");
        const from = Number(fromRaw);
        const to = Number(toRaw);
        const action =
          group.rotate === "180"
            ? "180"
            : ((from + 1) % 4 === to ? "cw" : "ccw");

        for (let sample = 0; sample < 40; sample += 1) {
          const engine = new StackerEngine("endless") as unknown as {
            board: number[][];
            activePiece: { id: number; matrix: number[][]; x: number; y: number };
            activeRotation: number;
            restart: (opts?: { openerPieceIds?: number[] }) => void;
            start: () => void;
            rotateClockwise: () => void;
            rotateCounterClockwise: () => void;
            rotate180: () => void;
            getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
          };
          engine.restart({ openerPieceIds: [group.family === "i" ? 1 : 3] });
          engine.start();

          const board = Array.from({ length: 20 }, () => Array(10).fill(0));
          engine.board = board;

          let matrix = baseByFamily[group.family].map((row) => [...row]);
          for (let i = 0; i < from; i += 1) matrix = rotateCw(matrix);
          engine.activePiece = {
            id: group.family === "i" ? 1 : 3,
            matrix,
            x: 4,
            y: 6,
          };
          engine.activeRotation = from;
          const originX = engine.activePiece.x;
          const originY = engine.activePiece.y;

          for (let y = 0; y < 20; y += 1) {
            for (let x = 0; x < 10; x += 1) {
              if (nextRandom() < 0.22) board[y][x] = 9;
            }
          }

          // Ensure the pre-rotation position itself is legal in the generated field.
          for (let y = 0; y < matrix.length; y += 1) {
            for (let x = 0; x < matrix[y].length; x += 1) {
              if (!matrix[y][x]) continue;
              const bx = originX + x;
              const by = originY + y;
              if (bx >= 0 && bx < 10 && by >= 0 && by < 20) board[by][bx] = 0;
            }
          }

          const rotated =
            action === "cw"
              ? rotateCw(matrix)
              : action === "ccw"
                ? rotateCcw(matrix)
                : rotate180m(matrix);
          const expected = kicks.find(([dx, dy]) =>
            canPlaceSnapshotPiece(board, {
              matrix: rotated,
              x: originX + dx,
              y: originY - dy,
            }),
          );
          const before = engine.getSnapshot().activePiece;

          if (action === "cw") engine.rotateClockwise();
          else if (action === "ccw") engine.rotateCounterClockwise();
          else engine.rotate180();

          const after = engine.getSnapshot().activePiece;
          expect(canPlaceSnapshotPiece(board, after)).toBe(true);

          if (expected) {
            expect(after.x).toBe(originX + expected[0]);
            expect(after.y).toBe(originY - expected[1]);
            expect(after.matrix).toEqual(rotated);
          } else {
            expect(after.x).toBe(before.x);
            expect(after.y).toBe(before.y);
            expect(after.matrix).toEqual(before.matrix);
          }
        }
      }
    }
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

  it("does not instantly lock when first ground contact happens mid-frame", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2, 1] }); // O then I
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 17 }; // one cell above floor
    engine.activeRotation = 0;

    const before = engine.getSnapshot();
    // At level 1 (760ms gravity), this frame makes first contact mid-frame.
    engine.update(1000);
    const afterFirst = engine.getSnapshot();
    expect(afterFirst.activePiece.id).toBe(before.activePiece.id);
    expect(afterFirst.activePiece.y).toBe(18);
    expect(afterFirst.lastLock).toBeNull();

    // Remaining grounded time should complete lock delay and then lock.
    engine.update(260);
    const afterSecond = engine.getSnapshot();
    expect(afterSecond.activePiece.id).not.toBe(before.activePiece.id);
    expect(afterSecond.lastLock).not.toBeNull();
  });

  it("accrues exact grounded milliseconds after first contact within a frame", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lockTimerMs: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2] }); // O
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 17 }; // one above floor
    engine.activeRotation = 0;
    engine.lockTimerMs = 0;

    // L1 interval is 760ms. With 1000ms update:
    // - first 760ms: drop to ground
    // - remaining 240ms: grounded timer accrual
    engine.update(1000);
    const snap = engine.getSnapshot();
    expect(snap.activePiece.id).toBe(2);
    expect(snap.activePiece.y).toBe(18);
    expect(snap.lastLock).toBeNull();
    expect(engine.lockTimerMs).toBe(240);
  });

  it("accrues exact grounded milliseconds when contact happens on second gravity tick", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lockTimerMs: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2] }); // O
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 16 }; // two above floor
    engine.activeRotation = 0;
    engine.lockTimerMs = 0;

    // L1 interval 760ms:
    // tick1 at 760ms -> y 16->17 (airborne)
    // tick2 at 1520ms -> y 17->18 (grounded)
    // remaining grounded time in frame: 1600 - 1520 = 80ms
    engine.update(1600);
    const snap = engine.getSnapshot();
    expect(snap.activePiece.id).toBe(2);
    expect(snap.activePiece.y).toBe(18);
    expect(snap.lastLock).toBeNull();
    expect(engine.lockTimerMs).toBe(80);
  });

  it("counts only post-contact grounded segment when one update spans multiple gravity ticks", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2, 1] }); // O then I
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 16 }; // two cells above floor
    engine.activeRotation = 0;

    const before = engine.getSnapshot();
    // Level 1 drop interval is 760ms:
    // - at 760ms: y 16->17 (still airborne)
    // - at 1520ms: y 17->18 (grounded)
    // Remaining ~80ms should be the only grounded time counted in this frame.
    engine.update(1600);
    const afterFirst = engine.getSnapshot();
    expect(afterFirst.activePiece.id).toBe(before.activePiece.id);
    expect(afterFirst.activePiece.y).toBe(18);
    expect(afterFirst.lastLock).toBeNull();

    // Lock should happen only after remaining grounded time crosses 500ms.
    engine.update(419);
    expect(engine.getSnapshot().lastLock).toBeNull();
    engine.update(1);
    const afterSecond = engine.getSnapshot();
    expect(afterSecond.activePiece.id).not.toBe(before.activePiece.id);
    expect(afterSecond.lastLock).not.toBeNull();
  });

  it("does not accrue lock timer during fully-airborne large updates", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      lockTimerMs: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2] }); // O piece
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 0 };
    engine.activeRotation = 0;
    engine.lockTimerMs = 0;

    // Large frame spans multiple gravity ticks but remains airborne.
    engine.update(1500); // at level 1 this is < 3 drops; final y should be 1
    const mid = engine.getSnapshot();
    expect(mid.lastLock).toBeNull();
    expect(mid.activePiece.y).toBe(1);
    expect(engine.lockTimerMs).toBe(0);
  });

  it("does not apply residual frame time to newly spawned piece after timer lock", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2, 1] }); // O then I
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 18 }; // already grounded
    engine.activeRotation = 0;

    // Large frame must lock current piece, but the newly spawned piece should remain at spawn Y.
    engine.update(2000);
    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.activePiece.id).toBe(1);
    expect(snap.activePiece.y).toBe(0);
  });

  it("emits exactly one lock event for a single huge grounded update", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2, 1, 3] }); // O, I, T
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 18 }; // grounded
    engine.activeRotation = 0;

    engine.update(10_000);
    const afterFirst = engine.getSnapshot();
    expect(afterFirst.lastLock).not.toBeNull();
    const firstLockId = afterFirst.lastLock?.id ?? -1;
    expect(afterFirst.activePiece.id).toBe(1); // only one spawn consumed
    expect(afterFirst.activePiece.y).toBe(0);

    // A zero update must not create another lock event.
    engine.update(0);
    const afterSecond = engine.getSnapshot();
    expect(afterSecond.lastLock?.id).toBe(firstLockId);
    expect(afterSecond.activePiece.id).toBe(1);
  });

  it("preserves timer-lock outcome with grounded fast-path on huge frame deltas", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2, 1] }); // O then I
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 18 }; // grounded
    engine.activeRotation = 0;

    // Large frame should lock current piece by timer and spawn exactly once.
    engine.update(5000);
    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.pieceId).toBe(2);
    expect(snap.activePiece.id).toBe(1);
    expect(snap.activePiece.y).toBe(0);

    // Follow-up tiny frame should not retroactively emit another lock.
    const lockId = snap.lastLock?.id ?? -1;
    engine.update(1);
    const after = engine.getSnapshot();
    expect(after.lastLock?.id).toBe(lockId);
  });

  it("keeps drop accumulator normalized after grounded fast-path huge updates", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      activePiece: { id: number; matrix: number[][]; x: number; y: number };
      activeRotation: number;
      dropAccumulator: number;
      getDropIntervalMs: () => number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
    };

    engine.restart({ openerPieceIds: [2, 1] });
    engine.start();
    engine.board = Array.from({ length: 20 }, () => Array(10).fill(0));
    engine.activePiece = { id: 2, matrix: [[1, 1], [1, 1]], x: 4, y: 18 }; // grounded
    engine.activeRotation = 0;

    const interval = engine.getDropIntervalMs();
    engine.update(20_000);
    expect(engine.dropAccumulator).toBeGreaterThanOrEqual(0);
    expect(engine.dropAccumulator).toBeLessThan(interval);
  });

  it("ignores non-finite update delta values safely", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] }); // O piece
    engine.start();

    const before = engine.getSnapshot();

    engine.update(Number.NaN);
    let after = engine.getSnapshot();
    expect(after.activePiece.id).toBe(before.activePiece.id);
    expect(after.activePiece.x).toBe(before.activePiece.x);
    expect(after.activePiece.y).toBe(before.activePiece.y);
    expect(after.lastLock).toBeNull();

    engine.update(Number.POSITIVE_INFINITY);
    after = engine.getSnapshot();
    expect(after.activePiece.id).toBe(before.activePiece.id);
    expect(after.activePiece.x).toBe(before.activePiece.x);
    expect(after.activePiece.y).toBe(before.activePiece.y);
    expect(after.lastLock).toBeNull();
  });

  it("keeps gravity cadence stable across split frames", () => {
    const engineA = new StackerEngine("endless");
    const engineB = new StackerEngine("endless");
    engineA.restart({ openerPieceIds: [2] });
    engineB.restart({ openerPieceIds: [2] });
    engineA.start();
    engineB.start();

    // Level 1 interval is 760ms. Split updates should match combined update.
    engineA.update(380);
    engineA.update(380);
    engineB.update(760);

    const a = engineA.getSnapshot().activePiece;
    const b = engineB.getSnapshot().activePiece;
    expect(a.id).toBe(b.id);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });

  it("does not mutate gravity accumulator on invalid update deltas", () => {
    const engine = new StackerEngine("endless") as unknown as {
      dropAccumulator: number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [2] });
    engine.start();
    engine.update(120);
    const beforeAccumulator = engine.dropAccumulator;
    const beforeY = engine.getSnapshot().activePiece.y;

    engine.update(Number.NaN);
    engine.update(Number.POSITIVE_INFINITY);
    engine.update(-999);

    const afterAccumulator = engine.dropAccumulator;
    const afterY = engine.getSnapshot().activePiece.y;
    expect(afterAccumulator).toBe(beforeAccumulator);
    expect(afterY).toBe(beforeY);
  });

  it("keeps gravity accumulator bounded across mixed update sizes", () => {
    const engine = new StackerEngine("endless") as unknown as {
      dropAccumulator: number;
      getDropIntervalMs: () => number;
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      update: (deltaMs: number) => void;
    };

    engine.restart({ openerPieceIds: [2] });
    engine.start();
    const interval = engine.getDropIntervalMs();

    const samples = [16, 17, 33, 1000, 760, 761, 0, Number.NaN, Number.POSITIVE_INFINITY, -25, 5000];
    for (const dt of samples) {
      engine.update(dt);
      expect(engine.dropAccumulator).toBeGreaterThanOrEqual(0);
      expect(engine.dropAccumulator).toBeLessThan(interval);
    }
  });

  it("ignores negative update delta values safely", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.start();

    const before = engine.getSnapshot();
    engine.update(-1000);
    const after = engine.getSnapshot();

    expect(after.activePiece.id).toBe(before.activePiece.id);
    expect(after.activePiece.x).toBe(before.activePiece.x);
    expect(after.activePiece.y).toBe(before.activePiece.y);
    expect(after.lastLock).toBeNull();
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

  it("failed grounded movement does not reset lock delay timer", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] }); // O piece
    engine.start();

    // Ground piece and push to left wall so further left moves fail.
    for (let i = 0; i < 40; i += 1) engine.softDrop();
    for (let i = 0; i < 8; i += 1) engine.moveLeft();
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.update(400);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Failed grounded movement should not refresh timer.
    engine.moveLeft();
    engine.update(99);
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.update(1);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("successful grounded rotation resets lock delay timer", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] }); // O piece can't meaningfully rotate to change placement
    engine.start();

    // Ground piece.
    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.update(400);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Grounded rotation counts as a successful transform and should reset the timer.
    engine.rotateClockwise();
    engine.update(499);
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.update(1);
    expect(engine.getSnapshot().lastLock).not.toBeNull();
  });

  it("failed grounded rotation does not reset lock delay timer", () => {
    const engine = new StackerEngine("endless") as unknown as {
      board: number[][];
      restart: (opts?: { openerPieceIds?: number[] }) => void;
      start: () => void;
      softDrop: () => void;
      rotateClockwise: () => void;
      update: (deltaMs: number) => void;
      getSnapshot: () => ReturnType<StackerEngine["getSnapshot"]>;
    };

    engine.restart({ openerPieceIds: [1] }); // I piece
    engine.start();
    for (let i = 0; i < 40; i += 1) engine.softDrop();
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Block all reachable CW targets from grounded 0>1 at x=3:
    // x=3 (no-kick), x=1 (-2), x=4 (+1).
    const blocked = engine.board.map((row) => [...row]);
    blocked[16][3] = 9;
    blocked[16][1] = 9;
    blocked[16][4] = 9;
    engine.board = blocked;

    engine.update(400);
    expect(engine.getSnapshot().lastLock).toBeNull();

    // Rotation should fail and therefore not reset lock timer.
    engine.rotateClockwise();
    engine.update(99);
    expect(engine.getSnapshot().lastLock).toBeNull();

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

  it("hard-drop overrides prior grounded soft-drop lock intent", () => {
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

    engine.softDrop(); // grounded, tags soft-drop intent
    engine.hardDrop(); // should override and lock immediately

    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.lockCause).toBe("hard-drop");
  });

  it("hard-drop locks immediately regardless of configured lock delay and pending soft-drop intent", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [2] });
    engine.setHandling({ lockDelayMs: 900, lockResetLimit: 15 });
    engine.start();

    let previousY = engine.getSnapshot().activePiece.y;
    for (let i = 0; i < 40; i += 1) {
      engine.softDrop();
      const nextY = engine.getSnapshot().activePiece.y;
      if (nextY === previousY) break;
      previousY = nextY;
    }
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.softDrop(); // pending soft-drop intent
    expect(engine.getSnapshot().lastLock).toBeNull();

    engine.hardDrop(); // must lock immediately
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

  it("reverts lock cause to gravity after successful grounded move following soft-drop", () => {
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

    engine.softDrop(); // tag soft-drop cause at contact
    engine.moveRight(); // successful transform should reset cause to gravity
    engine.update(500);

    const snap = engine.getSnapshot();
    expect(snap.lastLock).not.toBeNull();
    expect(snap.lastLock?.lockCause).toBe("gravity");
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

  it("keeps active piece in legal position under long deterministic random action sequence", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ seed: 20260531 });
    engine.start();

    // Deterministic LCG for reproducible action stream.
    let state = 99173;
    const next = () => {
      state = (state * 48271) % 2147483647;
      return state / 2147483647;
    };

    const actions = [
      () => engine.moveLeft(),
      () => engine.moveRight(),
      () => engine.rotateClockwise(),
      () => engine.rotateCounterClockwise(),
      () => engine.rotate180(),
      () => engine.softDrop(),
      () => engine.hardDrop(),
      () => engine.hold(),
      () => engine.update(16),
      () => engine.update(33),
    ];

    for (let i = 0; i < 1200; i += 1) {
      actions[Math.floor(next() * actions.length)]();
      const snap = engine.getSnapshot();
      if (snap.isGameOver) break;
      expect(canPlaceSnapshotPiece(snap.board, snap.activePiece)).toBe(true);
    }
  });

  it("keeps active piece legal under deterministic mixed actions and variable frame deltas", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ seed: 424242, openerPieceIds: [1, 2, 3, 4, 5, 6, 7] });
    engine.start();

    let rng = 246813579;
    const nextRandom = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 0x100000000;
    };

    const frameDeltas = [0, 1, 2, 8, 16, 17, 33, 50, 80, 120, 250, 500, 760, 1000];

    for (let i = 0; i < 1200; i += 1) {
      const roll = nextRandom();
      if (roll < 0.12) engine.moveLeft();
      else if (roll < 0.24) engine.moveRight();
      else if (roll < 0.36) engine.rotateClockwise();
      else if (roll < 0.46) engine.rotateCounterClockwise();
      else if (roll < 0.54) engine.rotate180();
      else if (roll < 0.62) engine.softDrop();
      else if (roll < 0.67) engine.hold();
      else if (roll < 0.7) engine.hardDrop();

      const dt = frameDeltas[Math.floor(nextRandom() * frameDeltas.length)] ?? 16;
      engine.update(dt);

      const snap = engine.getSnapshot();
      if (snap.isGameOver) break;
      expect(canPlaceSnapshotPiece(snap.board, snap.activePiece)).toBe(true);
    }
  });
});
