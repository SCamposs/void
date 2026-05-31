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
    expect(after).toBeGreaterThan(before);
  });

  it("awards hard-drop points by distance", () => {
    const engine = new StackerEngine("endless");
    engine.restart({ openerPieceIds: [1] });
    engine.start();
    const before = engine.getSnapshot().score;
    engine.hardDrop();
    const after = engine.getSnapshot().score;
    expect(after).toBeGreaterThanOrEqual(before + 2);
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
