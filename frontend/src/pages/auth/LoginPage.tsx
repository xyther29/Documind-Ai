import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useRouter, validateRedirectUrl } from "../../lib/router";
import { Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { signInWithPassword, isAuthenticated, isConfigured, loading: authLoading } = useAuth();
  const { getQueryParam, navigate } = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawRedirect = getQueryParam("redirect");
  const isExpired = getQueryParam("expired") === "true";
  const redirectTarget = validateRedirectUrl(rawRedirect, "/app");

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTarget);
    }
  }, [authLoading, isAuthenticated, redirectTarget, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signInWithPassword(cleanEmail, password);
      if (error) {
        setErrorMessage(error.message);
      } else {
        navigate(redirectTarget);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6">
        {/* Header Icon & Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Sign In to DocuMind
          </h1>
          <p className="text-xs text-slateText-secondary">
            Access your encrypted notebook vault and personal document partitions
          </p>
        </div>

        {/* Expired Session Notice */}
        {isExpired && (
          <div
            className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-start gap-2.5"
            role="status"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Your session has expired. Please sign in again to continue.</span>
          </div>
        )}

        {/* Unconfigured Notice */}
        {!isConfigured && (
          <div className="p-4 rounded-xl bg-tint border border-border text-left space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-navy">
              <Sparkles className="w-3.5 h-3.5 text-electric" />
              <span>Auth Service Offline</span>
            </div>
            <p className="text-xs text-slateText-secondary leading-relaxed">
              Supabase environment variables are unconfigured. You can explore the platform
              immediately with all capabilities active in the interactive guest demo.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1 text-xs font-bold text-electric hover:underline"
            >
              <span>Explore Interactive Guest Demo</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            className="p-3.5 rounded-xl bg-coral/10 border border-coral/20 text-coral text-xs flex items-start gap-2.5"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting || !isConfigured}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="researcher@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-electric hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={submitting || !isConfigured}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={submitting || !isConfigured}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slateText-muted hover:text-slateText-secondary focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-slateText-secondary gap-2">
          <span>Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="font-bold text-electric hover:underline inline-flex items-center gap-1"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
