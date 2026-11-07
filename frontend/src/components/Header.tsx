import React from "react";
import { BookOpen, RefreshCw, HardDrive } from "lucide-react";
import type { HealthResponse } from "../types/api";

interface HeaderProps {
  health: HealthResponse | null;
  loadingHealth: boolean;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loadingHealth,
  onRefreshHealth,
}) => {
  const isOnline = health?.status === "ok";

  return (
    <header className="h-14 bg-navy border-b border-border flex items-center justify-between px-6 shadow-sm shrink-0 z-20">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-electric flex items-center justify-center text-white shadow-sm">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-white font-bold text-base tracking-tight">DocuMind AI</span>
          <span className="text-white/30 text-sm font-light">|</span>
          <span className="text-xs uppercase font-semibold tracking-wider text-tint bg-white/10 border border-white/20 px-2 py-0.5 rounded">
            Student Workspace
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-200">
        {/* Backend Connectivity Badge */}
        <button
          type="button"
          onClick={onRefreshHealth}
          disabled={loadingHealth}
          title="Click to re-check backend connection"
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded transition focus-visible:outline-electric cursor-pointer"
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isOnline
                ? "bg-teal shadow-[0_0_0_3px_rgba(15,157,145,0.3)]"
                : "bg-coral shadow-[0_0_0_3px_rgba(232,117,104,0.3)]"
            }`}
            aria-hidden="true"
          />
          <span className="font-medium text-slate-100">
            {loadingHealth
              ? "Connecting..."
              : isOnline
              ? "Backend: Online"
              : "Backend: Offline"}
          </span>
          <RefreshCw
            className={`w-3 h-3 text-slate-300 ${loadingHealth ? "animate-spin text-electric" : ""}`}
            aria-hidden="true"
          />
        </button>

        <span className="text-white/30" aria-hidden="true">·</span>

        {/* Honest in-memory persistence notice */}
        <div
          className="flex items-center gap-1.5 text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded"
          title="Documents are kept in memory for this demo and reset on server restart"
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
          <span>In-Memory Session</span>
        </div>
      </div>
    </header>
  );
};
