"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker — but ONLY in production builds. In dev
 * it actively unregisters any existing worker, so a service worker can never
 * cache stale assets over a `next dev` session (yours or your friend's :3001).
 * The worker only does anything once the app is served from `next build`/`start`
 * (the "downloaded app").
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort — the app still works online without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
