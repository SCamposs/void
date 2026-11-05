/** Repeat debt is carried across frames, so 8ms ARR also works at 60Hz. */
export function advanceRepeat(remainingMs: number, deltaMs: number, intervalMs: number): { count: number; remainingMs: number } {
  const remaining = remainingMs - Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0);
  if (remaining > 0) return { count: 0, remainingMs: remaining };
  // Zero ARR means moving to the wall, not an unbounded repeat loop.
  if (intervalMs <= 0) return { count: 10, remainingMs: 0 };
  const due = Math.floor(-remaining / intervalMs) + 1;
  return { count: Math.min(40, due), remainingMs: remaining + due * intervalMs };
}
