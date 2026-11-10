import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useRouter } from "../../lib/router";
import { Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, CheckCircle2, Mail, Sparkles } from "lucide-react";

export const SignUpPage: React.FC = () => {
  const { signUp, isAuthenticated, isConfigured, loading: authLoading } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/app");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter an email address.");
      return;
    }
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
      const result = await signUp(cleanEmail, password);
      if (result.error) {
        setErrorMessage(result.error.message);
      } else if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        // Auto-confirmed / immediate session
        navigate("/app");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation email sent state
  if (confirmationSent) {
    return (
      <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 text-teal mx-auto flex items-center justify-center">
            <Mail className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-navy tracking-tight">
              Check Your Email
            </h1>
            <p className="text-sm text-slateText-secondary leading-relaxed">
              We&apos;ve sent a verification link to{" "}
              <strong className="text-slateText-primary font-semibold">{email}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-canvas border border-border text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-teal font-mono uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Next Steps</span>
            </div>
            <p className="text-xs text-slateText-secondary leading-relaxed">
              Click the link in the verification email to activate your account and access your personal
              research vault.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => setConfirmationSent(false)}
              className="text-xs text-slateText-secondary hover:text-navy cursor-pointer hover:underline"
            >
              Didn&apos;t receive it? Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-slateText-primary selection:bg-electric-subtle selection:text-electric justify-center items-center py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-electric-subtle text-electric mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-navy tracking-tight">
            Create Your Account
          </h1>
          <p className="text-xs text-slateText-secondary">
            Get your own encrypted research vault with isolated document storage
          </p>
        </div>

        {/* Unconfigured Notice */}
        {!isConfigured && (
          <div className="p-4 rounded-xl bg-tint border border-border text-left space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-navy">
              <Sparkles className="w-3.5 h-3.5 text-electric" />
              <span>Auth Service Offline</span>
            </div>
            <p className="text-xs text-slateText-secondary leading-relaxed">
              Supabase environment variables are unconfigured. You can explore all capabilities
              immediately using the interactive guest demo.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label
              htmlFor="signup-email"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Email Address
            </label>
            <input
              id="signup-email"
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
            <label
              htmlFor="signup-password"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Password (min. 8 characters)
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="block text-xs font-semibold text-slateText-primary uppercase tracking-wider"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={submitting || !isConfigured}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-canvas text-sm text-slateText-primary placeholder:text-slateText-muted focus:outline-none focus:ring-2 focus:ring-electric focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-electric hover:bg-electric-hover shadow-btn transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-slateText-secondary gap-2">
          <span>Already have an account?</span>
          <Link
            href="/login"
            className="font-bold text-electric hover:underline inline-flex items-center gap-1"
          >
            <span>Sign In</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
