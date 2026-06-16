"use client";

import { useState } from "react";
import GamificationPanel from "./GamificationPanel";
import LoungeFinder from "./LoungeFinder";
import SocialBoards from "./SocialBoards";

type Section = "hub" | "boards" | "lounges" | "achievements";

interface SectionCard {
  id: Section;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SECTIONS: SectionCard[] = [
  {
    id: "boards",
    label: "Social Boards",
    description: "Share and vote on travel deals with others",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    id: "lounges",
    label: "Lounge Finder",
    description: "Find airport lounges and check your access options",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
        <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
      </svg>
    ),
  },
  {
    id: "achievements",
    label: "Achievements",
    description: "Track your travel milestones and earn badges",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </svg>
    ),
  },
];

export default function CommunityView() {
  const [activeSection, setActiveSection] = useState<Section>("hub");

  function renderSection() {
    switch (activeSection) {
      case "boards":
        return <SocialBoards />;
      case "lounges":
        return <LoungeFinder />;
      case "achievements":
        return <GamificationPanel />;
      default:
        return null;
    }
  }

  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label;

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          {activeSection !== "hub" && (
            <button
              onClick={() => setActiveSection("hub")}
              className="rounded p-1 text-slate-500 transition hover:text-slate-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {activeSection === "hub" ? "Community" : activeLabel}
            </h2>
            <p className="text-xs text-slate-500">
              {activeSection === "hub"
                ? "Social boards, lounges, and achievements"
                : "Part of the TravelBoard community"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {activeSection === "hub" ? (
          <div className="p-4">
            <div className="mx-auto max-w-lg">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-amber-500/30 hover:bg-slate-900/70"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/80 text-amber-400 transition group-hover:border-amber-500/30">
                      {section.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200">{section.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{section.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full">
            {renderSection()}
          </div>
        )}
      </div>
    </div>
  );
}
