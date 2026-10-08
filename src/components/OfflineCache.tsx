"use client";

import { useEffect, useState } from "react";

export function OfflineCache({ basePath }: { basePath: string }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let mounted = true;
    function register() {
      setStatus("Saving for offline use…");
      // Updates wait for existing tabs to close, preserving the current build
      // and an in-progress practice session without a forced reload.
      void navigator.serviceWorker.register(`${basePath}/sw.js`, {
        scope: `${basePath}/`, updateViaCache: "none",
      }).then((registration) => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (mounted && worker.state === "redundant" && !registration.active) setStatus("Offline saving unavailable");
        });
        void navigator.serviceWorker.ready.then(() => {
          if (mounted) setStatus("Available offline");
        });
      }).catch(() => {
        if (mounted) setStatus("Offline saving unavailable");
      });
    }
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => { mounted = false; window.removeEventListener("load", register); };
  }, [basePath]);
  return status ? <span role="status">{status}</span> : null;
}
