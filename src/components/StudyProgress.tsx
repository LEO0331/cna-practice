"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { progressSummary, readProgress } from "@/lib/progress";
import { ResetProgressButton } from "./ResetProgressButton";

// labels maps question id → display label (e.g. "2014 Q3(d)(i)").
export function StudyProgress({ labels }: { labels: Record<string, string> }) {
  const ids = Object.keys(labels);
  const [summary, setSummary] = useState(() => progressSummary({ reviewed: [], bookmarked: [] }, ids));
  const [loaded, setLoaded] = useState(false);
  function refresh() { setSummary(progressSummary(readProgress(), Object.keys(labels))); }
  useEffect(() => { refresh(); setLoaded(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!loaded) return <section className="panel study-progress" aria-label="Your progress" role="status">Loading saved progress…</section>;
  const percent = summary.total ? Math.round((summary.reviewed / summary.total) * 100) : 0;
  const started = summary.reviewed > 0 || summary.bookmarked > 0 || summary.lastViewed;
  return <section className="panel study-progress" aria-label="Your progress">
    <div className="study-progress-head"><h2>Your progress</h2><span>Saved on this device</span></div>
    <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.reviewed} aria-label="Questions reviewed"><span style={{ width:`${percent}%` }} /></div>
    <p><strong>{summary.reviewed} / {summary.total}</strong> reviewed ({percent}%) · <strong>{summary.bookmarked}</strong> bookmarked</p>
    <div className="actions">
      {summary.lastViewed ? <Link className="button" href={`/questions/${summary.lastViewed}`}>Continue: {labels[summary.lastViewed]} →</Link> : <Link className="button" href="/practice">Start practising →</Link>}
      {summary.bookmarked > 0 && <Link className="button secondary" href="/questions?progress=bookmarked">Review bookmarked</Link>}
      {summary.reviewed < summary.total && summary.reviewed > 0 && <Link className="button secondary" href="/questions?progress=not-reviewed">Not reviewed yet</Link>}
      {started && <ResetProgressButton onReset={refresh} />}
    </div>
  </section>;
}
