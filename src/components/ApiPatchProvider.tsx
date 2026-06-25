"use client";

import { useEffect } from "react";
import { installApiFetchPatch } from "@/lib/api";

/**
 * Invisible client component that patches window.fetch once on mount so that
 * `/api/…` requests are redirected to the external backend when
 * NEXT_PUBLIC_API_URL is set (e.g. for static GitHub Pages export).
 */
export default function ApiPatchProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installApiFetchPatch();

    // Register service worker for PWA offline support
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Auto-update: when a new SW is found, activate it immediately
          reg.onupdatefound = () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.onstatechange = () => {
                if (newWorker.state === "activated") {
                  console.log("[SW] Updated and activated");
                }
              };
            }
          };
        })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }
  }, []);

  return <>{children}</>;
}
