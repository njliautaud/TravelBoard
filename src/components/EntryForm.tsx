"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftPrefill, GeocodeResult, LocationItem, MediaItem, MediaType, VisitStatus } from "@/lib/types";
import { cleanThumb, coverImageSrc } from "@/lib/thumb";
import { isDuplicateWish } from "@/lib/similarity";
import { isSocialUrl } from "@/lib/linkEnrichment";

export interface PinDropResult {
  latitude: number;
  longitude: number;
  geocode: GeocodeResult | null;
}

interface EntryFormProps {
  open: boolean;
  hidden: boolean; // kept mounted but visually hidden during pin-drop
  editing: LocationItem | null;
  draftPrefill?: DraftPrefill | null;
  draftId?: string | null;
  /** Existing wishes, used to warn before adding a likely duplicate. */
  existingLocations?: LocationItem[];
  pinDropResult: PinDropResult | null;
  onRequestPinDrop: () => void;
  onClose: () => void;
  onSaved: (opts?: { draftId?: string }) => void;
}

interface FormState {
  activityName: string;
  countryName: string;
  countryCode: string;
  region: string;
  city: string;
  latitude: string;
  longitude: string;
  status: VisitStatus;
  notes: string;
  reminderAt: string;
  priceThreshold: string;
  seasonSpring: boolean;
  seasonSummer: boolean;
  seasonFall: boolean;
  seasonWinter: boolean;
  coverImageUrl: string;
  media: MediaItem[];
}

const EMPTY: FormState = {
  activityName: "",
  countryName: "",
  countryCode: "",
  region: "",
  city: "",
  latitude: "",
  longitude: "",
  status: "TO_VISIT",
  notes: "",
  reminderAt: "",
  priceThreshold: "",
  seasonSpring: false,
  seasonSummer: false,
  seasonFall: false,
  seasonWinter: false,
  coverImageUrl: "",
  media: [],
};

function fromLocation(loc: LocationItem): FormState {
  return {
    activityName: loc.activityName,
    countryName: loc.countryName,
    countryCode: loc.countryCode,
    region: loc.region ?? "",
    city: loc.city ?? "",
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    status: loc.status,
    notes: loc.notes ?? "",
    reminderAt: loc.reminderAt ? loc.reminderAt.slice(0, 10) : "",
    priceThreshold: loc.priceThreshold !== null ? String(loc.priceThreshold) : "",
    seasonSpring: loc.seasonSpring,
    seasonSummer: loc.seasonSummer,
    seasonFall: loc.seasonFall,
    seasonWinter: loc.seasonWinter,
    coverImageUrl: loc.coverImageUrl ?? "",
    media: loc.media.map((m) => ({ ...m })),
  };
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus:outline-none";
const labelCls = "block text-xs font-medium text-slate-400 mb-1";
const amberBtnCls =
  "rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50";

type CoverOption = {
  url: string;
  previewUrl: string;
  source: "wikipedia" | "commons" | "google" | "instagram";
};

const SOURCE_LABEL: Record<CoverOption["source"], string> = {
  wikipedia: "Wikipedia",
  commons: "Wikimedia",
  google: "Google",
  instagram: "Instagram",
};

export default function EntryForm({
  open,
  hidden,
  editing,
  draftPrefill,
  draftId,
  existingLocations,
  pinDropResult,
  onRequestPinDrop,
  onClose,
  onSaved,
}: EntryFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichHint, setEnrichHint] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverOptions, setCoverOptions] = useState<CoverOption[]>([]);
  const [coverNote, setCoverNote] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverCandidateKeyRef = useRef("");

  // Reset when (re)opened
  useEffect(() => {
    if (open) {
      if (editing) {
        setForm(fromLocation(editing));
      } else if (draftPrefill) {
        setForm({
          ...EMPTY,
          activityName: draftPrefill.activityName ?? "",
          notes: draftPrefill.notes ?? "",
          coverImageUrl: draftPrefill.coverImageUrl ?? "",
          countryName: draftPrefill.countryName ?? "",
          countryCode: draftPrefill.countryCode ?? "",
          region: draftPrefill.region ?? "",
          city: draftPrefill.city ?? "",
          latitude: draftPrefill.latitude != null ? String(draftPrefill.latitude) : "",
          longitude: draftPrefill.longitude != null ? String(draftPrefill.longitude) : "",
          media: (draftPrefill.media ?? []).map((m, i) => ({ ...m, sortOrder: i })),
        });
      } else {
        setForm(EMPTY);
      }
      setQuery("");
      setResults([]);
      setError(null);
      setEnrichHint(null);
      coverCandidateKeyRef.current = "";
      setCoverOptions([]);
      setCoverNote(null);
    }
  }, [open, editing, draftPrefill]);

  const coverSearchKey = () =>
    [form.activityName, form.city, form.region, form.countryName]
      .map((s) => s.trim().toLowerCase())
      .join("|");

  // Drop cached candidates when the user edits activity or location fields.
  useEffect(() => {
    const key = coverSearchKey();
    if (coverCandidateKeyRef.current && coverCandidateKeyRef.current !== key) {
      coverCandidateKeyRef.current = "";
      setCoverOptions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.activityName, form.city, form.region, form.countryName]);

  // Analyze a social link (shared reel/post, or one pasted in Photos & links)
  // and smart-fill the form from its caption/thumbnail/location.
  const runEnrichment = useCallback(async (url: string, rawText: string) => {
    setEnriching(true);
    setError(null);
    setEnrichHint("Reading post caption, thumbnail, and location…");
    try {
      const params = new URLSearchParams({ url, rawText: rawText || url });
      const res = await fetch(`/api/drafts/enrich?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setEnrichHint("Couldn’t read post details — fill in manually");
        return;
      }

      const e = data.enrichment as {
        activityName?: string | null;
        notes?: string | null;
        thumbnailUrl?: string | null;
        coverImageUrl?: string | null;
        locationQuery?: string | null;
        geocode?: {
          displayName: string;
          latitude: number;
          longitude: number;
          countryCode: string | null;
          countryName: string | null;
          region: string | null;
          city: string | null;
        } | null;
      };

      setForm((f) => {
        const media = [...f.media];
        // Keep the reel still frame in the gallery.
        if (e.thumbnailUrl && !media.some((m) => m.url === e.thumbnailUrl)) {
          media.push({
            type: "IMAGE_URL",
            url: e.thumbnailUrl,
            caption: "Reel frame",
            sortOrder: media.length,
          });
        }
        // Default the cover to the reel's own thumbnail (same as "Set cover" on
        // that frame). We no longer auto-generate a Wikipedia/Google cover —
        // the user fills in details first, then can Generate/Regenerate.
        const cover = e.thumbnailUrl ?? f.coverImageUrl;
        return {
          ...f,
          activityName: e.activityName ?? f.activityName,
          notes: e.notes ?? f.notes,
          coverImageUrl: cover,
          countryName: e.geocode?.countryName ?? f.countryName,
          countryCode: e.geocode?.countryCode ?? f.countryCode,
          region: e.geocode?.region ?? f.region,
          city: e.geocode?.city ?? f.city,
          latitude: e.geocode ? String(e.geocode.latitude) : f.latitude,
          longitude: e.geocode ? String(e.geocode.longitude) : f.longitude,
          media: media.map((m, i) => ({ ...m, sortOrder: i })),
        };
      });

      if (e.geocode?.displayName) setQuery(e.geocode.displayName);
      setEnrichHint(
        e.geocode
          ? `Found location: ${e.geocode.displayName}`
          : e.locationQuery
            ? `Saw “${e.locationQuery}” but couldn’t pin it — search manually`
            : "Filled from post — add a location if needed"
      );
    } catch {
      setEnrichHint("Couldn’t read post details — fill in manually");
    } finally {
      setEnriching(false);
    }
  }, []);

  // Auto-run once when opening a prefilled "Add a place" form from a shared link.
  useEffect(() => {
    if (!open || editing || !draftPrefill?.enrichUrl) return;
    runEnrichment(draftPrefill.enrichUrl, draftPrefill.enrichRawText ?? "");
  }, [open, editing, draftPrefill?.enrichUrl, draftPrefill?.enrichRawText, runEnrichment]);

  // Apply coordinates coming back from pin-drop mode
  useEffect(() => {
    if (!pinDropResult) return;
    setForm((f) => ({
      ...f,
      latitude: pinDropResult.latitude.toFixed(5),
      longitude: pinDropResult.longitude.toFixed(5),
      countryName: pinDropResult.geocode?.countryName ?? f.countryName,
      countryCode: pinDropResult.geocode?.countryCode ?? f.countryCode,
      region: pinDropResult.geocode?.region ?? f.region,
      city: pinDropResult.geocode?.city ?? f.city,
    }));
  }, [pinDropResult]);

  // Debounced Nominatim search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pickResult = (r: GeocodeResult) => {
    setForm((f) => ({
      ...f,
      activityName: f.activityName || r.displayName.split(",")[0],
      countryName: r.countryName ?? f.countryName,
      countryCode: r.countryCode ?? f.countryCode,
      region: r.region ?? "",
      city: r.city ?? "",
      latitude: r.latitude.toFixed(5),
      longitude: r.longitude.toFixed(5),
    }));
    setResults([]);
    setQuery("");
  };

  const addMedia = (type: MediaType) => {
    if (type === "UPLOAD") {
      fileRef.current?.click();
      return;
    }
    const url = window.prompt(type === "IMAGE_URL" ? "Paste image URL" : "Paste link (Google Maps, Instagram, website...)");
    if (!url?.trim()) return;
    setForm((f) => ({
      ...f,
      media: [...f.media, { type, url: url.trim(), caption: null, sortOrder: f.media.length }],
    }));
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setForm((f) => ({
        ...f,
        media: [...f.media, { type: "UPLOAD", url: data.url, caption: null, sortOrder: f.media.length }],
      }));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeMedia = (idx: number) =>
    setForm((f) => {
      const removed = f.media[idx];
      const clearCover = removed && f.coverImageUrl === removed.url;
      return {
        ...f,
        media: f.media.filter((_, i) => i !== idx),
        coverImageUrl: clearCover ? "" : f.coverImageUrl,
      };
    });

  const clearCover = () => {
    setForm((f) => ({ ...f, coverImageUrl: "" }));
    setCoverOptions([]);
    setCoverNote(null);
    coverCandidateKeyRef.current = "";
  };

  const generateCover = async (forceRefresh = false) => {
    if (!form.activityName.trim()) {
      setError("Add an activity name before generating a cover image.");
      return;
    }
    setGeneratingCover(true);
    setError(null);
    setCoverNote(null);
    const key = coverSearchKey();
    try {
      // Google Images via Serper (cached server-side) — best for niche places.
      const query = [form.activityName, form.city, form.region, form.countryName]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
      const params = new URLSearchParams({ query, limit: "6" });
      if (forceRefresh) params.set("refresh", "1"); // Regenerate = fresh API pull
      const res = await fetch(`/api/fetch-previews?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Image search failed");

      const images = (data.images ?? []) as {
        imageUrl?: string;
        thumbnailUrl?: string | null;
        source?: string;
      }[];
      const options: CoverOption[] = images
        .filter((im): im is { imageUrl: string; thumbnailUrl?: string | null; source?: string } =>
          // Google results are absolute http(s); a captured IG cover is a
          // same-origin /api/stored-image path — accept both.
          typeof im.imageUrl === "string" && (im.imageUrl.startsWith("http") || im.imageUrl.startsWith("/")),
        )
        .map((im) => ({
          url: im.imageUrl,
          // Serper thumbnails are Google-hosted (gstatic) and proxy reliably for the picker.
          previewUrl: coverImageSrc(im.thumbnailUrl || im.imageUrl, 240) || im.imageUrl,
          source: im.source === "instagram" ? ("instagram" as const) : ("google" as const),
        }));

      if (options.length === 0) {
        setCoverOptions([]);
        setError("No images found — try a more specific activity or place name.");
        return;
      }
      coverCandidateKeyRef.current = key;
      setCoverOptions(options);
      setForm((f) => ({ ...f, coverImageUrl: options[0].url }));

      if (data.source === "placeholder") {
        setCoverNote("Showing placeholders — set SERPER_API_KEY in .env (line 20) for real Google Images.");
      } else if (data.match === "similar") {
        setCoverNote(
          `Reused images from a similar saved search (“${data.similarTo}”). Click Regenerate for a fresh Google search.`,
        );
      } else if (data.match === "exact") {
        setCoverNote("From cache (no API credit used). Click Regenerate for a fresh search.");
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setGeneratingCover(false);
    }
  };

  const pickCoverOption = (url: string) => setForm((f) => ({ ...f, coverImageUrl: url }));

  const setCaption = (idx: number, caption: string) =>
    setForm((f) => ({
      ...f,
      media: f.media.map((m, i) => (i === idx ? { ...m, caption: caption || null } : m)),
    }));

  const setCover = (url: string) => setForm((f) => ({ ...f, coverImageUrl: url }));

  const save = async () => {
    setError(null);
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!form.activityName.trim()) return setError("Activity name is required.");
    if (!form.countryName.trim() || !form.countryCode.trim())
      return setError("Country is required - use search or drop a pin.");
    if (Number.isNaN(lat) || Number.isNaN(lng))
      return setError("Coordinates are required - use search or drop a pin.");

    // Warn before adding what looks like a duplicate of an existing wish.
    if (!editing && existingLocations?.length) {
      const candidate = {
        activityName: form.activityName,
        city: form.city,
        region: form.region,
        countryName: form.countryName,
        countryCode: form.countryCode,
      };
      const dupe = existingLocations.find((l) => isDuplicateWish(candidate, l));
      if (dupe) {
        const proceed = window.confirm(
          `This looks like the same wish as one you already have:\n\n` +
            `“${dupe.activityName}” — ${[dupe.city, dupe.countryName].filter(Boolean).join(", ")}\n\n` +
            `Add it as a separate wish anyway?`,
        );
        if (!proceed) return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        activityName: form.activityName,
        countryName: form.countryName,
        countryCode: form.countryCode,
        region: form.region || null,
        city: form.city || null,
        latitude: lat,
        longitude: lng,
        status: form.status,
        notes: form.notes || null,
        reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : null,
        priceThreshold: form.priceThreshold ? parseFloat(form.priceThreshold) : null,
        seasonSpring: form.seasonSpring,
        seasonSummer: form.seasonSummer,
        seasonFall: form.seasonFall,
        seasonWinter: form.seasonWinter,
        coverImageUrl: form.coverImageUrl.trim() || null,
        media: form.media.map((m, i) => ({ type: m.type, url: m.url, caption: m.caption, sortOrder: i })),
      };
      const res = await fetch(editing ? `/api/locations/${editing.id}` : "/api/locations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(draftId ? { draftId } : undefined);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${hidden ? "hidden" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-scroll max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">
            {editing ? "Edit place" : "Add a place"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cover photo — top of form */}
        <div className="mb-4">
          <label className={labelCls}>Cover photo</label>
          {form.coverImageUrl ? (
            <div className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageSrc(form.coverImageUrl, 480)}
                alt=""
                className="mx-auto block h-auto max-h-96 w-auto max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 text-xs text-slate-500">
              No cover yet — generate options from Wikipedia &amp; Google (CC)
            </div>
          )}
          {coverOptions.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-slate-500">Pick a cover (tap to select):</p>
              <div className="grid grid-cols-3 gap-2">
                {coverOptions.map((opt) => {
                  const selected = form.coverImageUrl === opt.url;
                  const preview = opt.previewUrl || coverImageSrc(opt.url, 240) || opt.url;
                  return (
                    <button
                      key={opt.url}
                      type="button"
                      onClick={() => pickCoverOption(opt.url)}
                      className={`overflow-hidden rounded-lg border bg-slate-900/60 transition ${
                        selected
                          ? "border-amber-500 ring-2 ring-amber-500/40"
                          : "border-slate-700/70 hover:border-slate-500"
                      }`}
                    >
                      <div className="aspect-[4/3] bg-slate-800/80">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                      </div>
                      <span className="block truncate px-1 py-1 text-[10px] text-slate-500">
                        {SOURCE_LABEL[opt.source]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {coverNote && <p className="mt-2 text-xs text-violet-300">{coverNote}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generatingCover}
                onClick={() => generateCover(coverOptions.length > 0)}
                className={amberBtnCls}
              >
                {generatingCover
                  ? "Searching…"
                  : coverOptions.length > 0
                    ? "Regenerate (new search)"
                    : "Generate image"}
              </button>
              {form.coverImageUrl && (
                <button type="button" onClick={clearCover} className={amberBtnCls}>
                  Remove cover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Location search */}
        <div className="relative mb-4">
          <label className={labelCls}>Find a location (OpenStreetMap)</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "Hoh Rainforest" or "Mount Bromo"...'
              className={inputCls}
            />
            <button
              type="button"
              onClick={onRequestPinDrop}
              className={`shrink-0 ${amberBtnCls}`}
            >
              Drop pin on map
            </button>
          </div>
          {searching && <p className="mt-1 text-xs text-slate-500">Searching&hellip;</p>}
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
                  >
                    {r.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(enriching || enrichHint) && (
          <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
            {enriching ? "…" : "✓"} {enrichHint ?? "Reading post…"}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Activity name *</label>
            <input
              value={form.activityName}
              onChange={(e) => set("activityName", e.target.value)}
              placeholder="Hike the Hall of Mosses"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Country (major location) *</label>
            <input
              value={form.countryName}
              onChange={(e) => set("countryName", e.target.value)}
              placeholder="United States"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>State / region</label>
            <input
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
              placeholder="Washington"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>City (minor location)</label>
            <input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Forks"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/80 p-1">
              {(["TO_VISIT", "VISITED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                    form.status === s
                      ? s === "VISITED"
                        ? "bg-emerald-500/25 text-emerald-200"
                        : "bg-amber-500/25 text-amber-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "TO_VISIT" ? "To visit" : "Visited"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Country code (ISO-3)</label>
            <input
              value={form.countryCode}
              onChange={(e) => set("countryCode", e.target.value.toUpperCase())}
              placeholder="USA"
              maxLength={3}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes / journal</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="Why this place? Tips, season, memories..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Remind me on</label>
            <input
              type="date"
              value={form.reminderAt}
              onChange={(e) => set("reminderAt", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Flight deal threshold (USD)</label>
            <input
              type="number"
              min="0"
              value={form.priceThreshold}
              onChange={(e) => set("priceThreshold", e.target.value)}
              placeholder="650"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>When do you want to go?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["seasonSpring", "Spring", "Mar–May"],
                  ["seasonSummer", "Summer", "Jun–Aug"],
                  ["seasonFall", "Fall", "Sep–Nov"],
                  ["seasonWinter", "Winter", "Dec–Feb"],
                ] as const
              ).map(([key, label, range]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set(key, !form[key])}
                  className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                    form[key]
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                      : "border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="text-[10px] opacity-70">{range}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Media manager */}
        <div className="mt-4">
          <label className={labelCls}>Photos & links</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => addMedia("UPLOAD")}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload image"}
            </button>
            <button
              type="button"
              onClick={() => addMedia("IMAGE_URL")}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Paste image URL
            </button>
            <button
              type="button"
              onClick={() => addMedia("LINK")}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Paste link (Maps / Instagram / site)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
          {form.media.length > 0 && (
            <ul className="mt-2 space-y-2">
              {form.media.map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 p-2">
                  {m.type !== "LINK" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cleanThumb(m.url)} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="shrink-0 rounded bg-sky-500/15 px-2 py-1 text-[10px] font-medium text-sky-300">LINK</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{m.url}</span>
                  {m.type === "LINK" && isSocialUrl(m.url) && (
                    <button
                      type="button"
                      disabled={enriching}
                      onClick={() => runEnrichment(m.url, m.url)}
                      title="Analyze this link for a title, location, and cover"
                      className="shrink-0 rounded border border-violet-500/50 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                    >
                      {enriching ? "Analyzing…" : "Auto-generate"}
                    </button>
                  )}
                  {m.type !== "LINK" &&
                    (form.coverImageUrl === m.url ? (
                      <span className="shrink-0 rounded bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-300">Cover</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCover(m.url)}
                        className="shrink-0 rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:text-amber-300"
                      >
                        Set cover
                      </button>
                    ))}
                  <input
                    value={m.caption ?? ""}
                    onChange={(e) => setCaption(i, e.target.value)}
                    placeholder="caption"
                    className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 sm:w-32"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="shrink-0 rounded p-1 text-slate-500 hover:text-rose-400"
                    aria-label="Remove media"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Coordinates — bottom of form */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Latitude *</label>
            <input
              value={form.latitude}
              onChange={(e) => set("latitude", e.target.value)}
              placeholder="47.86070"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Longitude *</label>
            <input
              value={form.longitude}
              onChange={(e) => set("longitude", e.target.value)}
              placeholder="-123.93480"
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : editing ? "Save changes" : "Add place"}
          </button>
        </div>
      </div>
    </div>
  );
}
