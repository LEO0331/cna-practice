export type SavedPracticeSession = {
  year: string;
  category: string;
  topic: string;
  count: string;
  sessionIds: string[];
  index: number;
};

const key = "cna-practice-session-v1";
export const defaultPracticeSession: SavedPracticeSession = {
  year: "", category: "", topic: "", count: "10", sessionIds: [], index: 0,
};

// Preserve the current question when earlier questions have been removed.
export function restorePracticeSession(value: unknown, knownIds: string[]): SavedPracticeSession | undefined {
  if (!value || typeof value !== "object") return undefined;
  const saved = value as Partial<SavedPracticeSession>;
  if (![saved.year, saved.category, saved.topic].every((item) => typeof item === "string") ||
      !["5", "10", "15", "20", "30"].includes(saved.count ?? "") ||
      !Array.isArray(saved.sessionIds) || !saved.sessionIds.every((id) => typeof id === "string") ||
      !Number.isInteger(saved.index) || saved.index! < 0) return undefined;
  const known = new Set(knownIds);
  const sessionIds = [...new Set(saved.sessionIds.filter((id) => known.has(id)))];
  const currentIndex = sessionIds.indexOf(saved.sessionIds[saved.index!]);
  return {
    year: saved.year!, category: saved.category!, topic: saved.topic!, count: saved.count!, sessionIds,
    index: currentIndex >= 0 ? currentIndex : Math.min(saved.index!, Math.max(0, sessionIds.length - 1)),
  };
}

export function readPracticeSession(knownIds: string[]): SavedPracticeSession | undefined {
  try {
    return restorePracticeSession(JSON.parse(localStorage.getItem(key) ?? "null"), knownIds);
  } catch { return undefined; }
}

// Storage can be unavailable or full; practice should still work in memory.
export function savePracticeSession(value: SavedPracticeSession): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep the active session usable. */ }
}

export function clearPracticeSession(): void {
  try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
