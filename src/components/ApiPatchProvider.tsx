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
  }, []);

  return <>{children}</>;
}
