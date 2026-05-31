export type Matrix = number[][];
export type PieceDefinition = { id: number; matrix: Matrix };
export type ActivePiece = { id: number; matrix: Matrix; x: number; y: number };
export type LockCause = "gravity" | "soft-drop" | "hard-drop";
export type TSpinKind = "none" | "mini" | "full";

export type LastClearEvent = {
  id: number;
  pieceId: number;
  lines: number;
  isTSpin: boolean;
  tSpinKind: TSpinKind;
  isPerfectClear: boolean;
  combo: number;
  b2bStreak: number;
  wasBackToBack: boolean;
};

export type LastLockEvent = {
  id: number;
  pieceId: number;
  lines: number;
  isTSpin: boolean;
  tSpinKind: TSpinKind;
  isPerfectClear: boolean;
  combo: number;
  b2bStreak: number;
  lockCause: LockCause;
};

export type Snapshot = {
  board: number[][];
  activePiece: ActivePiece;
  nextPiece: PieceDefinition;
  nextQueue: PieceDefinition[];
  holdPiece: PieceDefinition | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2bStreak: number;
  lastClear: LastClearEvent | null;
  lastLock: LastLockEvent | null;
  isGameOver: boolean;
  isPaused: boolean;
};
type RestartOptions = {
  seed?: number | null;
  openerPieceIds?: number[];
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const SCORE_BY_LINES = [0, 100, 300, 500, 800] as const;
const PREVIEW_QUEUE_SIZE = 5;
const DEFAULT_LOCK_DELAY_MS = 500;
const DEFAULT_LOCK_RESET_LIMIT = 15;

const PIECES: PieceDefinition[] = [
  { id: 1, matrix: [[1, 1, 1, 1]] },
  { id: 2, matrix: [[1, 1], [1, 1]] },
  { id: 3, matrix: [[0, 1, 0], [1, 1, 1]] },
  { id: 4, matrix: [[0, 1, 1], [1, 1, 0]] },
  { id: 5, matrix: [[1, 1, 0], [0, 1, 1]] },
  { id: 6, matrix: [[1, 0, 0], [1, 1, 1]] },
  { id: 7, matrix: [[0, 0, 1], [1, 1, 1]] },
];

function getPieceById(id: number): PieceDefinition {
  return PIECES.find((piece) => piece.id === id) ?? PIECES[0];
}

type SuccessfulAction = "none" | "cw" | "ccw" | "r180" | "other";
type HandlingConfig = { lockDelayMs?: number; lockResetLimit?: number };

type KickTable = Record<string, Array<[number, number]>>;
const JLSTZ_KICKS: KickTable = {
  "0>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "1>0": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "1>2": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  "2>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  "2>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  "3>2": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "3>0": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  "0>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};

const I_KICKS: KickTable = {
  // SRS+-style I kicks (TETR.IO-default family), keeping JLSTZ kicks standard.
  "0>1": [[0,0],[-2,0],[1,0],[1,2],[-2,-1]],
  "1>0": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  "1>2": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  "2>1": [[0,0],[-2,0],[1,0],[-2,1],[1,-1]],
  "2>3": [[0,0],[2,0],[-1,0],[2,1],[-1,-1]],
  "3>2": [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  "3>0": [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  "0>3": [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
};

const JLSTZ_KICKS_180: KickTable = {
  "0>2": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
  "1>3": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
  "2>0": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
  "3>1": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
};

const I_KICKS_180: KickTable = {
  "0>2": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
  "1>3": [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [0, -1]],
  "2>0": [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1]],
  "3>1": [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [0, -1]],
};

export const STACKER_KICK_TABLES = {
  jltsz: JLSTZ_KICKS,
  i: I_KICKS,
  jltsz180: JLSTZ_KICKS_180,
  i180: I_KICKS_180,
} as const;

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map((row) => [...row]);
}

function createSpawnPiece(piece: PieceDefinition): ActivePiece {
  return { id: piece.id, matrix: cloneMatrix(piece.matrix), x: Math.floor((BOARD_WIDTH - piece.matrix[0].length) / 2), y: 0 };
}

function rotateMatrixClockwise(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: Matrix = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) rotated[x][rows - 1 - y] = matrix[y][x];
  return rotated;
}

function rotateMatrixCounterClockwise(matrix: Matrix): Matrix {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: Matrix = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) rotated[cols - 1 - x][y] = matrix[y][x];
  return rotated;
}

export class StackerEngine {
  private board: number[][] = createEmptyBoard();
  private pieceBag: PieceDefinition[] = [];
  private activePiece: ActivePiece = createSpawnPiece(PIECES[0]);
  private nextQueue: PieceDefinition[] = [];
  private holdPiece: PieceDefinition | null = null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private level = 1;
  private isGameOver = false;
  private isPaused = true;
  private mode: "sprint" | "endless" = "endless";
  private dropAccumulator = 0;
  private combo = 0;
  private b2bStreak = 0;
  private lastSuccessfulAction: SuccessfulAction = "none";
  private pendingLockCause: LockCause = "gravity";
  private clearEventId = 0;
  private lockEventId = 0;
  private lastClearEvent: LastClearEvent | null = null;
  private lastLockEvent: LastLockEvent | null = null;
  private activeRotation = 0;
  private lockTimerMs = 0;
  private lockResetCount = 0;
  private lockDelayMs = DEFAULT_LOCK_DELAY_MS;
  private lockResetLimit = DEFAULT_LOCK_RESET_LIMIT;
  private randomState: number | null = null;
  private forcedPieceIds: number[] = [];

  constructor(mode: "sprint" | "endless" = "endless") {
    this.mode = mode;
    this.restart();
  }

  private nextRandom(): number {
    if (this.randomState === null) return Math.random();
    this.randomState = (this.randomState * 48271) % 2147483647;
    return this.randomState / 2147483647;
  }

  private isGrounded(): boolean {
    return !this.canPlace(this.activePiece.matrix, this.activePiece.x, this.activePiece.y + 1);
  }

  private onTransformSuccess(action: SuccessfulAction): void {
    this.lastSuccessfulAction = action;
    // Successful movement/rotation after contact means the eventual timer lock
    // is no longer attributable to a direct soft-drop lock intent.
    this.pendingLockCause = "gravity";
    if (this.isGrounded() && this.lockResetCount < this.lockResetLimit) {
      this.lockTimerMs = 0;
      this.lockResetCount += 1;
    }
  }

  private shuffledPiecesBag(): PieceDefinition[] {
    const bag = [...PIECES];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.nextRandom() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  private takePieceFromBag(): PieceDefinition {
    if (this.forcedPieceIds.length > 0) {
      const id = this.forcedPieceIds.shift();
      return PIECES.find((piece) => piece.id === id) ?? PIECES[0];
    }
    if (this.pieceBag.length === 0) this.pieceBag = this.shuffledPiecesBag();
    const nextPiece = this.pieceBag.shift();
    if (!nextPiece) {
      this.pieceBag = this.shuffledPiecesBag();
      return this.pieceBag.shift() ?? PIECES[0];
    }
    return nextPiece;
  }

  private fillPreviewQueue(): void {
    while (this.nextQueue.length < PREVIEW_QUEUE_SIZE) this.nextQueue.push(this.takePieceFromBag());
  }

  private consumeNextForSpawn(): PieceDefinition {
    const piece = this.nextQueue.shift() ?? this.takePieceFromBag();
    this.fillPreviewQueue();
    return piece;
  }

  private isCellBlocked(x: number, y: number): boolean {
    if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true;
    if (y < 0) return false;
    return this.board[y][x] !== 0;
  }

  private getDropIntervalMs(): number {
    return Math.max(80, 760 - (this.level - 1) * 60);
  }

  private canPlace(matrix: Matrix, x: number, y: number): boolean {
    for (let py = 0; py < matrix.length; py += 1) {
      for (let px = 0; px < matrix[py].length; px += 1) {
        if (matrix[py][px] === 0) continue;
        const boardX = x + px;
        const boardY = y + py;
        if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) return false;
        if (boardY >= 0 && this.board[boardY][boardX] !== 0) return false;
      }
    }
    return true;
  }

  private mergeActivePiece(): void {
    const { matrix, x, y, id } = this.activePiece;
    for (let py = 0; py < matrix.length; py += 1) {
      for (let px = 0; px < matrix[py].length; px += 1) {
        if (matrix[py][px] === 0) continue;
        const boardY = y + py;
        const boardX = x + px;
        if (boardY < 0) { this.isGameOver = true; return; }
        this.board[boardY][boardX] = id;
      }
    }
  }

  private clearCompletedLines(): number {
    let cleared = 0;
    for (let row = BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      if (!this.board[row].every((cell) => cell !== 0)) continue;
      this.board.splice(row, 1);
      this.board.unshift(Array(BOARD_WIDTH).fill(0));
      cleared += 1;
      row += 1;
    }
    if (cleared > 0) {
      this.lines += cleared;
      this.level = 1 + Math.floor(this.lines / 10);
    }
    return cleared;
  }

  private isBoardEmpty(): boolean {
    return this.board.every((row) => row.every((cell) => cell === 0));
  }

  private detectTSpinKind(): TSpinKind {
    if (this.activePiece.id !== 3) return "none";
    if (!["cw", "ccw", "r180"].includes(this.lastSuccessfulAction)) return "none";
    const pivotX = this.activePiece.x + 1;
    const pivotY = this.activePiece.y + 1;
    const corners = [[pivotX - 1, pivotY - 1],[pivotX + 1, pivotY - 1],[pivotX - 1, pivotY + 1],[pivotX + 1, pivotY + 1]] as const;
    const blocked = corners.reduce((c, [x, y]) => c + (this.isCellBlocked(x, y) ? 1 : 0), 0);
    if (blocked < 3) return "none";
    const fronts = this.activeRotation === 0 ? [[pivotX - 1, pivotY - 1],[pivotX + 1, pivotY - 1]] :
      this.activeRotation === 1 ? [[pivotX + 1, pivotY - 1],[pivotX + 1, pivotY + 1]] :
      this.activeRotation === 2 ? [[pivotX - 1, pivotY + 1],[pivotX + 1, pivotY + 1]] :
      [[pivotX - 1, pivotY - 1],[pivotX - 1, pivotY + 1]];
    const frontBlocked = fronts.reduce((c, [x, y]) => c + (this.isCellBlocked(x, y) ? 1 : 0), 0);
    // TETR.IO-style scoring distinguishes Spin Zero and Mini Spin Zero.
    // We classify front-light cases as mini for both zero- and single-line outcomes.
    if (frontBlocked < 2) return "mini";
    return "full";
  }

  private isDifficultClear(lines: number, tSpinKind: TSpinKind): boolean {
    return lines > 0 && (tSpinKind !== "none" || lines === 4);
  }

  private scoreForClear(
    linesCleared: number,
    tSpinKind: TSpinKind,
    isPerfectClear: boolean,
    wasBackToBack: boolean,
  ): number {
    // Approximate TETR.IO solo scoring profile:
    // - line clear table (100/300/500/800)
    // - spin tables (mini/full)
    // - B2B difficult clear multiplier (x1.5)
    // - combo bonus (x50)
    // - all clear flat bonus
    let base = 0;
    if (tSpinKind === "full") {
      base = [400, 800, 1200, 1600, 2600][linesCleared] ?? 0;
    } else if (tSpinKind === "mini") {
      base = [100, 200, 400, 800, 1600][linesCleared] ?? 0;
    } else {
      base = SCORE_BY_LINES[linesCleared as 0 | 1 | 2 | 3 | 4] ?? 0;
    }
    if (wasBackToBack && this.isDifficultClear(linesCleared, tSpinKind)) {
      base = Math.trunc(base * 1.5);
    }
    let total = base;
    if (this.combo > 0) total += 50 * this.combo;
    if (isPerfectClear) total += 3500;
    return total * this.level;
  }

  private spawnNextPiece(): void {
    this.activePiece = createSpawnPiece(this.consumeNextForSpawn());
    this.activeRotation = 0;
    this.canHold = true;
    this.lockTimerMs = 0;
    this.lockResetCount = 0;
    if (!this.canPlace(this.activePiece.matrix, this.activePiece.x, this.activePiece.y)) this.isGameOver = true;
  }

  private lockPieceAndAdvance(): void {
    const lockedPieceId = this.activePiece.id;
    this.mergeActivePiece();
    if (this.isGameOver) return;
    const cleared = this.clearCompletedLines();
    const tSpinKind = this.detectTSpinKind();
    const difficult = this.isDifficultClear(cleared, tSpinKind);
    const prevB2B = this.b2bStreak;

    if (difficult) this.b2bStreak += 1;
    else if (cleared > 0) this.b2bStreak = 0;

    this.combo = cleared > 0 ? this.combo + 1 : 0;
    const isPerfectClear = cleared > 0 && this.isBoardEmpty();
    const wasBackToBack = difficult && prevB2B >= 1;

    if (cleared > 0 || tSpinKind !== "none") {
      this.score += this.scoreForClear(
        cleared,
        tSpinKind,
        isPerfectClear,
        wasBackToBack,
      );
      this.lastClearEvent = {
        id: ++this.clearEventId,
        pieceId: lockedPieceId,
        lines: cleared,
        isTSpin: tSpinKind !== "none",
        tSpinKind,
        isPerfectClear,
        combo: this.combo,
        b2bStreak: this.b2bStreak,
        wasBackToBack,
      };
    } else {
      this.lastClearEvent = null;
    }

    this.lastLockEvent = {
      id: ++this.lockEventId,
      pieceId: lockedPieceId,
      lines: cleared,
      isTSpin: tSpinKind !== "none",
      tSpinKind,
      isPerfectClear,
      combo: this.combo,
      b2bStreak: this.b2bStreak,
      lockCause: this.pendingLockCause,
    };

    this.pendingLockCause = "gravity";
    this.lastSuccessfulAction = "none";
    this.spawnNextPiece();
  }

  private tryMove(dx: number, dy: number): boolean {
    if (this.isGameOver || this.isPaused) return false;
    const tx = this.activePiece.x + dx;
    const ty = this.activePiece.y + dy;
    if (!this.canPlace(this.activePiece.matrix, tx, ty)) return false;
    this.activePiece.x = tx;
    this.activePiece.y = ty;
    this.onTransformSuccess("other");
    return true;
  }

  moveLeft(): void { this.tryMove(-1, 0); }
  moveRight(): void { this.tryMove(1, 0); }

  softDrop(): void {
    if (this.isGameOver || this.isPaused) return;
    if (this.tryMove(0, 1)) {
      this.score += 1;
    } else {
      // Preserve input intent for the eventual delayed lock event.
      this.pendingLockCause = "soft-drop";
    }
  }

  hardDrop(): void {
    if (this.isGameOver || this.isPaused) return;
    while (this.tryMove(0, 1)) this.score += 2;
    this.pendingLockCause = "hard-drop";
    this.lockPieceAndAdvance();
  }

  private tryRotate(rotated: Matrix, direction: SuccessfulAction, nextRotation: number): void {
    if (this.isGameOver || this.isPaused) return;
    const from = this.activeRotation;
    const key = `${from}>${nextRotation}`;
    const kicks =
      direction === "r180"
        ? (this.activePiece.id === 1
            ? (I_KICKS_180[key] ?? [[0, 0]])
            : (JLSTZ_KICKS_180[key] ?? [[0, 0]]))
        : this.activePiece.id === 1
          ? (I_KICKS[key] ?? [[0, 0]])
          : (JLSTZ_KICKS[key] ?? [[0, 0]]);
    for (const [dx, dy] of kicks) {
      const tx = this.activePiece.x + dx;
      const ty = this.activePiece.y - dy;
      if (!this.canPlace(rotated, tx, ty)) continue;
      this.activePiece.matrix = rotated;
      this.activePiece.x = tx;
      this.activePiece.y = ty;
      if (this.activePiece.id !== 2) this.activeRotation = nextRotation;
      this.onTransformSuccess(direction);
      return;
    }
  }

  rotateClockwise(): void {
    const next = (this.activeRotation + 1) % 4;
    this.tryRotate(rotateMatrixClockwise(this.activePiece.matrix), "cw", next);
  }

  rotateCounterClockwise(): void {
    const next = (this.activeRotation + 3) % 4;
    this.tryRotate(rotateMatrixCounterClockwise(this.activePiece.matrix), "ccw", next);
  }

  rotate180(): void {
    const next = (this.activeRotation + 2) % 4;
    this.tryRotate(rotateMatrixClockwise(rotateMatrixClockwise(this.activePiece.matrix)), "r180", next);
  }

  hold(): void {
    if (this.isGameOver || this.isPaused || !this.canHold) return;
    const current = getPieceById(this.activePiece.id);
    if (this.holdPiece === null) {
      this.holdPiece = current;
      this.activePiece = createSpawnPiece(this.consumeNextForSpawn());
      this.activeRotation = 0;
      this.canHold = false;
      this.lastSuccessfulAction = "other";
      this.lockTimerMs = 0;
      this.lockResetCount = 0;
      if (!this.canPlace(this.activePiece.matrix, this.activePiece.x, this.activePiece.y)) this.isGameOver = true;
      return;
    }
    const held = this.holdPiece;
    this.holdPiece = current;
    this.activePiece = createSpawnPiece(getPieceById(held.id));
    this.activeRotation = 0;
    this.canHold = false;
    this.lastSuccessfulAction = "other";
    this.lockTimerMs = 0;
    this.lockResetCount = 0;
    if (!this.canPlace(this.activePiece.matrix, this.activePiece.x, this.activePiece.y)) this.isGameOver = true;
  }

  togglePause(): void { if (!this.isGameOver) this.isPaused = !this.isPaused; }
  start(): void { if (!this.isGameOver) this.isPaused = false; }
  setMode(mode: "sprint" | "endless"): void { this.mode = mode; }
  setHandling(config: HandlingConfig): void {
    if (typeof config.lockDelayMs === "number" && Number.isFinite(config.lockDelayMs)) {
      this.lockDelayMs = Math.max(0, Math.trunc(config.lockDelayMs));
    }
    if (typeof config.lockResetLimit === "number" && Number.isFinite(config.lockResetLimit)) {
      this.lockResetLimit = Math.max(0, Math.trunc(config.lockResetLimit));
    }
  }

  restart(options?: RestartOptions): void {
    if (options && Object.prototype.hasOwnProperty.call(options, "seed")) {
      if (options.seed === null || options.seed === undefined || Number.isNaN(options.seed)) this.randomState = null;
      else {
        const abs = Math.abs(Math.trunc(options.seed));
        const normalized = abs % 2147483647;
        this.randomState = normalized === 0 ? 1 : normalized;
      }
    } else if (!options) {
      this.randomState = null;
    }
    this.forcedPieceIds = options?.openerPieceIds ? [...options.openerPieceIds] : [];
    this.board = createEmptyBoard();
    this.pieceBag = [];
    this.nextQueue = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.isGameOver = false;
    this.isPaused = true;
    this.dropAccumulator = 0;
    this.combo = 0;
    this.b2bStreak = 0;
    this.lastSuccessfulAction = "none";
    this.pendingLockCause = "gravity";
    this.clearEventId = 0;
    this.lockEventId = 0;
    this.lastClearEvent = null;
    this.lastLockEvent = null;
    this.holdPiece = null;
    this.canHold = true;
    this.activeRotation = 0;
    this.lockTimerMs = 0;
    this.lockResetCount = 0;
    this.fillPreviewQueue();
    this.activePiece = createSpawnPiece(this.consumeNextForSpawn());
  }

  update(deltaMs: number): void {
    if (this.isGameOver || this.isPaused) return;
    this.dropAccumulator += deltaMs;
    const dropInterval = this.getDropIntervalMs();
    while (this.dropAccumulator >= dropInterval) {
      this.dropAccumulator -= dropInterval;
      if (!this.tryMove(0, 1)) break;
    }

    if (this.isGrounded()) {
      this.lockTimerMs += deltaMs;
      if (this.lockTimerMs >= this.lockDelayMs || this.lockResetCount >= this.lockResetLimit) {
        this.lockPieceAndAdvance();
      }
    } else {
      this.lockTimerMs = 0;
      this.lockResetCount = 0;
    }

    if (this.mode === "sprint" && this.lines >= 40) {
      this.isGameOver = true;
      this.isPaused = true;
    }
  }

  getSnapshot(): Snapshot {
    const nextPiece = this.nextQueue[0] ?? PIECES[0];
    return {
      board: this.board.map((row) => [...row]),
      activePiece: { id: this.activePiece.id, matrix: this.activePiece.matrix.map((r) => [...r]), x: this.activePiece.x, y: this.activePiece.y },
      nextPiece: { id: nextPiece.id, matrix: nextPiece.matrix.map((row) => [...row]) },
      nextQueue: this.nextQueue.map((piece) => ({ id: piece.id, matrix: piece.matrix.map((row) => [...row]) })),
      holdPiece: this.holdPiece ? { id: this.holdPiece.id, matrix: this.holdPiece.matrix.map((row) => [...row]) } : null,
      canHold: this.canHold,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      b2bStreak: this.b2bStreak,
      lastClear: this.lastClearEvent,
      lastLock: this.lastLockEvent,
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
    };
  }
}
