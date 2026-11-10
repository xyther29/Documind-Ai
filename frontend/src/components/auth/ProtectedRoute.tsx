import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePathname, navigate, Link } from "../../lib/router";
import { Lock, Sparkles, ArrowRight, Loader2 } from "lucide-react";

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading, isConfigured } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && isConfigured && !isAuthenticated) {
      const redirectTarget = `/login?redirect=${encodeURIComponent(pathname)}`;
      navigate(redirectTarget);
    }
  }, [loading, isConfigured, isAuthenticated, pathname]);

  // 1. Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-canvas text-slateText-primary"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-electric animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-slateText-secondary tracking-tight">
            Verifying your research vault session...
          </span>
        </div>
      </div>
    );
  }

  // 2. Unconfigured Supabase environment fallback
  if (!isConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-slateText-primary px-4 py-12">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-tint text-electric mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint text-xs font-mono font-semibold text-navy border border-border">
            <Sparkles className="w-3.5 h-3.5 text-electric" />
            <span>Auth Service Notice</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Supabase Auth Unconfigured
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              Real user authentication requires Supabase environment variables (
              <code className="text-xs font-mono text-electric bg-tint px-1.5 py-0.5 rounded">
                VITE_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="text-xs font-mono text-electric bg-tint px-1.5 py-0.5 rounded">
                VITE_SUPABASE_ANON_KEY
              </code>
              ).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-border text-left space-y-2">
            <p className="text-xs text-slateText-secondary leading-relaxed">
              You can explore all document ingestion, semantic chunking, and grounded citation features
              immediately using the unauthenticated guest demo.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <span>Launch Guest Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Not authenticated
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-canvas text-slateText-primary"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-electric animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-slateText-secondary">
            Redirecting to sign in...
          </span>
        </div>
      </div>
    );
  }

  // 4. Authenticated: render children
  return <>{children}</>;
};
