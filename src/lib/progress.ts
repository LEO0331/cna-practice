import { clearPracticeSession } from "./practice-session.ts";

export type Progress = { reviewed: string[]; bookmarked: string[]; lastViewed?: string };
const key = "cna-practice-progress-v1";
const empty: Progress = { reviewed: [], bookmarked: [] };

export function readProgress(): Progress {
  if (typeof window === "undefined") return empty;
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<Progress> | null;
    return value && Array.isArray(value.reviewed) && Array.isArray(value.bookmarked)
      ? { reviewed: value.reviewed, bookmarked: value.bookmarked, lastViewed: value.lastViewed }
      : empty;
  } catch { return empty; }
}
export function saveProgress(value: Progress): void {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Practice remains usable when device storage is unavailable. */ }
}
export function clearProgress(): void {
  clearPracticeSession();
  try {
    if (typeof window !== "undefined") localStorage.removeItem(key);
  } catch { /* Device storage may be unavailable. */ }
}
// Counts only IDs that still exist, so removed or renamed questions are ignored.
export function progressSummary(progress: Progress, ids: string[]): { reviewed: number; bookmarked: number; total: number; lastViewed?: string } {
  const known = new Set(ids);
  return {
    reviewed: new Set(progress.reviewed.filter((id) => known.has(id))).size,
    bookmarked: new Set(progress.bookmarked.filter((id) => known.has(id))).size,
    total: ids.length,
    lastViewed: progress.lastViewed && known.has(progress.lastViewed) ? progress.lastViewed : undefined,
  };
}
