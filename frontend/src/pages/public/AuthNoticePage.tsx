import React from "react";
import { Link, usePathname } from "../../lib/router";
import {
  Lock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export const AuthNoticePage: React.FC = () => {
  const pathname = usePathname();
  const isSignUp = pathname === "/signup";

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>

        {/* Milestone 2.2 Roadmap Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint text-xs font-mono font-semibold text-navy border border-border">
          <Sparkles className="w-3.5 h-3.5 text-electric" />
          <span>Milestone 2.2 Architecture Notice</span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            {isSignUp ? "Create Your Research Account" : "Welcome Back to DocuMind"}
          </h1>
          <p className="text-sm text-slateText-secondary leading-relaxed">
            Persistent user accounts and personal notebook libraries are slated for{" "}
            <strong>Milestone 2.2</strong> under Product Blueprint 2.0.
          </p>
        </div>

        {/* Live Demo Callout */}
        <div className="p-4 rounded-xl bg-canvas border border-border text-left space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-teal font-mono uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Open Access Demo Available</span>
          </div>
          <p className="text-xs text-slateText-secondary leading-relaxed">
            The current DocuMind AI demonstration workspace is open to everyone. You can upload PDFs,
            ask questions, and explore citation folios immediately without creating an account.
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-3 pt-2">
          <Link
            href="/app"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
          >
            <span>Launch Interactive Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slateText-secondary hover:text-navy hover:bg-tint transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Homepage</span>
          </Link>
        </div>

        {/* Future Capabilities Teaser */}
        <div className="pt-4 border-t border-border text-[11px] text-slateText-muted space-y-1">
          <div className="font-semibold text-slateText-secondary font-mono">Coming in Milestone 2.2:</div>
          <div>Supabase Authentication • Encrypted Personal Vaults • Row Level Security</div>
        </div>
      </div>
    </div>
  );
};
