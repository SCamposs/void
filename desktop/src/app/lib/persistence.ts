export type TypingSession = {
  timestamp: string;
  wpm: number;
  accuracy: number;
  correctWords: number;
  incorrectWords: number;
  correctChars: number;
  incorrectChars: number;
  durationSeconds: number;
  language: "pt-BR";
  mode: "word-flow-60s";
};

export type TypingSummary = {
  totalSessions: number;
  bestWpm: number;
  averageWpm: number;
  averageAccuracy: number;
};

const key = "void-typing-sessions";

export const typingRepo = {
  all(): TypingSession[] {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try { return JSON.parse(raw) as TypingSession[]; } catch { return []; }
  },
  save(session: TypingSession): void {
    const list = this.all();
    list.unshift(session);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  },
  summary(): TypingSummary {
    const sessions = this.all();
    if (sessions.length === 0) return { totalSessions: 0, bestWpm: 0, averageWpm: 0, averageAccuracy: 0 };
    const total = sessions.length;
    const bestWpm = Math.max(...sessions.map((s) => s.wpm));
    const averageWpm = sessions.reduce((acc, s) => acc + s.wpm, 0) / total;
    const averageAccuracy = sessions.reduce((acc, s) => acc + s.accuracy, 0) / total;
    return { totalSessions: total, bestWpm: Number(bestWpm.toFixed(2)), averageWpm: Number(averageWpm.toFixed(2)), averageAccuracy: Number(averageAccuracy.toFixed(2)) };
  },
};
