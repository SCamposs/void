import { describe, expect, it } from "vitest";
import { StackerEngine, type ActivePiece } from "../app/modules/stacker/engine";

// Board fixtures arrange reachable placements; actions use the public engine.
function fixture(mode: "sprint" | "endless" = "endless") {
  const engine = new StackerEngine(mode);
  engine.restart({ openerPieceIds: [3, 2, 1] });
  engine.start();
  const state = engine as unknown as {
    board: number[][]; activePiece: ActivePiece; activeRotation: number;
    lines: number; lastSuccessfulAction: string;
  };
  return { engine, state };
}

describe("Stacker placement contracts", () => {
  it("rotates T around its fixed center rather than a cropped rectangle", () => {
    const { engine } = fixture();
    const spawn = engine.getSnapshot().activePiece;
    engine.rotateClockwise();
    expect(engine.getSnapshot().activePiece).toEqual({ id: 3, x: 3, y: 0, matrix: [[0, 1, 0], [0, 1, 1], [0, 1, 0]] });
    for (let turn = 0; turn < 3; turn += 1) engine.rotateClockwise();
    expect(engine.getSnapshot().activePiece).toEqual(spawn);
  });

  it("recognizes a rotated T single before removing the occupied corner row", () => {
    const { engine, state } = fixture();
    state.board[17][3] = state.board[17][5] = state.board[19][3] = 7;
    state.board[18] = [7, 7, 7, 0, 0, 0, 7, 7, 7, 7];
    state.activePiece = { id: 3, matrix: [[0, 1], [1, 1], [0, 1]], x: 3, y: 17 };
    state.activeRotation = 3;
    engine.rotateClockwise();
    engine.hardDrop();
    expect(engine.getSnapshot().lastClear).toMatchObject({ lines: 1, tSpinKind: "full", clearedRows: [18] });
  });

  it("preserves rotation intent through vertical travel but cancels it on horizontal movement", () => {
    const { engine, state } = fixture();
    engine.rotateClockwise();
    engine.softDrop();
    expect(state.lastSuccessfulAction).toBe("cw");
    engine.update(760);
    expect(state.lastSuccessfulAction).toBe("cw");
    engine.moveLeft();
    expect(state.lastSuccessfulAction).toBe("other");
  });

  it("gives the next piece a full gravity interval after hard drop and hold", () => {
    const { engine } = fixture();
    engine.update(750);
    engine.hardDrop();
    engine.update(20);
    expect(engine.getSnapshot().activePiece.y).toBe(0);
    engine.update(700);
    engine.hold();
    const spawnY = engine.getSnapshot().activePiece.y;
    engine.update(40);
    expect(engine.getSnapshot().activePiece.y).toBe(spawnY);
  });

  it("ends sprint on the 40th line immediately and rejects subsequent inputs", () => {
    const { engine, state } = fixture("sprint");
    state.lines = 39;
    state.board[19] = [7, 7, 7, 0, 0, 0, 0, 7, 7, 7];
    state.activePiece = { id: 1, matrix: [[1, 1, 1, 1]], x: 3, y: 0 };
    engine.hardDrop();
    const completed = engine.getSnapshot();
    expect(completed.lines).toBe(40);
    expect(completed.isGameOver).toBe(true);
    expect(completed.isPaused).toBe(true);
    engine.hardDrop(); engine.moveLeft(); engine.hold();
    expect(engine.getSnapshot()).toEqual(completed);
  });
});
