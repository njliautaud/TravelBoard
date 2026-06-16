"use client";

import { useCallback, useState } from "react";

interface ShareableEntry {
  id: string;
  title: string;
  content: string;
  location?: string | null;
  country?: string | null;
  date?: string | null;
}

/**
 * Share button for journal entries — WhatsApp, Instagram Story, Copy Link.
 * Uses native Web Share API on mobile, explicit buttons on desktop.
 */
export function ShareJournalButton({
  entry,
  className = "",
}: {
  entry: ShareableEntry;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/journal/${entry.id}`
    : `/journal/${entry.id}`;

  const shareText = [
    entry.title,
    entry.location && `${entry.location}${entry.country ? `, ${entry.country}` : ""}`,
    entry.content.slice(0, 100) + (entry.content.length > 100 ? "..." : ""),
  ]
    .filter(Boolean)
    .join(" — ");

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: entry.title, text: shareText, url: shareUrl });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setOpen(true);
      }
    } else {
      setOpen(true);
    }
  }, [entry.title, shareText, shareUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  }, [shareUrl]);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${entry.title}\n${shareUrl}`)}`;
  // Instagram doesn't support direct URL sharing via web — use clipboard + open Instagram
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${entry.title}`)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleNativeShare}
        title="Share this entry"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 ${className}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share
      </button>

      {/* Desktop share menu */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-green-500">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>

            {/* Instagram (copy link to share in Stories/DMs) */}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                window.open("https://instagram.com", "_blank");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-pink-500">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
              </svg>
              Instagram (copies link)
            </button>

            {/* Twitter/X */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Twitter / X
            </a>

            {/* Copy Link */}
            <button
              onClick={() => { handleCopy(); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
