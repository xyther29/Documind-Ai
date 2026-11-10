import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useRouter } from "../../lib/router";
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, isAuthenticated, loading: authLoading } = useAuth();
  const { navigate } = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-canvas text-slateText-primary"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-electric animate-spin" aria-hidden="true" />
          <span className="text-sm font-medium text-slateText-secondary">
            Validating password reset session...
          </span>
        </div>
      </div>
    );
  }

  // If not authenticated, the user arrived without exchanging a valid recovery code
  if (!isAuthenticated && !success) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-coral/10 text-coral mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Invalid or Expired Link
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              This password reset link is invalid, expired, or has already been used. Please request
              a fresh reset link to continue.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/forgot-password"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <span>Request New Link</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Password Updated
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              Your password has been changed successfully. You can now access your personal research vault.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer"
            >
              <span>Go to Notebook Vault</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Choose a New Password
          </h1>
          <p className="text-xs text-slateText-secondary">
            Set a new secure password for your DocuMind account (min. 8 characters).
          </p>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="reset-password"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                disabled={submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slateText-muted hover:text-slateText-secondary focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="reset-confirm-password"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Confirm New Password
            </label>
            <input
              id="reset-confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={submitting}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Password...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
