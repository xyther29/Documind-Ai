import React from "react";
import { BookOpen, RefreshCw, HardDrive, ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../context/AuthContext";
import type { HealthResponse } from "../types/api";

interface HeaderProps {
  health: HealthResponse | null;
  loadingHealth: boolean;
  onRefreshHealth: () => void;
  mode?: "authenticated" | "guest";
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loadingHealth,
  onRefreshHealth,
  mode = "guest",
}) => {
  const isOnline = health?.status === "ok";
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <header className="h-14 bg-navy border-b border-border flex items-center justify-between px-4 sm:px-6 shadow-sm shrink-0 z-20">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition mr-1 sm:mr-2"
          title="Return to DocuMind AI Website"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back to Website</span>
        </Link>
        <div className="w-8 h-8 rounded bg-electric flex items-center justify-center text-white shadow-sm shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-white font-bold text-base tracking-tight">DocuMind AI</span>
          <span className="text-white/30 text-sm font-light hidden sm:inline">|</span>
          <span className="text-xs uppercase font-semibold tracking-wider text-tint bg-white/10 border border-white/20 px-2 py-0.5 rounded hidden sm:inline">
            {mode === "authenticated"
              ? "Personal Research Vault"
              : "Interactive Guest Demo"}
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
          <span className="font-medium text-slate-100 hidden sm:inline">
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

        <span className="text-white/30 hidden sm:inline" aria-hidden="true">·</span>

        {/* Mode-specific status & actions */}
        {mode === "authenticated" ? (
          <>
            <div
              className="hidden md:flex items-center gap-1.5 text-teal bg-white/5 border border-teal/20 px-2.5 py-1 rounded"
              title="User Partition Isolated under Row Level Security"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal" aria-hidden="true" />
              <span>Isolated Partition</span>
            </div>

            <div className="flex items-center gap-2 pl-1 border-l border-white/10">
              <div
                className="w-6 h-6 rounded-full bg-electric text-white flex items-center justify-center font-bold text-xs"
                title={user?.email || "Authenticated User"}
              >
                {userInitial}
              </div>
              <span className="text-slate-300 font-medium max-w-[140px] truncate hidden lg:inline">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Sign out of DocuMind"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="flex items-center gap-1.5 text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded"
              title="Guest session documents are held in memory during the active session"
            >
              <HardDrive className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
              <span>Guest Session</span>
            </div>

            <Link
              href="/signup"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold text-white bg-electric hover:bg-electric-hover transition shadow-xs"
            >
              <span>Create Account</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
};
