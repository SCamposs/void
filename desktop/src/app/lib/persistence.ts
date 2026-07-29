export type TypingSession = {
  timestamp: string;
  wpm: number;
  accuracy: number;
  correctWords: number;
  incorrectWords: number;
  correctChars: number;
  incorrectChars: number;
  durationSeconds: number;
  language: "pt-BR" | "en";
  mode: string;
};

export type TypingSummary = {
  totalSessions: number;
  bestWpm: number;
  averageWpm: number;
  averageAccuracy: number;
};

export const STORAGE_SCHEMA_VERSION = 2;
export const storageKeys = {
  schema: "void.storage.schema",
  theme: "void.app.theme.v2",
  sidebar: "void.app.sidebar.v2",
  typingSessions: "void.typing.sessions.v2",
} as const;

const LEGACY_KEYS: Record<string, string> = {
  "void-desktop-theme": storageKeys.theme,
  "void-sidebar-collapsed": storageKeys.sidebar,
  "void-typing-sessions": storageKeys.typingSessions,
};

function isVoidKey(key: string): boolean {
  return key.startsWith("void.") || key.startsWith("void_") || key.startsWith("void-");
}

export function initializeStorage(): void {
  try {
    for (const [legacy, current] of Object.entries(LEGACY_KEYS)) {
      if (localStorage.getItem(current) === null) {
        const value = localStorage.getItem(legacy);
        if (value !== null) localStorage.setItem(current, value);
      }
    }
    localStorage.setItem(storageKeys.schema, String(STORAGE_SCHEMA_VERSION));
  } catch {
    // The app remains usable in restricted WebViews where storage is unavailable.
  }
}

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures should not interrupt the active module.
  }
}

export type VoidDataBackup = {
  format: "void-local-backup";
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, string>;
};

export function exportAppData(): string {
  initializeStorage();
  const data: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isVoidKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  const backup: VoidDataBackup = {
    format: "void-local-backup",
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

export function importAppData(raw: string): number {
  const parsed = JSON.parse(raw) as Partial<VoidDataBackup>;
  if (
    parsed.format !== "void-local-backup" ||
    !parsed.data ||
    typeof parsed.data !== "object" ||
    Array.isArray(parsed.data)
  ) {
    throw new Error("This file is not a VOID data backup.");
  }
  const entries = Object.entries(parsed.data);
  if (entries.some(([key, value]) => !isVoidKey(key) || typeof value !== "string")) {
    throw new Error("The backup contains unsupported data.");
  }
  for (const [key, value] of entries) localStorage.setItem(key, value);
  initializeStorage();
  return entries.length;
}

export function resetAppData(): number {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isVoidKey(key)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
  initializeStorage();
  return keys.length;
}

initializeStorage();

export const typingRepo = {
  all(): TypingSession[] {
    const sessions = readStoredJson<unknown>(storageKeys.typingSessions, []);
    if (!Array.isArray(sessions)) return [];
    return sessions.filter((session): session is TypingSession => {
      if (!session || typeof session !== "object") return false;
      const value = session as Partial<TypingSession>;
      return typeof value.timestamp === "string" &&
        Number.isFinite(value.wpm) &&
        Number.isFinite(value.accuracy);
    });
  },
  save(session: TypingSession): void {
    const list = this.all();
    list.unshift(session);
    writeStoredJson(storageKeys.typingSessions, list.slice(0, 250));
  },
  reset(): void {
    writeStoredJson(storageKeys.typingSessions, []);
  },
  summary(): TypingSummary {
    const sessions = this.all();
    if (sessions.length === 0) return { totalSessions: 0, bestWpm: 0, averageWpm: 0, averageAccuracy: 0 };
    const total = sessions.length;
    const bestWpm = Math.max(...sessions.map((session) => session.wpm));
    const averageWpm = sessions.reduce((sum, session) => sum + session.wpm, 0) / total;
    const averageAccuracy = sessions.reduce((sum, session) => sum + session.accuracy, 0) / total;
    return {
      totalSessions: total,
      bestWpm: Number(bestWpm.toFixed(2)),
      averageWpm: Number(averageWpm.toFixed(2)),
      averageAccuracy: Number(averageAccuracy.toFixed(2)),
    };
  },
};
