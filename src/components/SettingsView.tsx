"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SettingsPanel from "./SettingsPanel";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => {});
  }, []);

  const handleChange = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          const data = await res.json();
          if (res.ok && data.settings) setSettings(data.settings);
        } catch {
          // optimistic UI already applied
        } finally {
          setSaving(false);
        }
      }, 400);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-100">Settings</h2>
        <p className="text-xs text-slate-500">Customize your TravelBoard experience</p>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg pt-4">
          <SettingsPanel settings={settings} saving={saving} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
