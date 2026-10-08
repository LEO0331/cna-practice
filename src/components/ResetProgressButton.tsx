"use client";

import { clearProgress } from "@/lib/progress";

export function ResetProgressButton({ onReset }: { onReset?: () => void }) {
  function reset() {
    if (!window.confirm("Clear all reviewed, bookmarked, last viewed progress, and saved practice session on this device?")) return;
    clearProgress();
    onReset?.();
  }
  return <button className="button ghost" onClick={reset}>Reset progress</button>;
}
