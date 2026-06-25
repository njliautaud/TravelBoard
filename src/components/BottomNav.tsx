"use client";

import type { Panel } from "@/lib/types";
import { NAV_PILLARS, NavIcon } from "./navConfig";

interface BottomNavProps {
  panel: Panel;
  /** Tap a section: switch to it (and open its sheet); tapping the active one toggles. */
  onSelect: (panel: Panel) => void;
  /** Whether its content sheet is currently open (for active highlight). */
  sheetOpen: boolean;
  /** Hide Passport on a friend's board (editing is own-board only). */
  canEdit: boolean;
}

export default function BottomNav({ panel, onSelect, sheetOpen, canEdit }: BottomNavProps) {
  const items = canEdit ? NAV_PILLARS : NAV_PILLARS.filter((i) => i.panel !== "passport");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {items.map((item) => {
        const active = panel === item.panel && sheetOpen;
        const accentText = item.accent === "teal" ? "text-teal-300" : "text-amber-300";
        return (
          <button
            key={item.panel}
            onClick={() => onSelect(item.panel)}
            aria-label={item.short}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
              active ? accentText : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <NavIcon panel={item.panel} size={22} />
            {item.short}
          </button>
        );
      })}
    </nav>
  );
}
