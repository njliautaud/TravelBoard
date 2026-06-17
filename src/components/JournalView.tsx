"use client";

import { useCallback, useEffect, useState } from "react";
import { ShareJournalButton } from "./ShareJournal";
// demoData import removed — all data comes from APIs

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  date: string | null;
  mood: string | null;
  weather: string | null;
  tags: string[];
  photos: string[];
  tripId: string | null;
  trip?: { id: string; city: string; country: string } | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JournalStats {
  totalEntries: number;
  countriesVisited: string[];
  totalCountries: number;
  topTags: Array<{ tag: string; count: number }>;
  moodBreakdown: Record<string, number>;
  timeline: Array<{ month: string; count: number }>;
}

const MOODS = [
  { value: "excited", label: "Excited", emoji: "\u{1F929}" },
  { value: "happy", label: "Happy", emoji: "\u{1F60A}" },
  { value: "relaxed", label: "Relaxed", emoji: "\u{1F60C}" },
  { value: "adventurous", label: "Adventurous", emoji: "\u{1F3D4}\uFE0F" },
  { value: "tired", label: "Tired", emoji: "\u{1F634}" },
  { value: "nostalgic", label: "Nostalgic", emoji: "\u{1F972}" },
  { value: "inspired", label: "Inspired", emoji: "\u2728" },
];

const WEATHER_OPTIONS = [
  { value: "sunny", label: "Sunny", emoji: "\u2600\uFE0F" },
  { value: "cloudy", label: "Cloudy", emoji: "\u2601\uFE0F" },
  { value: "rainy", label: "Rainy", emoji: "\u{1F327}\uFE0F" },
  { value: "snowy", label: "Snowy", emoji: "\u2744\uFE0F" },
  { value: "stormy", label: "Stormy", emoji: "\u26C8\uFE0F" },
  { value: "windy", label: "Windy", emoji: "\u{1F32C}\uFE0F" },
];

type ViewMode = "list" | "create" | "detail" | "edit";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCountry, setFilterCountry] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formMood, setFormMood] = useState("");
  const [formWeather, setFormWeather] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formIsPublic, setFormIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showMobileStats, setShowMobileStats] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (filterCountry) params.set("country", filterCountry);
      if (filterTag) params.set("tag", filterTag);
      const res = await fetch(`/api/journal?${params}`);
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [filterCountry, filterTag]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/journal/stats");
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchEntries(); fetchStats(); }, [fetchEntries, fetchStats]);

  function resetForm() {
    setFormTitle("");
    setFormContent("");
    setFormLocation("");
    setFormCountry("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormMood("");
    setFormWeather("");
    setFormTags("");
    setFormIsPublic(false);
  }

  function openCreate() {
    resetForm();
    setFormDate(new Date().toISOString().slice(0, 10));
    setView("create");
  }

  function openEdit(entry: JournalEntry) {
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormLocation(entry.location ?? "");
    setFormCountry(entry.country ?? "");
    setFormDate(entry.date ? entry.date.slice(0, 10) : "");
    setFormMood(entry.mood ?? "");
    setFormWeather(entry.weather ?? "");
    setFormTags(entry.tags.join(", "));
    setFormIsPublic(entry.isPublic);
    setSelected(entry);
    setView("edit");
  }

  function openDetail(entry: JournalEntry) {
    setSelected(entry);
    setView("detail");
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    setSaving(true);
    const payload = {
      title: formTitle,
      content: formContent,
      location: formLocation || null,
      country: formCountry || null,
      date: formDate || null,
      mood: formMood || null,
      weather: formWeather || null,
      tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
      isPublic: formIsPublic,
    };

    try {
      if (view === "edit" && selected) {
        await fetch(`/api/journal/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setView("list");
      fetchEntries();
      fetchStats();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/journal/${id}`, { method: "DELETE" });
    setView("list");
    fetchEntries();
    fetchStats();
  }

  function getMoodEmoji(mood: string | null): string {
    if (!mood) return "";
    return MOODS.find((m) => m.value === mood)?.emoji ?? "";
  }

  function getWeatherEmoji(weather: string | null): string {
    if (!weather) return "";
    return WEATHER_OPTIONS.find((w) => w.value === weather)?.emoji ?? "";
  }

  // ---- Render: Entry Form ----
  function renderForm() {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">
            {view === "edit" ? "Edit Entry" : "New Journal Entry"}
          </h2>
          <button onClick={() => setView("list")} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            Cancel
          </button>
        </div>

        <input
          type="text"
          placeholder="Entry title..."
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
        />

        <textarea
          placeholder="Write about your experience..."
          rows={8}
          value={formContent}
          onChange={(e) => setFormContent(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none resize-none"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Location</label>
            <input
              type="text"
              placeholder="e.g. Shibuya, Tokyo"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Country</label>
            <input
              type="text"
              placeholder="e.g. Japan"
              value={formCountry}
              onChange={(e) => setFormCountry(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        {/* Mood Selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">Mood</label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setFormMood(formMood === m.value ? "" : m.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  formMood === m.value
                    ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Weather Selector */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">Weather</label>
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setFormWeather(formWeather === w.value ? "" : w.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  formWeather === w.value
                    ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                }`}
              >
                {w.emoji} {w.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Tags (comma-separated)</label>
          <input
            type="text"
            placeholder="food, culture, scenery..."
            value={formTags}
            onChange={(e) => setFormTags(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        {/* Public sharing toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-200">Share publicly</div>
            <div className="text-xs text-slate-500">Anyone with the link can view this entry</div>
          </div>
          <button
            type="button"
            onClick={() => setFormIsPublic(!formIsPublic)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              formIsPublic ? "bg-amber-500" : "bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                formIsPublic ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !formTitle.trim()}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : view === "edit" ? "Update Entry" : "Save Entry"}
        </button>
      </div>
    );
  }

  // ---- Render: Entry Detail ----
  function renderDetail() {
    if (!selected) return null;
    return (
      <div className="mx-auto max-w-2xl p-4">
        <button onClick={() => setView("list")} className="mb-4 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">{selected.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {selected.date && <span>{new Date(selected.date).toLocaleDateString()}</span>}
                {selected.location && <span>- {selected.location}</span>}
                {selected.country && <span>- {selected.country}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selected.isPublic && (
                <ShareJournalButton entry={selected} />
              )}
              <button onClick={() => openEdit(selected)} className="rounded-lg px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10">
                Edit
              </button>
              <button onClick={() => setConfirmDelete(selected.id)} className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                Delete
              </button>
            </div>
          </div>

          {(selected.mood || selected.weather) && (
            <div className="mb-4 flex gap-3">
              {selected.mood && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                  {getMoodEmoji(selected.mood)} {selected.mood}
                </span>
              )}
              {selected.weather && (
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
                  {getWeatherEmoji(selected.weather)} {selected.weather}
                </span>
              )}
            </div>
          )}

          {/* Photos */}
          {selected.photos.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
              {selected.photos.map((photo, i) => (
                <div key={i} className={`overflow-hidden ${selected.photos.length === 1 ? "col-span-2" : ""}`}>
                  <img
                    src={photo}
                    alt={`Photo ${i + 1}`}
                    className="h-40 w-full object-cover rounded-lg"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {selected.content}
          </div>

          {selected.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {selected.trip && (
            <div className="mt-4 rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
              Linked to trip: {selected.trip.city}, {selected.trip.country}
            </div>
          )}

          {selected.isPublic && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              This entry is publicly shared. Anyone with the link can view it.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Render: Stats Sidebar ----
  function renderStats() {
    if (!stats) return null;
    return (
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Journal Stats</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.totalEntries}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Entries</div>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.totalCountries}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Countries</div>
          </div>
        </div>

        {stats.countriesVisited.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-slate-400">Countries</h4>
            <div className="flex flex-wrap gap-1">
              {stats.countriesVisited.map((c) => (
                <span key={c} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{c}</span>
              ))}
            </div>
          </div>
        )}

        {stats.topTags.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-slate-400">Top Tags</h4>
            <div className="space-y-1">
              {stats.topTags.slice(0, 5).map((t) => (
                <div key={t.tag} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">#{t.tag}</span>
                  <span className="text-slate-500">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.timeline.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-slate-400">Timeline</h4>
            <div className="space-y-1">
              {stats.timeline.slice(-6).map((t) => (
                <div key={t.month} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{t.month}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-amber-500/30" style={{ width: `${Math.min(t.count * 20, 80)}px` }}>
                      <div className="h-full rounded-full bg-amber-400" style={{ width: "100%" }} />
                    </div>
                    <span className="text-slate-500">{t.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Render: Entry List ----
  function renderList() {
    return (
      <div className="flex h-full flex-col lg:flex-row">
        {/* Main list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Travel Journal</h2>
              <button
                onClick={openCreate}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400"
              >
                + New Entry
              </button>
            </div>

            {/* Filters */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Filter by country..."
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Filter by tag..."
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none"
              />
            </div>

            {/* Mobile stats (collapsible) */}
            <div className="lg:hidden mb-3">
              <button onClick={() => setShowMobileStats(!showMobileStats)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={showMobileStats ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
                </svg>
                {stats ? `${stats.totalEntries} entries \u00b7 ${stats.totalCountries} countries` : "Stats"}
              </button>
              {showMobileStats && <div className="mt-2">{renderStats()}</div>}
            </div>

            {loading ? (
              <div className="space-y-3 p-4">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="h-4 w-2/3 rounded bg-slate-800 mb-2" />
                    <div className="h-3 w-1/3 rounded bg-slate-800/60 mb-3" />
                    <div className="h-3 w-full rounded bg-slate-800/40" />
                    <div className="h-3 w-4/5 rounded bg-slate-800/40 mt-1" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/80">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">No journal entries yet.</p>
                <p className="mt-1 text-xs text-slate-500">Start documenting your adventures!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => openDetail(entry)}
                    className="group w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
                          {getMoodEmoji(entry.mood)} {entry.title}
                        </h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          {entry.date && <span>{new Date(entry.date).toLocaleDateString()}</span>}
                          {entry.location && <span>- {entry.location}</span>}
                          {entry.weather && <span>{getWeatherEmoji(entry.weather)}</span>}
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1.5">
                        {entry.isPublic && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            Public
                          </span>
                        )}
                        {entry.country && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            {entry.country}
                          </span>
                        )}
                      </div>
                    </div>
                    {entry.content && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {entry.content}
                      </p>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-500">
                            #{tag}
                          </span>
                        ))}
                        {entry.tags.length > 4 && (
                          <span className="text-[10px] text-slate-600">+{entry.tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats sidebar (desktop only) */}
        <div className="hidden w-72 shrink-0 border-l border-slate-800 p-4 lg:block">
          {renderStats()}
        </div>
      </div>
    );
  }

  // ---- Main Render ----
  return (
    <div className="flex h-full flex-col bg-slate-950">
      {view === "list" && renderList()}
      {(view === "create" || view === "edit") && (
        <div className="flex-1 overflow-y-auto">{renderForm()}</div>
      )}
      {view === "detail" && (
        <div className="flex-1 overflow-y-auto">{renderDetail()}</div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-100 mb-2">Delete this entry?</h3>
            <p className="text-sm text-slate-400 mb-4">This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800">Cancel</button>
              <button onClick={() => { handleDelete(confirmDelete); setConfirmDelete(null); }} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
