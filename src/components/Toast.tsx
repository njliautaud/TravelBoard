"use client";
import { useState, useCallback } from "react";

interface ToastMsg { id: number; text: string; type: "success" | "error" }

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  function ToastContainer() {
    if (!toasts.length) return null;
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-lg animate-slide-up ${
            t.type === "success" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
          }`}>
            {t.text}
          </div>
        ))}
      </div>
    );
  }

  return { showToast, ToastContainer };
}
