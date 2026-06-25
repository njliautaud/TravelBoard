"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SettingsPanel from "./SettingsPanel";
import DataExport from "./DataExport";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

export default function SettingsView() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => {});

    // Check if user has admin access (OWNER role)
    fetch("/api/admin/stats")
      .then((r) => { if (r.ok) setIsOwner(true); })
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

          {/* Admin link — only visible to OWNER role */}
          {isOwner && (
            <div className="mt-6 border-t border-slate-800 px-4 pt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Administration</h3>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-400 transition hover:border-amber-500/40 hover:text-amber-300"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
                Admin Dashboard
              </Link>
            </div>
          )}

          {/* Legal section */}
          <div className="mt-6 border-t border-slate-800 px-4 pt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Legal</h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/privacy"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-amber-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-amber-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Data Export section */}
          <div className="mt-6 border-t border-slate-800 px-4 pt-6 pb-8">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Data & Privacy</h3>
            <p className="mb-3 text-xs text-slate-500">Export all your TravelBoard data as JSON or CSV.</p>
            <button
              onClick={() => setShowExport(true)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-amber-500/40 hover:text-amber-300"
            >
              Export My Data
            </button>

            {/* Delete Account */}
            <div className="mt-6 border-t border-slate-800 pt-6">
              <h4 className="mb-1 text-sm font-semibold text-red-400">Danger Zone</h4>
              <p className="mb-3 text-xs text-slate-500">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <DataExport onClose={() => setShowExport(false)} />
          </div>
        </div>
      )}

      {/* Delete Account confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-400">Delete Account</h3>
            <p className="mt-2 text-sm text-slate-300">
              Are you sure you want to permanently delete your account? All your travel data, wishes, journals, and settings will be erased. This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-300">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    const res = await fetch("/api/auth/delete-account", { method: "POST" });
                    if (res.ok) {
                      router.push("/sign-in");
                    } else {
                      const data = await res.json();
                      setDeleteError(data.error || "Failed to delete account.");
                    }
                  } catch {
                    setDeleteError("Network error. Please try again.");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
